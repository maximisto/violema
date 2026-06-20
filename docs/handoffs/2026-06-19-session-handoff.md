# Session handoff — 2026-06-19

**Branch:** `claude/build-ai-assistant-platform-BsdRr` (tracks `origin`, **in sync — all work pushed**)
**HEAD:** `9e96dc5` · working tree clean
**Repo root:** `/Users/maximisto/Documents/New project`

---

## ⚠️ Do this first tomorrow: deploy to the VPS

Everything below is committed and pushed, but **nothing is live yet**. There is
**no auto-deploy** (no GitHub Action, no webhook). The VPS only updates when
`deploy.sh` is run on it, which does `git reset --hard origin/<branch>` + rebuild.
As of this session the live site (`https://violema.com`) was still serving the
**old** build (live title said "…for recurring workflows"; repo says
"…for founder-led teams").

```bash
# from your machine — interactive login, run via the ! prefix in Claude Code:
! ssh <your-vps>
# then on the VPS:
cd /var/www/nexus/deploy && sudo bash deploy.sh
```

`deploy.sh` runs `npm ci`, so the new backend deps (helmet, express-rate-limit)
install automatically. After it finishes, verify:

```bash
curl -sI https://violema.com | grep -i x-frame-options        # helmet header present
curl -s https://violema.com/ | grep -i '<title>'              # should say "founder-led teams"
```

---

## What shipped this session (6 commits on top of `adcb5ee`)

1. `42537bf` **SEO/homepage** — unified canonical positioning ("the reviewable AI
   operator for founder-led teams"); added canonical + OG + Twitter + JSON-LD
   (`Organization`/`WebSite`/`SoftwareApplication`) to `frontend/index.html`;
   shipped 4 new blog guides with `Article`+`BreadcrumbList` schema, wired into
   `sitemap.xml`, `llms.txt`, IndexNow, blog index, pillar page.
2. `24d9eab` **dashboard** — time-aware Dima guardian + gentle patrol motion
   (respects `prefers-reduced-motion`).
3. `28d5498` **bug fix** — stale backend contract test (`automationSeeds`) expected
   Slack channel `#founders`; the seed deliberately delivers to `#all-purple-orange`
   (`#founders` is a legacy alias normalized in `scheduler.ts:56`). Suite now green.
4. `7661545` **security** — `helmet` + rate limiting on the API:
   - `app.set('trust proxy', 1)` (real client IP behind nginx)
   - general limiter 1200/15min across `/api/`, exempting the SSE stream + the
     signature-verified Stripe/Slack webhooks
   - strict limiter 30/15min scoped to admin magic login + public waitlist only
     (does NOT touch OAuth flow / session reads)
   - config + predicates in `backend/src/security.ts` with contract tests
   - verified live: headers present, strict limiter trips at request 31
5. `e7b10ec` **docs** — spec for the template gallery.
6. `9e96dc5` **feature — workflow template gallery** (the activation win):
   - templates already existed but were **buried inside the create-automation
     editor**; extracted the catalog to `frontend/src/content/workflowTemplates.ts`
     (single source of truth), enriched with `category`/`outcome`/`integrations`/
     `slug`, added a 6th (monthly investor update)
   - new `frontend/src/features/templates/WorkflowTemplateGallery.tsx` (card grid)
   - rendered on the home command surface; "Use template" opens the existing
     editor **prefilled** via `applyFounderWorkflowTemplate` (review-before-ship
     preserved)
   - contract test `frontend/tests/workflowTemplates.contract.ts`
   - verified in `/dashboard-preview`: 6 cards render, "Use template" → prefilled
     editor

**All green:** frontend `tsc + vite build`, 11 frontend contract tests, backend
build, 12 backend tests.

---

## Next steps (pick up here)

Highest leverage first:

1. **Public `/templates/<slug>` SEO pages** — cheap now (the shared catalog has
   `slug` already), doubles as activation + organic surface; slugs align with the
   4 new blog posts.
2. **Chat empty-state CTA for templates** — new founders land on the home *chat*
   tab, not the *Dashboard* (activity) tab where the gallery lives. Add a
   "Start from a template" empty-state on the chat surface so brand-new users hit
   it without clicking into Dashboard.
3. **Decompose `server.ts`** (5.5k lines, 51 routes) into route modules — this is
   the monolith generating the recurring one-line scheduler fixes.

## Open platform-review findings (from this session, not yet addressed)

- **Multi-tenant authorization gap (P1):** automations are global, not
  workspace-scoped — any approved beta user can `run`/`delete` any automation
  (`triggerAutomationNow(id)` / `deleteAutomation(id)` don't check ownership).
  Fine for closed beta; must be workspace-scoped before wider access.
- **Bundle weight (P2):** `AgentStudio` (~76 KB gz) and `Dashboard` (~87 KB gz)
  are heavy; lazy-loaded so the landing page is fine, but in-app first paint lags
  on mobile. Code-split the studio.
- **Homepage polish (P2):** scroll-reveal right-column cards read faint during
  fast scroll (widen IntersectionObserver rootMargin); mobile proof-stats row is
  very sparse; mobile header logo is oversized (<420px).

## DONE this session: rate limiting + helmet (was the P0 finding).

---

## How to run / verify

```bash
# dev server (frontend)
cd "/Users/maximisto/Documents/New project/frontend" && npm run dev   # http://localhost:5173

# in-app preview WITHOUT auth (dev only): /dashboard-preview
#   home tabs are labeled "Chat" / "Dashboard"; the gallery is on "Dashboard"

# frontend contract tests
cd frontend && for t in tests/*.contract.ts; do npx --yes tsx "$t" && echo "PASS $t"; done

# backend build + tests
cd backend && npm run build && for t in tests/*.ts; do npx --yes tsx "$t" && echo "PASS $t"; done

# headless screenshots (Playwright lives in BACKEND node_modules — run scripts from backend/)
#   chromium.launch(); newPage({viewport}); goto('http://localhost:5173/...')
#   NOTE: scroll-reveal sections need an incremental scroll pass before fullPage capture,
#   or they stay at opacity:0.
```

## Gotchas

- **Fact-forcing gate:** a hook requires stating facts before the first Bash
  command and before editing/creating files (importers, affected exports, data
  files, verbatim user instruction). Just present the 4 facts and retry.
- **Deploy is manual** (see top). Push ≠ live.
- **Playwright MCP bridge** doesn't connect here (needs a browser extension);
  use the backend's bundled Playwright via a small `.mjs` run from `backend/`.
- Contract tests run via `tsx` (not installed; `npx --yes tsx` fetches it).
  Node 22 strips types but can't resolve the extensionless imports these tests use.
