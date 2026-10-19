# Website regression and release checks, 2026-10-20

## Scope

Local desktop and actual 390 × 844 browser viewport, Chinese/English navigation, the six page purposes, mixed-status library retrieval, provenance map, local PDF reading and candidate exports. No paid provider call, private source upload, public guestbook post or database re-extraction was performed.

## Results

- JavaScript syntax checks passed for the shared shell, library, semantics renderer, extractor, community/report UI and page builders.
- Twelve isolated regression checks passed using a mock fetch function, not a network service: pipeline completion; context/provenance retention; definition quote matching; definition-page audit coverage; HTML and Markdown content; result UI fields; key omission from exports; ambiguity/unreported flags; HTML escaping; legacy-record handling; source-quality warnings.
- Desktop homepage language switching and method definition links worked.
- Mobile navigation and all six primary page layouts were inspected at an applied 390-pixel viewport, without page-wide horizontal overflow on the primary pages.
- Roxin search with candidate-only filtering returned one paper and15 candidates. Its paper container retained all16 records, distinguishing one curated record outside the active filter.
- Graph node activation via Enter opened the matching claim. Desktop all-curated view rendered64 nodes without widening the page. The map remains a provenance/question-grouping view, not automatically verified scientific relations.
- A synthetic two-page PDF was read locally; the little-text second page triggered the source-quality acknowledgement gate. No model received the PDF.
- The generated HTML reading report was opened in the browser and retained assessment context, definitions, locators and review status.
- Community correction drafts and guestbook fallback links rendered; nothing was submitted externally.

## Fixes

1. Replaced invalid nested markup in the custom-provider option with a language-aware plain-text option.
2. Stacked the library notice on narrow screens instead of squeezing its label vertically.
3. Included term-definition and ambiguity locators when assigning claims to source-audit page groups. Evidence and definition pages may differ.
4. Refreshed cache versions on both primary pages and existing report shells, including repeat builds.
5. Localized Markdown report headings and retained coverage/provenance. Made report correction URLs compatible with file URLs.

## Boundaries

Real provider compatibility, CORS, billing, model quality, independent scientific verification and author claims remain untested. Existing source records were not semantically backfilled or promoted. The release publishes the already prepared local library outputs; it does not run extraction or change the archive database.
