# Company-site local preview

This isolated Node-built static bundle does not change the existing frontend, backend, scheduler, deployment script or provider configuration. It requires Node 20 or later and no package installation.

```sh
cd company-site
node scripts/export-corpora.mjs --check
npm run build
npm test
npm run preview
```

Open `http://127.0.0.1:4317/`, `/method/` and `/demo/`. `PORT` can override the local preview port. The server binds to loopback, supports only GET/HEAD, and serves exact files with no application fallback. Missing paths return 404. Preview HTML and response headers remain `noindex`; robots.txt disallows crawling. These are deliberate preview defaults and require a separate release decision.

## Layout

- `lib/pages.mjs`: page shell (wordmark header, footer, metadata), the protocol stations, and the three routes.
- `lib/render.mjs`: shared evidence renderer: escaped text, safe source links, bounded additive-shift arithmetic, the interval scale, the trace specimen (a claim joined to its cited source records), the bias control and the demo bench.
- `browser/site.mjs`: entry module on every page: header state, pinning the hero trace once drawn, segmented controls; it imports `lab.mjs` only where a replay or the bench exists.
- `browser/tabs.mjs`: ARIA tabs over plain anchor links (arrow, Home and End keys; links still jump without JavaScript).
- `browser/lab.mjs`: the assumed-bias replay (home hero and demo) and the bench: corpus switch, claim selection, reset and hash links.
- `browser/site.css`: colour tokens (light, dark and the always-dark instrument), type scale, layout and the one on-load animation.
- `assets/`: self-hosted fonts with their licences (see below).
- `brand/`: the approved logo, its icon, the concepts that led to it and their prompts (see "Scientific logo preview").
- `docs/design-plan.md`: the design plan: tokens, type, layouts and the instrument's anatomy.
- `data/`: source packet contract, evidence records, provenance and execution receipts. See `data/provenance.md` for scope and scientific limitations.
- `scripts/build.mjs`: validates exported packet freshness, then builds only `company-site/dist`.
- `scripts/preview.mjs`: loopback-only preview server.
- `tests/`: source-contract, arithmetic, renderer, metadata and generated-output tests.

The generated routes are `dist/index.html`, `dist/method/index.html`, and `dist/demo/index.html`. Every company browser asset and downloadable packet lives under `dist/company-assets/`; the legacy application's `/assets/` and `/brand/` paths remain available for migration compatibility. The build no longer reads anything from `frontend/`. Build output is ignored by Git.

## Design system

Colours are CSS custom properties on `:root`, redefined for `prefers-color-scheme: dark`; components use only tokens. The instrument (hero specimen, method examples, demo bench) is dark in both themes: `.instrument` re-points the shared tokens to the `--inst-*` values, so components inside it need no special cases. One accent, no gradients, glows or glass; shadows only on raised objects. Instrument Sans sets display, headings, navigation and buttons; Inter sets running text; the system monospace stack is reserved for identifiers (record ids, commits, hashes, versions). See `docs/design-plan.md` for values and contrast notes.

The hero trace is the only on-load motion. Its leads are SVG lines placed by percentage on equal-height source rows, drawn with `stroke-dashoffset` under `@media (scripting: enabled) and (prefers-reduced-motion: no-preference)`; with JavaScript off or reduced motion they are simply drawn. Every mark comes from the packet: the leads are the claim's `sourceIds`, the scale shows the saved estimate, interval and reference thresholds.

## Fonts

`assets/fonts/` holds the two variable fonts PsychDoc already self-hosts, copied byte for byte from PsychDoc's `app/fonts/` (brand-refresh branch, 2026-10-10) with no download:

| File | Origin package | Licence |
| --- | --- | --- |
| `instrument-sans-latin-wght-normal.woff2` | `@fontsource-variable/instrument-sans@5.3.0`, latin subset | SIL Open Font License 1.1, `LICENSE-instrument-sans.txt` |
| `inter-latin-wght-normal.woff2` | `@fontsource-variable/inter@5.3.0`, latin subset | SIL Open Font License 1.1, `LICENSE-inter.txt` |

`assets/fonts/SHA256SUMS` records all four files; a test checks the sums and that the build serves the files and licences unchanged under `/company-assets/fonts/`. Instrument Sans sets the wordmark, headings, navigation and buttons; Inter sets running text.

## Logo

The header shows the owner-approved scientific logo and the favicon uses its matching icon. Both live in `brand/` and the build copies them unchanged: `brand/violema-restored-type-20261010.png` to `company-assets/violema-logo.png` and `brand/violema-fine-neck-icon-20261010.png` to `company-assets/violema-icon.png`. Do not edit, regenerate or recolour files under `brand/`; a test checks the served files are byte-identical to the approved ones. The logo is set at about 248 px wide on desktop and 168 px on phones so its "Scientific Evidence" line stays legible.

## Updating a packet

Edit the owned source records, preserve source identities and review status, then run `node scripts/export-corpora.mjs`. Review the JSON packet diff. Build fails if a packet is stale or its contract fails. The optional source-engine portability check is documented in `data/provenance.md`; the normal build does not import or require the other application.

The JavaScript renderer reads the same frozen data module as the static build. Without JavaScript, both corpus packets, all claims, condition tables, source links and downloads remain available. The slider is hidden until enhancement initializes. Selecting the materials corpus clears the clinical shift; reset returns to the first corpus, first claim and zero shift. Numbers shown in prose are rounded for reading; packet and calculation values retain full precision.

## Browser acceptance

Run against the built preview. Check all three routes by direct load and refresh at 1440, 1024, 768, 390 and 320 px widths, in light and dark colour schemes. Verify corpus and claim links with mouse and keyboard, the segmented controls' arrow keys, range changes including endpoints on the home hero and the demo, materials isolation, reset, packet downloads, reduced motion (the hero trace appears drawn), a no-JavaScript load (drawn trace, static interval, every claim and table), focus rings on every control, 44 px targets on phones and text contrast of at least 4.5:1. Table overflow is intentionally contained inside the keyboard-focusable comparison region; the page itself must not overflow horizontally. Inspect console and network failures.

Automated Node checks cover arithmetic boundaries, packet identity, document IDs/anchors, local links, assets, source protocols, corpus isolation, and meaningful no-JavaScript markup. Browser checks are separate because the package deliberately has no browser automation dependency.

This directory contains no deploy action. The adjacent migration preparation packet owns nginx cutover/rollback instructions. Do not copy the preview to production or remove preview indexing guards without a separate release request.

## Scientific logo preview

The October 10 circuit-hair and glasses concept replaces the operator lockup only in this local company-site bundle. After feedback that three thick strands looked jester-like, layered flowing hair and fine microchip traces were restored; research glasses and the Scientific Evidence descriptor reflect the new positioning. Max then approved this direction and requested an open eye; the current logo and icon use a calm, attentive open eye. The current wordmark restores lighter original-style geometric lettering, adds generous space beside the face, and integrates violet-to-copper color across the name. Both text lines render larger without increased boldness; the subtitle spans the name, and the increased header display sizes remain. The logo and matching icon now use a fine jaw/neck contour instead of the heavy dark band. The preferred pre-neck-edit lettering has been restored with an explicitly authorized direct pixel copy; the portrait and lettering regions are verified against their respective source images. `brand/` preserves the microscope alternative, selected transparent PNG, icon and generation prompts. The existing application brand assets remain intact. These raster concepts still need final vector/small-size refinement before a permanent brand release.
