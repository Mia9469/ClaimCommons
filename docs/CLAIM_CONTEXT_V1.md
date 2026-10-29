# Claim context v1 / 命题定义与判断条件

## Purpose / 目的

Claim Commons starts with neuroscience. It asks whether making a paper's objects, terms, measurements, conditions and evidence explicit can help people and AI inspect and compare its claims. This is a design hypothesis, not a demonstrated improvement in AI reasoning or a causal explanation of progress in mathematical AI. Neuroscience is not being reduced to formal proof.

从神经科学开始，把论文中的对象、术语、操作定义、条件与证据写清楚，检验这种表示能否帮助人和 AI 阅读、比较与核查。它是一项设计假设，不是已经验证的 AI 性能提升，也不是对数学 AI 进展原因的定论。

The unit is the smallest **complete, separately assessable proposition**, not the shortest sentence. Keep theorem assumptions, comparisons, shared controls and dependencies intact. Separate an observed effect, a proposed mechanism and a generalization only when they make independently assessable commitments.

## Additive metadata / 兼容新增字段

Existing `statement`, `source_statement`, `evidence`, `conclusion`, provenance and review states remain authoritative. New fields are optional for old records. The browser prompt version is `2026-10-26.1`; its additional semantic contract is `claim-context-v1`. The PDF protocol stays `claim-commons-pdf-v1`.

```json
{
  "assessment_frame": {
    "system": null,
    "conditions": null,
    "intervention_or_exposure": null,
    "comparator": null,
    "outcome": null,
    "relation": null,
    "quantifier": null,
    "assumptions": []
  },
  "terms": [],
  "ambiguities": []
}
```

- `system`: the actual population, preparation, recorded cells or model, not a broader biological substitute.
- `conditions`: species, state, task, time/spatial scale, parameter regime and other relevant restrictions as reported.
- `intervention_or_exposure`: the manipulated factor, input or observed exposure; do not turn observation into intervention.
- `comparator`: the reference condition; null if absent, unreported or inapplicable, with that distinction explained in review notes.
- `outcome`: the measured quantity, statistic, readout or formally defined mathematical object.
- `relation`: the relationship being assessed, retaining direction, uncertainty and attribution. Do not convert correlation into mechanism.
- `quantifier`: the tested or demonstrated coverage, not an invented universal statement.
- `assumptions`: joint conditions that cannot be dropped without changing the proposition.

## Term entry / 术语条目

```json
{
  "term": "source term",
  "source_definition": null,
  "operationalization": null,
  "definition_status": "not_reported",
  "source_locator": null
}
```

`definition_status` is `explicit`, `operational_only`, `not_reported` or `ambiguous`. It is not a confidence or validity score. `source_definition` records the source's definition; `operationalization` records how it was measured or manipulated. These may differ. Do not substitute a textbook definition or guess a definition from a familiar label. Do not infer absence from missing supplements or a partial excerpt: say “not found in the supplied material.” No fixed number of terms is required.

For `explicit` or `operational_only`, attach a locator containing the file-order `pdf_page`, optional section/figure/equation and a short exact `quote`. Mark `not_reported` with null values when appropriate; do not fabricate a quote to prove an absence. For `ambiguous`, retain the competing usages and explain the effect on interpretation. Local source matching checks text only; it does not verify that a definition is scientifically adequate.

An ambiguity entry has `issue`, `affects_assessment`, and an optional `source_locator`. It records an identifiable interpretive gap, not a new negative scientific result.

## Workflow / 流程

1. Preserve source wording, version and locators.
2. Identify the system and the relationship the paper actually claims.
3. Resolve the source's terms and operational definitions; retain unknowns instead of repairing them.
4. Record conditions, comparator, outcome, quantifier and joint assumptions.
5. Split only independently assessable commitments. Merge redundant wording and attach all relevant evidence.
6. Calibrate the supported conclusion and distinguish real negative findings, non-inferences and untested questions.
7. Source-audit definitions as well as claims, including a definition on a different page from the result evidence. Explicitly flag definition drift, incompatible measures, missing controls and scope changes.
8. Keep candidates unverified. Across papers, compare definitions, measurement, state, scale, controls and evidence independence before proposing any scientific relation.

## Rollout boundaries / 更新边界

The homepage, method guide, blank worksheet, new browser extraction metadata, on-screen output and downloadable reports use this contract. The library can display and search these fields **when a record contains them**. The explicit collection importer preserves them for a future authorized import; it has not been run for this change. Existing records, statuses, counts and scientific graph relations have not been backfilled or promoted. Existing collection reports retain their original content; optional context remains available through the record/metadata rather than an invented retrospective rewrite.

本次不会重新提取全部文献，不会改写既有证据，不会自动更新数据库或发布。下一步如需补齐旧记录，应单独指定来源、覆盖范围和人工检查方式。

## Reader-facing report / 读者界面

The default report is not the audit worksheet. It presents the primary scientific question, a short abstract-like overview, a broad argument outline, and complete claims in logical order. Each claim shows a concise result and essential scope. Evidence and methods expand on demand; definitions, full limits and review logs remain behind secondary disclosures or in metadata. Do not remove source information to shorten the default view.

Optional presentation fields: top-level `reading_overview` with `primary_question`, `summary`, `logical_outline` (`label`, `claim_ids`) and `claim_order`; each claim may include `short_title` and `reading_summary` (`result`, `boundary`). Scientific `statement` and evidence remain unchanged. Unsupported summaries must be flagged, not treated as new evidence.

Outputs appear in the current extraction UI. A separate blob-backed reading tab and downloadable self-contained HTML/Markdown are available; the JSON retains the full record. A browser print action can save PDF, but there is no automatic PDF file generation or public hosted URL. Publication remains an explicit later action.


## Optional author-view appendix

The reader-first report may add a collapsed `author_view` after its claims and before the source audit. It is an analysis layer, not a new paper claim, a verified research gap, or an author-endorsed action list. It must not change the original claim IDs, evidence, or review status.

- `basis_scope`, `literature_checked` (false unless a documented literature check was actually performed), `summary`, `closure_points`, `follow_up_questions`, and `suggested_first_step` describe the appendix.
- Each point links existing `claim_ids`, gives a `why_open` or `question`, a `minimum_next_step`, `if_supported` / `if_not_supported`, and a `scope_note`.
- `basis_type` separates `source_reported_limit`, `missing_supplied_material`, and `extractor_inference`; `basis_note` explains the attribution. A missing attachment is not proof that the original study omitted it.
- `necessity` distinguishes `verify_materials_first`, `only_for_stronger_claim`, `core_claim_check`, `optional_follow_up`, and `separate_study`. Do not label an unanswered broader question a defect in a bounded claim.
- Prefer at most three closure points and two follow-ups. Empty arrays are valid; do not manufacture issues to fill slots. Suggest the smallest discriminating check rather than unconditional new experiments or wider scope.

The appendix is included in the HTML and Markdown report and JSON metadata. Existing metadata without it remains readable. This addition does not publish a report or modify the public claim library.
