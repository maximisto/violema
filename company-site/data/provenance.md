# Scientific demo packet provenance

Packet version: `2026-10-10.1`. Curated on 10 October 2026.

These two frozen packets share one source/claim/condition contract and one presentation adapter. Claims were selected and paraphrased manually from the passages identified below. No live ingestion, automated full-text extraction, complete literature search, new statistical model fit or qualified human scientific review was performed for this website build.

## PsychDoc: saved results, exact inputs

The source is PsychDoc commit `3001296325cb95d64fcca6e412eb10b48264144a`. The checked-out files used for the local verification were verified byte-for-byte against that commit before execution; uncommitted work was not used or changed. The existing offline demo at commit `308542e15a0a1b6e8b2e70780c32578bd4bae8ac` was inspected read-only, not replaced.

| Artifact | SHA-256 |
| --- | --- |
| `analysis/stage_b/results/stability.json` | `7289ec7d89f6df0061d2aa7508f58c4d46c37a611a5838162470596ff1e1ace1` |
| Pinned SYPRES CSV | `237b4a5601bd4de1b1c1b0e335e730677c2b09cd7a3ce2c893df623e9feba793` |
| Stage B declaration | `5c3bff63ca9c694f40dec1bf4349381711692bfa0542e3337d95cf5f06a421ef` |

`stage-b-snapshot.json` retains the selected `primary` and `mdd-trd` records at full precision plus the relevant source hashes. The primary g is `-0.9030829073153204`; its confidence interval is `[-1.256109404142053, -0.5500564104885878]`. Formatting to two decimal places is a display choice. The prediction interval and subgroup reuse the same dataset; they must not be counted as additional independent studies.

Public sources:

- [SYPRES paper](https://doi.org/10.1038/s44220-026-00630-8): public abstract identified. This build did not inspect its paywalled sections or re-audit trial inputs.
- [SYPRES dataset 25.1.2](https://doi.org/10.5281/zenodo.17657950): immutable release identity. The original pinned CSV is unchanged; the release records CC BY 4.0. Attribution to the dataset's authors is retained, with no implied endorsement.
- [SYPRES author analysis release 26.0.0](https://github.com/PennLINC/sypres-docs/tree/26.0.0): original analysis-code identity. PsychDoc's existing R rerun receipt and saved results were inspected. Neither the R analysis nor a fresh source-input audit ran during this build.
- [PsychDoc canonical demonstration](https://psychdoc.ai/#stress): current public application. This URL is a live navigation destination, not an immutable artifact URL. The downloadable snapshot is the pin for this preview.

The `analysis/stage_b/REVIEW.md` at the pinned commit says the Stage B brief awaits independent review and trial arm-level input verification remains incomplete. A computed result and a matching checksum do not resolve those gaps. The original rerun used package substitutions, documented in that review packet; this preview makes no claim to have repeated that environment.

### Trial records of the saved primary analysis

`sypres-primary-trials.json` lists the 12 trials pooled in the saved primary analysis, one record per label in `stage-b-snapshot.json` `primary.studies` (`primary.k` = 12). Each record is a trial, not a publication. It has a stable `id` (the label as a slug, for example `davis-2021`), the `study` label exactly as in the snapshot, the `year` and `registration` fields copied verbatim from the `year` and `registration_number` columns, and `dois`, every publication DOI recorded for the trial in the `doi` column (split at semicolons, each entry verbatim), all from the pinned SYPRES CSV (`analysis/stage_b/data/depression-psiloctr-25.1.2.csv`, SHA-256 `237b4a5601bd4de1b1c1b0e335e730677c2b09cd7a3ce2c893df623e9feba793`, read at PsychDoc commit `23a6e348e7a7d7586b6b205da2a2061f3e052520` on 10 October 2026). `csvRows` counts the CSV rows recorded for the label. A blank CSV field would be stored as null (or an empty `dois` list); none of the 12 is blank. Three trials record two publication DOIs; all are kept and none is treated as the trial's single source. One registration is an ANZCTR id (`ACTRN…`), not an NCT id. Nothing is filled in, chosen or corrected.

`node scripts/export-trials.mjs --check` (run by every build) fails if the records stop matching `primary.studies`, `primary.k` or the snapshot's pinned CSV hash. With `--csv <path>` or `SYPRES_CSV` set it also re-derives every record from the CSV and fails on any difference. The records identify trials; they are not a re-audit of trial inputs, which remains incomplete.

### Bias replay semantics

The control adds an assumed nonnegative value to the saved g and both confidence bounds. It preserves interval width and changes no study weights, heterogeneity, variance or source inputs. It is an illustrative replay of the existing declared common additive shift, not an estimated bias correction or new meta-analysis.

The thresholds `-0.24` and `-0.50`, and the range `0` to `0.60`, are inherited from the pinned Stage B declaration. Its threshold references are [Cuijpers et al.](https://doi.org/10.1002/da.22249) and [NICE NG222 methods supplement](https://www.nice.org.uk/guidance/ng222/evidence/supplement-1-methods-pdf-11131003117). They are illustrative, publisher-declared decision thresholds; no claim of universal clinical validity or patient-specific applicability is made. For an interval to lie wholly beyond a negative benefit threshold, its upper bound must be strictly lower than the threshold. At equality the interval touches the threshold. The exact crossings are approximately 0.3100564105 and 0.0500564105, so rounded interval text must not drive classification.

## Materials: four reports, separate guidance

The packet is a purposive comparability demonstration. Sources were chosen to show differing temperatures, atmospheres, encapsulation and stability endpoints. Publication independence, device batches and sample sizes were not adjudicated. “Not extracted” means not present in this curated packet, not necessarily unreported by the authors. No paper figures or full article text are redistributed.

| Source | Passage actually used | Scope boundary |
| --- | --- | --- |
| [Jiang et al., 2023](https://doi.org/10.1038/s41586-023-06610-7) | Public abstract | Retain temperature-dependent, projected-endpoint wording. Do not turn the two temperature conditions into two independent reports or an outdoor lifetime guarantee. |
| [Wang et al., 2024](https://doi.org/10.1038/s41586-024-07705-5) | Abstract; Device performance and stability; Fig. 4c caption; Solar-cell characterization | The selected row is the encapsulated, 85 °C, ~30% RH air experiment. Its stability device baseline is 23.0%; champion efficiency and the separate nitrogen experiment are not substituted. |
| [Lian et al., 2025](https://doi.org/10.1038/s41467-025-62391-9) | Public abstract | Stability concerns 1.77 eV cells, not the separately reported tandem efficiency. Other test conditions remain unextracted. |
| [Zhang et al., 2021](https://doi.org/10.1038/s41467-021-23566-2) | Abstract; Fig. 5c caption | Continuous operation in nitrogen at 25 °C is distinct from ambient shelf ageing and the separate 85 °C experiment. |
| [Khenkin et al., 2020](https://doi.org/10.1038/s41560-019-0529-5) | Checklist for PSC stability studies; Table 3; stability figures of merit discussion / Table 5 | Reporting guidance, not another measured device result. |

All five source records carry HTTPS DOI links and exact human-readable locators. Those cited passages were retrieved on the curation date using public publisher pages/search results. A future reader's access can differ. No inference is made from a download icon or open-access label alone.

There is no harmonized outcome table, uncertainty model or reviewed dependence structure for this packet. It has `analysis: null`. The same claim renderer does not imply portable numerical validity.

## What was actually reused

The optional `prove-portability.mts` check executes PsychDoc's unchanged TypeScript modules through an already-installed `tsx`. It checks the local file hashes against both the pinned hashes and `git show` at the pinned commit before importing them.

| Unchanged PsychDoc module | Exercised behavior |
| --- | --- |
| `lib/content/schema.ts` | `danglingClaims`, `danglingRelations`, `danglingEntities`; deliberately missing source is detected in each packet |
| `lib/synthesis/trust.ts` | `computeTrust` receives each adapted packet; no discovery snapshot yields coverage basis `none`, ratio `null`, scan `null` |
| `lib/synthesis/corpus.ts` | Existing runtime dependency of trust module, hash checked; discovery itself was not run |

`portability-receipt.json` records the execution, hashes and returned values. The new `contract.mjs` adapter maps source IDs, claims and caveats into the existing schema. There are zero edits to PsychDoc core code. It does not fill in missing author metadata, manufacture expert review or expose the trust module's author-overlap grouping as statistical independence. It supplies provisional technical tier values to satisfy the schema; those tiers are not published as evidence grades. No authored fragility rules were supplied, so the trust module correctly returns zero fragility entries.

The new validator rejects missing local references, duplicate IDs, repeated source edges and repeated canonical DOI/URL identities. This is exact-record duplicate handling, not fuzzy publication deduplication or cohort resolution. The actual numerical loader still names the pinned psilocybin CSV and its SYPRES filters; no arbitrary-corpus numerical engine was built.

To repeat the optional proof from the company-site directory, using an existing read-only PsychDoc checkout with dependencies already installed:

```sh
"$PSYCHDOC_ROOT/node_modules/.bin/tsx" data/prove-portability.mts "$PSYCHDOC_ROOT"
node scripts/export-corpora.mjs
node --test tests/corpora.test.mjs
```

The ordinary site build does not depend on that checkout. Generated JSON packets are checked against the module, and the receipt is checked against the adapter and packet hashes. Adapter time and analyst/review hours were not instrumented; this result does not establish a measured cost or speed of domain transfer. Qualified scientific review remains outstanding.

## Typefaces

The site self-hosts Instrument Sans and Inter as variable WOFF2 files, latin subset, from `@fontsource-variable/instrument-sans@5.3.0` and `@fontsource-variable/inter@5.3.0`. They were copied from PsychDoc's vendored `app/fonts/` directory, not downloaded, and are distributed under the SIL Open Font License 1.1 with the licence texts beside them in `assets/fonts/`. Checksums are in `assets/fonts/SHA256SUMS`.
