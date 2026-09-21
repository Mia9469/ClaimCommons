# Claim Commons Product Definition v0.2

## One-sentence definition

Claim Commons is a research-knowledge ledger that converts heterogeneous research assets into author-confirmed, evidence-bounded Claim Records and connects those records through inspectable logical relations.

It is not another PDF repository. Its primary object is the smallest claim that can stand with its own evidence, scope, uncertainty, provenance and revision history.

## The product has three surfaces

### 1. Research Atlas: source to candidate

The Atlas inventories repositories, manuscripts, datasets, analyses, protocols, tools, archives and reference libraries. It classifies each source before extracting candidate claims.

An extracted statement is never silently published. It receives one of four states:

- `claim_ready`: enough source detail exists to open an author-confirmation draft;
- `needs_author_check`: wording, evidence, inferential unit, ownership or boundaries remain unresolved;
- `protocol_only`: the question and protocol are fixed but a numerical result is intentionally unavailable;
- `reference_only`: the asset supplies context, infrastructure, recovery or provenance rather than a scientific claim.

### 2. Claim Editor: candidate to evidence contract

The author confirms or rewrites the candidate and supplies:

- one atomic statement;
- claim type and strength;
- scope, conditions and independent unit;
- evidence design, sample, analysis, result and uncertainty;
- inspectable artifacts;
- explicit non-claims and untested conditions;
- falsification conditions and alternatives;
- contributor roles and source provenance.

Schema errors block deposit. Scope and language warnings remain advisory: the platform must not replace one prestige gate with an automated style gate.

### 3. Commons Ledger: record to knowledge graph

Deposited records are immutable versions. Review asks whether evidence supports the claim as scoped, not whether the story is sufficiently important.

Relations connect records through:

- `supports`;
- `contradicts`;
- `replicates`;
- `narrows`;
- `generalises`;
- `depends_on`;
- `supersedes`.

Questions, protocols and source assets may appear in an Atlas, but only validated Claim Records become nodes in the formal Commons Ledger.

## Core object model

| Object | Purpose | Can enter the formal ledger? |
|---|---|---|
| Research workspace | A person, group or project inventory boundary | No |
| Source asset | Repository, paper, dataset, notebook, proof, protocol or tool | As provenance only |
| Candidate claim | Machine- or human-extracted bounded statement | No |
| Claim Record | Author-confirmed claim and evidence contract | Yes |
| Review | Structured assessment of claim–evidence alignment | Attached to a version |
| Relation | Typed link between records | Yes |
| Status event | Deposited, checked, reproduced, challenged, narrowed or superseded | Attached to a version |

## End-to-end workflow

1. Define an inventory boundary.
2. Classify every research-related asset by function and maturity.
3. Extract the smallest candidate statements that are explicitly supported by source text.
4. Preserve source wording and mark uncertainty rather than filling gaps by inference.
5. Ask the author to confirm statement, units, evidence, boundaries, ownership and contributor roles.
6. Open eligible candidates in the Claim Editor.
7. Validate and deposit an immutable Claim Record.
8. Add expert review and status events.
9. Connect records to prior and subsequent claims.
10. Narrow or supersede through new versions without deleting the historical state.

## Product principles

### Evidence before significance

Interpretation is welcome but visually and structurally separate from the validated claim.

### Boundaries are knowledge

Negative comparisons, failed generalisation, right-censoring and protocol dependence should become boundary records rather than disappear because they weaken a story.

### No automatic authorship

Repository ownership does not establish scientific authorship or contributor roles. Collaboration sources remain blocked until people confirm provenance.

### No automatic truth

Extraction creates candidates. Schema validation checks structure. Review evaluates support. None of these is an automatic truth oracle.

### Protocols are first-class

A frozen protocol with numerical claims disabled is more useful than a premature result. Protocol Records should later link to the resulting Claim Records.

## MVP boundaries

The local prototype currently demonstrates intake, drafting, deposit, review, versioning, relation creation and a personal research atlas. A public platform still requires identity, moderation, ethics review, artifact storage, durable identifiers, abuse handling, governance and preservation funding.

## Pilot success criteria

The first pilot should test process rather than impact:

1. Can an author classify a mixed research folder without turning every file into a publication?
2. Can independent readers identify the exact statement, evidence and boundary faster than from a standard abstract?
3. Does author confirmation catch extraction errors before deposit?
4. Can one conventional manuscript be decomposed without losing provenance?
5. Do negative and boundary results become easier to find and reuse?
6. Can a later researcher connect a replication or contradiction without rewriting the original record?

The first defensible product claim should concern one of these measured workflow outcomes, not that Claim Commons has already fixed scientific publishing.
