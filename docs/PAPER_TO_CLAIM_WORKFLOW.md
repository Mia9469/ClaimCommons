# Paper → Claims → Questions workflow v0.3

Claim Commons does not summarize each paper into one sentence. A paper is a source container; each paper can contribute one or more complete **Claim–Evidence–Conclusion** units.

## 1. Source gate
Record the DOI, version, bibliographic identity and exact source location. Do not upload copyrighted PDFs. A generated sentence without a traceable source remains a candidate.

## 2. Contribution enumeration
Read the paper as a whole and list every major, independently inspectable contribution. Do not force the paper into one headline claim, and do not claim exhaustive coverage until a curator has checked all result sections, figures and appendices.

## 3. Define the proposition before connecting it

Starting with neuroscience, make objects, source definitions, operational measurements, conditions and assumptions explicit. This borrows a useful discipline from formalized mathematics; it does not claim that this alone explains progress in mathematical AI, that empirical findings become proofs, or that AI reasoning has already improved. The benefit is a design hypothesis to evaluate.

New extraction outputs carry optional `assessment_frame`, `terms` and `ambiguities` fields. Preserve the source wording. A missing or ambiguous definition stays visible instead of being replaced by a textbook meaning. Do not split away joint assumptions or controls merely to make claims smaller. See [Claim context v1](CLAIM_CONTEXT_V1.md) for the contract and rollout boundaries.

## 4. Complete claim contract
Every public claim needs:

- **Claim:** one bounded scientific proposition;
- **Evidence:** method, data, theory, or their combination, including the actual independent unit;
- **Positive conclusion:** what the evidence supports;
- **Boundary:** conditions, population, model, task or scale where it applies;
- **Negative result:** a failed or contrary outcome from a test actually performed;
- **Non-inference:** a stronger conclusion the evidence cannot establish;
- **Unresolved:** remaining alternative explanation or unanswered question;
- **Provenance and verification state.**

Missing fields are not silently invented. An explicit “not reported” is better than a plausible completion.

## 5. Verification states
`machine_candidate` is an extraction candidate. `source_reported` means a curator checked that the record faithfully represents the source. It does not mean the claim is true, independently replicated, or author-endorsed.

## 6. Two-level organization
Claims receive one or more of seven broad directions for navigation. They may also join a specific **claim family** defined by a scientific question. Broad directions must stay coarse. Families may be narrower, but membership only means the claims are useful to compare.

## 7. Cross-paper relations
A shared keyword, direction or claim family is not a scientific relation. Add `supports`, `replicates`, `contradicts`, `narrows`, `extends` or `depends_on` only after checking both sources, independence of evidence, compatible operational definitions and scope. Multiple claims from one paper never count as independent replication.

## 8. Public views
The same records must be reachable in three ways:

1. **Direction view:** discover a broad area and inspect its concrete claims.
2. **Paper view:** see every currently extracted claim from one paper.
3. **Question view:** ask whether a proposition has evidence, what type, where it holds, and what failed.

## 9. Contribution unit
A pull request should change one auditable decision: add or verify one claim, correct one evidence contract, add one boundary, define one question family, or verify one relation. Popularity, novelty and rhetorical importance are never verification states.
