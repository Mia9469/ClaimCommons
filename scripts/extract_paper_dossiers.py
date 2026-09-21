#!/usr/bin/env python3
"""Build auditable Claim Commons paper dossiers from a folder of PDFs.

The extractor deliberately produces *candidates*. It never upgrades a machine
candidate to source_reported or author_confirmed. Human curation lives in a
separate overlay so regenerated source text never erases scientific judgment.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import re
import subprocess
from datetime import datetime, timezone
from pathlib import Path

CLAIM_CUES = (
    "we show", "we demonstrate", "we find", "we report", "we reveal",
    "we establish", "we prove", "we derive", "our results", "results show",
    "suggest that", "indicate that", "supports the hypothesis",
)
DOI_RE = re.compile(r"10\.\d{4,9}/[-._;()/:A-Z0-9]+", re.I)
YEAR_RE = re.compile(r"(?:19|20)\d{2}")


def clean(text: str) -> str:
    return re.sub(r"\s+", " ", text).strip()


def extract_text(pdf: Path) -> tuple[str, int]:
    proc = subprocess.run(
        ["pdftotext", "-layout", str(pdf), "-"],
        check=True,
        capture_output=True,
        text=True,
        timeout=120,
    )
    pages = proc.stdout.split("\f")
    if pages and not pages[-1].strip():
        pages.pop()
    return "\n\f\n".join(pages), len(pages)


def abstract_span(text: str) -> tuple[str, int, int]:
    head = text[:30000]
    patterns = [
        re.compile(r"\babstract\b\s*[:—-]?\s*(.+?)(?=\n\s*(?:keywords?|introduction|significance)\b)", re.I | re.S),
        re.compile(r"\bsummary\b\s*[:—-]?\s*(.+?)(?=\n\s*(?:introduction|keywords?)\b)", re.I | re.S),
    ]
    for pattern in patterns:
        match = pattern.search(head)
        if match:
            return clean(match.group(1)), match.start(1), match.end(1)
    # Many journal PDFs place the abstract directly below title/author blocks.
    fallback = clean(head[:5000])
    return fallback, 0, min(len(head), 5000)


def sentences(text: str) -> list[str]:
    return [clean(s) for s in re.split(r"(?<=[.!?])\s+(?=[A-Z])", text) if len(clean(s)) >= 45]


def candidate_claim(abstract: str) -> str:
    ranked = []
    for index, sentence in enumerate(sentences(abstract)):
        low = sentence.lower()
        cue_score = sum(cue in low for cue in CLAIM_CUES)
        result_score = sum(word in low for word in ("increase", "decrease", "predict", "explain", "recover", "improve", "robust", "causal", "associated"))
        penalty = int(len(sentence) > 700) + int(index == 0)
        ranked.append((cue_score * 5 + result_score - penalty, -index, sentence))
    if not ranked:
        return "No bounded claim candidate could be extracted automatically."
    return max(ranked)[2][:1200]


def inferred_title(text: str, fallback: str) -> str:
    lines = [clean(line) for line in text[:6000].splitlines() if clean(line)]
    candidates = [line for line in lines[:45] if 20 <= len(line) <= 240 and not DOI_RE.search(line)]
    candidates = [line for line in candidates if not re.search(r"copyright|received|accepted|published|journal|article|open access", line, re.I)]
    return max(candidates, key=len, default=fallback.replace("-", " "))


def dossier(pdf: Path) -> dict:
    text, page_count = extract_text(pdf)
    abstract, start, end = abstract_span(text)
    doi_match = DOI_RE.search(text[:12000])
    year_match = YEAR_RE.search(pdf.name[:4]) or YEAR_RE.search(text[:4000])
    digest = hashlib.sha256(pdf.read_bytes()).hexdigest()
    return {
        "id": f"paper-{digest[:16]}",
        "year": int(year_match.group()) if year_match else 0,
        "title": inferred_title(text, pdf.stem),
        "doi": doi_match.group().rstrip(".,;)") if doi_match else "",
        "topic": "unclassified",
        "claim": candidate_claim(abstract),
        "evidence": "Machine extraction pending curator description of design, sample, analysis and uncertainty.",
        "scope": "Bounded to the methods, data and conditions reported in this source.",
        "non_claim": "This machine-extracted candidate has not yet been checked against the full paper by a curator.",
        "status": "machine_candidate",
        "archive": {
            "source_filename": pdf.name,
            "sha256": digest,
            "page_count": page_count,
            "extracted_at": datetime.now(timezone.utc).isoformat(),
        },
        "source_spans": [{
            "section": "abstract_or_front_matter",
            "start_char": start,
            "end_char": end,
            "text": abstract[:3000],
        }],
    }


def merge(machine: list[dict], curated: dict | None) -> list[dict]:
    if not curated:
        return machine
    by_doi = {p.get("doi", "").lower(): p for p in machine if p.get("doi")}
    by_title = {clean(p.get("title", "")).lower(): p for p in machine}
    merged = []
    for record in curated.get("papers", []):
        base = by_doi.get(record.get("doi", "").lower()) or by_title.get(clean(record.get("title", "")).lower()) or {}
        # Curator decisions override machine fields; source spans and hashes survive.
        merged.append({**base, **record})
    return merged


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("pdf_dir", type=Path)
    parser.add_argument("--curation", type=Path)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    pdfs = sorted(args.pdf_dir.glob("*.pdf"))
    if not pdfs:
        raise SystemExit(f"No PDFs found in {args.pdf_dir}")
    machine = [dossier(pdf) for pdf in pdfs]
    curated = json.loads(args.curation.read_text()) if args.curation else None
    payload = {
        "schema_version": "0.1.0",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "pipeline": "pdf -> source span -> machine candidate -> curator overlay -> public dossier",
        "review_notice": "Source-reported means faithful to the cited paper, not independently reproduced.",
        "counts": {
            "pdfs": len(pdfs),
            "published_records": len(curated.get("papers", [])) if curated else len(machine),
            "machine_candidates": sum(p.get("status") == "machine_candidate" for p in machine),
        },
        "papers": merge(machine, curated),
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n")
    print(json.dumps(payload["counts"], ensure_ascii=False))


if __name__ == "__main__":
    main()
