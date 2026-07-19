# TechChicago Demo Integrations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship one production Weekly Founder Update that reads the approved TechChicago demo systems with real data, stops for review, delivers only after approval, and advertises only production-verified integrations as Active.

**Architecture:** Keep Stripe, Tavily, Slack, and Postmark on their existing native paths. Add one curated Composio read adapter for Gmail, Google Calendar, Google Drive, Linear, and GitHub; route only the approved query types through it; normalize every provider response before it reaches prompts or artifacts. Keep the existing approval and ledger machinery, but make it source-agnostic. Treat Drive as a visible supporting-source degradation and fail closed for every required source.

**Tech Stack:** Node 20, TypeScript 5.3, Express, Node test runner, React 18, Vite, Composio SDK 0.14, existing native Stripe/Tavily/Slack/Postmark adapters, PM2/nginx VPS deployment.

## Global Constraints

- The frozen demo set is Stripe, Gmail, Google Calendar, Google Drive, Linear, GitHub, Tavily web search, Slack, and Postmark email.
- Do not add or activate Notion, HubSpot, Airtable, Figma, Vercel, Microsoft workflow-data tools, Salesforce, Jira, Intercom, Zendesk, or custom MCP before the demos.
- No demo query source may return `simulated: true`.
- Gmail collection is metadata-only. Do not include message bodies in tool arguments, normalized results, artifacts, logs, or prompts.
- Google Drive collection is metadata-only. Do not download file bodies.
- All provider reads are bounded. No provider write action belongs in the curated adapter.
- Slack and email delivery remain behind the existing approval gate.
- Preserve the unrelated untracked backup and WeChat files in the main worktree.
- Make implementation commits in an isolated git worktree, then merge the verified branch into `main`.

---

## Task 1: Add the Curated Composio Read Adapter

**Files:**

- Create: `backend/src/integrationGateway/adapters/partnerComposio.ts`
- Create: `backend/tests/partnerComposio.test.ts`
- Modify: `backend/src/integrationGateway/types.ts`

- [ ] **Step 1: Write failing allowlist, privacy, normalization, and error tests**

Create adapter tests with an injected executor. The test double records the action and arguments and returns small provider-shaped responses.

Cover:

```ts
const DEMO_READ_ACTIONS = {
  email: ['GMAIL_FETCH_EMAILS'],
  calendar: ['GOOGLECALENDAR_EVENTS_LIST_ALL_CALENDARS'],
  google_drive: ['GOOGLEDRIVE_FIND_FILE'],
  linear: ['LINEAR_SEARCH_ISSUES'],
  github: [
    'GITHUB_GET_A_REPOSITORY',
    'GITHUB_LIST_PULL_REQUESTS',
    'GITHUB_LIST_REPOSITORY_ISSUES',
    'GITHUB_LIST_COMMITS',
  ],
} as const;
```

Assertions:

- Gmail executes `GMAIL_FETCH_EMAILS` with `include_payload: false`, `verbose: false`, a seven-day query, and `max_results <= 10`.
- Calendar executes with ISO `time_min`, ISO `time_max`, and `max_results_per_calendar <= 10`.
- Drive executes with `q: "trashed = false"`, `pageSize <= 10`, and metadata-only `fields`.
- Linear executes `LINEAR_SEARCH_ISSUES` with a bounded `first`.
- GitHub executes only the four read actions above, using the explicit `owner` and `repo` filters and `per_page <= 10`.
- Normalized Gmail results expose only `id`, `threadId`, `subject`, `from`, `to`, `date`, and `labels`.
- Normalized Drive results expose only `id`, `name`, `mimeType`, `modifiedTime`, `parents`, and `webViewLink`.
- A missing connected account maps to `integration_not_ready`.
- a 403/scope response maps to `integration_scope_insufficient`.
- other provider failures map to `integration_query_failed`.
- unsupported source/query pairs map to `unsupported_query`.
- all failures contain a user-facing `nextAction`, never raw authorization data.

- [ ] **Step 2: Run the focused tests and confirm RED**

Run:

```bash
cd backend
NODE_ENV=test VIOLEMA_DISABLE_AUTOMATION_SCHEDULER=1 \
  node --test -r ts-node/register tests/partnerComposio.test.ts
```

Expected: failure because `partnerComposio.ts` and the new error code do not exist.

- [ ] **Step 3: Extend the integration result contract**

Add `integration_scope_insufficient` to `IntegrationReadinessError.code` in `backend/src/integrationGateway/types.ts`.

Add:

```ts
can_continue?: boolean;
```

to readiness errors so Drive can report a disclosed supporting-source degradation while required sources fail closed.

- [ ] **Step 4: Implement the adapter with dependency injection**

Export:

```ts
export type PartnerComposioExecutor = (
  actionName: string,
  input: Record<string, unknown>,
  ctx: { entityId: string },
) => Promise<unknown>;

export interface PartnerComposioQueryInput {
  workspaceId: string;
  source: 'email' | 'calendar' | 'google_drive' | 'linear' | 'github';
  queryType: string;
  filters?: Record<string, unknown>;
  limit?: number;
  now?: Date;
  execute?: PartnerComposioExecutor;
}

export async function queryPartnerComposio(
  input: PartnerComposioQueryInput,
): Promise<IntegrationQueryResult>;
```

Use `executeComposioAction` as the default executor. Clamp requested limits to `1..10`. Accept only these source/query pairs:

| Source | Query type | Action |
| --- | --- | --- |
| `email` | `commitments` | `GMAIL_FETCH_EMAILS` |
| `calendar` | `weekly_commitments` | `GOOGLECALENDAR_EVENTS_LIST_ALL_CALENDARS` |
| `google_drive` | `recent_files` | `GOOGLEDRIVE_FIND_FILE` |
| `linear` | `delivery_status` | `LINEAR_SEARCH_ISSUES` |
| `github` | `delivery_risk` | four bounded GitHub reads |

Validate the Composio envelope:

```ts
interface ComposioEnvelope {
  successful?: boolean;
  data?: unknown;
  error?: unknown;
}
```

Return the existing live success contract with the normalized data and current latency. Never pass the raw envelope through.

- [ ] **Step 5: Run the focused test and typecheck**

Run:

```bash
cd backend
NODE_ENV=test VIOLEMA_DISABLE_AUTOMATION_SCHEDULER=1 \
  node --test -r ts-node/register tests/partnerComposio.test.ts
npm run typecheck
```

Expected: all focused tests pass and TypeScript reports no errors.

- [ ] **Step 6: Commit**

```bash
git add backend/src/integrationGateway/adapters/partnerComposio.ts \
  backend/src/integrationGateway/types.ts \
  backend/tests/partnerComposio.test.ts
git commit -m "feat: add curated live integration adapter"
```

---

## Task 2: Remove Simulated Data from Every Demo Query Source

**Files:**

- Modify: `backend/src/integrationGateway/queryData.ts`
- Modify: `backend/tests/queryDataGateway.test.ts`
- Modify: `backend/src/server.ts`
- Modify: `backend/tests/workflowLedger.test.ts` if an existing ledger contract needs extension

- [ ] **Step 1: Replace the legacy GitHub sample assertion with failing live-routing tests**

Add a `partner` function to `clientOverrides` and assert that `github`, `linear`, `email`, `calendar`, and `google_drive` call it with the workspace, query type, filters, limit, and clock.

Add a table-driven assertion that every frozen workflow-data source returns either:

- `ok: true` and `live: true`; or
- `ok: false` with a readiness/query error.

It must never return `simulated: true`.

- [ ] **Step 2: Run the gateway test and confirm RED**

Run:

```bash
cd backend
NODE_ENV=test VIOLEMA_DISABLE_AUTOMATION_SCHEDULER=1 \
  node --test -r ts-node/register tests/queryDataGateway.test.ts
```

Expected: current GitHub routing still returns legacy sample data.

- [ ] **Step 3: Route the five approved partner sources**

In `executeQueryData`, preserve native Stripe first, then route:

```ts
const PARTNER_DEMO_SOURCES = new Set([
  'github',
  'linear',
  'email',
  'calendar',
  'google_drive',
]);
```

Call `queryPartnerComposio` or the injected override. Keep legacy sample data only for deferred, non-demo templates so this change does not broaden into a separate product cleanup.

Update the model-facing `query_data` enum in `backend/src/server.ts` to include `email`, `calendar`, and `google_drive`.

- [ ] **Step 4: Make ledger events source-agnostic**

Replace the Stripe-only event block in `executeAutomationCore` with one event for every query source:

```ts
appendWorkflowLedgerEvent({
  workspaceId,
  workflowId: runContext.workflowId,
  automationId: automation.id,
  taskId: runContext.taskId,
  taskRunId: runContext.taskRunId,
  type: payload.ok === false ? 'connector_failed' : 'data_read',
  summary: payload.ok === false
    ? `${label} read blocked: ${String(payload.message || 'integration unavailable')}`
    : `Read live ${label} data.`,
  metadata: { source: payloadSource, queryType, ok: payload.ok, live: payload.live },
});
```

Do not place normalized data, raw provider payloads, or secrets in ledger metadata.

- [ ] **Step 5: Run focused tests and backend typecheck**

Run:

```bash
cd backend
NODE_ENV=test VIOLEMA_DISABLE_AUTOMATION_SCHEDULER=1 \
  node --test -r ts-node/register \
  tests/queryDataGateway.test.ts tests/workflowLedger.test.ts
npm run typecheck
```

- [ ] **Step 6: Commit**

```bash
git add backend/src/integrationGateway/queryData.ts \
  backend/tests/queryDataGateway.test.ts \
  backend/src/server.ts backend/tests/workflowLedger.test.ts
git commit -m "feat: route demo workflows to live data"
```

---

## Task 3: Align the Weekly Founder Update Seed, Template, and Readiness

**Files:**

- Modify: `backend/src/scheduler.ts`
- Modify: `backend/src/integrationGateway/workflowReadiness.ts`
- Modify: `backend/tests/automationSeeds.contract.ts`
- Modify: `backend/tests/workflowReadiness.test.ts`
- Modify: `frontend/src/content/workflowTemplates.ts`
- Modify: `frontend/tests/workflowTemplates.contract.ts`

- [ ] **Step 1: Write failing canonical-source contracts**

Require this exact source sequence in both backend seed and frontend template:

```ts
['stripe', 'github', 'linear', 'email', 'calendar', 'google_drive']
```

Require the Tavily search step after those reads, one summary step, and an approval-required Slack delivery step.

Require:

```ts
requiredIntegrationIds: [
  'stripe',
  'github',
  'linear',
  'email',
  'calendar',
  'tavily',
  'slack',
],
optionalIntegrationIds: ['google_drive', 'postmark'],
firstRunRequiresApproval: true,
```

- [ ] **Step 2: Run focused contracts and confirm RED**

Run:

```bash
cd backend
NODE_ENV=test VIOLEMA_DISABLE_AUTOMATION_SCHEDULER=1 \
  node --test -r ts-node/register \
  tests/automationSeeds.contract.ts tests/workflowReadiness.test.ts
cd ../frontend
npx tsx tests/workflowTemplates.contract.ts
```

Expected: missing Linear/Drive steps and unsupported weekly readiness fail.

- [ ] **Step 3: Upgrade the backend seed safely**

Bump the weekly seed to version 3 and add:

```ts
{
  id: 'step_linear_delivery',
  kind: 'query',
  inputs: { source: 'linear', query_type: 'delivery_status', limit: 10 },
}
```

and:

```ts
{
  id: 'step_drive_context',
  kind: 'query',
  inputs: { source: 'google_drive', query_type: 'recent_files', limit: 10 },
}
```

Add `limit: 10` to all partner query steps. Add explicit GitHub filters:

```ts
filters: { owner: 'maximisto', repo: 'violema' }
```

Change `ensureCoreAutomationSeeds` so a stored core seed is replaced only when its numeric `version` is lower than the code seed. Preserve runtime fields such as `created_at`, `last_run_at`, `last_run_status`, and `consecutive_failures`.

- [ ] **Step 4: Add weekly readiness without coupling it to secrets**

Extend `checkWorkflowReadiness` to accept optional runtime evidence:

```ts
runtimeStatus?: Record<string, {
  ready: boolean;
  detail?: string;
  code?: 'integration_not_ready' | 'integration_scope_insufficient' | 'integration_query_failed';
}>;
```

Use workspace settings for native Stripe. Use `runtimeStatus` for Gmail, Calendar, Linear, GitHub, Tavily, Slack, Drive, and Postmark. Required failures become blockers. Supporting failures appear as `warnings` and do not set `ready: false`.

Keep Revenue Watch behavior unchanged.

- [ ] **Step 5: Align the frontend template**

List all nine frozen integrations in human language. Add the six query steps, then Tavily search, summary, and approval-gated Slack delivery. Add the required/optional IDs above.

- [ ] **Step 6: Run focused tests and builds**

Run:

```bash
cd backend
NODE_ENV=test VIOLEMA_DISABLE_AUTOMATION_SCHEDULER=1 \
  node --test -r ts-node/register \
  tests/automationSeeds.contract.ts tests/workflowReadiness.test.ts
npm run typecheck
cd ../frontend
npx tsx tests/workflowTemplates.contract.ts
npm run build
```

- [ ] **Step 7: Commit**

```bash
git add backend/src/scheduler.ts \
  backend/src/integrationGateway/workflowReadiness.ts \
  backend/tests/automationSeeds.contract.ts \
  backend/tests/workflowReadiness.test.ts \
  frontend/src/content/workflowTemplates.ts \
  frontend/tests/workflowTemplates.contract.ts
git commit -m "feat: make founder update a real multi-source workflow"
```

---

## Task 4: Make the Public Integrations Page Truthful and Demo-Ready

**Files:**

- Create: `frontend/src/content/demoIntegrations.ts`
- Create: `frontend/tests/demoIntegrations.contract.mjs`
- Modify: `frontend/src/pages/IntegrationsPage.tsx`
- Modify: `frontend/package.json`

- [ ] **Step 1: Write the failing public-claims contract**

The contract reads `demoIntegrations.ts` and `IntegrationsPage.tsx` and asserts:

- the Active matrix has exactly the nine frozen integration labels;
- each entry has one category: `Workflow data`, `Delivery`, or `Identity`;
- no deferred provider appears with `status: 'active'`;
- the page renders the word `Active` beside each verified integration;
- the page does not describe active integrations as “next” or “simulated”;
- the one-click connection section remains a signed-in workspace action, not proof of public availability.

- [ ] **Step 2: Run the contract and confirm RED**

Run:

```bash
cd frontend
node tests/demoIntegrations.contract.mjs
```

- [ ] **Step 3: Add one public source of truth**

Create:

```ts
export type DemoIntegrationCategory = 'Workflow data' | 'Delivery' | 'Identity';

export interface DemoIntegration {
  id: string;
  name: string;
  category: DemoIntegrationCategory;
  detail: string;
  status: 'active';
}
```

The Active entries are:

- Workflow data: Stripe, Gmail, Google Calendar, Google Drive, Linear, GitHub, Web search.
- Delivery: Slack, Email.
- Identity is described separately as Google sign-in and Microsoft sign-in; it is not counted in the nine workflow/delivery integrations.

Do not put a connector in this file until its production smoke has passed. The operational sequence in Task 5 must therefore complete before this task is merged/deployed with all nine Active labels.

- [ ] **Step 4: Rebuild the page around the verified matrix**

Replace `NATIVE_NOW` and remove Linear/Calendar/GitHub from “Coming next.” Lead with:

> Nine production integrations power the TechChicago demo workflow.

Render a compact category label and green Active badge on each card. Keep the connect controls below as workspace setup. Rewrite the commercial copy so it states what is active now and what is intentionally deferred.

- [ ] **Step 5: Add and run the frontend contract**

Add:

```json
"test:integrations": "node tests/demoIntegrations.contract.mjs"
```

Run:

```bash
cd frontend
npm run test:integrations
npm run test:brand-bleed
npm run build
```

- [ ] **Step 6: Commit**

```bash
git add frontend/src/content/demoIntegrations.ts \
  frontend/tests/demoIntegrations.contract.mjs \
  frontend/src/pages/IntegrationsPage.tsx frontend/package.json
git commit -m "feat: publish verified active integrations"
```

---

## Task 5: Repair OAuth, Connect GitHub, and Prove Every Active Claim

**Files:**

- No credential files committed
- Update after verification: `docs/products/violema/TECHCHICAGO_WEEK_2026_DEMO_READINESS.md`

- [ ] **Step 1: Deploy backend adapter changes without promoting public Active claims first**

Push the implementation branch, merge into `main`, push `main`, then deploy:

```bash
ssh root@187.77.220.60 \
  'set -e; cd /var/www/nexus; DOMAIN=violema.com LEGACY_DOMAIN=nexus.purpleorange.io APP_DIR=/var/www/nexus PM2_APP_NAME=violema-backend bash deploy/deploy.sh --skip-deps'
```

Verify `pm2 status`, `/api/health`, and deployed git SHA.

- [ ] **Step 2: Generate workspace-scoped OAuth URLs**

Use the production Composio SDK or authenticated Violema endpoint for entity `purpleorangehq`:

- reconnect `googledrive`;
- connect `github`.

Open each URL in the browser and complete OAuth. Request the minimum read scopes that satisfy the curated actions.

- [ ] **Step 3: Run privacy-safe functional smokes**

Run bounded calls and print only pass/fail, counts, response keys, and safe error codes:

| Integration | Acceptance |
| --- | --- |
| Stripe | native `revenue_summary` returns `ok: true`, `live: true` |
| Gmail | `commitments` returns metadata-only records and no body keys |
| Calendar | seven-day read returns `ok: true`, `live: true` |
| Drive | metadata query returns `ok: true`, `live: true` |
| Linear | delivery query returns `ok: true`, `live: true` |
| GitHub | `maximisto/violema` delivery query returns `ok: true`, `live: true` |
| Tavily | search returns a non-empty result set |
| Slack | `#all-purple-orange` resolves |
| Postmark | server authentication succeeds |

Do not mark Drive or GitHub Active until these checks pass.

- [ ] **Step 4: Promote the website matrix only after all nine checks pass**

If a check fails:

- required source: keep it out of Active and block the full canonical demo;
- Drive: label `Needs reauthorization` and document the degraded path;
- Postmark: keep Slack delivery active and label email fallback unavailable.

If all pass, merge the Task 4 Active matrix and redeploy.

---

## Task 6: Rehearse the Real Product and Write the Operator Runbook

**Files:**

- Create: `docs/products/violema/TECHCHICAGO_WEEK_2026_DEMO_READINESS.md`

- [ ] **Step 1: Run the production Weekly Founder Update to review**

Trigger the seeded `auto_weekly_founder_update` for workspace `purpleorangehq`.

Before approval, verify:

- six query artifacts exist and every successful one has `live: true`;
- no artifact contains `simulated: true`;
- Tavily evidence exists;
- a founder brief draft exists;
- the run state is review-required;
- no Slack or email delivery has occurred.

- [ ] **Step 2: Approve and verify delivery**

Approve the held draft through the existing review path. Verify:

- Slack delivery succeeds to `#all-purple-orange`;
- a delivery receipt is stored;
- ledger events include one `data_read` per live query source, `draft_created`, `approval_requested`, `approval_granted`, and `external_action_executed`;
- the ledger contains no secrets or raw private payloads.

- [ ] **Step 3: Repeat from a clean session**

Run the same demo once more from a new browser/session to catch hidden session, auth, and stale-seed issues.

- [ ] **Step 4: Write the runbook**

Include:

- frozen matrix with UTC and America/Chicago last-verified timestamps;
- exact 3–5 minute talk track;
- exact click/run sequence;
- expected evidence after every step;
- pre-demo checklist;
- Drive-degraded and Postmark-degraded fallback;
- recovery commands for PM2/nginx/backend health;
- claims Max can make;
- claims Max must not make;
- owner and status for unresolved items.

- [ ] **Step 5: Run final verification**

Run:

```bash
cd backend
npm test
npm run build
cd ../frontend
npm run test:brand-bleed
npm run test:integrations
npx tsx tests/workflowTemplates.contract.ts
npm run build
cd ..
git diff --check
git status --short
```

Then verify production:

```bash
ssh root@187.77.220.60 \
  'cd /var/www/nexus && git rev-parse HEAD && pm2 status violema-backend --no-color'
curl -fsS https://violema.com/api/health
curl -fsSI https://violema.com/integrations
```

- [ ] **Step 6: Commit and push the runbook**

```bash
git add docs/products/violema/TECHCHICAGO_WEEK_2026_DEMO_READINESS.md
git commit -m "docs: add TechChicago demo operator runbook"
git push origin main
```

## Final Acceptance

- [ ] The nine frozen integrations pass fresh production checks.
- [ ] GitHub is connected under `purpleorangehq`.
- [ ] Google Drive has sufficient metadata-read scope.
- [ ] The Weekly Founder Update uses no simulated data.
- [ ] The workflow stops for approval before any delivery.
- [ ] Approved Slack delivery produces a receipt.
- [ ] The ledger records all reads, review, approval, and delivery without raw private data.
- [ ] The public page lists exactly the verified active integrations and no deferred system as Active.
- [ ] Backend tests/build and frontend contracts/build pass.
- [ ] Production SHA, PM2, nginx, health, and `/integrations` are verified.
- [ ] The demo runbook is current enough to operate without reading source code.
