# Final design-taste preservation audit

Design read: scientific editorial landing for researchers/reviewers. Preserve mode. DESIGN_VARIANCE6 / MOTION_INTENSITY5 / VISUAL_DENSITY4. Existing native CSS tokens: Instrument Sans + Inter, violet/copper brand, 8px controls/12px cards. No new dependencies in the site.

## Applied polish
- Five WebP delivery derivatives total611368bytes versus7410226bytes of source PNGs (91.7% reduction). Original PNGs retained. Hero dimensions retained; below-fold icons delivered at512px. Quality92, alpha100, visually checked against approved composition.
- Full-width phone filter fields below480px avoid clipped option labels.
- Standalone map-detail source links now44px high.
- Paper accessible names now include displayed venue; added explicit text spacing. Claim labels include population. Remaining Lighthouse advisory concerns duplicated decorative claim-number badges; badges already aria-hidden, names include Claim N.
- Compact header reserved during script startup only when scripting enabled. No-JavaScript navigation remains expanded. This removes the observed0.272 startup CLS.

## Preflight disposition
- Pass: brand/shape/type hierarchy, real owner assets, no invented statistics/testimonials, original source-backed copy, visible interactive map, no fake previews, desktop single-line navigation/CTAs, responsive overflow checks, primary44px buttons, visible source links, focus and keyboard menu dismissal, no-JS nav, both themes, reduced-motion and offscreen pause.
- Preserved by explicit owner brief over generic skill defaults: three-line hero and original longer copy; numbered chapters; violet/copper palette; light first-visit default; dark evidence instrument; supplied artwork/formulas and diagram lines; real complete evidence map rather than shortened marketing list; original100px desktop brand header and logo. No new images required because all approved artwork is supplied/generated already.
- Not applicable: React client components/hooks, GSAP/pinning, bento cells, marquees, testimonial rules, forms/error states beyond existing map empty state, logo walls, premium-consumer palette, global state, skeletons for static content. Static site uses existing native CSS/JS.
- No copy/route/nav/legal/analytics renaming. No additional decorative motion. Metadata and noindex behavior retained.

## Validation
Build and72tests pass. Whitespace diff clean. Mobile320/390, tablet768/1024 and desktop1440 checked in both themes, no overflow/broken assets; hero CTA visible. Menu open/Escape and no-JS fallback pass. Animal filter8papers/7claims/11connections and Jiang source selection pass.

Lighthouse mobile local preview: transfer8775940→3940060bytes (55% reduction); LCP40.9→21.2s; final CLS0; TBT60ms. Final scores performance70/accessibility100/best-practices96/SEO69. These are local simulated results, not field metrics or a production readiness claim. LCP still misses target: original high-resolution logos/icon and uncompressed/no-store preview delivery remain substantial. SEO score reflects intentional preview X-Robots-Tag:noindex. Existing stretched decorative DNA/Earth flagged for aspect ratio; approved composition retained. Physical iPhone/Safari and production compression/cache performance remain release checks. No deploy.
