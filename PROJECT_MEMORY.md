# Project Memory

## Goal
Claim Commons treats papers as source containers and Claim–Evidence–Conclusion units as inspectable knowledge. Users enter through broad directions, papers, scientific questions or the logic graph.

## Current state
- Public v0.2 explorer lives in `app/static/index.html`, `commons-v02.css`, `commons-v02.js`.
- Full Chinese/English interface toggle; `?lang=en` opens English directly and preference persists locally.
- Source titles, claims and evidence preserve their publication language; the UI labels them as source text rather than silently machine-translating scientific records.
- Initial corpus: 22 papers, 35 claims, 7 broad directions, 7 question families.
- Every claim stores evidence, positive result, boundary, negative/non-inference and unresolved issue.
- Legacy atlas remains available at `helix.html`.

## Invariants
- One paper may yield 1–N claims; extraction is curated but not exhaustive.
- Family membership is navigation, not support or replication.
- Cross-paper relations require explicit source checks and evidence independence.
- `source_reported` means faithful to source, not independently reproduced.
- Scientific source text is not auto-translated into a verified record.

## Key paths
- `app/static/data/claim-library-v0.2.json`
- `curation/additional-claims-v0.2.json`
- `curation/claim-families-v0.2.json`
- `scripts/build_claim_library_v02.mjs`
- `docs/PAPER_TO_CLAIM_WORKFLOW.md`
