# Violema experience progress

## October 15 refinement release — authorized

Max explicitly requested push and deployment of all latest Violema updates after local approval.

1. Verify the current diff, build/tests and live predecessor; preserve unrelated checkouts.
2. Prepare and test the static successor against the current experience release, with unchanged nginx bytes and a guarded rollback.
3. Review, commit/push the company-site changes, complete CI and merge the release.
4. Activate the exact merged artifact; verify all public bytes, route variants, live desktop/mobile interactions and preserved legacy surfaces.
5. Archive recovery receipts and update the vault's production record.

Stop condition: the reviewed revision is on main and its exact public artifact is verified at violema.com. Maximum three attempts per failing step; investigate rather than bypass drift guards.

## Hero product signature follow-up

Replaced the loose family paragraph and duplicate product CTA with “One method. Many applications.” and a single linked PsychDoc.AI signature, captioned “Our first application.” The current two-leaf wordmark is copied unchanged in its light/dark SVG variants from PsychDoc’s diagram-motion worktree; both path sets were checked against the live psychdoc.ai header. The older root-checkout brain icon was rejected by the owner and removed before completion.

Verified loaded SVGs, correct theme visibility, 16 px caption, keyboard focus and the https://psychdoc.ai destination. Desktop and 320/390 px phone layouts have no horizontal overflow. Build and all 71 existing tests pass; diff check clean. Screenshot: `violema-psychdoc-product-signature.png` in the task’s visualization directory. Local only; no commit, push or deployment.

## October 15 legibility and playback follow-up — verified locally

Approved identity stays: Instrument Sans / Inter, light paper surfaces, violet accents and the existing dark theme. The problem is supporting-text hierarchy, not heading scale or missing imagery. Apply the supplied frontend-design and imagegen-frontend-web guidance on readable supporting copy, clear scan order and restrained density.

1. Audit rendered text across all six routes, including notes, legends, controls, footer and mobile overrides. Set a 16 px ordinary-text floor, with 17 px body/supporting prose; only spatially constrained diagram labels are exceptions.
2. Reflow metadata, source notes and controls to fit that type. Keep substantive limits beside their claims, and keep prose measures around 66–72 characters.
3. Remove the misleading homepage method Replay control (it only fades the labels). Give both six-step overviews a bounded entrance while preserving direct manual selection and reduced-motion behavior. Keep replay for the actual connected diagrams.
4. Build/test, audit actual desktop/mobile rendering and both themes, inspect screenshots, and record the result. No new production deployment is authorized by this refinement request.

Critique: the existing 11–13 px text rules undermine the scientific caveats and make the hierarchy depend on unreadability. Enlarge those specific roles and give them space; retain the approved heading scale and assets.

Completed: caption/control floor 16 px, supporting prose 17 px, source-note/code/footer fixes, readable metadata and link spacing, two-column phone navigation and method choices. Dense map labels now have a 12 px minimum; SVG labels keep their existing spatial scale. Scientific packets and approved brand files are unchanged. Homepage Replay sequence removed; manual tabs remain. Both six-step overviews now use one bounded entrance. The larger Method diagrams already had card/connector playback, which was verified and retained.

Validation: build and 71 tests pass; diff check clean. Actual DOM font audit of six routes in both themes at 320/390/1440 px reports no ordinary text below 16 px and no page overflow (36 combinations). Additional home/Method/lab checks at 375/768/1024/1920 px pass. Verified mobile Assumption tab content, source disclosures, expanded full-map copy, and Method entrance with 0–0.9 second stagger; no captured console warnings/errors. Reduced-motion and control-free entrance behavior pass actual-module tests; OS reduced-motion and native Safari were not rechecked this turn. Independent diff review found no blockers. Graph updated: 2,804 nodes / 5,456 edges / 240 communities.

Screenshots and JSON audit: `/Users/maximisto/.codex/visualizations/2026/10/15/01a13f94-7d5d-7bc3-add6-306115271346/violema-legible-evidence-desktop.png`, `violema-legible-mobile-method.png`, `violema-font-audit.json` in the same directory. Preview remains http://127.0.0.1:4326/. No commit, push, merge or deployment in this follow-up.


## October 15 authorized release

Max explicitly requested push and deployment after approving the local experience and logo shimmer.

1. Recheck the exact source, build/tests and current production baseline; review only the company-site release diff.
2. Commit/push the scoped changes, complete CI, and merge the reviewed release through the existing GitHub flow.
3. Prepare the guarded static successor, retain the current release for rollback, and activate without changing the legacy application or nginx configuration.
4. Verify public bytes, route behavior, interactions and preserved legacy surfaces; record the release and recovery receipts in the vault.

Execution bound: at most three attempts per failing step; stop on unexplained baseline drift.

## Owner follow-up: subtle light through the logo hair

Adapted the legacy `.violema-logo-electric` mask treatment into one low-opacity light pass every 12 seconds, with a quiet interval between passes. The overlay is clipped to the hair/circuit area, uses the correct supplied logo mask for each theme, and never intercepts pointer input. Original image files, face and wordmark stay unchanged. Animation is enabled only under `prefers-reduced-motion: no-preference`.

Build and all 70 tests pass. Browser inspection confirms running animation, changing light position/opacity, theme-specific masks and exact overlay/image alignment at desktop and 320 px, without horizontal overflow. Reduced-motion exclusion was checked in the stylesheet; no OS setting was changed. Local preview only.

## October 15 refinement complete locally

User feedback: the Safari view felt too small, the next section bled into the hero, chapter markers were weak, and method charts/diagrams were static. Applied UI/UX Pro Max hierarchy, viewport, focus and motion guidance while retaining the approved brand.

- Wide homepage frame expands from 1240 to 1480 px; hero display grows to 88 px. The desktop first chapter fills the viewport, with compact spacing on shorter screens and no clipped content.
- Chapter markers now use 40 px numbers, 18 px names and divider lines.
- All 12 hero trial records are selectable. Native dialogs preserve every DOI, registry value and the pinned source version. Hover/focus highlights the corresponding inclusion line. The trace sequence lasts 3.4 seconds and remains skippable/replayable.
- Adapted the behavior in Claude's PsychDoc diagram-motion worktree at 78e41e4: 16 interactive SVG nodes, source-grounded panels, keyboard activation, Escape/Close focus return, bounded line/card playback. Planned connections remain dashed. Shared vanilla playback, no new dependency.
- The Method interval chart now uses the existing assumption control and calculation; saved values, limits and reference notes are unchanged.

Validation: build succeeds, 70 tests pass, diff whitespace clean. Graphify AST update completed: 2,790 nodes, 5,414 edges, 239 communities; generated output stays ignored. Browser checked 320/390/768/1024/1440/2056 px with no page overflow; all trial targets are at least 44 px. Hero and chapter boundary match the viewport at 1440×900, 1920×1080 and 2056×1132. On short/narrow screens content can extend below the fold. Verified actual animation CSS while playing, Skip settling, diagram Enter/Space/Escape, focus return, trial multi-publication dialogs and chart +0.00/+0.60 endpoints. No captured console warnings/errors. Reduced motion and tall-part visibility pass actual-module tests; no OS preference was changed.

Native Safari verification completed after Max unlocked the Mac. Confirmed the full-screen hero without next-section bleed, icon theme switching and supplied dark logo, visible source-trace playback, interactive Method panels with Enter/Escape and focus return, and chart keyboard endpoints +0.60/+0.00. The native trial dialog exposed a Safari pointer-focus difference: closing it returned focus to the page body. The dialog now explicitly restores its invoking link; verified in Safari and covered by an actual-script regression test. Safari console inspection was not performed.

No deployment, commit, push or merge. Local review at http://127.0.0.1:4326/.

## Earlier approved implementation and validation

Approved 2026-10-15: five chapters, light by default, polished dark mode; approved logo and typography preserved. Local candidate ready for review. No deployment, merge, push or dependency installation.

## Implementation

- Isolated at `codex/violema-experience`, based on origin/main `7576196`.
- Added overview → guided evidence → method → applications → conversation chapters.
- Preserved the full evidence map behind a native disclosure, with lazy enhancement and working direct fragments.
- Added a persistent manual appearance choice, bounded source/method playback, Skip/Replay, keyboard controls and responsive layouts.
- Updated the privacy disclosure for local theme storage; its October 15 date is separate from the unchanged October 12 terms date.
- Incorporated Claude's PsychDoc motion handoff: static first, actual visibility thresholds, one persistent playback control, no touch-scroll interruption and no animated scientific quantities.

## Validation completed

- `npm run build`: six pages and two source packets built.
- `node --test --test-reporter=spec tests/*.test.mjs`: 65 passed, 0 failed.
- Real browser: all six routes, both themes, 320/390/768/1024/1440 px; no document-level horizontal overflow in all 60 combinations.
- Real browser: source disclosure by Enter, guide ArrowRight, method End, hidden-panel exclusion, explicit-theme navigation/refresh, full-map disclosure, patient filter, direct map/guide fragments and hero Skip. Review slider End/Home retains +0.60 and +0.00 results.
- Console: no captured warnings or errors during these checks.
- Reduced motion, missing IntersectionObserver, hidden-tab settling, media changes, touch-scroll behavior, Skip/Replay and denied storage were exercised against the actual scripts in Node tests. No separate real-browser OS reduced-motion or JavaScript-disabled session was run; static-markup tests cover fallback content.
- `git diff --check`: clean. Approved logo/icon and all three evidence JSON files byte-identical to baseline; font checksums and served bytes pass the existing tests.
- `graphify update .`: completed (2,782 nodes, 5,392 edges, 244 communities); generated graph output remains ignored.

At 390×844 with the full map folded, the method now starts at about 3,047 px, compared with about 5,709 px in the live baseline reviewed earlier. These are viewport-specific observations, not a performance benchmark.

## Size and review surface

No animation dependency. Original first-pass homepage playback: 1,381 gzip bytes (before shared playback and trial dialogs). Shared entry: 709 → 1,432 gzip bytes. Added appearance/chapter CSS: 1,278 + 4,074 gzip bytes. The full map's browser module loads on expansion.

Preview: `http://127.0.0.1:4326/`. Source and design changes are limited to `company-site/`. The root legacy checkout and PsychDoc worktree were not edited. Production needs a separate explicit deploy request.

Desktop light, desktop dark applications and phone evidence screenshots are saved in the task's local visualization folder. The vault implementation run note records their exact paths and Claude's handoff.

## Owner follow-up: icon control and supplied dark logo

Replaced the dropdown with a 44×44 sun/moon button, accessible destination label and tooltip. The saved preference and light first-visit default remain. Added the owner's `violema-dark-bk-logo.png` unchanged as `brand/violema-dark-bk-logo-20261015.png`; dark mode now uses it directly without a light mount. Build and all 65 tests pass. Browser verified reload persistence, click/Space/Enter, correct visible/loaded logo, 320/390/768/1280 px layout and no console warnings/errors. Local only.

## Owner follow-up: archive retired brand assets

Moved ten superseded Violema images and eight historical notes/provenance files out of the active brand directory into `company-site/archive/brand-concepts-20261010/`. Historical notes are marked retired; approved-file links still resolve. `company-site/brand/README.md` lists the five approved Violema/PsychDoc artworks and their build destinations.

In the historical PsychDoc primary checkout (`/Users/maximisto/psychdoc-ai-starter`, branch `docs/hero-imagery`), moved the obsolete neon-brain image to `public/archive/retired-brand/psychdoc-neon-brain-retired.png`. Updated its single NavBar path so that historical preview remains intact. Added the unchanged current two-leaf SVGs to `public/brand/` and explicit current/retired asset guides. Current PsychDoc worktrees were not changed.

Validation: every moved asset preserved its bytes; all 39 generated Violema files remain byte-identical to the pre-cleanup build. Build and 71 tests pass. Brand/archive Markdown links resolve; whitespace checks pass in both checkouts. The historical PsychDoc image path resolves and matches the original image hash; no PsychDoc build or test suite was run for this path-only maintenance. No commit, push or deployment.
