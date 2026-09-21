# Paper → Claims → Questions workflow v0.2

Claim Commons does not summarize each paper into one sentence. A paper is a source container; each paper can contribute one or more complete **Claim–Evidence–Conclusion** units.

## 1. Source gate
Record the DOI, version, bibliographic identity and exact source location. Do not upload copyrighted PDFs. A generated sentence without a traceable source remains a candidate.

## 2. Contribution enumeration
Read the paper as a whole and list every major, independently inspectable contribution. Do not force the paper into one headline claim, and do not claim exhaustive coverage until a curator has checked all result sections, figures and appendices.

## 3. Complete claim contract
Every public claim needs:

- **Claim:** one bounded scientific proposition;
- **Evidence:** method, data, theory, or their combination, including the actual independent unit;
- **Positive conclusion:** what the evidence supports;
- **Boundary:** conditions, population, model, task or scale where it applies;
- **Negative conclusion:** failed result or inference that cannot be made;
- **Unresolved:** remaining alternative explanation or unanswered question;
- **Provenance and verification state.**

Missing fields are not silently invented. An explicit “not reported” is better than a plausible completion.

## 4. Verification states
`machine_candidate` is an extraction candidate. `source_reported` means a curator checked that the record faithfully represents the source. It does not mean the claim is true, independently replicated, or author-endorsed.

## 5. Two-level organization
Claims receive one or more of seven broad directions for navigation. They may also join a specific **claim family** defined by a scientific question. Broad directions must stay coarse. Families may be narrower, but membership only means the claims are useful to compare.

## 6. Cross-paper relations
A shared keyword, direction or claim family is not a scientific relation. Add `supports`, `replicates`, `contradicts`, `narrows`, `extends` or `depends_on` only after checking both sources, independence of evidence, compatible operational definitions and scope. Multiple claims from one paper never count as independent replication.

## 7. Public views
The same records must be reachable in three ways:

1. **Direction view:** discover a broad area and inspect its concrete claims.
2. **Paper view:** see every currently extracted claim from one paper.
3. **Question view:** ask whether a proposition has evidence, what type, where it holds, and what failed.

## 8. Contribution unit
A pull request should change one auditable decision: add or verify one claim, correct one evidence contract, add one boundary, define one question family, or verify one relation. Popularity, novelty and rhetorical importance are never verification states.
