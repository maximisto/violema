# Violema scientific company site

This isolated Node-built static bundle does not change the existing frontend, backend, scheduler, deployment script or provider configuration. It requires Node 20 or later and no package installation.

```sh
cd company-site
node scripts/export-corpora.mjs --check
node scripts/export-trials.mjs --check   # add --csv <pinned SYPRES CSV> to re-derive the records
npm run build
npm test
npm run preview
```

Open `http://127.0.0.1:4317/`, `/method/`, `/demo/` and `/review/`. `PORT` can override the local preview port. The preview server binds to loopback, supports only GET/HEAD, and returns `X-Robots-Tag: noindex, nofollow`. Built homepage, method and demo HTML is indexable for the owner-authorized release; robots.txt allows crawling and the sitemap lists those three routes. The physician review page uses `noindex,follow` and is excluded from the sitemap. This is discoverability control, not authentication. Missing static paths return 404 locally. The footer link `/login` belongs to the preserved production application and is not part of this bundle.

## Layout

- `lib/pages.mjs`: page shell (wordmark header, footer, metadata), the protocol stations, and the four routes.
- `lib/render.mjs`: shared evidence renderer: escaped text, safe source links, bounded additive-shift arithmetic, the interval scale, the trace specimen (a claim joined to its cited source records), the bias control and the demo bench.
- `browser/site.mjs`: entry module on every page: header state, pinning the hero trace once drawn, segmented controls; it imports `lab.mjs` only where a replay or the bench exists.
- `browser/tabs.mjs`: ARIA tabs over plain anchor links (arrow, Home and End keys; links still jump without JavaScript).
- `browser/lab.mjs`: the assumed-bias replay (physician review and demo) and the bench: corpus switch, claim selection, reset and hash links.
- `browser/site.css`: colour tokens (light, dark and the always-dark instrument), type scale, layout and the one on-load animation.
- `assets/`: self-hosted fonts with their licences (see below).
- `brand/`: the approved logo, its icon, the concepts that led to it and their prompts (see "Scientific logo preview").
- `docs/design-plan.md`: the design plan: tokens, type, layouts and the instrument's anatomy.
- `data/`: source packet contract, evidence records, provenance and execution receipts. See `data/provenance.md` for scope and scientific limitations.
- `scripts/export-trials.mjs`: exports and checks the 12 trial records of the saved primary analysis (`data/sypres-primary-trials.json`) against `stage-b-snapshot.json` and, given `--csv` or `SYPRES_CSV`, the pinned SYPRES CSV.
- `scripts/build.mjs`: validates exported packet and trial-record freshness, then builds only `company-site/dist`.
- `scripts/preview.mjs`: loopback-only preview server.
- `tests/`: source-contract, arithmetic, renderer, metadata and generated-output tests.

The generated routes are `dist/index.html`, `dist/method/index.html`, `dist/demo/index.html`, and `dist/review/index.html`. Every company browser asset and downloadable packet lives under `dist/company-assets/`; the legacy application's `/assets/` and `/brand/` paths remain available for migration compatibility. The build no longer reads anything from `frontend/`. Build output is ignored by Git.

## Design system

Colours are CSS custom properties on `:root`; components use only tokens. The site ships in the light theme only (`color-scheme: light`) until a reversed logo is approved, because the approved logo's ink subtitle disappears on dark grounds; the parked dark values are in `docs/design-plan.md`. The accent is the logo's violet `#6852A3`. The instrument (home illustration, review specimen, method examples, demo bench) is dark by design: `.instrument` re-points the shared tokens to the `--inst-*` values, so components inside it need no special cases. The source illustration adds a restrained copper `#CD936B` border and endpoint; shadows only on raised objects. Instrument Sans sets display, headings, navigation and buttons; Inter sets running text; the system monospace stack is reserved for identifiers (record ids, commits, hashes, versions). See `docs/design-plan.md` for values and contrast notes.

The home hero assembles the 12 named trial records from the pinned primary-analysis packet into one source-linked claim. It is visible at every screen width. The grouped curves mean inclusion in the saved analysis, never citation edges, causal relationships, statistical independence or effect magnitude. Each record retains its `data-trial` identity and the full packet is available through the review route. There is no automatic hero animation.

`/review/` is a generic physician/researcher walkthrough: one primary claim, the four linked sources, an assumed-shift replay, the animal/human scope boundary and five focused questions. It makes no advisor appointment or affiliation claim, collects no submissions and asks for published sources without patient information. `/demo/` continues to hold both full packets and the fixed Claim 1 replay scope.

## Fonts

`assets/fonts/` holds the two variable fonts PsychDoc already self-hosts, copied byte for byte from PsychDoc's `app/fonts/` (brand-refresh branch, 2026-10-10) with no download:

| File | Origin package | Licence |
| --- | --- | --- |
| `instrument-sans-latin-wght-normal.woff2` | `@fontsource-variable/instrument-sans@5.3.0`, latin subset | SIL Open Font License 1.1, `LICENSE-instrument-sans.txt` |
| `inter-latin-wght-normal.woff2` | `@fontsource-variable/inter@5.3.0`, latin subset | SIL Open Font License 1.1, `LICENSE-inter.txt` |

`assets/fonts/SHA256SUMS` records all four files; a test checks the sums and that the build serves the files and licences unchanged under `/company-assets/fonts/`. Instrument Sans sets the wordmark, headings, navigation and buttons; Inter sets running text.

## Logo

The header shows the owner-approved scientific logo and the favicon uses its matching icon. Both live in `brand/` and the build copies them unchanged: `brand/violema-restored-type-20261010.png` to `company-assets/violema-logo.png` and `brand/violema-fine-neck-icon-20261010.png` to `company-assets/violema-icon.png`. Do not edit, regenerate or recolour files under `brand/`; a test checks the served files are byte-identical to the approved ones. The unchanged logo is about 248 px wide on desktop and spans the available phone header width, with navigation below it on narrow screens.

## Updating a packet

Edit the owned source records, preserve source identities and review status, then run `node scripts/export-corpora.mjs`. Review the JSON packet diff. Build fails if a packet is stale or its contract fails. The optional source-engine portability check is documented in `data/provenance.md`; the normal build does not import or require the other application.

The JavaScript renderer reads the same frozen data module as the static build. Without JavaScript, both corpus packets, all claims, condition tables, source links and downloads remain available. The slider is hidden until enhancement initializes. Selecting the materials corpus clears the clinical shift; reset returns to the first corpus, first claim and zero shift. Numbers shown in prose are rounded for reading; packet and calculation values retain full precision.

## Browser acceptance

Run against the built preview. Check all four routes by direct load and refresh at 1440, 1024, 768, 390 and 320 px widths in the light theme, and confirm a dark colour-scheme preference still renders the light page with the dark instrument. Verify corpus and claim links with mouse and keyboard, the segmented controls' arrow keys, range changes including endpoints on the physician review page and the demo, materials isolation, reset, packet downloads, reduced motion (the static source illustration stays visible), a no-JavaScript load (drawn trace, static interval, every claim and table), focus rings on every control, 44 px targets on phones and text contrast of at least 4.5:1. Table overflow is intentionally contained inside the keyboard-focusable comparison region; the page itself must not overflow horizontally. Inspect console and network failures.

Automated Node checks cover arithmetic boundaries, packet identity, document IDs/anchors, local links, assets, source protocols, corpus isolation, and meaningful no-JavaScript markup. Browser checks are separate because the package deliberately has no browser automation dependency.

This directory contains no deploy action. The adjacent migration preparation packet owns nginx cutover/rollback instructions. Production deployment remains a separate operation. The owner explicitly authorized the scientific site and physician review release on 2026-10-10; changing this bundle does not itself deploy it.

## Scientific logo preview

The October 10 circuit-hair and glasses concept replaces the operator lockup only in this local company-site bundle. After feedback that three thick strands looked jester-like, layered flowing hair and fine microchip traces were restored; research glasses and the Scientific Evidence descriptor reflect the new positioning. Max then approved this direction and requested an open eye; the current logo and icon use a calm, attentive open eye. The current wordmark restores lighter original-style geometric lettering, adds generous space beside the face, and integrates violet-to-copper color across the name. Both text lines render larger without increased boldness; the subtitle spans the name, and the increased header display sizes remain. The logo and matching icon now use a fine jaw/neck contour instead of the heavy dark band. The preferred pre-neck-edit lettering has been restored with an explicitly authorized direct pixel copy; the portrait and lettering regions are verified against their respective source images. `brand/` preserves the microscope alternative, selected transparent PNG, icon and generation prompts. The existing application brand assets remain intact. These raster concepts still need final vector/small-size refinement before a permanent brand release.

### Prepared evidence map

The homepage map uses the canonical PsychDoc export copied unchanged to `data/evidence-map.json`.
Its SHA-256 is embedded in `data-map-sha256`; the exact JSON is also served as a download.
The source synthesis was updated on 2026-10-05. From the PsychDoc checkout, run
`npx tsx scripts/export-evidence-map.ts`, verify the export there, then copy
that file here before building. The company-site build intentionally fails if this input is absent.

Paper-to-claim edges are recorded source memberships. Claim-to-claim edges are authored relationships;
posed questions use dashed strokes. There is no citation-network or embedding layer in this version.
Positions are stable layout choices and do not encode causality, similarity or effect size. Study/method
filters use explicit registry metadata. All papers, claims and relationships remain available in the
HTML text alternative without JavaScript. The existing 12-trial saved-analysis hero is separate.
