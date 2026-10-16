# Violema Hero Asset Pack · mobile-first

## What this is
Production-oriented independent imagery and SVG decoration for the approved **light scientific editorial** direction: a photorealistic flaked hand axe, transparent purple/orange double helix, transparent Earth horizon, and editable geometric evidence overlays. Includes dark-theme counterparts, two conceptual previews, and a React art-only wrapper for Codex.

**IMPORTANT:** The generated reference mockup and previews are *not* production screenshots or source code. Real page copy, buttons, Violema logo, PsychDoc.AI logo, theme controls, links and accessibility elements **must come from the existing Violema codebase**. Do not bake any of these into an image. Do not replace the original logos with recreated ones from the reference sheet.

## Files to deploy

- `assets/raster/handaxe.webp` or `.png`: transparent photographic stone specimen (upscaled from illustration source; not a photographed museum artifact, so do not imply provenance or exact date).
- `assets/vector/dna-helix.svg` (preferred) or `assets/raster/dna-helix.webp` / `.png`: true editable transparent DNA illustration.
- `assets/raster/earth-horizon-light.webp` and `earth-horizon-dark.webp`: transparent, atmospheric globe rim. Bottom of image fades out to avoid a hard edge.
- `assets/vector/evidence-network-light.svg` and `evidence-network-dark.svg`: separate nodes and lines, no embedded text; layer behind hero artwork.
- `assets/vector/scientific-diagrams-light.svg` and `scientific-diagrams-dark.svg`: decorative geometries/molecular motifs, no scientific assertions.
- `assets/vector/atmosphere-light.svg` and `atmosphere-dark.svg`: lightweight abstract background waves and grid.
- `assets/vector/lens-accent.svg`: optional subtle visual highlight. Not required.

## How to implement (do not redesign the site)

1. Identify **existing mobile hero** and theme tokens in the Violema repo. Keep text precisely as shipped: `Scientific evidence systems`, `Know which conclusions hold. And why.`, `Violema connects scientific claims to their sources, makes consequential assumptions visible, and keeps the record open to review.`, `Follow the evidence`, `One method. Many applications.`, `Our first application.`
2. Reuse original Violema header logo and the original **linked PsychDoc.AI logo**. Preserve theme toggle, menu, button links, trace behavior, and semantic heading structure. Don't duplicate those UI features inside the art.
3. Add an absolutely positioned **decorative** art layer (`aria-hidden=true`, `pointer-events:none`), contained/clipped in a hero art region. Suggested layering bottom-to-top: atmosphere, diagrams, network, Earth, DNA, hand axe.
4. For mobile widths 320–480px, never place the largest specimen over copy. One option is a **280–340px art panel directly below the CTA**, followed by a PsychDoc.AI logo block. Show Earth across the panel's lower edge, and let the hand axe overlap the DNA slightly. Keep main CTA visible before scrolling. Leave generous whitespace around headline.
5. For desktop (min-width around 1024px) use a two-column layout: original copy/CTA at left, art cluster at right; Earth can span the bottom of the art side only or the full width with a gentle opacity gradient. Don't stretch hand axe to full screen.
6. Switch `-light.svg` and `-dark.svg`/Earth variants based on the site's existing theme selection; preserve the brand's actual purple/orange palette from existing CSS.
7. Reduce animated transforms to 0 for `prefers-reduced-motion: reduce`; avoid WebGL and scroll-coupled expensive animations. Animate faint node opacity only if desired.
8. Run mobile checks at 320, 360, 390, 430, 768, 1024 and 1440px widths. Test keyboard focus, minimum contrast, no unintended overflow, and CLS. Prefer explicit `width`/`height` or `aspect-ratio` for all media.

## Accuracy / fidelity notes

- The artifact is **an illustrative hand axe**, not an authenticated museum image. Avoid assigning an exact age or origin without a researched caption.
- The DNA rendering is a **visual metaphor**, not a molecular structure prediction.
- Evidence node network is decorative, **not an actual provenance graph**, and should not imply verified citations or data relationships. Actual trace and claim content stays in existing site UI.
- `reference/approved-direction.png` is for review only. It contains rasterized mock text/logos. *Never* deploy it as a hero background.
- `reference/IMG_4278.jpeg` and `IMG_4279.jpeg` are user screenshots for branding confirmation only. Don't serve them.
- `.webp` can be used directly with CSS `object-fit:contain` and is the smallest standalone raster. Retain SVG as scalable vectors.
- Specimen raster was extracted from an AI image; optical source detail is limited, despite upscale to web-friendly dimensions. Good for hero at ~180–300 CSS pixels, not for deep scientific zoom or print.

## Optional art-only React integration

Copy asset files into your existing site's `public/violema-hero/` directory and adapt `integration/ViolemaHeroArt.tsx` and `.css`. Import `<ViolemaHeroArt theme={theme} />` only within the existing hero artwork container. This component has **no headline, buttons, logos, navigational behavior, or links** and thus cannot accidentally replace functional site copy.
