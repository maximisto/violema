# Light theme — status & TODO

**Status:** built but **disabled**. Re-enable by flipping one flag:
`frontend/src/lib/theme.ts` → `export const LIGHT_THEME_ENABLED = true;`

While `false`: the dark/light toggle is hidden (`ThemeToggle` returns null) and
`useTheme` forces dark for everyone, even visitors with a stored `light`
preference. No other code is removed — the whole light system stays in place.

## How it works (so re-enabling makes sense)

- **Tokens:** `navy` / `ink` / `slate` are CSS-variable-backed in
  `frontend/tailwind.config.js` (`rgb(var(--c-*)/<alpha-value>)`). `:root` in
  `frontend/src/index.css` holds the exact original dark hexes (so dark renders
  pixel-identical), and `.theme-light` remaps the same tokens to a warm
  editorial off-white ramp — every shade and opacity variant flips at once.
- **Scope:** light only applies inside a `.theme-light` wrapper. It's added to
  each *marketing* page root via `useTheme().scopeClass` (Landing, FAQ, Billing,
  IntegrationsPage, PrivacyPolicy, TermsOfService). The in-app dashboard/studio
  never get it, so they always stay dark.
- **Explicit overrides** (bottom of `index.css`, `.theme-light` block) handle
  what the variable swap can't reach: white-alpha glass, arbitrary neutral
  hexes, `text-white` (re-whitening solid violet CTAs), `text-violet-50/100/200`,
  black-alpha chips, `bg-hero-gradient`, the Hero clip-text headline, and the
  scrollbar.
- **Logo:** swaps by scope — dark mark by default, violet-tagline mark
  (`violema-logo-light.png`) inside `.theme-light` (a white tagline vanishes on
  bone). See `ViolemaLogo.tsx`.

## Done / verified in light

- Homepage sections: hero copy, "The Receipt" stats, integrations row,
  reviewable-operator layer, workflow cards, Trust surface (Cane Corso line art),
  the competitor comparison table (incl. the highlighted Violema column),
  pricing.
- Dark dashboard confirmed pixel-identical after the token change (zero
  regression).

## TODO before re-enabling

1. **Re-verify the hero in light.** The live `SlackPhone` and `HeroActivityFeed`
   were added/rearranged *after* the light QA. They're dark glass on bone (should
   read as contrast accents), but confirm the activity card, phone, and the new
   positions look right in light.
2. **Visually QA the marketing sub-pages in light.** FAQ, `/plans` (Billing),
   `/integrations`, `/privacy`, `/terms`, plus `/login` and `/signup` (they use
   `PublicHeader`, which carries the scope). They got the variable swap + the
   `bg-hero-gradient` override but were never screenshot-checked in light —
   look for low-contrast text, washed-out cards, and any element using a color
   class not covered by the override block.
3. **Spot-check `text-white`-as-body sections.** A few sections set `text-white`
   as a default; the flip turns them ink, but confirm no heading/CTA regressed.
4. **Optional polish:** a no-flash inline script (the scope is applied at React
   render, so a brief dark flash is possible on a light page); and decide whether
   to respect `prefers-color-scheme` as the default once light is solid.

## Out of scope (separate, larger project)

Full-app light theme (dashboard + Agent Studio) means tokenizing ~4,872
hardcoded color utilities across the in-app surfaces — a multi-pass effort with
real regression risk. Not part of "finish the marketing light theme."

## Re-enable checklist

```bash
# 1. flip the flag
#    frontend/src/lib/theme.ts → LIGHT_THEME_ENABLED = true
cd frontend && npm run dev   # http://localhost:5173
# 2. screenshot each public route with localStorage violema_theme=light:
#    /  /faq  /plans  /integrations  /privacy  /terms  /login  /signup
# 3. fix contrast misses in the .theme-light block of index.css
# 4. npm run build && run contract tests, then deploy
```
