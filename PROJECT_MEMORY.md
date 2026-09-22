# Project Memory

## Goal
Claim Commons treats papers as source containers and Claim–Evidence–Conclusion units as inspectable knowledge. It supports broad discovery, paper-level contribution views and question-first evidence search.

## Current state
- v0.2 public explorer implemented in `claim-commons-mvp/app/static/index.html` and deployable `sites-public/`.
- Initial corpus: 22 published papers, 35 claims, 7 broad directions and 7 question families.
- Each claim records evidence plus positive result, boundary, negative/non-inference and unresolved issue.
- Four access modes: direction, paper, scientific question and paper→claim→question logic graph.
- Legacy four-module atlas is preserved at `helix.html`.
- Workflow, JSON Schema, GitHub contribution templates and Xiaohongshu launch post are included.
- Public homepage footer includes privacy-preserving total/today page-view counters with a graceful unavailable state; these are anonymous visits, not unique visitors.
- Public homepage includes a bilingual Chinese/English guestbook backed by one GitHub issue through Utterances; it explicitly invites ideas, corrections and criticism.
- v0.3 adds a separate bilingual expanded-literature explorer for 519 metadata records. Legally archived open PDFs are converted into page-linked, explicitly unreviewed full-text candidates; curated claims remain a separate validated layer.

## Key paths
- `claim-commons-mvp/curation/published-papers.json`
- `claim-commons-mvp/curation/additional-claims-v0.2.json`
- `claim-commons-mvp/curation/claim-families-v0.2.json`
- `claim-commons-mvp/scripts/build-claim-library-v02.mjs`
- `claim-commons-mvp/app/static/data/claim-library-v0.2.json`
- `claim-commons-mvp/docs/PAPER_TO_CLAIM_WORKFLOW.md`
- `claim-commons-mvp/docs/XHS_LAUNCH_POST_v0.2.md`

## Invariants
- A paper may yield 1–N claims; current extraction is curated but not exhaustive.
- Family membership is navigation, not support or replication.
- Cross-paper relations require explicit source checks, compatible scope and evidence independence.
- Multiple claims from one paper are never independent replication.
- `source_reported` means faithful to source, not true or independently reproduced.
- Public records preserve provenance and separate evidence, result, boundary, negative and unresolved fields.

## Next actions
1. Curate more claims per paper from full text and add exact source spans.
2. Pilot contribution workflow with external researchers.
3. Add authenticated moderation and durable review states.
4. Migrate useful evidence from the legacy 500-paper Atlas into v0.2 claim contracts without inflating verification.
5. Re-run `extract_fulltext_candidates.py` as additional iCloud text records become local, then human-review candidates before promotion into the curated library.
