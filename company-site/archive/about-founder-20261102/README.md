# About founder section — temporary archive

Saved 2026-11-02 before the company-focused About revision, from commit `53c798c88a2dc86686d92985bb6cce897511b7df`.

- `founder-section.mjs.txt`: exact original `founderExplorer` and `founderLeadSection` declarations from `lib/pages.mjs`.
- `founder-section.html`: exact rendered lead section from that commit, including the portrait, biography, career tabs, client marks and personal profile cards.
- Source portrait and client assets remain in their original paths. Founder CSS, guarded browser behavior and `profileCards()` remain available. This archive is not copied to `dist` and has no public page or route.
- The existing ORCID is `https://orcid.org/0009-0009-9354-2207`; the revised build shows it separately from company accounts in every footer.

## Restore

1. Insert the two saved declarations into `aboutPage()` immediately before `corporateDirectory` in `lib/pages.mjs`.
2. Import `profileCards` from `./social.mjs` again and put `founderLeadSection` first in the returned section array.
3. Change `company-title` back from `h1` to `h2` and remove the temporary `.about-company-left > h1` style. The restored lead section contains the page's h1.
4. Review current company facts and biography with Max before republishing. Restore the About description and `llms.txt` founder wording only if appropriate; decide whether to keep the footer ORCID or return to the original profile cards alone.
5. Update the current-page assertions, build and test `company-site`, and verify desktop/mobile. Deployment needs its own authorization.

For the complete original implementation, inspect `company-site/lib/pages.mjs`, `lib/social.mjs`, `browser/site.css`, `browser/site.mjs`, `tests/site.test.mjs` and `scripts/build.mjs` at the source commit above. Do not wholesale replace those files over later unrelated edits.

## Retained asset SHA-256

- `assets/max-markovtsev.jpg`: `e829529fbbaa64930ad4582aa45e6064bae117c095d52114e69710be2df895cd`
- `assets/clients/unilever.svg`: `c86f421d52d6fbb6b2f443cc7c42919690fee10a0feae569dbc694064bfabdb9`
- `assets/clients/wrigley.svg`: `6a53d5f32e36444548c5d7a41596aeedd51f7b00e00881384ef90e52d2704547`
- `assets/clients/nestle.svg`: `7f24c7034910b38e0ecfd3adc88c6b88a2c76a53c4ea89ab22ce763b4c8005f3`
