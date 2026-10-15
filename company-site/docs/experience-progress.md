# Violema experience progress

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
