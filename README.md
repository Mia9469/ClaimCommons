# Claim Commons v0.2

> A paper is a source container. A Claim–Evidence–Conclusion unit is a piece of inspectable knowledge.

Claim Commons extracts one or more complete scientific claims from each published paper and reconnects them around broad directions and specific scientific questions.

## What is new in v0.2

- One paper can contribute multiple claims.
- Every claim includes evidence, positive result, boundary, negative/non-inference and unresolved questions.
- Seven broad directions support discovery without over-classifying the literature.
- Paper view preserves all extracted contributions from a source.
- Question view shows whether a proposition has relevant evidence and of what type.
- Family membership is not treated as replication. Cross-paper support, contradiction and replication require explicit verified relations.

## Build the public library

```bash
node scripts/build-claim-library-v02.mjs
```

The builder combines the original curated paper records, additional claims and claim-family mappings into `app/static/data/claim-library-v0.2.json`.

## Repository map

- `curation/published-papers.json` — initial paper-level curation
- `curation/additional-claims-v0.2.json` — additional claims per paper
- `curation/claim-families-v0.2.json` — scientific questions and membership
- `schema/claim-library-v0.2.schema.json` — machine-readable contract
- `docs/PAPER_TO_CLAIM_WORKFLOW.md` — repeatable extraction and review protocol
- `app/static/index.html` — public v0.2 explorer
- `app/static/helix.html` — preserved legacy four-module atlas

## Contribute

You do not need to write code. Extract or verify one complete claim, add a missing boundary, define a useful scientific question, or verify a relation between two claims. Start from the GitHub issue templates.

The current collection is curated but not exhaustive. `source_reported` means faithful to a source, not independently reproduced or author-endorsed.
