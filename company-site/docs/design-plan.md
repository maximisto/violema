# Company site design plan

Approved direction, 2026-10-15: five chapters, light by default, polished dark mode. Preserve the approved logo, Instrument Sans / Inter, the actual evidence and its limitations. This supersedes the October 10 homepage and light-only notes in this file's history. Implementation is a local candidate; deployment needs a separate request.

## Reading sequence

1. **Overview.** A focused company statement beside the existing 12-trial source assembly. The main action enters the guided evidence; PsychDoc has its own direct link.
2. **Evidence in action.** One real saved claim, its four source records and its limits. The full 24-paper / 23-claim map remains in a native disclosure below the guide. Filters, text alternative, download and the `#evidence-map` deep link remain available.
3. **The method.** Six inspectable parts of a record: Source, Study, Claim, Assumption, Review, Version. Each panel provides one explanation and a destination where the reader can inspect it.
4. **Applications.** PsychDoc is the primary feature, with three specific exploration paths. The existing materials demonstration is a subordinate editorial row and retains its review-pending/no-pooled-estimate wording.
5. **Conversation.** A scientific briefing invitation and a separate scientific-review route.

Chapter navigation follows native scrolling. Section changes use space, typography, hairlines and distinct surfaces: cool grey, white, pale violet, grey and violet. Avoid repetitive card grids, scroll hijacking, entrance effects on every paragraph and synthetic evidence graphics.

## Appearance

Light remains the first-visit default regardless of OS appearance. The header's sun/moon button switches between Light and Dark in one action. Its accessible label and tooltip name the destination mode; native button behavior supports Enter and Space. It saves only `violema-theme` in localStorage; a small guarded prepaint script restores an explicit dark choice. Denied storage leaves the current page usable. The privacy page documents the preference.

`browser/site.css` owns light and instrument tokens. `browser/appearance.css` adds chapter tokens and the dark override. Components use shared tokens. The original light PNG and the October 15 owner-supplied dark PNG are shown only in their matching theme. Both stay unchanged; do not invert, recolour or regenerate them.

| Role | Light | Dark |
| --- | --- | --- |
| Page | `#F5F6F8` | `#10131A` |
| Surface | `#FFFFFF` | `#181D26` |
| Secondary surface | `#ECEEF2` | `#232936` |
| Chapter surface | `#F0EFF5` | `#191823` |
| Primary text | `#12161D` | `#ECECF0` |
| Secondary text | `#4A5260` | `#B5BCC8` |
| Tertiary text | `#626B78` | `#9CA6B7` |
| Accent | `#6852A3` | `#BAA9EB` |
| Text on accent | `#FFFFFF` | `#171023` |
| Control border | `#818A97` | `#8793A5` |

The evidence instrument keeps its established dark palette in both themes. Copper marks the claim boundary; violet identifies sources and interactive elements. Decorative hairlines are distinct from control boundaries. Tests require 4.5:1 for text and 3:1 for control borders on each page surface. Focus rings are 3 px with a 4 px offset.

## Layout and type

- Keep the 1240 px frame, expanding the homepage/header/footer to 1480 px above 1600 px. Preserve 40/24/16 px desktop/tablet/phone gutters. The desktop hero fills at least the initial viewport using svh; short screens compact spacing without clipping content. Wide-screen hero type grows to 88 px. Chapter labels use 40 px numbers, 18 px names and a divider.
- Homepage hero uses five columns for copy and seven for the instrument. Below 960 px, use a true one-column grid so twelve desktop gaps cannot overflow a 320 px screen.
- Chapter space is 72–112 px. Headings use Instrument Sans; body text uses Inter. Identifiers retain system monospace.
- The evidence guide is asymmetrical on desktop and stacked on smaller screens. Panels share an intrinsic grid track to avoid a jump when switching tabs. Inactive panels remain hidden from focus and the accessibility tree.
- The method is a connected six-part row on desktop and a 3×2 selectable layout on phones. Only the current panel appears after enhancement.
- Phone header uses a fixed logo/appearance row and a 48 px navigation row. The first row scrolls away; the navigation remains available without covering anchor destinations.
- Product paths and source disclosures have clear focus, hover and touch targets. New phone actions are at least 44 px tall.

## Motion contract

The PsychDoc handoff and latest diagram-motion worktree (78e41e4) informed behavior. Its DiagramStage/DiagramExplorer patterns are adapted to the existing vanilla stack: shared playback helper, SVG controls and detail panels. No React runtime or animation dependency.

- Static HTML is the complete, settled record. JavaScript adds playback and tab selection.
- The hero source assembly and homepage method sequence and the two Method diagrams each play once after at least 15% of the component is visible. No loop, random motion, count-up statistic or animated estimate.
- Desktop playback is bounded (hero 3.4 seconds; homepage method 1.5 seconds; Method diagrams 3.6 seconds). On phones, parts animate after 25% of each enters view, or 40% of the visible viewport for a taller part; completion settles after the last part. The SVG diagrams retain their own horizontal scroll region on narrow screens.
- Skip and Replay are the same persistent button. Clicks or deliberate keyboard interaction settle playback; touch scrolling does not.
- Reduced motion starts settled with motion disabled. Changing the preference, hiding the tab or crossing a breakpoint during playback settles immediately.
- Only solid source-assembly and pipeline connectors use `pathLength`; dashed/planned relationships retain their original dash units. Focused and selected nodes stay fully visible.
- Panel transitions are a restrained 220 ms / 4 px entrance, gated by the motion preference. Scientific content and control state remain readable without them.

## Progressive enhancement and boundaries

Plain anchors and native details work without JavaScript. All guide panels, method explanations, evidence sources and downloads exist in the HTML. The full map imports its browser module only when expanded; direct fragments expand the relevant disclosure first. Review/demo calculations and their source packets are unchanged.

All 12 hero trial records open a native dialog with every recorded DOI, registration and source version. Escape closes it and restores focus. Without enhancement the names remain DOI links and the full trial packet is downloadable. The Method page adds 16 keyboard-selectable nodes with explanatory panels, plus the existing bounded assumed-shift control on its interval chart. Details use the same pinned version 2.2 facts as the drawings; planned work stays labelled.

The physician walkthrough remains at `/review/` with noindex/follow. Both complete source packets and the bounded assumed-shift control remain on their existing review/demo routes. No new submission form, analytics, service, dependency or backend integration is introduced.

## Verification

Build and run `node --test --test-reporter=spec tests/*.test.mjs` from `company-site/`. Check the six routes in both themes at 320, 390, 768, 1024 and 1440 px. Exercise theme persistence, keyboard tabs, native disclosures, lazy map filters, deep links, Skip/Replay and existing replay controls. Inspect console errors, page overflow, hidden-panel accessibility and mobile sticky-header placement.

Automated tests exercise the actual playback module with visibility, media-query, timer and storage controls. Static-markup tests cover the no-JavaScript reading order. Do not describe those as real-browser OS-preference or JavaScript-disabled checks unless those environments were actually exercised.
