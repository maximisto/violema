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

Open `http://127.0.0.1:4317/`, `/method/`, `/demo/`, `/review/`, `/about/`, `/legal/terms/` and `/legal/privacy/`. `PORT` can override the local preview port. The preview server binds to loopback, supports only GET/HEAD, and returns `X-Robots-Tag: noindex, nofollow`. Built homepage, method, demo, about and website policy HTML is indexable for the owner-authorized release; robots.txt allows crawling and the sitemap lists those six routes. The physician review page uses `noindex,follow` and is excluded from the sitemap. This is discoverability control, not authentication. Missing static paths return 404 locally. The links `/login`, `/terms` and `/privacy` belong to the preserved production application and are not part of this bundle.

## Layout

- `lib/pages.mjs`: page shell (logo header, appearance control, footer, metadata), the protocol stations, and the six routes.
- `lib/experience.mjs`: the five homepage chapters, guided claim/source/limits interaction and six-part method explorer.
- `lib/legal.mjs`: public website terms and privacy copy; separate from legacy workspace policies. The privacy wording follows the visit-statistics switch.
- `lib/social.mjs`: the company's profiles (`profiles`: LinkedIn, Instagram, X, YouTube, Reddit, Facebook, GitHub, all Violema's own accounts) rendered as icon links in every footer, and the founder's (`founderProfiles`: LinkedIn and ORCID) rendered as labelled cards under the founder card on /about/ only, where ORCID alone keeps its brand green. Brand glyphs are Simple Icons 13.21.0 (CC0; LinkedIn from purpleorange.ai). A company row whose URL is not yet confirmed has `href: null`: it keeps its place, links to `/` and its label says the page is to come. Never guess a handle.
- `lib/briefing.mjs` and `browser/briefing.mjs`: the briefing form (see "Briefing form" below).
- `lib/analytics.mjs`: the visit-statistics switch (Umami website ID and policy date) and the tracker tag. See "Visit statistics" below.
- `lib/how-it-works.mjs`: the method page's "How it works" and "Where this is going" sections: two inline SVG diagrams of PsychDoc's evidence system, coloured only through tokens, with their figures read from `data/how-it-works.mjs`.
- `lib/render.mjs`: shared evidence renderer: escaped text, safe source links, bounded additive-shift arithmetic, the interval scale, the trace specimen (a claim joined to its cited source records), the bias control and the demo bench.
- `browser/site.mjs`: entry module on every page: appearance preference, header state, tabs and fragment navigation. It imports the lab only on review/demo, the map when expanded, and homepage playback only on home.
- `browser/analytics.mjs`: `track()` for the four counted reader actions; a no-op without the tracker.
- `browser/tabs.mjs`: ARIA tabs over plain anchor links (arrow, Home and End keys; links still jump without JavaScript).
- `browser/lab.mjs`: the assumed-bias replay (physician review and demo) and the bench: corpus switch, claim selection, reset and hash links.
- `browser/site.css`: base colour tokens, type scale and existing page layouts.
- `browser/appearance.css`: manual light/dark themes, theme-specific logos, shared header and focus treatment.
- `browser/experience.css` and `browser/experience.mjs`: homepage chapter layouts and bounded playback.
- `assets/`: self-hosted fonts with their licences (see below). `assets/clients/` holds the Unilever, Wrigley and Nestlé marks for the About page's former-client row, copied unchanged from purpleorange.ai's founder strip (`assets/brand/founder/`, 2026-07-14); `site.css` flattens them to one ink per theme, and P&G, Northwestern Mutual and the U.S. Marine Corps are set in type, as on purpleorange.ai.
- `brand/`: only the five current approved assets, listed in [the brand README](brand/README.md). Earlier concepts and prompts are in `archive/brand-concepts-20261010/`. The homepage product signature also serves the unchanged PsychDoc.AI two-leaf wordmark in light/dark SVG variants, verified against the current PsychDoc header on 2026-10-15.
- `docs/design-plan.md`: the design plan: tokens, type, layouts and the instrument's anatomy.
- `data/`: source packet contract, evidence records, provenance and execution receipts. See `data/provenance.md` for scope and scientific limitations.
- `scripts/export-trials.mjs`: exports and checks the 12 trial records of the saved primary analysis (`data/sypres-primary-trials.json`) against `stage-b-snapshot.json` and, given `--csv` or `SYPRES_CSV`, the pinned SYPRES CSV.
- `scripts/build.mjs`: validates exported packet and trial-record freshness, then builds only `company-site/dist`.
- `scripts/preview.mjs`: loopback-only preview server.
- `tests/`: source-contract, arithmetic, renderer, metadata and generated-output tests.

The generated routes are `dist/index.html`, `dist/method/index.html`, `dist/demo/index.html`, `dist/review/index.html`, `dist/legal/terms/index.html`, and `dist/legal/privacy/index.html`. Every company browser asset and downloadable packet lives under `dist/company-assets/`; the legacy application's `/assets/` and `/brand/` paths remain available for migration compatibility. The build no longer reads anything from `frontend/`. Build output is ignored by Git.

## Design system

Colours are CSS custom properties on `:root`; components use only tokens. The site defaults to light. A sun/moon button with an accessible destination label and tooltip switches modes and remembers the choice in localStorage (`violema-theme`); the privacy page documents this local preference. OS appearance does not override a first visit. The original light logo and owner-supplied dark logo stay byte-identical and display only in their matching theme. The accent is the logo's violet `#6852A3`. The instrument (home illustration, review specimen, method examples, demo bench) is dark by design: `.instrument` re-points the shared tokens to the `--inst-*` values, so components inside it need no special cases. The source illustration adds a restrained copper `#CD936B` border and endpoint; shadows only on raised objects. Instrument Sans sets display, headings, navigation and buttons; Inter sets running text; the system monospace stack is reserved for identifiers (record ids, commits, hashes, versions). See `docs/design-plan.md` for values and contrast notes.

The home hero assembles the 12 named trial records from the pinned primary-analysis packet into one source-linked claim. It is visible at every screen width. The grouped curves mean inclusion in the saved analysis, never citation edges, causal relationships, statistical independence or effect magnitude. Each record retains its `data-trial` identity and the full packet is available through the review route. The hero and homepage method sequence each play once when sufficiently visible. Skip and Replay use the same button. Phone playback follows the parts as they enter view; reduced motion, a hidden tab or deliberate interaction settles the complete record. No numerical result is animated.

The homepage follows five chapters: overview, guided evidence, method, applications and a briefing invitation. The complete evidence map sits in a native disclosure, retaining its filters, text alternative, export and direct `#evidence-map` link. Without JavaScript, guided panels and method explanations are all present in reading order.

`/review/` is a generic physician/researcher walkthrough: one primary claim, the four linked sources, an assumed-shift replay, the animal/human scope boundary and five focused questions. It makes no advisor appointment or affiliation claim, collects no submissions and asks for published sources without patient information. `/demo/` continues to hold both full packets and the fixed Claim 1 replay scope.

## Briefing form

The homepage's closing chapter holds the site's one form, `id="briefing"`, and every "Request a briefing" link on the site (hero, footer, About) points at it. The markup is rendered at build time; `browser/briefing.mjs`, loaded by `site.mjs` only where the form exists, enables the button and posts the fields as JSON to `/api/briefing` on this host. Without JavaScript the button stays disabled and a `noscript` line names the same form on PsychDoc.AI, because a plain form post cannot reach the handler.

The handler is the one PsychDoc.AI already runs (`app/api/briefing/route.ts` in `maximisto/psychdoc-ai`): JSON only, rate limited, honeypot field `website`, the lead appended to its store and emailed to the owner. Its field contract is fixed in `lib/briefing.mjs` (`briefingIntents`, `briefingRoles`): labels are Violema's, values are the handler's. nginx hands the path over with `deploy/scientific-site/briefing-api.nginx.conf.snippet`, an exact-match location inside the company server block, placed before the legacy `/api/` prefix. That is a vhost change, so the release packet that ships the form must pin the new vhost hash and the form does not work until the location is live: check `curl -fsS -X POST https://violema.com/api/briefing -H 'content-type: application/json' -d '{}'` answers 400 with `"Check the highlighted fields."`, not 404.

The Website Privacy Policy describes the form (section 2, "Briefing form") and the Terms name it as the one submission the site accepts.

## Visit statistics

The site can count visits with Umami, self-hosted on the same VPS as psychdoc.ai and shared with it (runbook in `maximisto/psychdoc-ai`, `docs/analytics.md`). It is **on** since 2026-10-16: `analytics.websiteId` in `lib/analytics.mjs` holds the violema.com website ID and `policyDate` the privacy page's effective date. Setting both back to `null` removes the tracker and restores the no-analytics privacy wording, byte for byte. The ID is committed rather than read from the environment so a release bundle stays reproducible from its commit.

When on, every page loads `/stats/script.js` (deferred, `data-domains` violema.com and www.violema.com, Do Not Track honoured, query and fragment dropped), and four reader actions are counted with fixed labels only: `evidence-map-opened`, `corpus-switched` (`corpus`), `trial-record-opened` (`trial`) and `shift-explored` (first slider move per replay, never the value). No element carries Umami's `data-umami-event` attributes: on the lab's hash links Umami would cancel the click and navigate only after its request settles.

To turn it on, in this order:

1. Umami runs and psychdoc.ai's runbook steps 1 to 5 are done.
2. In the Umami dashboard, add a website for `violema.com` and copy its ID.
3. In the violema.com TLS server block, inside the company overlay and before `location / { return 404; }`, add `include snippets/umami-locations.conf;`. That changes the vhost, so the release packet's pinned baseline and candidate hashes change with it. Check `curl -fsSI https://violema.com/stats/script.js` returns 200.
4. In one commit, set `websiteId` and `policyDate` (the day the release goes live). The build fails if only one is set. Tests show the privacy page switching to the statistics wording.
5. Prepare a release packet as usual. The bundle now includes `company-assets/browser/analytics.mjs`; extend the audited bundler's allowlist if it rejects the new file.

## Fonts

`assets/fonts/` holds the two variable fonts PsychDoc already self-hosts, copied byte for byte from PsychDoc's `app/fonts/` (brand-refresh branch, 2026-10-10) with no download:

| File | Origin package | Licence |
| --- | --- | --- |
| `instrument-sans-latin-wght-normal.woff2` | `@fontsource-variable/instrument-sans@5.3.0`, latin subset | SIL Open Font License 1.1, `LICENSE-instrument-sans.txt` |
| `inter-latin-wght-normal.woff2` | `@fontsource-variable/inter@5.3.0`, latin subset | SIL Open Font License 1.1, `LICENSE-inter.txt` |

`assets/fonts/SHA256SUMS` records all four files; a test checks the sums and that the build serves the files and licences unchanged under `/company-assets/fonts/`. Instrument Sans sets the wordmark, headings, navigation and buttons; Inter sets running text.

## Logo

The header shows the owner-approved scientific logos and the favicon uses the matching icon. All live in `brand/` and the build copies them unchanged: `brand/violema-restored-type-20261010.png` to `company-assets/violema-logo.png`, the October 15 supplied `brand/violema-dark-bk-logo-20261015.png` to `company-assets/violema-logo-dark.png`, and `brand/violema-fine-neck-icon-20261010.png` to `company-assets/violema-icon.png`. Do not edit, regenerate or recolour files under `brand/`; a test checks the served files are byte-identical to the approved ones. The unchanged logo is about 248 px wide on desktop and spans the available phone header width, with navigation below it on narrow screens.

## Updating a packet

Edit the owned source records, preserve source identities and review status, then run `node scripts/export-corpora.mjs`. Review the JSON packet diff. Build fails if a packet is stale or its contract fails. The optional source-engine portability check is documented in `data/provenance.md`; the normal build does not import or require the other application.

The JavaScript renderer reads the same frozen data module as the static build. Without JavaScript, both corpus packets, all claims, condition tables, source links and downloads remain available. The slider is hidden until enhancement initializes. Selecting the materials corpus clears the clinical shift; reset returns to the first corpus, first claim and zero shift. Numbers shown in prose are rounded for reading; packet and calculation values retain full precision.

## Browser acceptance

Run against the built preview. Check all six routes by direct load and refresh at 1440, 1024, 768, 390 and 320 px widths in both light and selected dark themes. Confirm a first visit remains light, an explicit selection survives navigation/refresh, and blocked storage leaves the current-page toggle usable. Verify corpus and claim links with mouse and keyboard, the segmented controls' arrow keys, range changes including endpoints on the physician review page and the demo, materials isolation, reset, packet downloads, Skip/Replay, reduced motion (the complete source illustration stays visible), full-map disclosure and direct fragment links, a no-JavaScript load (drawn trace, static interval, every claim and table), focus rings on every control, 44 px targets on phones and text contrast of at least 4.5:1. Table overflow is intentionally contained inside the keyboard-focusable comparison region; the page itself must not overflow horizontally. Inspect console and network failures.

Automated Node checks cover arithmetic boundaries, packet identity, document IDs/anchors, local links, assets, source protocols, corpus isolation, static markup, appearance storage failure, theme contrast, visibility thresholds, playback interruption and reduced-motion behavior. Browser checks are separate because the package deliberately has no browser automation dependency.

This directory contains no deploy action. The adjacent migration preparation packet owns nginx cutover/rollback instructions. Production deployment remains a separate operation. The owner explicitly authorized the scientific site and physician review release on 2026-10-10; changing this bundle does not itself deploy it.

## Scientific logo preview

The October 10 circuit-hair and glasses concept replaces the operator lockup only in this local company-site bundle. After feedback that three thick strands looked jester-like, layered flowing hair and fine microchip traces were restored; research glasses and the Scientific Evidence descriptor reflect the new positioning. Max then approved this direction and requested an open eye; the current logo and icon use a calm, attentive open eye. The current wordmark restores lighter original-style geometric lettering, adds generous space beside the face, and integrates violet-to-copper color across the name. Both text lines render larger without increased boldness; the subtitle spans the name, and the increased header display sizes remain. The logo and matching icon now use a fine jaw/neck contour instead of the heavy dark band. The preferred pre-neck-edit lettering has been restored with an explicitly authorized direct pixel copy; the portrait and lettering regions are verified against their respective source images. `archive/brand-concepts-20261010/` preserves the retired alternatives and their generation records; only the approved files remain in `brand/`. The existing application brand assets remain intact. These raster concepts still need final vector/small-size refinement before a permanent brand release.

### Prepared evidence map

The homepage map uses the canonical PsychDoc export copied unchanged to `data/evidence-map.json`.
Its SHA-256 is embedded in `data-map-sha256`; the exact JSON is also served as a download.
The source synthesis was updated on 2026-10-11 (version 2.2). The current copy is the export at PsychDoc
commit `ec08ae5` (pull request 15), SHA-256 `fd8199f1b36fccfb27d3a2928d4b0190c6413e3618b1a32177a552d33571252d`.
From the PsychDoc checkout, run
`npx tsx scripts/export-evidence-map.ts`, verify the export there, then copy
that file here before building. The company-site build intentionally fails if this input is absent.

Paper-to-claim edges are recorded source memberships. Claim-to-claim edges are authored relationships;
posed questions use dashed strokes. There is no citation-network or embedding layer in this version.
Positions are stable layout choices and do not encode causality, similarity or effect size. Nodes sit at a
percentage of the field height and the lines stretch with it; below 1200 px and again below 480 px the field is
lengthened so paper names that wrap keep their own row. Study/method
filters use explicit registry metadata. All papers, claims and relationships remain available in the
HTML text alternative without JavaScript. The existing 12-trial saved-analysis hero is separate.

### How it works (method page)

`/method/#how-it-works` shows the evidence system as PsychDoc, the first application, runs it: eight steps and the seed loop, then the planned cross-field question with its contribution record (`/method/#cross-field`). Every number comes from `data/how-it-works.mjs`, which copies PsychDoc's psilocybin synthesis version 2.2 of 2026-10-11 (pull request 15, commit `ec08ae5`, read before that pull request merged) and names the PsychDoc file behind each value; `data/provenance.md` lists them. The page calls the figures a dated snapshot of a provisional synthesis without signed expert review, which stays true after PsychDoc publishes the version. Planned parts are dashed and labelled. No expert review is claimed; the section refuses to build if the facts record one, so the copy has to change first. The "See each step in detail" link goes to `https://psychdoc.ai/how-it-works`, which exists once PsychDoc pull request 15 merges.

Each diagram keeps a minimum width at which its smallest text renders at 12 px or more. Narrower than that, it scrolls inside its own focusable region; the page itself does not scroll sideways. `tests/how-it-works.test.mjs` checks the figures add up, the accessible figure markup, the house voice, token-only colours and the 12 px floor.

### Website legal pages

The public company policies identify Violema, Inc., a Delaware corporation, as directed by the owner. They describe the scientific pages separately from the existing workspace and PsychDoc, a division of Violema, Inc. with its own terms and privacy policy. Privacy copy reflects static, self-hosted assets and local controls, while allowing for ordinary hosting requests and voluntary correspondence. No arbitrary numeric retention promise, reviewer endorsement, or compliance certification is added.

The existing publicly listed `legal@violema.com` and `privacy@violema.com` addresses are used in the drafts. Confirm monitoring before publication. The policy text has not been reviewed by counsel. Guidance consulted: [Delaware Online Privacy and Protection Act, §1205C](https://delcode.delaware.gov/title6/c012c/index.html) and [FTC data-handling guidance](https://www.ftc.gov/business-guidance/resources/protecting-personal-information-guide-business).

`release/legal-pages-20261011/` prepares a local release packet for these exact new routes and preserves `/terms` and `/privacy` for the workspace. Its README documents baseline guards and owner-authorized deployment steps. Preparing a packet does not deploy it.

### October 15 interaction refinement

The homepage fills the desktop viewport and expands to a 1480 px frame on wide screens. Numbered chapter labels are stronger; all 12 trial labels open their actual source metadata. The Method page now has selectable SVG nodes, detail panels and bounded playback, adapted from PsychDoc's `diagram-motion` worktree at `78e41e4`. Its interval chart uses the existing assumed-shift slider. `browser/playback.mjs` shares motion handling without adding a dependency; `lib/diagram-details.mjs` explains the same frozen version 2.2 facts as the diagrams. Planned edges remain dashed.

Build and 70 tests pass. Updated responsive/keyboard checks are in `docs/experience-progress.md`; native Safari checks pass for the hero, themes, motion, diagram panels, dialog focus return and chart endpoints. A faint masked light pass moves through the logo hair in both themes and is excluded under reduced motion. The owner authorized push and deployment on October 15; `release/experience-20261015/` prepares the guarded successor. The vault runbook records the activated revision and recovery receipts.
