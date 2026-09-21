# Claim Commons

> Publish the smallest defensible claim. Preserve the evidence trail. Let significance emerge.

Claim Commons is an open-source experiment in changing the basic unit of scientific communication. Instead of requiring every result to become a paper-sized story, it records one bounded claim together with the evidence, scope, non-claims and provenance needed to inspect it.

## Public pilot

The first collection contains 22 published papers. Each Paper Dossier separates one bounded viewpoint, the evidence reported by the paper, its scope, one explicit non-claim, and its review state.

`source_reported` means faithful to the cited source. It does **not** mean independently reproduced or author-endorsed. Records marked `needs_curator_review` are open tasks.

## Rebuild the collection

```bash
python scripts/extract_paper_dossiers.py /path/to/pdfs \
  --curation curation/published-papers.json \
  --output app/static/data/published-paper-dossiers.json
```

The extraction pipeline is local-first and preserves machine candidates separately from curator decisions. PDFs are not committed.

## Contribute

You do not need to write code. Verify one paper, narrow an over-strong claim, add a missing boundary, connect two records, or improve the extraction workflow. Start with [CONTRIBUTING.md](CONTRIBUTING.md) and the [Paper → Claim workflow](docs/PAPER_TO_CLAIM_WORKFLOW.md).

## Repository map

- `app/static/` — public website and published dossier data
- `curation/` — human-reviewed overlays
- `scripts/extract_paper_dossiers.py` — reproducible local extraction
- `schema/` — machine-readable record contracts
- `docs/` — charter, review rubric, governance and workflow

This pilot is not a truth engine, a replacement for peer review, or an unmoderated upload service. A production platform still needs identity, moderation, ethics handling, durable preservation and public governance.

Code is MIT licensed. Documentation and curated record text are CC BY 4.0 unless a source record states otherwise.
