# Project Memory

## Goal
Claim Commons treats papers as source containers and Claim–Evidence–Conclusion units as inspectable knowledge. It supports broad discovery, paper-level contribution views and question-first evidence search.

## Current state
- Public explorer is served from `app/static/index.html`; GitHub Pages deploys the complete `app/static/` tree on `main`. The separate Sites build/export helpers are older and are not the public release path.
- Initial corpus: 22 published papers, 35 claims, 7 broad directions and 7 question families.
- Each claim records evidence plus positive result, boundary, negative/non-inference and unresolved issue.
- Four access modes: direction, paper, scientific question and paper→claim→question logic graph.
- The public checkout does not ship the old `helix.html` Atlas. Its former dead homepage link now opens the independent Helix project at `https://helix-research-programme.tongtonghmy.chatgpt.site`, labelled restricted preview (owner-only audience is unchanged).
- Workflow, JSON Schema, GitHub contribution templates and Xiaohongshu launch post are included.
- Public homepage footer includes privacy-preserving total/today page-view counters with a graceful unavailable state; these are anonymous visits, not unique visitors.
- Public homepage includes a bilingual Chinese/English guestbook backed by one GitHub issue through Utterances; it explicitly invites ideas, corrections and criticism. Its embed uses the dark theme.
- v0.3 integrates 519 metadata records, page-linked unreviewed full-text candidates, and human-curated claims in one bilingual Claim Library. Record-status filters preserve evidence levels; only curated claims enter verified question relations and logic views.

- Shared visual identity matches the personal homepage: dark `#080816` / `#0c0c1e`, cyan / magenta / purple accents, Inter body text, Orbitron brand and JetBrains Mono metadata, with Chinese sans-serif fallbacks. Main explorer and both worked examples share this theme and footer links to `https://mia9469.github.io/#cards-tools`. Scientific status colours remain distinct.
- Branding work was prepared from public `main` `9f467ef16b5e5cd840d567a9decb75bac571f399`, whose homepage and primary CSS were byte-identical to live before edits; all four public JSON assets and interaction logic were preserved.

## Key paths
- `curation/published-papers.json`
- `curation/additional-claims-v0.2.json`
- `curation/claim-families-v0.2.json`
- `scripts/build-claim-library-v02.mjs`
- `app/static/data/claim-library-v0.2.json`
- `docs/PAPER_TO_CLAIM_WORKFLOW.md`
- `docs/XHS_LAUNCH_POST_v0.2.md`

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
