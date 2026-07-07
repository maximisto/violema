# Claude Task Queue

This is the execution queue for the next few days.

Use this with:

- `/Users/maximisto/Documents/New project/docs/CLAUDE_CODE_HANDOFF.md`

The handoff file explains the system. This file tells you what to do next.

## Priority 1: Finish real auth

### Goal

Replace the remaining migration-era local auth fallback with a real backend-owned auth flow.

### Why this matters

This is the biggest remaining trust and systems gap.

Until this is done:

- admin privileges are not clean enough
- signup/login are not fully production-grade
- the final domain move stays awkward

### Main files

- `/Users/maximisto/Documents/New project/backend/src/auth.ts`
- `/Users/maximisto/Documents/New project/backend/src/server.ts`
- `/Users/maximisto/Documents/New project/frontend/src/lib/auth.ts`
- `/Users/maximisto/Documents/New project/frontend/src/components/ProtectedRoute.tsx`
- `/Users/maximisto/Documents/New project/frontend/src/pages/Signup.tsx`
- `/Users/maximisto/Documents/New project/frontend/src/pages/Login.tsx`

### What to do

- remove remaining local-session fallback from protected routes
- make backend session the real source of truth
- wire real Google sign-in end to end once creds are present
- wire real Microsoft sign-in end to end once creds are present
- ensure founder/admin privileges are resolved server-side only

### Done means

- a returning user can refresh and stay signed in through backend session cookie only
- signup/login do not depend on local-only acceptance state
- admin-only actions require real server-side admin identity

## Priority 2: Final `violema.com` cutover

### Goal

Make `violema.com` the canonical production domain.

### Why this matters

It affects:

- auth callbacks
- cookie domain
- Stripe return URLs
- public trust and launch readiness

### Main files

- `/Users/maximisto/Documents/New project/deploy/DEPLOY.md`
- `/Users/maximisto/Documents/New project/deploy/nginx.conf`
- `/Users/maximisto/Documents/New project/deploy/deploy.sh`
- `/Users/maximisto/Documents/New project/.env.example`
- `/Users/maximisto/Documents/New project/backend/src/server.ts`

### What to do

- confirm DNS and Hostinger routing actually point at the VPS
- provision final TLS certs
- set:
  - `AUTH_PUBLIC_URL=https://violema.com`
  - `AUTH_COOKIE_DOMAIN=violema.com`
- verify Google and Microsoft callback URLs
- verify Stripe success/cancel URLs
- add safe redirect behavior from `nexus.purpleorange.io`

### Done means

- `https://violema.com` serves the app
- auth works on the final domain
- billing returns to the final domain
- old domain can redirect safely

## Priority 3: Turn Slack into a real operating surface

### Goal

Move Slack from “working integration” to a strong product surface.

### Why this matters

Slack is one of the most believable surfaces for this product.

### Main files

- `/Users/maximisto/Documents/New project/backend/src/server.ts`
- `/Users/maximisto/Documents/New project/backend/src/integrations.ts`
- `/Users/maximisto/Documents/New project/frontend/src/pages/SlackSetup.tsx`
- `/Users/maximisto/Documents/New project/docs/SLACK_VIOLEMA_SETUP.md`

### What to do

- tighten Slack mention behavior
- add or finish DM support if event subscriptions are available
- improve Slack reply formatting
- make delivery targets clearer in product UX
- keep channel IDs and alias mapping sane

### Done means

- `@bot` in a connected channel feels reliable
- Slack replies feel product-grade, not raw
- DM path is either supported cleanly or intentionally disabled, not ambiguous

## Priority 4: Deepen the typed automation runtime

### Goal

Keep moving from stringy workflow behavior toward a clean typed step engine.

### Why this matters

This is the real path to:

- better reliability
- clearer UX
- better cost control
- stronger profit margins

### Main files

- `/Users/maximisto/Documents/New project/backend/src/server.ts`
- `/Users/maximisto/Documents/New project/backend/src/scheduler.ts`
- `/Users/maximisto/Documents/New project/backend/src/platform/types.ts`
- `/Users/maximisto/Documents/New project/backend/src/platform/delegation.ts`
- `/Users/maximisto/Documents/New project/backend/src/platform/topology.ts`
- `/Users/maximisto/Documents/New project/frontend/src/pages/Dashboard.tsx`

### What to do

- expand typed step support where it is still shallow
- keep run progress visible in the dashboard
- make per-step outputs easier to inspect
- reduce hidden prompt-like behavior inside execution
- keep step execution explicit and durable

### Done means

- authoring and runtime are aligned around typed steps
- worker/lane activity is visible and understandable
- automation failures are easier to debug

## Priority 5: Add exact cost and margin visibility

### Goal

Make runtime economics legible, not just VIOLEMA-credit legible.

### Why this matters

This product needs:

- smart routing
- profitable defaults
- confidence about actual provider cost

### Main files

- `/Users/maximisto/Documents/New project/backend/src/models.ts`
- `/Users/maximisto/Documents/New project/backend/src/platform/cost.ts`
- `/Users/maximisto/Documents/New project/backend/src/platform/store.ts`
- `/Users/maximisto/Documents/New project/backend/src/server.ts`
- `/Users/maximisto/Documents/New project/frontend/src/pages/Dashboard.tsx`

### What to do

- log provider-level token usage and cost per step when possible
- keep VIOLEMA credits as the product abstraction
- surface both:
  - user-facing cost abstraction
  - internal provider economics
- avoid making the dashboard noisy

### Done means

- the system can answer:
  - what this run cost in VIOLEMA credits
  - what it likely cost in provider spend
  - what the margin looked like

## Operating notes

- Highest-risk files are still:
  - `/Users/maximisto/Documents/New project/frontend/src/pages/Dashboard.tsx`
  - `/Users/maximisto/Documents/New project/frontend/src/components/ChatInterface.tsx`
  - `/Users/maximisto/Documents/New project/backend/src/server.ts`
- Build after meaningful changes:

```bash
cd /Users/maximisto/Documents/New\ project/frontend && npm run build
cd /Users/maximisto/Documents/New\ project/backend && npm run build
```

- Current fast deploy pattern:

```bash
ssh root@187.77.220.60 'set -e; cd /var/www/nexus; git fetch origin; git checkout claude/build-ai-assistant-platform-BsdRr; git pull --ff-only origin claude/build-ai-assistant-platform-BsdRr; cd frontend; npm run build; pm2 restart violema-backend'
```

## Anti-goals

Do not waste time on:

- org-chart theater
- fake autonomy claims
- decorative abstraction
- broad rewrites without leverage
- changing the design language without a clear reason

## If you only do one thing first

Finish real auth cleanly.

That unlocks the rest.
