# Paper → Claim workflow v0.1

Claim Commons does not ask a language model to decide what is true. It creates an auditable route from a published source to a bounded, reviewable viewpoint.

## The five gates

1. **Archive the source.** Identify a paper by file hash and validated DOI. Keep the PDF outside the public repository unless its licence permits redistribution.
2. **Extract source spans.** Preserve the abstract or result passage, its section and location. A generated sentence without a source span cannot enter the public dossier.
3. **Create candidates.** Machine extraction may propose a claim, topic and relation. Every such item is labelled `machine_candidate`.
4. **Curate the evidence contract.** A human checks the statement, evidence design, scope and explicit non-claim against the full paper. Passing this gate produces `source_reported`, not “true” or “reproduced”.
5. **Review or reproduce.** Independent readers can challenge the wording, inspect the source, add a structured review, or attach a replication/contradiction record.

## Standard record

Each Paper Dossier contains:

- bibliographic identity and source hash;
- one bounded candidate viewpoint;
- what evidence the paper reports;
- the conditions under which the statement is scoped;
- one explicit non-claim;
- source spans and extraction provenance;
- a review state that cannot be silently upgraded.

The machine-readable contract is [`schema/paper-dossier.schema.json`](../schema/paper-dossier.schema.json). Human decisions live in [`curation/published-papers.json`](../curation/published-papers.json), separately from generated source spans.

## Rebuild a local collection

```bash
python scripts/extract_paper_dossiers.py /path/to/pdfs \
  --curation curation/published-papers.json \
  --output app/static/data/published-paper-dossiers.json
```

The command requires Poppler's `pdftotext`. It does not upload PDFs, call an external model, or alter the originals.

## Contribution protocol

Open a GitHub issue or pull request for exactly one of these tasks:

- **Verify a paper:** compare one dossier with its full text and cite the source passage.
- **Narrow a claim:** identify wording that exceeds the evidence and propose a bounded replacement.
- **Add a boundary:** document an untested condition, alternative explanation or failed generalisation.
- **Connect records:** propose a typed relation and explain why it is `supports`, `contradicts`, `replicates`, `narrows`, `generalises`, or `depends_on`.
- **Improve the pipeline:** make extraction more traceable without turning heuristics into a truth score.

Every scientific edit must preserve provenance. Popularity, novelty and rhetorical importance are never validation states.
