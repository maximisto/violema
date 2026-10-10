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

- `lib/pages.mjs`: static page composition and navigation.
- `lib/render.mjs`: shared evidence renderer, escaped text, safe source links, and bounded additive-shift arithmetic.
- `browser/site.mjs`: progressive enhancement for corpus selection, claim selection, range control, and reset.
- `browser/site.css`: responsive typography and layout.
- `assets/`: self-hosted fonts with their licences and the placeholder icon (see below).
- `data/`: source packet contract, evidence records, provenance and execution receipts. See `data/provenance.md` for scope and scientific limitations.
- `scripts/build.mjs`: validates exported packet freshness, then builds only `company-site/dist`.
- `scripts/preview.mjs`: loopback-only preview server.
- `tests/`: source-contract, arithmetic, renderer, metadata and generated-output tests.

The generated routes are `dist/index.html`, `dist/method/index.html`, and `dist/demo/index.html`. Every company browser asset and downloadable packet lives under `dist/company-assets/`; the legacy application's `/assets/` and `/brand/` paths remain available for migration compatibility. Build output is ignored by Git.

## Fonts and icon

`assets/fonts/` holds the two variable fonts PsychDoc already self-hosts, copied byte for byte from PsychDoc's `app/fonts/` (brand-refresh branch, 2026-10-10) with no download:

| File | Origin package | Licence |
| --- | --- | --- |
| `instrument-sans-latin-wght-normal.woff2` | `@fontsource-variable/instrument-sans@5.3.0`, latin subset | SIL Open Font License 1.1, `LICENSE-instrument-sans.txt` |
| `inter-latin-wght-normal.woff2` | `@fontsource-variable/inter@5.3.0`, latin subset | SIL Open Font License 1.1, `LICENSE-inter.txt` |

`assets/fonts/SHA256SUMS` records all four files; a test checks the sums and that the build serves the files and licences unchanged under `/company-assets/fonts/`. Instrument Sans sets the wordmark, headings, navigation and buttons; Inter sets running text.

`assets/violema-icon.svg` is a placeholder favicon (a capital V in the accent on the page ground, with a dark-scheme variant). The header wordmark is live text. Both are placeholders until a chosen mark exists.

## Updating a packet

Edit the owned source records, preserve source identities and review status, then run `node scripts/export-corpora.mjs`. Review the JSON packet diff. Build fails if a packet is stale or its contract fails. The optional source-engine portability check is documented in `data/provenance.md`; the normal build does not import or require the other application.

The JavaScript renderer reads the same frozen data module as the static build. Without JavaScript, both corpus packets, all claims, condition tables, source links and downloads remain available. The slider is hidden until enhancement initializes. Selecting the materials corpus clears the clinical shift; reset returns to the first corpus, first claim and zero shift. Numbers shown in prose are rounded for reading; packet and calculation values retain full precision.

## Browser acceptance

Run against the built preview. Check all three routes by direct load and refresh at desktop, 390px and 320px widths. Verify corpus and claim links with mouse and keyboard, range changes including endpoints, materials isolation, reset, packet downloads, reduced motion and a no-JavaScript load. Table overflow is intentionally contained inside the keyboard-focusable comparison region; the page itself must not overflow horizontally. Inspect console and network failures.

Automated Node checks cover arithmetic boundaries, packet identity, document IDs/anchors, local links, assets, source protocols, corpus isolation, and meaningful no-JavaScript markup. Browser checks are separate because the package deliberately has no browser automation dependency.

This directory contains no deploy action. The adjacent migration preparation packet owns nginx cutover/rollback instructions. Do not copy the preview to production or remove preview indexing guards without a separate release request.
