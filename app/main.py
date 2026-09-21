from __future__ import annotations

import json
import os
import re
import sqlite3
import uuid
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Literal

from fastapi import FastAPI, HTTPException, Query
from fastapi.responses import FileResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from jsonschema import Draft202012Validator, FormatChecker
from pydantic import BaseModel, Field, model_validator

ROOT = Path(__file__).resolve().parents[1]
STATIC = ROOT / "app" / "static"
SCHEMA_PATH = ROOT / "schema" / "claim-record.schema.json"
DB_PATH = Path(os.environ.get("CLAIM_COMMONS_DB", str(ROOT / "data" / "claims.db")))
SEED_EXAMPLES = os.environ.get("CLAIM_COMMONS_SEED", "1") != "0"

SCHEMA = json.loads(SCHEMA_PATH.read_text(encoding="utf-8"))
VALIDATOR = Draft202012Validator(SCHEMA, format_checker=FormatChecker())

STATUS_FLOW: dict[str, set[str]] = {
    "deposited": {"evidence_complete", "challenged"},
    "evidence_complete": {"expert_checked", "challenged", "narrowed"},
    "expert_checked": {"independently_reproduced", "challenged", "narrowed", "superseded"},
    "independently_reproduced": {"challenged", "narrowed", "superseded"},
    "challenged": {"evidence_complete", "narrowed", "superseded"},
    "narrowed": {"evidence_complete", "expert_checked", "challenged", "superseded"},
    "superseded": set(),
}
ALLOWED_STATUSES = [
    "deposited",
    "evidence_complete",
    "expert_checked",
    "independently_reproduced",
    "challenged",
    "narrowed",
    "superseded",
]
STATUS_LABELS = {
    "deposited": "Deposited",
    "evidence_complete": "Evidence complete",
    "expert_checked": "Expert checked",
    "independently_reproduced": "Independently reproduced",
    "challenged": "Challenged",
    "narrowed": "Narrowed",
    "superseded": "Superseded",
}

HELIX_ID_ALIASES = {
    "adaptive-resource-allocation": "helical-research-framework-v1",
}


@asynccontextmanager
async def lifespan(_: FastAPI):
    init_db()
    seed_examples()
    yield


app = FastAPI(
    title="Claim Commons MVP",
    version="0.1.0",
    description="A minimal claim–evidence submission and review prototype.",
    lifespan=lifespan,
)
app.mount("/static", StaticFiles(directory=str(STATIC)), name="static")


class ReviewIn(BaseModel):
    reviewer_name: str = Field(default="Anonymous reviewer", min_length=1, max_length=200)
    outcome: str = Field(pattern=r"^(supports_as_scoped|supports_after_clarification|evidence_gap|contradicted|cannot_assess)$")
    comments: str = Field(min_length=3, max_length=5000)
    checklist: dict[str, bool] = Field(default_factory=dict)
    proposed_status: str | None = None


class StatusUpdateIn(BaseModel):
    status: str = Field(pattern=r"^(deposited|evidence_complete|expert_checked|independently_reproduced|challenged|narrowed|superseded)$")
    actor: str = Field(default="Reviewer", min_length=1, max_length=120)
    note: str = Field(default="", max_length=1000)


class RelationIn(BaseModel):
    predicate: str = Field(pattern=r"^(supports|contradicts|replicates|narrows|generalises|depends_on|supersedes)$")
    target: str = Field(min_length=3, max_length=500)
    note: str = Field(default="", max_length=1000)
    target_record_version: int | None = Field(default=None, ge=1)


class HelixPlacementIn(BaseModel):
    primary_column: Literal["experiment", "theory", "algorithm", "agent"]
    bridge_type: Literal[
        "experiment_to_theory",
        "theory_to_algorithm",
        "algorithm_to_agent",
        "agent_to_experiment",
    ] | None = None
    placement_role: Literal["node", "bridge_evidence", "return_prediction", "revision"]
    generation: int = Field(default=0, ge=0)
    helix_id: str = Field(min_length=1, max_length=120)
    primary_cluster_id: str = Field(min_length=1, max_length=120)
    secondary_topic_ids: list[str] = Field(default_factory=list, max_length=50)
    rationale: str = Field(min_length=1, max_length=3000)
    classification_method: Literal["human", "auto"]
    confidence: float = Field(ge=0, le=1)
    completion_status: Literal["candidate", "confirmed"] = "candidate"
    confirmation_note: str = Field(default="", max_length=2000)

    @model_validator(mode="after")
    def validate_area_contract(self) -> "HelixPlacementIn":
        connection_roles = {"bridge_evidence", "return_prediction"}
        bridge_columns = {
            "experiment_to_theory": "experiment",
            "theory_to_algorithm": "theory",
            "algorithm_to_agent": "algorithm",
            "agent_to_experiment": "agent",
        }
        if self.bridge_type is None and self.placement_role in connection_roles:
            raise ValueError("A pillar area cannot use a connection-only placement role.")
        if self.bridge_type is not None and self.placement_role == "node":
            raise ValueError("A connection area requires bridge_evidence, return_prediction, or revision role.")
        if self.bridge_type is not None and self.primary_column != bridge_columns[self.bridge_type]:
            raise ValueError("primary_column must match the source domain of bridge_type.")
        if self.placement_role == "return_prediction" and self.bridge_type != "agent_to_experiment":
            raise ValueError("return_prediction is reserved for the agent_to_experiment area.")
        if self.completion_status == "confirmed":
            if self.classification_method != "human":
                raise ValueError("Area completion requires human review.")
            if len(self.confirmation_note.strip()) < 10:
                raise ValueError("Confirmed area completion requires a review note of at least 10 characters.")
        return self


# ---------------------------------------------------------
# database + validation helpers
# ---------------------------------------------------------

def utc_now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def connect() -> sqlite3.Connection:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


def init_db() -> None:
    with connect() as conn:
        conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS claims (
                claim_id TEXT NOT NULL,
                version INTEGER NOT NULL,
                title TEXT NOT NULL,
                statement TEXT NOT NULL,
                claim_type TEXT NOT NULL,
                claim_strength TEXT NOT NULL,
                status TEXT NOT NULL,
                created_at TEXT NOT NULL,
                record_json TEXT NOT NULL,
                PRIMARY KEY (claim_id, version)
            );

            CREATE TABLE IF NOT EXISTS reviews (
                review_id INTEGER PRIMARY KEY AUTOINCREMENT,
                claim_id TEXT NOT NULL,
                claim_version INTEGER NOT NULL,
                reviewer_name TEXT NOT NULL,
                outcome TEXT NOT NULL,
                comments TEXT NOT NULL,
                checklist_json TEXT NOT NULL,
                created_at TEXT NOT NULL,
                FOREIGN KEY (claim_id, claim_version)
                    REFERENCES claims(claim_id, version)
                    ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS claim_status_history (
                status_id INTEGER PRIMARY KEY AUTOINCREMENT,
                claim_id TEXT NOT NULL,
                claim_version INTEGER NOT NULL,
                status TEXT NOT NULL,
                actor TEXT NOT NULL,
                note TEXT NOT NULL,
                created_at TEXT NOT NULL,
                FOREIGN KEY (claim_id, claim_version)
                    REFERENCES claims(claim_id, version)
                    ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS helix_placements (
                claim_id TEXT NOT NULL,
                claim_version INTEGER NOT NULL,
                primary_column TEXT NOT NULL
                    CHECK (primary_column IN ('experiment', 'theory', 'algorithm', 'agent')),
                bridge_type TEXT
                    CHECK (
                        bridge_type IS NULL OR bridge_type IN (
                            'experiment_to_theory',
                            'theory_to_algorithm',
                            'algorithm_to_agent',
                            'agent_to_experiment'
                        )
                    ),
                placement_role TEXT NOT NULL
                    CHECK (placement_role IN ('node', 'bridge_evidence', 'return_prediction', 'revision')),
                generation INTEGER NOT NULL CHECK (generation >= 0),
                helix_id TEXT NOT NULL,
                primary_cluster_id TEXT NOT NULL,
                secondary_topic_ids_json TEXT NOT NULL,
                rationale TEXT NOT NULL,
                classification_method TEXT NOT NULL
                    CHECK (classification_method IN ('human', 'auto')),
                confidence REAL NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
                completion_status TEXT NOT NULL DEFAULT 'candidate'
                    CHECK (completion_status IN ('candidate', 'confirmed')),
                confirmation_note TEXT NOT NULL DEFAULT '',
                updated_at TEXT NOT NULL,
                PRIMARY KEY (claim_id, claim_version),
                FOREIGN KEY (claim_id, claim_version)
                    REFERENCES claims(claim_id, version)
                    ON DELETE CASCADE
            );

            CREATE INDEX IF NOT EXISTS idx_helix_placements_claim
                ON helix_placements (claim_id, claim_version DESC);
            CREATE INDEX IF NOT EXISTS idx_helix_placements_framework
                ON helix_placements (helix_id, primary_cluster_id, generation);
            """
        )
        placement_columns = {row["name"] for row in conn.execute("PRAGMA table_info(helix_placements)").fetchall()}
        if "completion_status" not in placement_columns:
            conn.execute(
                "ALTER TABLE helix_placements ADD COLUMN completion_status TEXT NOT NULL DEFAULT 'candidate' "
                "CHECK (completion_status IN ('candidate', 'confirmed'))"
            )
        if "confirmation_note" not in placement_columns:
            conn.execute("ALTER TABLE helix_placements ADD COLUMN confirmation_note TEXT NOT NULL DEFAULT ''")
        conn.execute(
            "UPDATE helix_placements SET helix_id=? WHERE helix_id=?",
            (HELIX_ID_ALIASES["adaptive-resource-allocation"], "adaptive-resource-allocation"),
        )


def helix_placement_from_row(row: sqlite3.Row) -> dict[str, Any]:
    return {
        "placement_version": row["claim_version"],
        "primary_column": row["primary_column"],
        "bridge_type": row["bridge_type"],
        "placement_role": row["placement_role"],
        "generation": row["generation"],
        "helix_id": row["helix_id"],
        "primary_cluster_id": row["primary_cluster_id"],
        "secondary_topic_ids": json.loads(row["secondary_topic_ids_json"]),
        "rationale": row["rationale"],
        "classification_method": row["classification_method"],
        "confidence": row["confidence"],
        "completion_status": row["completion_status"],
        "confirmation_note": row["confirmation_note"],
        "updated_at": row["updated_at"],
    }


def helix_claim_summary(row: sqlite3.Row) -> dict[str, Any]:
    return {
        "claim_id": row["claim_id"],
        "current_version": row["current_version"],
        "title": row["title"],
        "statement": row["statement"],
        "claim_type": row["claim_type"],
        "claim_strength": row["claim_strength"],
        "status": row["status"],
        "claim_created_at": row["created_at"],
    }


def schema_errors(record: dict[str, Any]) -> list[str]:
    errors = sorted(VALIDATOR.iter_errors(record), key=lambda e: list(e.absolute_path))
    formatted: list[str] = []
    for error in errors:
        path = ".".join(str(x) for x in error.absolute_path) or "$"
        formatted.append(f"{path}: {error.message}")
    return formatted


HYPE_PATTERNS = {
    "breakthrough": r"\b(breakthrough|revolutionary|transformative|game[- ]changing)\b",
    "universal": r"\b(universal|all systems|always|never)\b",
    "priority": r"\b(first ever|for the first time|unprecedented)\b",
    "proof-language": r"\b(prove[sd]?|proof of)\b",
    "mechanism-language": r"\b(the mechanism|mechanistically establishes|causes)\b",
}


def hygiene_warnings(record: dict[str, Any]) -> list[str]:
    warnings: list[str] = []
    claim = record.get("claim", {})
    statement = str(claim.get("statement", ""))
    ctype = claim.get("type")
    strength = claim.get("strength")
    # Interpretation is intentionally outside the validated claim. It may be
    # ambitious; hygiene checks should police only the title and claim itself.
    text = " ".join([str(record.get("title", "")), statement])

    for label, pattern in HYPE_PATTERNS.items():
        if re.search(pattern, text, flags=re.IGNORECASE):
            warnings.append(f"Language check ({label}): verify that the wording is required by the evidence.")

    if statement.lower().count(" and ") > 2:
        warnings.append("The primary claim contains several 'and' clauses; consider splitting it into atomic records.")
    if strength == "general" and not claim.get("generality_axes"):
        warnings.append("A general claim should name the independent axes over which generality was tested.")
    if strength == "causal" and ctype not in {"causal", "methodological"}:
        warnings.append("Claim strength is causal, but the selected claim type is not causal; check the evidence contract.")
    if strength == "mechanistic" and not record.get("alternatives"):
        warnings.append("A mechanistic claim should identify serious alternative explanations.")
    if strength == "theorem":
        artifacts = [a for e in record.get("evidence", []) for a in e.get("artifacts", [])]
        if not any(a.get("kind") == "proof" for a in artifacts):
            warnings.append("A theorem-level record should include an inspectable proof artifact.")
    if ctype != "mathematical" and re.search(r"\bprove[sd]?\b", statement, flags=re.IGNORECASE):
        warnings.append("Empirical and computational records normally support rather than prove a claim.")
    if not record.get("non_claims"):
        warnings.append("Add at least one explicit non-claim to prevent predictable overinterpretation.")
    return warnings


def normalize_record(record: dict[str, Any]) -> dict[str, Any]:
    record = json.loads(json.dumps(record))
    provenance = record.setdefault("provenance", {})
    provenance.setdefault("created_at", utc_now())
    provenance.setdefault("record_version", "0.1.0")
    provenance.setdefault("license", "CC-BY-4.0")
    if record.get("interpretation") and "label" not in record["interpretation"]:
        record["interpretation"]["label"] = "not_part_of_validated_claim"
    record.setdefault("relations", [])
    return record


def _coerce_status(status: str | None) -> str:
    if status not in ALLOWED_STATUSES:
        raise HTTPException(status_code=422, detail=f"Unsupported status: {status}")
    return status


def can_transition(current_status: str, next_status: str) -> bool:
    if current_status == next_status:
        return True
    return next_status in STATUS_FLOW.get(current_status, set())


def status_from_db(claim_id: str, claim_version: int, conn: sqlite3.Connection) -> str:
    row = conn.execute(
        """
        SELECT status
        FROM claim_status_history
        WHERE claim_id=? AND claim_version=?
        ORDER BY created_at DESC, status_id DESC
        LIMIT 1
        """,
        (claim_id, claim_version),
    ).fetchone()
    if row:
        return row["status"]
    fallback = conn.execute(
        "SELECT status FROM claims WHERE claim_id=? AND version=?",
        (claim_id, claim_version),
    ).fetchone()
    return fallback["status"] if fallback else "deposited"


def record_status_event(conn: sqlite3.Connection, claim_id: str, claim_version: int, status: str, actor: str, note: str) -> None:
    conn.execute(
        """
        INSERT INTO claim_status_history
            (claim_id, claim_version, status, actor, note, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
        """,
        (claim_id, claim_version, status, actor, note, utc_now()),
    )


def insert_claim_version(
    claim_id: str,
    version: int,
    record: dict[str, Any],
    status: str,
    actor: str,
    note: str,
    *,
    seed: bool = False,
) -> dict[str, Any]:
    with connect() as conn:
        conn.execute(
            """
            INSERT INTO claims
                (claim_id, version, title, statement, claim_type, claim_strength, status, created_at, record_json)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                claim_id,
                version,
                record["title"],
                record["claim"]["statement"],
                record["claim"]["type"],
                record["claim"]["strength"],
                status,
                utc_now(),
                json.dumps(record, ensure_ascii=False),
            ),
        )
        record_status_event(conn, claim_id, version, status, actor=actor, note=note)
    return {
        "claim_id": claim_id,
        "version": version,
        "status": status,
        "warnings": hygiene_warnings(record),
        "seeded": seed,
    }


def create_claim(record: dict[str, Any], *, seed: bool = False) -> dict[str, Any]:
    record = normalize_record(record)
    errors = schema_errors(record)
    if errors:
        raise HTTPException(status_code=422, detail={"errors": errors, "warnings": hygiene_warnings(record)})

    claim_id = record.pop("claim_id", None) or f"ccr-{datetime.now(timezone.utc):%Y%m%d}-{uuid.uuid4().hex[:8]}"
    version = 1
    status = "deposited"
    created = insert_claim_version(
        claim_id=claim_id,
        version=version,
        record=record,
        status=status,
        actor="system" if seed else "author",
        note="initial deposit",
        seed=seed,
    )
    return created


def seed_examples() -> None:
    if not SEED_EXAMPLES:
        return
    with connect() as conn:
        count = conn.execute("SELECT COUNT(*) AS n FROM claims").fetchone()["n"]
    if count:
        return
    for path in sorted((ROOT / "examples").glob("*.json")):
        record = json.loads(path.read_text(encoding="utf-8"))
        create_claim(record, seed=True)


@app.get("/", include_in_schema=False)
def index() -> FileResponse:
    return FileResponse(STATIC / "index.html")


@app.get("/helix", include_in_schema=False)
def helical_framework() -> RedirectResponse:
    return RedirectResponse(url="/static/helix.html")


# Public Research Atlas pages intentionally share one renderer.  The profile
# slug selects data from the static registry; it never selects a bespoke page.
RESEARCH_PROFILE_SLUGS = frozenset(
    {"mia", "tim-vogels", "yuguo-yu", "michael-hausser"}
)


def research_profile_template(profile_slug: str) -> FileResponse:
    if profile_slug not in RESEARCH_PROFILE_SLUGS:
        raise HTTPException(status_code=404, detail="Research profile not found.")
    return FileResponse(STATIC / "research-profile.html")


@app.get("/research/{profile_slug}", include_in_schema=False)
def research_profile(profile_slug: str) -> FileResponse:
    return research_profile_template(profile_slug)

@app.get("/research-profile-pipeline", include_in_schema=False)
def research_profile_pipeline_docs() -> FileResponse:
    return FileResponse(ROOT / "docs" / "RESEARCH_PROFILE_PIPELINE_v0.1.md")


@app.get("/topic/{topic_slug}", include_in_schema=False)
def topic_profile(topic_slug: str) -> FileResponse:
    del topic_slug
    return FileResponse(STATIC / "research-profile.html")


@app.get("/mia", include_in_schema=False)
def mia_atlas() -> FileResponse:
    return research_profile_template("mia")


@app.get("/tim-vogels", include_in_schema=False)
def tim_vogels_atlas() -> FileResponse:
    return research_profile_template("tim-vogels")


@app.get("/yuguo-yu", include_in_schema=False)
def yuguo_yu_atlas() -> FileResponse:
    return research_profile_template("yuguo-yu")


@app.get("/michael-hausser", include_in_schema=False)
def michael_hausser_atlas() -> FileResponse:
    return research_profile_template("michael-hausser")


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok", "version": "0.1.0"}


@app.get("/api/schema")
def get_schema() -> dict[str, Any]:
    return SCHEMA


@app.get("/api/statuses")
def get_statuses() -> dict[str, list[dict[str, str]]]:
    return {"statuses": [{"value": s, "label": STATUS_LABELS[s]} for s in ALLOWED_STATUSES]}


@app.get("/api/claims/{claim_id}/status-options")
def status_options(claim_id: str) -> dict[str, Any]:
    with connect() as conn:
        row = conn.execute(
            "SELECT version, status FROM claims WHERE claim_id=? ORDER BY version DESC LIMIT 1",
            (claim_id,),
        ).fetchone()
        if row is None:
            raise HTTPException(status_code=404, detail="Claim not found")
    current_status = row["status"]
    allowed = sorted(STATUS_FLOW.get(current_status, set()))
    return {
        "claim_id": claim_id,
        "claim_version": row["version"],
        "current_status": current_status,
        "allowed_next_statuses": allowed,
        "all_statuses": [
            {"value": s, "label": STATUS_LABELS[s]}
            for s in ALLOWED_STATUSES
        ],
    }


@app.get("/api/dashboard")
def dashboard() -> dict[str, Any]:
    with connect() as conn:
        total_records = conn.execute("SELECT COUNT(DISTINCT claim_id) AS n FROM claims").fetchone()["n"]
        by_status_rows = conn.execute(
            """
            SELECT c.status AS status, COUNT(*) AS count
            FROM claims c
            JOIN (
                SELECT claim_id, MAX(version) AS v
                FROM claims
                GROUP BY claim_id
            ) latest ON latest.claim_id = c.claim_id AND latest.v = c.version
            GROUP BY c.status
            ORDER BY c.status
            """
        ).fetchall()
        by_type_rows = conn.execute(
            """
            SELECT c.claim_type AS t, COUNT(*) AS count
            FROM claims c
            JOIN (
                SELECT claim_id, MAX(version) AS v
                FROM claims
                GROUP BY claim_id
            ) latest ON latest.claim_id = c.claim_id AND latest.v = c.version
            GROUP BY c.claim_type
            ORDER BY c.claim_type
            """
        ).fetchall()
    return {
        "total_records": total_records,
        "by_status": {row["status"]: row["count"] for row in by_status_rows},
        "by_type": {row["t"]: row["count"] for row in by_type_rows},
    }


@app.get("/api/helix/placements")
def list_helix_placements(
    helix_id: str | None = Query(default=None, min_length=1, max_length=120),
) -> dict[str, Any]:
    helix_id = HELIX_ID_ALIASES.get(helix_id, helix_id)
    with connect() as conn:
        claims = conn.execute(
            """
            SELECT c.claim_id,
                   c.version AS current_version,
                   c.title,
                   c.statement,
                   c.claim_type,
                   c.claim_strength,
                   c.status,
                   c.created_at
            FROM claims c
            JOIN (
                SELECT claim_id, MAX(version) AS version
                FROM claims
                GROUP BY claim_id
            ) latest ON latest.claim_id=c.claim_id AND latest.version=c.version
            ORDER BY c.created_at DESC, c.claim_id
            """
        ).fetchall()
        if helix_id:
            placement_rows = conn.execute(
                """
                SELECT hp.*
                FROM helix_placements hp
                JOIN (
                    SELECT claim_id, MAX(claim_version) AS claim_version
                    FROM helix_placements
                    WHERE helix_id=?
                    GROUP BY claim_id
                ) latest
                  ON latest.claim_id=hp.claim_id
                 AND latest.claim_version=hp.claim_version
                WHERE hp.helix_id=?
                """,
                (helix_id, helix_id),
            ).fetchall()
        else:
            placement_rows = conn.execute(
                """
                SELECT hp.*
                FROM helix_placements hp
                JOIN (
                    SELECT claim_id, MAX(claim_version) AS claim_version
                    FROM helix_placements
                    GROUP BY claim_id
                ) latest
                  ON latest.claim_id=hp.claim_id
                 AND latest.claim_version=hp.claim_version
                """
            ).fetchall()

    latest_placements = {row["claim_id"]: row for row in placement_rows}
    assigned: list[dict[str, Any]] = []
    unassigned: list[dict[str, Any]] = []
    for claim in claims:
        item = helix_claim_summary(claim)
        placement_row = latest_placements.get(claim["claim_id"])
        placement = helix_placement_from_row(placement_row) if placement_row else None
        is_current = bool(placement and placement["placement_version"] == claim["current_version"])
        item["is_current"] = is_current
        if is_current:
            item.update(placement)
            assigned.append(item)
        else:
            item["placement_version"] = placement["placement_version"] if placement else None
            item["stale_placement"] = placement
            unassigned.append(item)

    return {
        "assigned": assigned,
        "unassigned": unassigned,
        "counts": {"assigned": len(assigned), "unassigned": len(unassigned)},
    }


@app.put("/api/helix/placements/{claim_id}")
def put_helix_placement(claim_id: str, placement: HelixPlacementIn) -> dict[str, Any]:
    updated_at = utc_now()
    values = placement.model_dump()
    values["helix_id"] = HELIX_ID_ALIASES.get(values["helix_id"], values["helix_id"])
    with connect() as conn:
        claim = conn.execute(
            """
            SELECT claim_id,
                   version AS current_version,
                   title,
                   statement,
                   claim_type,
                   claim_strength,
                   status,
                   created_at
            FROM claims
            WHERE claim_id=?
            ORDER BY version DESC
            LIMIT 1
            """,
            (claim_id,),
        ).fetchone()
        if claim is None:
            raise HTTPException(status_code=404, detail="Claim not found")

        existing = conn.execute(
            "SELECT * FROM helix_placements WHERE claim_id=? AND claim_version=?",
            (claim_id, claim["current_version"]),
        ).fetchone()
        if existing is not None and existing["completion_status"] == "confirmed" and values["completion_status"] == "confirmed":
            location_changed = any(
                [
                    existing["primary_column"] != values["primary_column"],
                    existing["bridge_type"] != values["bridge_type"],
                    existing["placement_role"] != values["placement_role"],
                    existing["generation"] != values["generation"],
                    existing["helix_id"] != values["helix_id"],
                    existing["primary_cluster_id"] != values["primary_cluster_id"],
                ]
            )
            if location_changed:
                raise HTTPException(
                    status_code=409,
                    detail="Reclassification invalidates completion. Save the new placement as candidate before confirming it.",
                )

        conn.execute(
            """
            INSERT INTO helix_placements (
                claim_id,
                claim_version,
                primary_column,
                bridge_type,
                placement_role,
                generation,
                helix_id,
                primary_cluster_id,
                secondary_topic_ids_json,
                rationale,
                classification_method,
                confidence,
                completion_status,
                confirmation_note,
                updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(claim_id, claim_version) DO UPDATE SET
                primary_column=excluded.primary_column,
                bridge_type=excluded.bridge_type,
                placement_role=excluded.placement_role,
                generation=excluded.generation,
                helix_id=excluded.helix_id,
                primary_cluster_id=excluded.primary_cluster_id,
                secondary_topic_ids_json=excluded.secondary_topic_ids_json,
                rationale=excluded.rationale,
                classification_method=excluded.classification_method,
                confidence=excluded.confidence,
                completion_status=excluded.completion_status,
                confirmation_note=excluded.confirmation_note,
                updated_at=excluded.updated_at
            """,
            (
                claim_id,
                claim["current_version"],
                values["primary_column"],
                values["bridge_type"],
                values["placement_role"],
                values["generation"],
                values["helix_id"],
                values["primary_cluster_id"],
                json.dumps(values["secondary_topic_ids"], ensure_ascii=False),
                values["rationale"],
                values["classification_method"],
                values["confidence"],
                values["completion_status"],
                values["confirmation_note"],
                updated_at,
            ),
        )

    return {
        **helix_claim_summary(claim),
        **values,
        "placement_version": claim["current_version"],
        "is_current": True,
        "updated_at": updated_at,
    }


@app.post("/api/validate")
def validate_record(record: dict[str, Any]) -> dict[str, Any]:
    record = normalize_record(record)
    errors = schema_errors(record)
    return {"valid": not errors, "errors": errors, "warnings": hygiene_warnings(record)}


@app.post("/api/claims", status_code=201)
def post_claim(record: dict[str, Any]) -> dict[str, Any]:
    return create_claim(record)


@app.get("/api/claims")
def list_claims(
    q: str | None = Query(default=None, max_length=200),
    claim_type: str | None = Query(default=None, max_length=100),
    status: str | None = Query(default=None, max_length=100),
    limit: int = Query(default=100, ge=1, le=500),
) -> list[dict[str, Any]]:
    if status and status not in ALLOWED_STATUSES:
        raise HTTPException(status_code=422, detail="Unsupported status filter")

    where: list[str] = []
    params: list[Any] = []
    if q:
        where.append("(c.title LIKE ? OR c.statement LIKE ?)")
        params.extend([f"%{q}%", f"%{q}%"])
    if claim_type:
        where.append("c.claim_type = ?")
        params.append(claim_type)
    if status:
        where.append("c.status = ?")
        params.append(status)
    where_sql = "WHERE " + " AND ".join(where) if where else ""

    sql = f"""
        SELECT c.*,
               (SELECT COUNT(*) FROM reviews r WHERE r.claim_id=c.claim_id AND r.claim_version=c.version) AS review_count
        FROM claims c
        JOIN (
            SELECT claim_id, MAX(version) AS version
            FROM claims
            GROUP BY claim_id
        ) latest ON latest.claim_id=c.claim_id AND latest.version=c.version
        {where_sql}
        ORDER BY c.created_at DESC
        LIMIT ?
    """
    params.append(limit)
    with connect() as conn:
        rows = conn.execute(sql, params).fetchall()
    return [
        {
            "claim_id": row["claim_id"],
            "version": row["version"],
            "title": row["title"],
            "statement": row["statement"],
            "claim_type": row["claim_type"],
            "claim_strength": row["claim_strength"],
            "status": row["status"],
            "created_at": row["created_at"],
            "review_count": row["review_count"],
        }
        for row in rows
    ]


@app.get("/api/claims/{claim_id}")
def get_claim(claim_id: str, version: int | None = None) -> dict[str, Any]:
    with connect() as conn:
        if version is None:
            row = conn.execute(
                "SELECT * FROM claims WHERE claim_id=? ORDER BY version DESC LIMIT 1", (claim_id,)
            ).fetchone()
        else:
            row = conn.execute(
                "SELECT * FROM claims WHERE claim_id=? AND version=?", (claim_id, version)
            ).fetchone()
        if row is None:
            raise HTTPException(status_code=404, detail="Claim not found")

        reviews = conn.execute(
            "SELECT * FROM reviews WHERE claim_id=? AND claim_version=? ORDER BY created_at DESC",
            (claim_id, row["version"]),
        ).fetchall()
        versions = conn.execute(
            "SELECT version, created_at FROM claims WHERE claim_id=? ORDER BY version DESC", (claim_id,)
        ).fetchall()
        status_history = conn.execute(
            """
            SELECT status_id, status, actor, note, created_at
            FROM claim_status_history
            WHERE claim_id=? AND claim_version=?
            ORDER BY created_at DESC, status_id DESC
            """,
            (claim_id, row["version"]),
        ).fetchall()

    record = json.loads(row["record_json"])
    return {
        "claim_id": row["claim_id"],
        "version": row["version"],
        "status": row["status"],
        "created_at": row["created_at"],
        "record": record,
        "warnings": hygiene_warnings(record),
        "versions": [dict(v) for v in versions],
        "status_history": [dict(s) for s in status_history],
        "reviews": [
            {
                "review_id": r["review_id"],
                "reviewer_name": r["reviewer_name"],
                "outcome": r["outcome"],
                "comments": r["comments"],
                "checklist": json.loads(r["checklist_json"]),
                "created_at": r["created_at"],
            }
            for r in reviews
        ],
    }


@app.post("/api/claims/{claim_id}/versions", status_code=201)
def add_version(claim_id: str, record: dict[str, Any]) -> dict[str, Any]:
    record = normalize_record(record)
    errors = schema_errors(record)
    if errors:
        raise HTTPException(status_code=422, detail={"errors": errors, "warnings": hygiene_warnings(record)})

    with connect() as conn:
        row = conn.execute("SELECT MAX(version) AS v FROM claims WHERE claim_id=?", (claim_id,)).fetchone()
        if row is None or row["v"] is None:
            raise HTTPException(status_code=404, detail="Claim not found")
        version = int(row["v"]) + 1
    return insert_claim_version(
        claim_id=claim_id,
        version=version,
        record=record,
        status="deposited",
        actor="author",
        note="new record revision",
    )


@app.post("/api/claims/{claim_id}/reviews", status_code=201)
def add_review(claim_id: str, review: ReviewIn) -> dict[str, Any]:
    with connect() as conn:
        row = conn.execute(
            "SELECT version, status FROM claims WHERE claim_id=? ORDER BY version DESC LIMIT 1", (claim_id,)
        ).fetchone()
        if row is None:
            raise HTTPException(status_code=404, detail="Claim not found")

        created_at = utc_now()
        cursor = conn.execute(
            """
            INSERT INTO reviews
                (claim_id, claim_version, reviewer_name, outcome, comments, checklist_json, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (
                claim_id,
                row["version"],
                review.reviewer_name,
                review.outcome,
                review.comments,
                json.dumps(review.checklist),
                created_at,
            ),
        )

        if review.proposed_status:
            next_status = _coerce_status(review.proposed_status)
            current_status = status_from_db(claim_id, row["version"], conn)
            if not can_transition(current_status, next_status):
                raise HTTPException(
                    status_code=400,
                    detail={
                        "error": "invalid_transition",
                        "from": current_status,
                        "to": next_status,
                        "allowed": sorted(STATUS_FLOW.get(current_status, set())),
                    },
                )
            conn.execute(
                "UPDATE claims SET status=? WHERE claim_id=? AND version=?",
                (next_status, claim_id, row["version"]),
            )
            record_status_event(
                conn=conn,
                claim_id=claim_id,
                claim_version=row["version"],
                status=next_status,
                actor=review.reviewer_name,
                note="status update from review",
            )
    return {
        "review_id": cursor.lastrowid,
        "claim_id": claim_id,
        "version": row["version"],
        "created_at": created_at,
    }


@app.post("/api/claims/{claim_id}/status", status_code=201)
def update_status(claim_id: str, payload: StatusUpdateIn) -> dict[str, Any]:
    target = _coerce_status(payload.status)
    with connect() as conn:
        row = conn.execute(
            "SELECT version, status FROM claims WHERE claim_id=? ORDER BY version DESC LIMIT 1", (claim_id,)
        ).fetchone()
        if row is None:
            raise HTTPException(status_code=404, detail="Claim not found")

        current_status = status_from_db(claim_id, row["version"], conn)
        if not can_transition(current_status, target):
            raise HTTPException(
                status_code=400,
                detail={
                    "error": "invalid_transition",
                    "from": current_status,
                    "to": target,
                    "allowed": sorted(STATUS_FLOW.get(current_status, set())),
                },
            )
        conn.execute(
            "UPDATE claims SET status=? WHERE claim_id=? AND version=?",
            (target, claim_id, row["version"]),
        )
        record_status_event(
            conn,
            claim_id=claim_id,
            claim_version=row["version"],
            status=target,
            actor=payload.actor,
            note=payload.note,
        )
    return {
        "claim_id": claim_id,
        "version": row["version"],
        "from": current_status,
        "to": target,
        "note": payload.note,
    }


@app.post("/api/claims/{claim_id}/relations", status_code=201)
def add_relation(claim_id: str, relation: RelationIn) -> dict[str, Any]:
    with connect() as conn:
        row = conn.execute(
            "SELECT * FROM claims WHERE claim_id=? ORDER BY version DESC LIMIT 1", (claim_id,)
        ).fetchone()
        if row is None:
            raise HTTPException(status_code=404, detail="Claim not found")

    record = normalize_record(json.loads(row["record_json"]))
    relations = record.setdefault("relations", [])

    # optional guardrail: ensure target claim reference exists when it looks like internal id
    if relation.target.startswith("ccr-"):
        with connect() as conn:
            ref = conn.execute(
                "SELECT claim_id FROM claims WHERE claim_id=? LIMIT 1", (relation.target,)
            ).fetchone()
            if ref is None:
                raise HTTPException(status_code=404, detail="target claim_id not found")

    if any(r.get("predicate") == relation.predicate and r.get("target") == relation.target for r in relations):
        raise HTTPException(status_code=400, detail="Relation already exists for this predicate/target.")

    entry = {
        "predicate": relation.predicate,
        "target": relation.target,
        "note": relation.note,
    }
    if relation.target_record_version is not None:
        entry["target_record_version"] = relation.target_record_version
    relations.append(entry)
    next_version = int(row["version"]) + 1
    return insert_claim_version(
        claim_id=claim_id,
        version=next_version,
        record=record,
        status=row["status"],
        actor="author",
        note=f"linked relation: {relation.predicate} -> {relation.target}",
    )
