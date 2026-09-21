import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def test_public_dossiers_are_bounded_and_unique():
    payload = json.loads((ROOT / "app/static/data/published-paper-dossiers.json").read_text())
    papers = payload["papers"]
    assert len(papers) == 22
    assert len({paper["id"] for paper in papers}) == len(papers)
    for paper in papers:
        assert paper["status"] in {"source_reported", "needs_curator_review"}
        for field in ("title", "claim", "evidence", "scope", "non_claim"):
            assert paper[field].strip(), (paper["id"], field)


def test_public_site_does_not_ship_personal_research_examples():
    public = ROOT / "app/static"
    assert not (public / "data/mia-research-map.json").exists()
    assert not (ROOT / "examples/sg_eap_history_effect.json").exists()
