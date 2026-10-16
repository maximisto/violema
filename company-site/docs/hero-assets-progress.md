# Hero asset integration — 2026-10-15

1. Inspect supplied assets and current source; preserve all content and interactions.
2. Implement separate decorative mobile layers; verify light and dark at 320–768px.
3. Adapt desktop composition; verify 1024/1440px and existing interactions.
4. Run site tests/build, record screenshots and final diff, write vault run note.

Stop: responsive visual verification and relevant checks complete; local only, no deploy.
Retry limit: three per failing check; instrument after two failed diagnoses.
Base: 84de034, isolated managed worktree.

## Initial pass — superseded by owner feedback
- Six independently positioned decorative layers; themed SVG backgrounds and Earth WebP, original DNA SVG and handaxe WebP. No reference screenshots deployed.
- Mobile copy/CTA → art → original linked PsychDoc signature → existing interactive trace. Desktop copy/signature at left, art at right, trace below.
- Light stays the first-visit default; existing theme persistence unchanged. No new art animation.
- Build and all 72 existing site tests pass; git diff --check passes.
- Generated DOM comparison with base: all text, 239 anchor destinations, four original logo images unchanged.
- Chromium browser checks: 320, 360, 390, 430, 768, 1024 and 1440px, both themes. No overflow or broken images; matching themed art; CTA visible in tested viewports. Menu Escape/focus, keyboard CTA, trial dialog/focus, trace playback, reduced motion and saved theme pass. Observed reload CLS 0; no page errors.
- Screenshots and machine receipt: output/hero-assets/. Physical mobile devices and Safari not tested in this run.
- Graphify AST update complete. No commit, merge, push or deploy performed.

## Revised brief — light concept and motion
Owner rejected the initial isolated art panel. Use supplied mobile/desktop concept images as composition references. Preserve real copy/logos/links, build a full layered scene, and use the Oryx slow independent scientific-overlay drift. Light design only in this pass; retain functional theme toggle. Steps: derive glass DNA asset, implement responsive composition and vector/formula overlays, verify mobile then desktop, exercise reduced motion and existing behavior. No deployment.

## Light concept complete — local review ready
- Replaced the initial panel with a responsive full-scene composition based on the newly supplied mobile/desktop concepts.
- New transparent glass DNA and stone layers reconstructed with the built-in image tool. Original Earth and SVG overlays retained; neither flattened reference is served. Asset sources/prompts: hero-light-asset-provenance.md.
- Independent 28–42 second formula/diagram/helix drift and staggered node opacity, inspired by the inspected Oryx implementation. Copy, CTA, Earth and specimen stay stationary. Motion pauses offscreen/hidden and stops for reduced motion.
- Light screenshots at 320, 360, 390, 430, 768, 1024 and 1440px reviewed. No horizontal overflow or broken art. CTA bottom 496–623px in tested widths, original body text remains at least 16px. Observed CLS ~0.0069 in the local browser run, not a field performance claim.
- Browser assertions pass: active animation, reduced-motion zero animations, offscreen pause, menu dismissal, CTA anchor, trial dialog and focus return, trace playback, theme toggle. No page errors.
- Generated content comparison: original text, all 239 links and four original logo images unchanged; new decorative labels/formulas excluded from comparison.
- Build and 72 existing tests pass after the final asset allowlist change; git diff --check passes; Graphify updated. Local preview refreshed in the app.
- Evidence: output/hero-light-concept/. Dark art direction deferred at owner request; toggle remains functional. Physical devices and native Safari not exercised in this pass.
- No commit, push, merge or deployment.

## Cursor depth and shine
Owner approved the light direction and requested cursor-following/flying motion and shine. Add bounded independently weighted cursor depth, a soft pointer highlight and a masked DNA light sweep; preserve all content/controls. Verify pointer movement, settling, touch/reduced-motion exclusion, viewport pause, mobile layout and site tests.

Cursor/shine pass complete: layered mouse depth, easing on leave, soft cursor glow, masked 12-second DNA light sweep. Browser verified the copy does not move, desktop offsets differ by layer, touch ignores pointer depth, reduced motion yields zero animations, and all offscreen animations pause (including disabling the glow fade). 390px layout has no overflow. Build and all 72 tests pass; diff whitespace clean. Existing preview refreshed. No deployment. Evidence: output/hero-light-concept/cursor-shine.png, cursor-checks.txt (initial offscreen opacity fade finding), offscreen-check.txt (verified correction).

## Staged page entrance and history accents
Owner requested an Oryx-like sequential page build and small hand-axe motifs. Implement line-by-line hero entrance, staggered copy/action and separate artwork arrival, one-time chapter typography reveals. Add two static specimen accents to the history/trace title and method label. No running mouse: discussed as a distraction from this visual direction. Validate appearance sequence, focus, reduced motion, no-JS content, narrow layout and existing tests.

Entrance pass complete: hero lines stagger at 180/340/500ms, supporting content follows; chapter typography reveals once. Browser verified keyboard CTA immediately visible, reduced-motion hero animations zero, no-JS content accessible, and no overflow at 320/390px. Desktop, mobile and both specimen accents visually reviewed. Build and 72 tests pass; diff whitespace clean. Evidence: output/hero-light-concept/entrance-*.png, chapter-entrance-checks.txt and entrance-checks.txt. Local only; no deployment.

## Dark counterpart
1. Activate supplied dark Earth/network/diagram layers with existing theme selection.
2. Tune mobile illumination and contrast; verify 320–430px before desktop.
3. Check desktop, theme switching, shared motion/reduced motion and original controls; build/test.
4. Record evidence and vault note. Stop at validated local preview; no deploy. Retry bound: three per failing check. Section04 rings confirmed decorative, not missing data.

Dark counterpart complete: dedicated supplied dark Earth and SVG overlays now follow the existing theme toggle. Shared glass DNA/stone, motion and geometry preserved; tuned violet atmosphere, warm specimen rim, restrained cursor glow and edge blending. Browser screenshots inspected mobile first then desktop; 320/360/390/430/768/1024/1440px have no overflow or broken art. Verified theme persistence, light asset restoration, dark cursor/shine/drift, reduced-motion zero animations, mobile menu Escape and trial dialog. Build and 72 tests pass; git diff --check clean. Section04 circles are unchanged decorative orbit rings, not incomplete controls or missing data. Receipts: output/hero-dark/. Native Safari/physical devices not tested this pass. Local preview left in dark mode; no deploy.

## Intentional closing illustration and visible map
1. Replace closing rings with Observe/Record/Revisit illustration and restrained motion.
2. Remove the outer map disclosure and expose original interactive map; add jump link.
3. Build/test and verify mobile/desktop both themes, map interactions and reduced motion.
4. Record local-only result.

Complete: Section04 now shows a responsive Observe/Record/Revisit concept with separate specimen and SVG document/records. Slow24s signal and28s specimen drift pause offscreen/hidden and disable under reduced motion. The original map is permanently visible outside a disclosure; direct jump link added beside the evidence introduction. All original map data/filter/source interactions preserved. Browser verified320/390/1440 both themes without overflow; mobile animal filter8papers/7claims/11connections and source record selection pass. Build and72tests pass, including updated visibility assertion; diff clean. Screenshots/receipts: output/closing-evidence/. No deployment.

Section04 supplied-icons refinement: microscope for Observe, document for Record, circular network for Revisit. Three original transparent PNGs copied unchanged; independent sizing and staggered28/32/36s drift. Verified320/390/1440px both themes with no overflow/broken assets, normal motion and reduced-motion disabling. Build72tests pass; no deployment. Receipts: output/closing-evidence/icons-*.

## Final taste-preservation pass
Design read: scientific editorial landing, existing CSS tokens; variance6/motion5/density4. Audit approved composition, preserve original copy/numbering/map and manual light-default theme. Fix evidence-backed issues only: oversized asset delivery, truncated phone filter labels, standalone source tap target, accessible map names. Validate Lighthouse before/after, mobile/desktop themes and site tests.

Final taste pass complete. Five artwork layers91.7% smaller; phone filter labels readable,44px standalone source links, paper accessible names improved, mobile header startup shift removed. Build72tests pass; responsive/theme/control checks pass. Lighthouse final CLS0; local LCP21.2s remains a release-performance follow-up. See final-design-polish.md for full preflight disposition and honest limitations. No deploy.
