# Worked extraction examples

Two bilingual, static teaching pages are linked from the homepage's `#examples` section:

- `roxin-2011.html`: theory, simulation, distributional fits and parameter effects.
- `hausser-2010.html`: Branco, Clark and Häusser's 2010 experiments on input sequence discrimination.

## Source and status

Full-text sources and exact main-text figure/page locators are embedded in each record. The records describe a main-text-checked teaching extraction, not independent replication, exhaustive coverage, or author endorsement. Supplement-dependent claims for Branco et al. are explicitly deferred. Numerical sample labels preserve the paper's wording. Negative findings, non-inferences and unresolved questions are separate fields.

Teaching records are not automatically promoted to the main library or counted as curated entries. The downloadable `data/extraction-examples-v1.json` contains the bilingual records and source information. Paper-to-record links show membership, not replication or causation.

## Rebuild

Edit `scripts/build-extraction-examples.mjs`, which contains bilingual source records and the shared page template. Run:

```sh
# Public ClaimCommons repository (GitHub Pages publishes app/static)
node scripts/build-extraction-examples.mjs app/static
```

The workspace wrapper also supports running with no argument to generate pages under its own root. Keep `examples.css`, `examples.js`, both pages and the JSON together under the site root. No build dependencies are required.

Language uses the existing `cc-lang` storage key, with an explicit `?lang=zh` or `?lang=en` taking priority. Internal links retain the active language and claim hashes. All claim text is present in static HTML; native details remain usable without JavaScript.
