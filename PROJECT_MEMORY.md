# Project Memory

> Canonical compact handoff for this repository. Update in place; do not append a diary.

## Goal

Claim Commons is an open-source public ledger for the smallest defensible scientific claim, its evidence, scope, non-claims and provenance. The first proof is a published-paper pilot, not an open submission platform.

## Current state

- Public landing/explorer in `app/static/index.html`, `styles.css`, `app.js`.
- First corpus: 22 published-paper dossiers, 16 topics, 5 marked for curator review.
- Local PDF extraction creates machine candidates and source spans; human curation is a separate overlay.
- Personal/unpublished SG-EAP examples and Mia research-map assets were removed from the public working tree.
- GitHub Pages workflow and a paper-verification issue template are present.

## Architecture & key paths

- `curation/published-papers.json`: human scientific decisions.
- `app/static/data/published-paper-dossiers.json`: generated public dataset.
- `scripts/extract_paper_dossiers.py`: PDF → source spans → candidates → curation merge.
- `schema/paper-dossier.schema.json`: Paper Dossier contract.
- `docs/PAPER_TO_CLAIM_WORKFLOW.md`: public protocol.
- `docs/XHS_LAUNCH_POST.md`: launch copy.

## Decisions & invariants

- Machine extraction never upgrades its own verification state.
- `source_reported` means faithful to a source, not independently reproduced or author-confirmed.
- Public repo must not include source PDFs or unpublished personal research.
- Claim, evidence, scope and non-claim remain separate fields.
- Topic-map edges mean shared topic only unless an explicit typed relation exists.
- Keep the prior private repository as an archive; publish from clean history.

## Project-specific preferences

- Calm cream/dark-green editorial visual language with acid and orange accents.
- Chinese-first public explanation with English scientific field labels.
- Invite bounded, concrete contributions; no prestige or novelty scoring.

## Open threads / next actions

1. Curators independently check the five `needs_curator_review` dossiers against full text.
2. Add source-page spans to every curated record rather than only generated machine records.
3. Pilot the issue/PR workflow with 5–10 external contributors.
4. Measure whether readers identify claim/evidence/boundary faster than from abstracts.

## Risks / blockers

- Initial dossier wording is curator-generated and not author-endorsed.
- Production submission still needs identity, moderation, ethics handling and durable preservation.
- Google-hosted fonts fall back gracefully but are an external dependency.

## Run & verify

- Regenerate: `python scripts/extract_paper_dossiers.py <pdf-dir> --curation curation/published-papers.json --output app/static/data/published-paper-dossiers.json`
- Static build: `npm run prepare:sites`
- Full build: `npm run build`

## Essential references

- `docs/CHARTER.zh-CN.md`
- `docs/PAPER_TO_CLAIM_WORKFLOW.md`
- `CONTRIBUTING.md`
