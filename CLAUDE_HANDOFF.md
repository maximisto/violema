# Claude Handoff - Violema Homepage Revision

Date: 2026-06-14  
Project root: `/Users/maximisto/Documents/New project`  
Frontend root: `/Users/maximisto/Documents/New project/frontend`  
Current local preview: `http://127.0.0.1:4173/?v=full-revision-final-pass-2`

## Current Directive

Max wants the Violema homepage to feel like a top-tier AI operator product for founder-led teams. The accepted direction is:

- Keep the powerful desktop hero composition.
- Do not touch the main header logo. It is considered correct.
- Fix logos only inside the desktop and mobile product mockups.
- Use real HTML for the page structure, copy, CTAs, sections, and controls.
- Use generated/static images only for the desktop web UI and mobile Slack/product mockups.
- Keep separate desktop and mobile presentation quality high. Do not flatten everything into a generic responsive compromise.
- Do not deploy without a separate explicit deploy request.

## Localhost / Run Commands

The current browser session has been using Vite preview:

```bash
cd "/Users/maximisto/Documents/New project/frontend"
npm run preview -- --host 127.0.0.1
```

Local preview URL:

```text
http://127.0.0.1:4173/
```

Cache-busted URL from the latest checked pass:

```text
http://127.0.0.1:4173/?v=full-revision-final-pass-2
```

If using Vite dev instead:

```bash
cd "/Users/maximisto/Documents/New project/frontend"
npm run dev -- --host 127.0.0.1
```

Default dev URL is usually:

```text
http://127.0.0.1:5173/
```

## What Changed In The Latest Pass

### Hero and Mockup Logos

- `frontend/src/components/Hero.tsx`
  - Preserved the main desktop header logo.
  - Removed temporary HTML logo overlays from the hero product mockups.
  - Tightened mobile sticky CTA behavior so it only appears while the mobile hero is still visible.

- `frontend/public/brand/violema-dashboard-ui.png`
  - Baked the real Violema brand mark into the dashboard mockup sidebar.

- `frontend/public/brand/violema-slack-phone-ui.png`
  - Baked a real Violema mark into the Slack/mobile mockup avatar area.

### Lower Page Revision

- `frontend/src/components/Integrations.tsx`
  - Replaced the generic integration marquee/card block.
  - New section is an operating map: signals in, Violema reviewable operator layer, approved work out.
  - Statuses are explicit: live, ready, planned.
  - Includes an honest disclaimer that product names do not imply sponsorship, customer, or commercial relationship claims.

- `frontend/src/components/Features.tsx`
  - Rebuilt the post-hero story:
    - web platform plus Slack approval surface
    - founder workflow examples
    - trust/control section
    - comparison section
  - Uses product imagery instead of div-built fake screenshots.
  - Mobile headline sizing was tuned after visual QA.

- `frontend/src/components/Footer.tsx`
  - Fixed invalid Tailwind `min-h-13` utility usage.

## Important Files

Homepage implementation:

- `frontend/src/pages/Landing.tsx`
- `frontend/src/components/Hero.tsx`
- `frontend/src/components/Integrations.tsx`
- `frontend/src/components/Features.tsx`
- `frontend/src/components/Pricing.tsx`
- `frontend/src/components/Footer.tsx`
- `frontend/src/content/homepage.ts`

Brand/product assets:

- `frontend/public/brand/violema-logo-20260510.png`
- `frontend/public/brand/violema-dashboard-ui.png`
- `frontend/public/brand/violema-slack-phone-ui.png`
- `frontend/public/brand/violema-command-center.png`

## Validation Already Run

Fresh build:

```bash
cd "/Users/maximisto/Documents/New project/frontend"
npm run build
```

Result: passed with `tsc && vite build`.

Targeted cleanup scan:

```bash
rg -n "min-h-13|opacity-92|py-18|<<<<<<<|=======|>>>>>>>|—|–|violema-favorite" \
  frontend/src/components/Features.tsx \
  frontend/src/components/Integrations.tsx \
  frontend/src/components/Hero.tsx \
  frontend/src/components/Pricing.tsx \
  frontend/src/components/Footer.tsx \
  frontend/src/pages/Landing.tsx \
  frontend/src/content/homepage.ts
```

Result: no matches.

Browser smoke with system Chrome at `1536x1024`, `768x1024`, and `430x932`:

- no horizontal overflow
- no console errors
- no failed requests
- all product images load after scrolling through relevant sections
- old full-page screenshot asset `violema-favorite-hero-desktop` is not used
- mobile sticky CTA does not appear outside the hero

Screenshot evidence is in:

```text
/Users/maximisto/Documents/New project/.codex/screenshots/
```

Useful screenshot names:

- `rev2-desktop-top.png`
- `aligned-desktop-integrations.png`
- `aligned-mobile-integrations.png`
- `final-mobile-product-final.png`

## Product Positioning To Preserve

Core positioning:

```text
AI agents for founder work.
```

Supporting idea:

```text
Violema is the reviewable AI operator for recurring founder and team workflows.
```

The page should balance:

- founder automation and business outcomes
- sophisticated web UI for agents, tasks, schedules, evidence, budgets, and replay
- Slack-native approval and delivery where users already are
- clear proof, source links, run history, policy, and cost controls

Avoid reducing Violema to only Slack or only developer automation.

## Design Rules From Max

- The main header logo was perfect. Do not alter it.
- Desktop and mobile can be designed separately. Do not chase generic adaptive compromise.
- The dashboard and phone mockups need to look premium and accurate.
- The rest of the page should match the hero quality, not become standard SaaS sections.
- Do not make misleading claims about integrations or logos.
- Do not use the old all-in-one hero screenshot as the live page implementation.

## Git / Worktree Warning

The worktree is dirty and contains many changes beyond the latest homepage pass. Do not run destructive git commands. Do not reset or revert unrelated files.

Known homepage-related dirty/untracked files include:

- `frontend/src/components/Hero.tsx`
- `frontend/src/components/Integrations.tsx`
- `frontend/src/components/Features.tsx`
- `frontend/src/components/Footer.tsx`
- `frontend/src/content/homepage.ts`
- `frontend/src/index.css`
- `frontend/index.html`
- `frontend/tailwind.config.js`
- `frontend/public/brand/violema-dashboard-ui.png`
- `frontend/public/brand/violema-slack-phone-ui.png`
- `frontend/public/brand/violema-command-center.png`

## Recommended Next Move

If continuing design work:

1. Open `http://127.0.0.1:4173/?v=full-revision-final-pass-2`.
2. Start by visually checking the hero, integrations map, product demo, and trust/control section.
3. Preserve the header logo.
4. Improve only the weakest visual section at a time.
5. Run `npm run build`.
6. Recheck desktop and iPhone-width screenshots before reporting.

