# Claim Record Specification v0.1

A Claim Record is the smallest independently inspectable unit in Claim Commons.

## Required sections

### 1. Claim

- **Title**: a short label, not a significance statement.
- **Statement**: one bounded sentence that can be judged true, false, or unresolved.
- **Type**: empirical observation, comparison, causal, mechanistic, mathematical, computational existence, generalisation, methodological, replication, null/negative, or other.
- **Strength**: existence, directional, quantitative, causal, mechanistic, general, or theorem.
- **Scope**: systems, populations, datasets, models, conditions, and time windows covered.
- **Independent unit**: the unit that supports inference, such as animal, session, input batch, simulation seed, theorem, or dataset.

### 2. Background dependencies

Only the prior facts needed to understand or interpret the claim. Each dependency should eventually point to another Claim Record or a conventional citation.

### 3. Evidence

Every evidence item must state:

- design;
- sample and independent units;
- method or analysis;
- observed result;
- uncertainty or proof status;
- artifacts such as data, code, workflow, proof, preregistration, or report;
- which claim it supports.

### 4. Boundaries

- **Non-claims**: conclusions that must not be inferred from the record.
- **Not tested**: adjacent conditions or systems not covered.
- **Falsification conditions**: results that would count against the claim.
- **Alternative explanations**: addressed, partly addressed, or open.

### 5. Interpretation

Optional. Possible significance, mechanism, application, or broader meaning. The interface must label it:

> Interpretation — not part of the validated claim.

### 6. Provenance and versioning

Contributors, roles, date, license, source context, record version, and relations to other claims.

## Claim-strength contracts

| Claim strength | Minimum contract |
|---|---|
| Existence | One valid, reproducible instance with scope stated |
| Directional | Matched comparison and replication across intended independent units |
| Quantitative | Effect size, uncertainty, protocol matching, and no unresolved censoring |
| Causal | Intervention or design sufficient to address principal confounding |
| Mechanistic | Evidence distinguishing the proposed mechanism from serious alternatives |
| General | Independent variation along the axes named in the generality claim |
| Theorem | Explicit assumptions, formal statement, and inspectable proof |

The platform may store a weaker record, but the wording must be narrowed to the evidence actually supplied.
