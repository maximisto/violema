# Violema Claude Passdown

Date: 2026-05-10
Repo: `/Users/maximisto/Documents/New project`
Branch: `claude/build-ai-assistant-platform-BsdRr`
Live app: `https://nexus.purpleorange.io`
Final target domain: `https://violema.com`

## Read this first

Violema is not starting from zero. The product already has a live marketing site, authenticated app surfaces, chat, recurring automations, Slack, Stripe, billing/credits, model routing, settings, and embedded Agent Studio surfaces.

The next phase is not "add more AI." The next phase is making Violema credible as a controlled beta and investor demo:

1. make setup trustworthy,
2. make top integrations actually usable,
3. make one recurring workflow run end-to-end,
4. make every run inspectable,
5. move to `violema.com` only after auth, billing, callbacks, and TLS are clean.

## Product direction

Position Violema as:

> The AI operator for recurring founder work.

Avoid generic "AI coworker that does everything" language. The beta should prove one valuable loop:

1. choose a workflow,
2. connect the minimum tools,
3. run once now,
4. review output,
5. approve delivery,
6. schedule recurring runs,
7. see history, cost, status, and failures.

The best first flagship workflow is:

> Weekly founder update: metrics, market notes, risks, wins, next asks, delivered to Slack or email with approval.

## Current live state

Verified on 2026-05-10:

- `https://nexus.purpleorange.io` is live.
- `https://nexus.purpleorange.io/api/health` returns `status: ok`.
- Live model routing is configured for OpenAI, Anthropic, OpenRouter, Mistral, and MiniMax lanes.
- Live health reports Anthropic, Tavily, Postmark, and Slack configured.
- The latest deployed frontend bundle is `index-CriXjmRr.js` / `index-DdbQ9T24.css`.
- `violema.com` is not the live app yet. Use `docs/VIOLEMA_DOMAIN_CUTOVER.md` before moving domains.

## Recent brand and landing changes

Do not accidentally revert these.

- Header and bottom CTA now use the updated transparent Violema PNG:
  - `frontend/public/brand/violema-logo-20260510.png`
  - `frontend/src/components/ViolemaLogo.tsx`
- The old video logo path was removed from the visible logo component.
- Footer Purple Orange logo is intentionally untouched.
- Mobile hero no longer shows the "Why teams switch to Nexus" stats tablet.
- Bottom CTA copy now pushes setup/integrations:
  - "Connect the stack."
  - "Let Violema run the loop."
  - "API keys in setup"

## Integration work already started

Max specifically wants integrations to work beyond Slack and wants setup to provide a place for API keys.

There is now a concrete settings surface for that:

- frontend route: `/settings`
- frontend file: `frontend/src/pages/SettingsPage.tsx`
- backend routes: `backend/src/agent-studio/settingsRoutes.ts`
- encrypted store: `backend/src/settingsStore.ts`
- store test: `backend/tests/settingsStore.test.ts`

Workspace setup currently supports model provider tokens:

- Anthropic
- OpenAI
- OpenRouter
- Mistral
- MiniMax

Workspace setup currently supports integration credentials:

- GitHub: personal access token
- Linear: API key
- Notion: internal integration token
- Stripe: secret key
- HubSpot: private app token
- Airtable: personal access token
- Figma: personal access token
- Vercel: access token

The backend can test these credentials using real provider endpoints:

- GitHub: `/user`
- Linear: `viewer`
- Notion: `/users/me`
- Stripe: `/v1/balance`
- HubSpot: contacts query
- Airtable: metadata bases
- Figma: `/me`
- Vercel: `/v2/user`

Important limitation:

Credential storage and connection tests exist, but most workflow actions still need provider-specific adapters that actually use these credentials during runs. Do not present the integrations as fully complete until those adapters exist and are tested.

## Next implementation priority

### 1. Finish integration adapter layer

Build a thin backend adapter boundary before adding more UI.

Recommended files/modules:

- keep credential storage in `backend/src/settingsStore.ts`
- create provider adapters under `backend/src/integrations/` or a similarly scoped backend folder
- keep `backend/src/server.ts` from getting larger where possible

Minimum useful adapters for beta:

- Stripe: read balance, subscriptions, MRR-ish revenue summary, failed payments
- GitHub: read repos, recent PRs/issues, commits for selected repo
- Linear: read issues/projects assigned to workspace context
- Notion: read selected pages/databases or at least verify accessible workspace/user
- HubSpot or Airtable: pick one CRM/data-store path, not both at once

Do not try to ship every provider deeply. Ship enough real reads to power the weekly founder update workflow.

### 2. Build one guided workflow setup

Make one workflow feel complete:

- choose "Weekly founder update"
- select sources
- confirm Slack/email destination
- run once now
- show output
- require approval before sending
- schedule recurring run

The first successful run is the activation event.

### 3. Improve run trust surfaces

Every run should show:

- status
- steps executed
- tools used
- sources/artifacts
- output
- delivery target
- approval state
- cost/credits
- failure reason and retry path

### 4. Keep Agent Studio secondary

Agent Studio is useful, but it should not be the first Violema story.

For beta:

- hide advanced topology/promotion/rollback language from normal users
- keep Agent Studio available to Max/admins
- let Violema feel like an operator, not an agent lab

### 5. Move to `violema.com` only after trust checks pass

Use `docs/VIOLEMA_DOMAIN_CUTOVER.md`.

Do not cut over until:

- `violema.com` and `www.violema.com` point to the VPS
- TLS terminates cleanly at nginx
- auth origins/cookie domain are correct
- Google/Microsoft OAuth callbacks are updated
- Stripe success/cancel URLs are updated
- Slack app URLs are checked
- `nexus.purpleorange.io` redirect behavior is intentional

## Repo map

Frontend:

- `frontend/src/App.tsx` - routes
- `frontend/src/components/Hero.tsx` - landing hero
- `frontend/src/components/Navbar.tsx` - public nav/logo
- `frontend/src/components/PublicHeader.tsx` - public secondary header/logo
- `frontend/src/components/ViolemaLogo.tsx` - current shared Violema logo component
- `frontend/src/pages/Landing.tsx` - landing page and final CTA
- `frontend/src/pages/Dashboard.tsx` - main app dashboard; large/high-risk
- `frontend/src/pages/SettingsPage.tsx` - model and integration setup
- `frontend/src/pages/AgentStudio.tsx` - embedded Agent Studio; very large/high-risk

Backend:

- `backend/src/server.ts` - main API; large/high-risk
- `backend/src/agent-studio/settingsRoutes.ts` - settings API routes
- `backend/src/settingsStore.ts` - encrypted workspace provider/integration credentials
- `backend/src/models.ts` - model routing
- `backend/src/integrations.ts` - existing integration helpers
- `backend/src/scheduler.ts` - recurring automation scheduler
- `backend/src/platform/*` - billing, store, cost, topology, delegation

Docs:

- `docs/products/violema/SETUP.md`
- `docs/products/violema/HANDOFF.md`
- `docs/products/violema/FRESH_AUDIT_BETA_READINESS_2026-05-07.md`
- `docs/VIOLEMA_DOMAIN_CUTOVER.md`
- `deploy/DEPLOY.md`

## Commands

Install:

```bash
npm run install:all
```

Run locally:

```bash
npm run dev
```

Build everything:

```bash
npm run build
```

Build frontend only:

```bash
cd frontend
npm run build
```

Build backend only:

```bash
cd backend
npm run build
```

Settings test note:

- `backend/tests/settingsStore.test.ts` exists for encrypted integration credential storage.
- There is no package-level test script wired yet.
- A direct `node --test tests/settingsStore.test.ts` run currently fails on TS/ESM module resolution before the assertions execute.
- Before relying on it, either add a TS-aware test runner or update the test import/runtime path cleanly.

Fast frontend-only deploy currently used for live visual edits:

```bash
cd "/Users/maximisto/Documents/New project/frontend"
npm run build
rsync -az --delete "/Users/maximisto/Documents/New project/frontend/dist/" root@187.77.220.60:/var/www/nexus/frontend/dist/
ssh root@187.77.220.60 'chown -R www-data:www-data /var/www/nexus/frontend/dist'
```

Use the deploy script for backend, nginx, env, or domain changes. Do not use the frontend-only rsync path for backend changes.

## Validation standard

Before saying work is done:

- run the smallest relevant build/test
- use `git diff --check`
- if UI changed, verify with a browser/mobile viewport
- if live site changed, verify the served bundle or endpoint
- never claim `violema.com` is live until HTTPS, auth, callbacks, Stripe returns, and cookies are verified on that domain

Useful live checks:

```bash
curl -sS https://nexus.purpleorange.io/api/health
curl -sS https://nexus.purpleorange.io/ | rg 'assets/index-'
curl -I https://nexus.purpleorange.io/brand/violema-logo-20260510.png
```

## Current risks

- `backend/src/server.ts`, `frontend/src/pages/Dashboard.tsx`, and `frontend/src/pages/AgentStudio.tsx` are too large. Avoid adding more unrelated logic to them.
- Integration setup exists, but workflow execution still needs real provider adapter usage.
- `violema.com` is not yet cut over.
- Some development/mock paths are still useful locally but should be clearly labeled before beta.
- The repo currently has multiple uncommitted changes. Preserve Max's existing edits; do not reset or revert unrelated files.

## Best next task for Claude

Start with:

> Make the weekly founder update workflow actually use connected credentials for at least Stripe plus one work source, produce an inspectable run result, and deliver to Slack/email only after approval.

That is the shortest path from current product to controlled beta proof.
