# VIOLEMA — Master Improvement Plan (Beta → Winner App → Seed 2026)

**Date:** 2026-07-04
**Prepared for:** Max (max@purpleorange.io)
**Implementer:** Claude Opus 4.8 (each work package below is written to be handed directly to Opus 4.8 as a self-contained task)
**Repo state audited:** branch `claude/build-ai-assistant-platform-BsdRr`, commit `246e768`
**Inputs:** full backend audit, full frontend audit, full product-docs review (this session). The SecondBrain vault (`/Users/maximisto/SecondBrain/...`) is not reachable from this remote container — sections flagged **[VAULT]** should be reconciled against `Violema - Dashboard.md`, `Violema - Runbook.md`, and `Violema Deployment Auth SEO Canon.md` before execution on a machine that has them.

---

## The Thesis

Violema's positioning — **"the reviewable AI operator for founder-led teams"** — is genuinely differentiated. Nobody in the category (Zapier AI, Lindy, Relay.app, n8n+AI, generic GPT wrappers) owns *inspectable autonomy*: every run reviewable, every step evidenced, every dollar of cost visible. The chat streaming surface is already near Claude/ChatGPT polish, and the credit-margin telemetry (P5) is something even funded competitors don't show users.

But the audit found the beta is a **convincing shell over a fragile core**:

1. **The product's central promise is currently false.** The 7 chat tools return fabricated demo data (`docs/INTEGRATIONS_ARCHITECTURE.md` admits "nothing real happens"). An investor demo that gets probed collapses.
2. **There is no tenant isolation.** Any beta user can read/write any other tenant's data — including their encrypted provider API keys — by setting an `X-Workspace-Id` header (`backend/src/server.ts:401-427`). Client-side `role` in localStorage is user-editable to `admin` (`frontend/src/lib/auth.ts:18-58`).
3. **The persistence layer loses data by design.** Whole-file synchronous JSON writes with no atomicity, no locking, silent reset-to-`[]` on corruption (`backend/src/platform/jsonStore.ts:6-13`).
4. **Money is not safe.** Credit accounting is check-then-act with no reservation; concurrent requests double-spend; the agent tool loop has **no iteration cap**, so a $0-balance user can trigger unbounded token spend (`server.ts:1187`, `store.ts:223-244`).
5. **Velocity is collapsing under monoliths.** `server.ts` 5,707 lines / 53 routes; `AgentStudio.tsx` 9,389 lines; `Dashboard.tsx` 6,527 lines. Tests exist but no runner is wired; zero CI; ~7 log lines in the whole server.

The plan: **make the promise true, make the core safe, then make the differentiation undeniable.** Five phases, strictly ordered by dependency. Phases 0–1 are non-negotiable before any external user or investor touches the product. Phases 2–4 are where "winner app" happens. Phase 5 packages it for the raise.

---

## Pricing + Packaging Direction (Stargaze Pass, 2026-07-04)

**Decision:** do **not** ship a $29 lowest paid tier. Violema should present as a call-led, trust-heavy AI operator for founder workflows:

1. Primary CTA: **Book workflow audit** / "Design your first reviewed mission."
2. Secondary CTA: **Start free preview** for a bounded preview, not a production tier.
3. First real paid plan: **Start / Founder — $79/mo**.
4. Main production plan: **Pro — $249/mo**.

**Why:** $29 frames Violema as commodity automation. The durable wedge is not "cheap tasks"; it is reviewed, source-linked, cost-visible operational work a founder can trust. The market already has cheap workflow meters. Violema should anchor against the value of a reliable operating loop and the trust/onboarding required to connect real company data.

**Competitive pricing check, official sources reviewed 2026-07-05:**

| Product | Public pricing anchor | Lesson for Violema |
|---|---:|---|
| [Zapier](https://zapier.com/pricing) | Free, Professional from $19.99/mo, Team from $69/mo | Commodity workflow automation starts cheap; do not let this anchor Violema's reviewed-operator positioning. |
| [Make](https://www.make.com/en/pricing) | Free, Core $12/mo, Pro $21/mo, Teams $38/mo at 10k credits | Low prices are for visual workflow volume, not trusted AI execution with review and evidence. |
| [Relay.app](https://www.relay.app/pricing) | Free, Professional $19/mo annual, Team $59/mo annual | Human-in-the-loop workflow tools still use low self-serve entry points; Violema needs a stronger trust/value frame. |
| [n8n](https://n8n.io/pricing/) | Starter 20 EUR/mo annual, Pro 50 EUR/mo annual, Business 667 EUR/mo annual | Builder platforms scale up sharply when production, governance, and team usage matter. |
| [Lindy](https://www.lindy.ai/pricing) | Plus $49.99/mo, Pro $99.99/mo, Max $199.99/mo; Pro includes live onboarding | The closest "AI assistant/operator" comparable validates that serious-use agent pricing belongs near/above $100, while onboarding is part of value. |
| [Gumloop](https://www.gumloop.com/pricing) | Free, Pro starts at $37/mo, Enterprise custom | AI-agent builders can start low, but serious team usage still pushes toward custom/enterprise motion. |
| [Relevance AI](https://relevanceai.com/pricing) / [pricing docs](https://relevanceai.com/docs/admin/subscriptions/new-pricing) | Public page is enterprise-first/custom; docs split actions from vendor credits | Agent platforms are moving toward transparent usage economics; Violema should make cost intelligence a feature, not a footnote. |

**Recommended packaging:**

- **Workflow Audit (primary motion):** 20-minute call to map the first mission, confirm integrations/data readiness, and decide whether Violema is useful. Do not label this "Contact sales"; call it a workflow audit or first-mission design session.
- **Free Preview ($0):** demo workspace, sample data, one reviewed sample run, visible run ledger/costs, no external delivery without connection. Purpose: self-serve learning and lead capture, not production value.
- **Start / Founder ($79/mo):** 1 workspace, 1-3 live missions, 1,500-2,000 credits, first hero integration, run review pages, Slack/email delivery, budget caps. This replaces the current $29 Starter concept without forcing a $99 first step.
- **Pro ($249/mo):** 5-10 live missions, 7,500+ credits, approval gates, more integrations, Slack operating surface, priority setup/support.
- **Enterprise (custom):** more seats, workspaces, custom mission volume, compliance/security review, custom integration help.
- **Optional paid setup:** $500-$1,500 first-mission setup, credited against the first invoice for qualified founders. This filters tire-kickers without making early adopters feel punished.

**Presentation / linking:**

- Make the hero CTA **Book workflow audit**. Pair it with a quieter **Start free preview** secondary CTA.
- Pricing page should show the call-led path first, then the plan cards. The best buyer path is not "pick a tier blind"; it is "design the first mission, then choose the plan."
- Link every pricing card to a sample reviewed run and a monthly cost projection. The proof is the run ledger: sources, steps, approval state, credits, provider cost, and monthly estimate.
- Reuse existing Stripe products/price IDs: current backend `pro` maps to public **Start / Founder $79**; current backend `team` maps to public **Pro $249**; current backend `starter` becomes hidden/legacy. No Stripe product migration is required.
- `/pricing` should become the canonical route; `/plans` can remain as a backwards-compatible alias. Current implementation has a blank `/pricing` route and live `/plans`, so WP-5.2 must fix routing, copy, and credit economics together.

**Stargaze rule:** sell the outcome of a trusted operating loop, not the cheapest seat in an automation category. A founder who will not pay $79 for one reliable reviewed workflow is not the first ICP; $249 Pro is the real production anchor.

---

## Phase 0 — Stop the Bleeding (security + money safety)

*Everything here is small, surgical, and must ship before anything else. No new features. Target: 1–2 Opus sessions.*

### WP-0.1 Enforce user→workspace authorization (kills the IDOR)

**Problem:** `resolveWorkspaceContext` (`backend/src/server.ts:401-427`) trusts `X-Workspace-Id` / `?workspace_id` / `body.workspaceId` from the client. `AuthUserRecord` (`backend/src/auth.ts:13-27`) has no workspace linkage. Every settings/task/billing/automation route is exposed cross-tenant.

**Steps:**
1. Add `workspaceIds: string[]` (and `defaultWorkspaceId: string`) to `AuthUserRecord` in `backend/src/auth.ts`. On user creation (`upsertAuthUser`), mint a deterministic workspace id from the user id and store it.
2. Write a one-shot migration that assigns every existing user in `auth-users.json` their own workspace id, and maps existing data: any workspace id currently present in `platform-tasks.json` / `automations.json` / `workspace-settings.json` gets assigned to the user whose activity created it (where ambiguous, assign to the admin account and log it).
3. In the global auth middleware (`server.ts:307-336`), after token verification, attach `req.authUser`. Rewrite `resolveWorkspaceContext` to: take the client-supplied workspace id **only as a selector**, verify it is in `req.authUser.workspaceIds`, else 403. If absent, fall back to `defaultWorkspaceId`. Admin role may access any workspace (server-verified role only).
4. Scope the scheduler and Slack event handlers: `automations.json` records must carry `workspace_id` and `owner_user_id`; `executeAutomation` and all automation CRUD routes filter by the caller's workspace. (This also fixes the documented P1 "automations are global" bug from `docs/handoffs/2026-06-21-claude-handoff.md`.)
5. Slack events (`server.ts:5050`) currently hardcode `DEFAULT_WORKSPACE_ID` — map the Slack team/channel to a workspace via the stored Slack connection instead; if unmapped, drop the event with a log line.

**Acceptance:** an integration test proving user B with a valid session gets 403 reading user A's `/api/settings`, tasks, automations, and billing; `npm test` green.

### WP-0.2 Kill client-trusted role/authz on the frontend

**Problem:** `frontend/src/lib/auth.ts:18-58` stores `role` in localStorage and gates admin UI on it; `ADMIN_EMAILS` hardcoded in the client bundle (`auth.ts:20-23`).

**Steps:**
1. Treat the backend session (`GET /api/auth/session`) as the sole source of truth for `role`. Remove `ADMIN_EMAILS` and `isAdminEmail` from the client entirely (the server already has its own allowlist).
2. Keep localStorage only as a display cache (name/email for instant paint); never read `role` from it for gating. `ProtectedRoute` and `AdminDashboard` must gate on the fetched backend session.
3. Ensure every admin API route re-verifies role server-side (audit each `/api/auth/admin*` and admin dashboard route — the check must be on `req.authUser.role`, never on request body/header).

**Acceptance:** editing localStorage to `role: "admin"` produces no admin UI and no admin API access.

### WP-0.3 Cap the agent tool loop + hold credits before running

**Problem:** `while (continueLoop)` with no bound (`server.ts:1187`, `:1310`); credits checked once pre-run, debited post-run — concurrent requests double-spend; a near-zero user can burn unbounded tokens.

**Steps:**
1. Add `MAX_TOOL_ITERATIONS` (default 24) and a per-request token budget to both the Anthropic and OpenAI loops. On breach: gracefully close the loop with a final "I hit the step limit for this task" message, mark the run `capped`, and charge only actual usage.
2. Implement a **credit hold**: at request start, append a `hold` ledger entry for the estimate (negative available-balance effect); at completion, replace with the actual charge and release the remainder. `canSpendCredits` computes against balance-minus-active-holds. Holds expire after 15 minutes (crash safety).
3. Wrap the `JSON.parse(result)` at `server.ts:1273` in a try/catch that emits the raw string as the tool result instead of aborting the SSE stream.
4. Add retry-with-backoff (3 attempts, 1s/4s/10s, on 429/5xx/network) to the Anthropic and OpenAI calls in `models.ts` and `server.ts`.

**Acceptance:** a test that fires 5 concurrent chat requests against a balance sufficient for 2 shows total debits never exceed balance; a mocked always-tool-calling model terminates at the cap.

### WP-0.4 Atomic file writes (bridge until Phase 1 DB)

**Steps:** In `jsonStore.ts`, write to `${path}.tmp` then `fs.renameSync` (atomic on same filesystem). On read, if parse fails, do **not** return `[]` silently — move the corrupt file to `${path}.corrupt.<ts>`, log loudly, and try `${path}.bak`; write a `.bak` copy before each successful write. Serialize writes per-file through a simple in-process promise queue keyed by path (kills same-process lost updates until the DB lands).

**Acceptance:** kill -9 during a write loop leaves a parseable store; concurrent writers through the queue never interleave.

---

## Phase 1 — Real Foundation (database, durable scheduler, CI)

*Target: 3–5 Opus sessions. This unlocks everything after it.*

### WP-1.1 Migrate persistence to SQLite (better-sqlite3, WAL mode)

**Why SQLite over Postgres now:** single-VPS deploy (PM2 + nginx, `deploy/DEPLOY.md`), zero ops overhead, synchronous transactional API that maps 1:1 onto the current call sites, real ACID, trivially backed up (single file + litestream later). Postgres is the right move at multi-node scale — design the data layer so the swap is a driver change, not a rewrite.

**Steps:**
1. Add `better-sqlite3`. Create `backend/src/db/` with: `schema.sql` (tables: `users`, `sessions`, `workspaces`, `workspace_members`, `tasks`, `task_runs`, `ledger_entries`, `credit_holds`, `automations`, `automation_runs`, `workspace_settings`, `stripe_events`, `waitlist`), `db.ts` (connection, WAL pragma, migrations runner with a `schema_migrations` table), and `repositories/` (one module per aggregate exposing the exact function signatures the JSON stores expose today — `listTasks`, `addLedgerEntry`, `upsertAuthUser`, etc.).
2. Port call sites store-by-store in this order (each its own commit, tests green between): `auth` → `ledger/billing` → `tasks/runs` → `automations` → `settings` → `stripe_events/waitlist`. The repository layer means `server.ts` barely changes.
3. `addLedgerEntry` + hold release become a single SQLite transaction with a `CHECK (balance_after >= 0)`-style guard enforced in the transaction (read current balance FOR UPDATE semantics via the write lock).
4. One-shot importer `backend/src/db/importJsonStores.ts` that ingests all existing `*.json` state files, verifies row counts, and renames the JSON files to `*.imported`. Run automatically on first boot if the DB is empty and JSON files exist.
5. Nightly backup: a cron in the scheduler that copies the SQLite file (via `VACUUM INTO`) to `backups/` with 14-day retention. **[VAULT]** reconcile backup destination with the Runbook's ops conventions.

**Acceptance:** all existing `node:test` suites pass against SQLite; importer round-trips current production JSON (copy from VPS) with zero row loss; concurrent-debit test from WP-0.3 now passes at the DB level.

### WP-1.2 Durable, idempotent scheduler

**Problem:** in-process `node-cron`, in-memory task map, re-executes past-due automations on every restart with no idempotency (`scheduler.ts:498-512`); hand-rolled `computeNextRunAt` diverges from node-cron (no ranges support).

**Steps:**
1. Replace the fire-on-boot-if-past-due logic with an `automation_runs` table keyed by `(automation_id, scheduled_for)` — a run is claimed by inserting that row (UNIQUE constraint = idempotency key). Missed windows during downtime create at most **one** catch-up run, and only if the automation opts into `catch_up: true` (default false — a founder's Monday 9am report should not fire at 2pm after a restart unless asked).
2. Replace the custom cron matcher with `cron-parser` for `next_run_at` computation so display and execution agree; keep `node-cron` for ticking or move to a simple 30s poll of `next_run_at <= now` (recommended — one mechanism, no drift, restart-safe).
3. Overlap guard: refuse to start a run while a `running` row exists for the same automation; mark runs `abandoned` if `running` for >30 min (crash recovery).
4. Persist per-step results into `automation_runs` (the frontend "Latest result" panel already renders these — extend it to a run *history* list, last 20 runs).

**Acceptance:** restart mid-run does not duplicate a delivery; two instances of the process (simulated) never double-fire; run history endpoint returns per-step records.

### WP-1.3 Wire tests + CI + deploy pipeline

**Steps:**
1. Backend: add `"test": "tsx --test tests/**/*.test.ts"` (add `tsx` dev-dep). Frontend: add vitest + `@testing-library/react`; convert the 16 hand-rolled `*.contract.ts` files to vitest suites (mechanical: replace local `assert` with `expect`).
2. GitHub Actions workflow: on PR and push — backend tsc + tests, frontend tsc + lint + vitest + vite build. Block merge on red.
3. New integration-test layer (supertest against the Express app with a temp SQLite DB): auth flows, the WP-0.1 tenancy 403s, credit hold/debit, automation CRUD + run, Stripe webhook idempotency. These are the tests that guard the money and the security fixes.
4. Deploy: extend `deploy/deploy.sh` into a GitHub Actions deploy job (SSH action) triggered by a tag or manual dispatch, so **push→live is one click and auditable**. Keep the manual script as fallback. **[VAULT]** the Runbook may already prescribe a deploy ritual — align rather than replace.

**Acceptance:** CI red blocks a deliberately broken PR; a tagged release reaches the VPS without a manual SSH session.

### WP-1.4 Observability floor

**Steps:**
1. Add `pino` structured logging with request middleware (request id, user id, workspace id, route, latency, status). Replace the ~16 `console.*` calls.
2. Add Sentry (backend + frontend) — free tier is fine for beta. Wire the Express error handler and React error boundary.
3. Per-run cost telemetry: every chat/automation run already computes tokens + credits + provider cost (P5) — log it as a structured event and add `GET /api/admin/metrics` (runs/day, tokens/day, provider spend/day, margin, active users, failure rate). This becomes the seed-round metrics tap (Phase 5).
4. `/api/health` extended: DB reachable, scheduler tick age, provider key presence — already partially there per docs; make it comprehensive.

**Acceptance:** a thrown error in a route appears in Sentry with request id; `/api/admin/metrics` returns real numbers.

### WP-1.5 Decompose `server.ts` (mechanical, after tests exist)

**Steps:** Split into routers, no behavior change, one commit per extraction, integration tests green after each: `routes/auth.ts`, `routes/chat.ts` (+ `services/agentLoop.ts` for the tool loops), `routes/automations.ts`, `routes/billing.ts`, `routes/settings.ts` (exists), `routes/slack.ts`, `routes/integrations.ts`, `routes/admin.ts`, `middleware/` (auth gate, workspace resolution, rate limits). Target: no file over 800 lines. `buildSystemPrompt` and Slack formatting helpers move to `services/`.

**Acceptance:** `server.ts` < 300 lines (app assembly only); route inventory identical (snapshot test on the Express router stack).

---

## Phase 2 — Make the Promise True (real work, real integrations)

*This is the highest product-risk item: the demo tools fabricate data. "Reviewable AI operator" only lands if the work is real. Target: 4–6 Opus sessions.*

### WP-2.1 Truth-labeling pass (ship immediately, one session)

Until real integrations land, every tool result that is fabricated must say so in the UI. Add `simulated: true` to demo tool outputs; render an unmissable "Simulated data — connect [Stripe] to see yours" chip on tool cards and delivered reports. **An investor who catches one fabricated number silently presented as real is a lost round.** This also converts demo mode into an activation funnel (chip → connect CTA).

### WP-2.2 Credential vault + integration OAuth spine

Build the `credentialVault.ts` + `/api/integrations/:provider/start|callback|disconnect` routes specified in `docs/INTEGRATIONS_ARCHITECTURE.md` (the design is already written — implement it):
1. Vault: per-workspace encrypted credentials in the new DB (AES-256-GCM already proven in `settingsStore.ts:106-129`); introduce a dedicated `CREDENTIAL_VAULT_KEY` env var with key-version column (fixes the WP: rotation-bricks-tokens weakness; keep decrypt fallback to the legacy derived key for migration).
2. Generic OAuth handler pattern (the Google/Microsoft auth flows in `server.ts:3691-3910` are the template — extract and generalize).
3. `/settings` Integrations section: connected state, scopes, disconnect, per-integration health check.

### WP-2.3 Hero integrations — make three real end-to-end

Priority order (founder-wedge value × demo impact):
1. **Stripe (read)** — real MRR/churn/failed-payments in the daily revenue monitor. The workspace already has Stripe billing code to model from.
2. **Google Workspace (Gmail read + Calendar read)** — reuses the Google OAuth client from auth; unlocks "inbox triage" and "week ahead" automations.
3. **GitHub (read)** — PRs/issues/commits for the weekly founder update. The category's founder ICP lives here.

Each: typed tool definition (input schema, output schema), vault-backed client, real fetch with retry, unit tests with recorded fixtures, and the tool card rendering real evidence links (deep links to the Stripe payment / email / PR — this *is* the "source-linked output" moat).

### WP-2.4 Composio long-tail behind a feature flag

`composioBridge.ts` exists; wire it to the vault + integrations UI for the 250+ long-tail (Notion, Linear, HubSpot...), flagged per-workspace. Hero integrations stay native (quality-controlled); long-tail rides Composio. This matches the documented Tier-1/Tier-2 architecture.

### WP-2.5 Typed automation runtime (finish P4)

The runtime is still partly "stringy" (`docs/CLAUDE_TASK_QUEUE.md` item 4). Define a versioned `AutomationSpec` (zod schema): typed steps (`research | analyze | draft | deliver`), typed sources (integration refs, not free text), typed delivery targets, typed conditions (replace the string-pattern `evaluateCondition` with a small structured condition object; keep string parsing as an import shim). Validate on save; migrate stored automations. This is what makes the template gallery (WP-4.3) and reliability possible.

---

## Phase 3 — Frontend Platform (velocity + polish)

*Target: 4–6 Opus sessions. Parallelizable with Phase 2 after 3.1.*

### WP-3.1 Data layer: TanStack Query + typed API client

1. Add `@tanstack/react-query`. Create `src/lib/api/client.ts`: one fetch wrapper (base URL, credentials, workspace header, JSON errors→typed `ApiError`, 401→session refresh→login redirect).
2. Create typed hooks per resource (`useTasks`, `useAutomations`, `useCreditSnapshot`, `useSession`, `useSettings`...) replacing the 38 raw `fetch()` sites. Query keys scoped by workspace. Mutations invalidate; automation "Save & run" becomes mutation + optimistic status.
3. Kill the redundant-fetch problem: credits fetched once, shared everywhere (Dashboard, ChatInterface, Navbar, BillingGateBar currently each refetch and can disagree).
4. Central error surface: one toast system; no more silent `catch {}` (16 sites in Dashboard alone).

### WP-3.2 Decompose Dashboard.tsx and AgentStudio.tsx

Follow the pattern that already works in `src/features/missions/` and `src/features/agent-studio/` (pure logic separated from view):
- `Dashboard.tsx` (6,527 lines, 37 useState) → `features/dashboard/`: `ChatPane`, `AutomationsPane` (+ `AutomationEditor`, `RunHistoryPanel`), `Sidebar`, `TaskPanel`, with state moving into React Query + small local state. Target: no file > 500 lines.
- `AgentStudio.tsx` (9,389 lines) → finish the started decomposition into its existing `features/agent-studio/` rooms; per product docs, **hide Agent Studio from non-admin users** behind a flag (the docs already call for this — it confuses the founder-wedge story).
- Bundle win is automatic: per-pane chunks replace one 936KB monolith chunk.

### WP-3.3 Replace the regex markdown renderer

Swap the 200-line hand-rolled `dangerouslySetInnerHTML` renderer (`ChatInterface.tsx:41-237`) for `react-markdown` + `remark-gfm` + `rehype-sanitize`, with custom renderers that preserve the existing styled components (tables in `overflow-x-auto`, code blocks with copy button). The chat is the surface investors stare at; GFM tables and nested lists must not fall apart. Keep the streaming-cursor behavior.

### WP-3.4 Design-system primitives

Promote the `.ui-*` CSS conventions into React primitives: `<Button>`, `<Card>`, `<Pill>`, `<Modal>` (with `role="dialog"`, focus trap, Escape — fixes the artifact-preview a11y gap at `ChatInterface.tsx:557-630`), `<Input>`, `<EmptyState>`, `<Skeleton>`. Adopt in decomposed panes as they're extracted (not a big-bang restyle). Add `aria-expanded` to disclosure buttons (ThinkingBlock, ToolCallBlock).

### WP-3.5 Mobile pass

Dashboard has ~38 breakpoint utilities across 6.5K lines — effectively desktop-only. After decomposition: sidebar as drawer (compact footer already done), chat full-bleed, automation editor as full-screen sheet, tables→cards on `sm`. Acceptance: core loop (read chat, review a run, approve) fully usable at 390px width. Founders check their AI operator from phones — this is a retention feature, not chrome.

---

## Phase 4 — Winner-App Differentiation

*The category-beating features. All depend on Phases 1–3. Target: 5–8 Opus sessions.*

### WP-4.1 The Run Review surface (the moat, part 1)

Nobody in the category has a first-class "review what the AI did" experience. Build it:
- Every run (chat task or automation) gets a permanent **Run page**: timeline of steps, each with inputs, outputs, evidence links (real integration deep-links from WP-2.3), tokens, credits, provider cost, duration.
- **Review gates:** automations can require approval before the deliver step; approval requests land in Slack (button) and the web Reviews queue. Approve/reject/edit-then-approve.
- Diff view for recurring reports: "what changed since last week's investor update" — trivially valuable to the founder ICP and screenshot-bait for marketing.

### WP-4.2 Cost intelligence (the moat, part 2)

The P5 margin plumbing exists — turn it into a user-facing killer feature: per-automation monthly cost projection ("this daily monitor ≈ 340 credits/mo"), budget caps per automation with auto-pause + Slack alert, and a workspace cost dashboard (spend by automation, by model tier, trend). Position: "the only AI operator that shows you exactly what every task costs before and after it runs." Pricing target is now **call-led workflow audit + bounded free preview + Start/Founder at $79/mo + Pro at $249/mo + Enterprise custom**; reconcile the old $29/$50/$149 plan-doc numbers by fixing `cost.ts` + `/pricing`/`/plans` + landing copy together while reusing existing Stripe price IDs (see WP-5.2).

### WP-4.3 Template gallery → 5-minute activation

Six documented templates (weekly investor update, daily revenue monitor, competitor brief...) become one-click installs on the typed runtime (WP-2.5): pick template → connect the 1–2 required integrations (WP-2.2 flow) → "run once now" (Save & run already shipped) → review output → schedule. Instrument every funnel step. Public `/templates/<slug>` SEO pages render the same specs (already in the task queue). **Activation-to-first-reviewed-run is THE seed-deck metric.**

### WP-4.4 Slack as a full operating surface

The bot works; finish the loop: approval buttons (WP-4.1) in Slack, `/violema run <automation>`, run-completion digests with evidence links, and per-workspace Slack mapping (from WP-0.1 step 5). Founder never has to leave Slack for the daily loop; the web app is the control room.

### WP-4.5 Streaming + resilience polish

SSE reconnect with `Last-Event-ID` resume on the chat stream; automation runs stream step progress live to the run page; graceful "model provider degraded, retrying" states (retries from WP-0.3). The product should feel *calmly reliable* — that texture is what separates winner apps from demos.

---

## Phase 5 — Investor Readiness (2026 seed)

*Target: 2–3 Opus sessions + founder work.*

### WP-5.1 The metrics tap
From WP-1.4 telemetry, build the internal one-pager investors will ask for: WAU, activation rate (signup → first reviewed run), retained automations/week (recurring-value proxy), runs/week growth, gross margin per run (real, from P5 data), failure rate trend. Auto-emailed weekly to Max.

### WP-5.2 Pricing + narrative coherence
Fix the pricing contradiction (plan doc vs `cost.ts` vs blank `/pricing` route — real route is `/plans`) around the new target: **workflow audit primary, free preview secondary, Start/Founder $79/mo, Pro $249/mo, Enterprise custom**.

**First pass shipped on this PR branch:** `/pricing` now renders the billing surface, public cards show Start $79 and Pro $249, backend display names match while existing Stripe `pro`/`team` IDs and price env keys are reused, Legacy Starter is hidden from the public ladder, checkout success/cancel returns are aligned to `/pricing`, the landing/footer CTAs now lead with "Book workflow audit" plus "Start free preview", and `/pricing` links to public sample Run pages with monthly credit projections for Start, Pro, and Enterprise.

1. Replace the current `$29 Starter` public offer with `Start / Founder — $79/mo`; move the serious production tier to `Pro — $249/mo`.
2. Reuse existing Stripe env keys and price IDs: backend `pro` remains the checkout id for $79, backend `team` remains the checkout id for $249, and backend `starter` stays as hidden/legacy fallback rather than a public plan.
3. Align credit economics in `backend/src/platform/cost.ts`, backend plan display names, `frontend/src/pages/Billing.tsx`, landing CTAs, and any plan docs in one PR. Do not change copy without changing billing math.
4. Make `/pricing` canonical and keep `/plans` as a redirect or backwards-compatible alias.
5. Add "Book workflow audit" as the primary public CTA and "Start free preview" as the secondary CTA. Avoid generic "Contact sales" language except for Enterprise.
6. Add sample-run links and monthly cost projections to the pricing surface so the buyer sees evidence, not just plan cards. First pass uses public sample Run pages; replace or enrich them with tenant-backed live Run pages when WP-4.2 ships.

Landing copy audit against what is now *actually real* post-Phase 2 — the docs themselves flag the current copy as over-broad ("AI coworker that does everything" → "the reviewable AI operator for founder-led teams" wedge). Ship the SEO comparison pages from the campaign doc ("Zapier AI vs AI operator", "n8n vs AI agent") once the claims are true.

### WP-5.3 The demo path
A scripted, seeded, unbreakable demo workspace: investor update template installed, real (own-company) Stripe+GitHub connected, run history showing weeks of reviewed runs with costs, one live "run now" that completes in <60s. Rehearsable, resettable via one script.

### WP-5.4 Security posture doc
After Phases 0–1: one-page security overview (tenant isolation, AES-256-GCM vault with key versioning, hashed sessions, signature-verified webhooks, rate limits, backups, Sentry). Seed-stage diligence increasingly asks; having it ready signals operator maturity.

---

## Sequencing & Dependency Map

```
Phase 0 (WP-0.1 → 0.4)            [BLOCKS EVERYTHING — security + money]
   └─ Phase 1 (1.1 DB → 1.2 scheduler → 1.3 CI → 1.4 obs → 1.5 split)
        ├─ Phase 2 (2.1 truth-label FIRST → 2.2 vault → 2.3 heroes → 2.4 composio → 2.5 typed runtime)
        ├─ Phase 3 (3.1 data layer → 3.2 decompose → 3.3 markdown ∥ 3.4 primitives → 3.5 mobile)
        └────────┬──────────────────────────────┘
                 └─ Phase 4 (4.1 review surface → 4.2 cost intel → 4.3 templates → 4.4 slack → 4.5 polish)
                      └─ Phase 5 (5.1 metrics → 5.2 pricing/copy → 5.3 demo → 5.4 security doc)
```

Notes:
- **WP-2.1 (truth-labeling) jumps the queue** — it's a half-day and removes the single biggest demo landmine.
- **WP-0.1 first hardening pass shipped on this PR branch:** authenticated users already get server-owned `workspaceIds`/`defaultWorkspaceId`, `resolveWorkspaceContext` treats client workspace values as selectors and 403s cross-tenant access, automation routes filter by workspace, Slack event callbacks resolve team/channel to a stored user Slack connection instead of falling back to the default workspace, API-created automations persist `owner_user_id`, and chat tool-created automations are workspace-scoped. Express-level tenant acceptance coverage now verifies cross-tenant 403s, read isolation for settings, platform tasks, task runs, credit ledgers, automations, billing, Studio workflows/runs/context/policies, workflow ledgers, and mutation/review guards for automation run, patch, delete, approve, request-changes, and rerun paths. Remaining scope is browser-level multi-session QA before production rollout.
- **WP-0.3 first hardening pass shipped on this PR branch:** chat loops now use `MAX_TOOL_ITERATIONS` (default 24), malformed tool-result JSON is preserved as raw output instead of aborting the stream, model calls retry transient 429/5xx/network failures, and chat/automation runs acquire credit holds before execution then settle or release them. Express chat coverage now uses a mocked always-tool-calling OpenAI-compatible provider with concurrent requests to verify loop caps, SSE completion, run metadata, and settled credit holds. Remaining scope is load-level soak testing with real providers before production rollout.
- **WP-2.1 first hardening pass shipped on this PR branch:** legacy non-Stripe `query_data` results now return `simulated: true`, an integration connection CTA, and non-live automation summaries; chat tool cards render a visible **Simulated** chip; fake `run_code` and Linear-style `create_task` outputs are labeled simulated. Remaining scope is a full sweep of any future/demo tool outputs as new integrations land.
- **WP-0.2 first hardening pass shipped on this PR branch:** backend admin route checks now derive the actor from `req.authUser.role`, the client auth cache no longer persists or restores admin role, `/admin` requires a fresh backend admin session, Agent Studio is admin-gated, and Express admin coverage now verifies anonymous/user/admin outcomes plus session revocation through the admin access endpoint. Remaining scope is a browser-level smoke check for the `/admin` screen once the draft PR is ready for final QA.
- **WP-0.4 first hardening pass shipped on this PR branch:** JSON stores already used atomic temp writes, backups, and corrupt-file quarantine; this PR adds a `updateJsonFile` read-modify-write helper and moves task/run/ledger mutations, including credit holds, onto it. SQLite remains the durable Phase 1 fix.
- Phases 2 and 3 parallelize across sessions once Phase 1 lands.
- Already-shipped work this plan builds on (don't redo): P5 cost plumbing, Save & run, per-step results panel, fail-closed conditions, compact sidebar, Settings account section, OAuth code paths (need only env vars + the WP-0 hardening).
- **Codex work already on this branch (PR #2, commits `6b5365b..1d0efb0`) partially delivers Phase 2/4 for the Revenue Watch workflow** — before starting the WPs below, read `backend/src/integrationGateway/` (nativeStripe adapter, `workflowReadiness.ts`, `approvalLedger.ts`, `auditLog.ts`, `workflowPolicy.ts`) and extend rather than duplicate:
  - WP-2.1: report generation already fails closed with `source_data_required` instead of synthetic revenue for Revenue Watch — remaining scope is the *other* demo tools and the UI "simulated" chips.
  - WP-2.3: the Stripe (read) hero integration exists for revenue queries — remaining scope is Google Workspace + GitHub, and folding Stripe creds into the WP-2.2 vault.
  - WP-4.1: approval gates + run ledger events (`data_read`, `draft_created`, `approval_requested`, `approval_granted`, `external_action_executed`) exist for this workflow — WP-4.1's scope becomes generalizing them into the universal Run page, not inventing them.
  - PR #2's own follow-ups fold in here: persist explicit `workflowId`/`templateId` on automations (belongs in WP-2.5's typed spec), and VPS model-provider env cleanup (belongs in "Open items requiring Max").

## How to run this with Opus 4.8

Each WP is a self-contained brief: problem, file references, ordered steps, acceptance criteria. Per session: (1) give Opus one WP plus this file for context, (2) require tests green + build clean before commit (CI enforces after WP-1.3), (3) one WP per PR, (4) update the `Status` column below in the same PR.

| WP | Phase | Status |
|----|-------|--------|
| 0.1 Tenant authorization | 0 | ◐ |
| 0.2 Server-side role | 0 | ◐ |
| 0.3 Loop cap + credit holds | 0 | ◐ |
| 0.4 Atomic writes | 0 | ◐ |
| 1.1 SQLite migration | 1 | ☐ |
| 1.2 Durable scheduler | 1 | ☐ |
| 1.3 Tests + CI + deploy | 1 | ☐ |
| 1.4 Observability | 1 | ☐ |
| 1.5 server.ts split | 1 | ☐ |
| 2.1 Truth-labeling | 2 | ◐ |
| 2.2 Vault + OAuth spine | 2 | ☐ |
| 2.3 Hero integrations ×3 | 2 | ☐ |
| 2.4 Composio flag | 2 | ☐ |
| 2.5 Typed runtime | 2 | ☐ |
| 3.1 React Query + client | 3 | ☐ |
| 3.2 Monolith decomposition | 3 | ☐ |
| 3.3 Markdown library | 3 | ☐ |
| 3.4 Design primitives | 3 | ☐ |
| 3.5 Mobile pass | 3 | ☐ |
| 4.1 Run Review surface | 4 | ☐ |
| 4.2 Cost intelligence | 4 | ☐ |
| 4.3 Template gallery | 4 | ☐ |
| 4.4 Slack operating surface | 4 | ☐ |
| 4.5 Streaming resilience | 4 | ☐ |
| 5.1 Metrics tap | 5 | ☐ |
| 5.2 Pricing coherence | 5 | ☐ |
| 5.3 Demo path | 5 | ☐ |
| 5.4 Security posture doc | 5 | ☐ |

## Max step-by-step checklist

1. **Pricing decision confirmed:** keep existing Stripe price env keys/products; backend `pro` is the public **Start / Founder $79/mo** offer, backend `team` is the public **Pro $249/mo** offer, and backend `starter` stays hidden/legacy.
2. **Workflow-audit CTA path confirmed:** "Book workflow audit" opens `https://calendly.com/max-purpleorange/30min` inside the in-page boxed scheduler modal for now. "Start free preview" stays secondary.
3. **Prepare production auth env vars:** add/verify `AUTH_PUBLIC_URL`, `AUTH_STATE_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `MICROSOFT_CLIENT_ID`, `MICROSOFT_CLIENT_SECRET`, and `MICROSOFT_TENANT_ID` on the VPS.
4. **Prepare production integration env vars:** verify `SLACK_BOT_TOKEN`, `SLACK_SIGNING_SECRET`, Postmark sender config, Composio key, and any Google Workspace/GitHub/Stripe credentials needed for the first live mission.
5. **Fix model-provider env routing:** verify Anthropic, OpenAI, and OpenRouter keys are in the right env vars. Current PR #2 findings showed Anthropic premature-close, an Anthropic-shaped key in the OpenAI slot, and OpenRouter `User not found`.
6. **Choose the first beta cohort:** pick 3-5 founder-led teams, collect approved login emails, preferred Slack channel IDs, and the first recurring workflow for each. Do this only after Phase 0 and the Phase 1 data/CI floor are green.
7. **Pick the first proof workflow:** use Revenue Watch or Weekly Founder Update as the canonical demo; connect real own-company Stripe/GitHub/Slack data and produce 2-3 reviewed sample runs.
8. **Reconcile with the vault canon:** compare this plan against `Violema - Dashboard.md`, `Violema - Runbook.md`, and the Deployment/Auth/SEO canon; if they disagree, update this file to match the canon.
9. **Before SQLite migration:** pull a fresh copy of production JSON state from the VPS, back it up, and use it as the importer test fixture for WP-1.1.
10. **Before public onboarding:** review the one-page security posture doc after Phases 0-1: tenant isolation, encrypted credential vault, hashed sessions, signature-verified webhooks, rate limits, backups, and audit logging.
