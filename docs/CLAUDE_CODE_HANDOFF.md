# Claude Code Handoff

This file is the fastest way to get productive on VIOLEMA without re-learning the repo from scratch.

## 1. Project identity

- Product: `VIOLEMA`
- Company: `Purple Orange LLC`
- Current public app URL: `https://nexus.purpleorange.io`
- Intended final domain: `https://violema.com`
- GitHub repo: `https://github.com/maximisto/violema`
- Active branch at handoff: `main` canonical; local worktrees may still use `claude/build-ai-assistant-platform-BsdRr`
- Local repo path: `/Users/maximisto/Documents/New project`

## 2. What this product is

VIOLEMA is an AI coworker product with:

- a marketing site
- a web app dashboard
- chat with tool use and streaming
- recurring automations
- Stripe billing and top-ups
- Slack outbound and inbound basics
- an internal multi-worker runtime story:
  - 1 manager
  - 6 resident specialists
  - 4 elastic lanes

The user-facing surface should stay simple. Internally, the system can be more complex.

## 3. Repo map

### Frontend

- app shell and routes:
  - `/Users/maximisto/Documents/New project/frontend/src/App.tsx`
- landing / marketing:
  - `/Users/maximisto/Documents/New project/frontend/src/pages/Landing.tsx`
  - `/Users/maximisto/Documents/New project/frontend/src/components/Hero.tsx`
  - `/Users/maximisto/Documents/New project/frontend/src/components/Features.tsx`
  - `/Users/maximisto/Documents/New project/frontend/src/components/Navbar.tsx`
  - `/Users/maximisto/Documents/New project/frontend/src/components/Footer.tsx`
- auth / onboarding:
  - `/Users/maximisto/Documents/New project/frontend/src/pages/Signup.tsx`
  - `/Users/maximisto/Documents/New project/frontend/src/pages/Login.tsx`
  - `/Users/maximisto/Documents/New project/frontend/src/pages/SlackSetup.tsx`
  - `/Users/maximisto/Documents/New project/frontend/src/components/AuthProviderButton.tsx`
  - `/Users/maximisto/Documents/New project/frontend/src/components/ProtectedRoute.tsx`
  - `/Users/maximisto/Documents/New project/frontend/src/lib/auth.ts`
- dashboard:
  - `/Users/maximisto/Documents/New project/frontend/src/pages/Dashboard.tsx`
  - `/Users/maximisto/Documents/New project/frontend/src/components/ChatInterface.tsx`
- pricing / billing:
  - `/Users/maximisto/Documents/New project/frontend/src/pages/Billing.tsx`
  - `/Users/maximisto/Documents/New project/frontend/src/components/Pricing.tsx`
  - `/Users/maximisto/Documents/New project/frontend/src/components/TopUpChooser.tsx`
  - `/Users/maximisto/Documents/New project/frontend/src/lib/credits.ts`
- global styling:
  - `/Users/maximisto/Documents/New project/frontend/src/index.css`

### Backend

- main API:
  - `/Users/maximisto/Documents/New project/backend/src/server.ts`
- auth:
  - `/Users/maximisto/Documents/New project/backend/src/auth.ts`
- integrations:
  - `/Users/maximisto/Documents/New project/backend/src/integrations.ts`
- scheduler / automations:
  - `/Users/maximisto/Documents/New project/backend/src/scheduler.ts`
- model routing:
  - `/Users/maximisto/Documents/New project/backend/src/models.ts`
- platform core:
  - `/Users/maximisto/Documents/New project/backend/src/platform/billing.ts`
  - `/Users/maximisto/Documents/New project/backend/src/platform/stripe.ts`
  - `/Users/maximisto/Documents/New project/backend/src/platform/store.ts`
  - `/Users/maximisto/Documents/New project/backend/src/platform/types.ts`
  - `/Users/maximisto/Documents/New project/backend/src/platform/topology.ts`
  - `/Users/maximisto/Documents/New project/backend/src/platform/delegation.ts`
  - `/Users/maximisto/Documents/New project/backend/src/platform/cost.ts`
  - `/Users/maximisto/Documents/New project/backend/src/platform/workspace.ts`

### Deploy

- deploy guide:
  - `/Users/maximisto/Documents/New project/deploy/DEPLOY.md`
- nginx template:
  - `/Users/maximisto/Documents/New project/deploy/nginx.conf`
- deploy script:
  - `/Users/maximisto/Documents/New project/deploy/deploy.sh`

## 4. Current product reality

These things are real and live:

- landing site and dashboard UX
- streaming chat in the web UI
- recurring automations
- typed automation step builder
- worker topology UI in the task panel
- Stripe plans and top-ups
- Slack bot posting
- Slack event webhook support
- backend session auth foundation
- Google and Microsoft OAuth routes scaffolded in backend

These things are partially real:

- Google / Microsoft sign-in
  - code path exists
  - production credentials are not fully wired yet
- Slack conversational copilot
  - events route exists
  - outbound works
  - inbound basics exist
  - still not a fully mature Slack operating surface
- multi-worker runtime
  - real enough for UX and typed step execution
  - still not a durable, queue-backed, deeply stateful orchestration engine

These things are still not complete:

- final `violema.com` cutover
- real production auth end-to-end on final domain
- exact provider-level cost accounting
- robust workspace/user admin model

## 5. Important recent fixes

### First-message chat bug

This was fixed in commit:

- `8a7328a` `Fix first-message chat streaming handoff`

Observed behavior:

- first prompt showed loading dots
- assistant only began answering after a second prompt was sent

Root cause:

- the first prompt created a new conversation
- `ChatInterface` was keyed by `activeConvoId`
- the component remounted mid-stream when the id changed from `new` to a real conversation id

Fix:

- removed the `key={activeConvoId}` remount trigger
- added explicit conversation handoff logic in `ChatInterface`
- preserve in-flight stream when promoting `new` -> real conversation

Files:

- `/Users/maximisto/Documents/New project/frontend/src/components/ChatInterface.tsx`
- `/Users/maximisto/Documents/New project/frontend/src/pages/Dashboard.tsx`

### Dashboard panel work

Recent fixes also addressed:

- stale deleted tasks showing up again
- frozen or clipped task side panel behavior
- mobile panel scroll issues

The dashboard is much better than it was, but it is still the highest-risk surface for regressions because it holds a lot of interaction logic in one file.

## 6. Worker system as it exists now

Source of truth:

- `/Users/maximisto/Documents/New project/backend/src/platform/topology.ts`

Current structure:

- Core workers:
  - `nexus`
  - `researcher`
  - `analyst`
  - `operator`
  - `engineer`
  - `reviewer`
- Elastic lanes:
  - `writer`
  - `scheduler`
  - `messenger`
  - `monitor`

Current intelligence-band mapping:

- `critical`:
  - Claude Opus / frontier review
- `hard`:
  - GPT-5.4 / deep reasoning
- `default`:
  - Claude Sonnet / Qwen-class reasoning
- `micro`:
  - MiniMax + low-cost memory routing

Important nuance:

- the UX story is stronger than the runtime sophistication
- do not oversell “self-evolving” or autonomous organization behavior
- accurate language is:
  - budget-aware orchestration
  - specialist routing
  - elastic capacity
  - memory grouping / context compaction

## 7. Billing and Stripe state

Pricing model in code:

- Legacy Starter: `$29` (hidden/internal fallback; do not market publicly)
- Start: `$79` (uses existing backend `pro` Stripe price/env key)
- Pro: `$249` (uses existing backend `team` Stripe price/env key)
- Enterprise: custom

Top-ups:

- `500`
- `1500`
- `5000`

Key files:

- `/Users/maximisto/Documents/New project/backend/src/platform/billing.ts`
- `/Users/maximisto/Documents/New project/backend/src/platform/stripe.ts`
- `/Users/maximisto/Documents/New project/frontend/src/pages/Billing.tsx`

Important reality:

- top-ups are one-time and should not mutate plan tier
- checkout success should land back in dashboard
- there is founder-only test-credit support, but it is intentionally temporary until real auth/admin is finished

## 8. Auth state

Current backend auth exists in:

- `/Users/maximisto/Documents/New project/backend/src/auth.ts`
- `/Users/maximisto/Documents/New project/backend/src/server.ts`

Current frontend auth wiring:

- `/Users/maximisto/Documents/New project/frontend/src/lib/auth.ts`
- `/Users/maximisto/Documents/New project/frontend/src/components/ProtectedRoute.tsx`

Current reality:

- real backend session cookie exists
- signup/login can create server-side sessions
- Google/Microsoft OAuth routes exist
- some local fallback behavior still remains for migration safety

Do not assume auth is “finished.”

## 9. Slack state

Slack work is centered in:

- `/Users/maximisto/Documents/New project/backend/src/integrations.ts`
- `/Users/maximisto/Documents/New project/backend/src/server.ts`
- `/Users/maximisto/Documents/New project/docs/SLACK_VIOLEMA_SETUP.md`

Current reality:

- outbound posting works
- inbound events route exists
- signature verification exists
- there is enough here to build a stronger Slack copilot, but it still needs product refinement

Do not commit secrets to the repo.

## 10. Domain cutover status

Target:

- `violema.com`
- `www.violema.com`

Current live app still runs at:

- `https://nexus.purpleorange.io`

Deploy/domain notes live in:

- `/Users/maximisto/Documents/New project/deploy/DEPLOY.md`

Critical reality:

- code has been prepared for the new domain
- infra/DNS is the blocker, not app code
- do not assume certificates and callbacks are done until verified

## 11. Where the risk lives

Highest-risk files:

- `/Users/maximisto/Documents/New project/frontend/src/pages/Dashboard.tsx`
- `/Users/maximisto/Documents/New project/frontend/src/components/ChatInterface.tsx`
- `/Users/maximisto/Documents/New project/backend/src/server.ts`

Why:

- these files carry a lot of product behavior
- easy to fix one thing and regress another
- changes need disciplined validation

## 12. What to validate after meaningful changes

Always validate the smallest relevant thing first.

### Frontend

Run:

```bash
cd /Users/maximisto/Documents/New\ project/frontend
npm run build
```

### Backend

Run:

```bash
cd /Users/maximisto/Documents/New\ project/backend
npm run build
```

### Production health

Check:

- [https://nexus.purpleorange.io/api/health](https://nexus.purpleorange.io/api/health)

### Deploy pattern currently used

```bash
ssh root@187.77.220.60 'set -e; cd /var/www/nexus; git fetch origin; git checkout claude/build-ai-assistant-platform-BsdRr; git pull --ff-only origin claude/build-ai-assistant-platform-BsdRr; cd frontend; npm run build; pm2 restart violema-backend'
```

Note:

- this rebuilds frontend and restarts backend
- it is enough for many UI/backend code changes
- if env or nginx changes are involved, use the deploy files instead of this shortcut

## 13. Recommended next priorities

If you are taking over for a few days, do these in this order:

### 1. Real auth finish

- remove remaining local-session fallback
- wire real Google and Microsoft creds
- tie admin privileges to backend identity only
- make login/signup behavior clean and predictable

### 2. Final domain cutover

- finish `violema.com` routing
- set final auth cookie domain
- update OAuth callback URLs
- verify Stripe return URLs
- add legacy redirects safely

### 3. Slack product refinement

- make Slack mention and DM UX strong
- improve reply formatting
- ensure Slack feels like a real operating surface, not a demo integration

### 4. Automation/runtime refinement

- keep making the typed step engine more durable
- improve live run visibility
- avoid stringy behavior drifting back into the system
- move toward more explicit per-step execution state

### 5. Cost and margin visibility

- exact provider-level accounting
- compare VIOLEMA credits vs underlying provider cost
- keep cheaper paths as default where quality holds

## 14. Guardrails for future work

- do not introduce ornamental abstractions
- do not turn the user-facing product into an org-chart toy
- keep one visible assistant; keep most complexity internal
- preserve the current design language unless there is a clear reason to change it
- do not make inflated capability claims the runtime cannot support
- do not claim validation you did not perform

## 15. Best working style for this codebase

- read the local file before editing
- make the smallest strong fix
- build after meaningful changes
- deploy only after the build is clean
- if a bug smells like state or effect ordering in the dashboard/chat flow, inspect remount behavior first
- if a bug smells like billing or auth, check workspace identity and env assumptions before touching UI

## 16. Suggested first 30 minutes for a new operator

1. Read this file.
2. Read:
   - `/Users/maximisto/Documents/New project/backend/src/server.ts`
   - `/Users/maximisto/Documents/New project/frontend/src/pages/Dashboard.tsx`
   - `/Users/maximisto/Documents/New project/frontend/src/components/ChatInterface.tsx`
   - `/Users/maximisto/Documents/New project/backend/src/platform/topology.ts`
   - `/Users/maximisto/Documents/New project/deploy/DEPLOY.md`
3. Run both builds locally.
4. Check live health.
5. Only then pick the next issue.

## 17. Short plain-English status

This is no longer a prototype with obvious holes everywhere.

It is a strong, live product shell with real billing, real scheduling, real chat streaming, real Slack hooks, and a coherent product story.

The remaining work is in:

- auth hardening
- domain cutover
- Slack product maturity
- orchestration/runtime depth
- cost visibility

Treat it like a real product. Avoid theater. Tighten what matters.
