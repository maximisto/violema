# Integration Readiness Gateway Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Violema integrations feel workflow-first, self-guided, and safe instead of exposing MCP, n8n, env vars, partner plumbing, or raw API-key setup as the default product experience.

**Architecture:** Add a Violema-owned integration gateway around connections, access grants, capabilities, dry runs, run permissions, and audit events. Keep native adapters for core integrations and put Pipedream/Composio behind a partner adapter so the product UX is not coupled to either vendor.

**Tech Stack:** TypeScript, Express, React/Vite, existing encrypted workspace settings store, existing Composio bridge during bakeoff, future Pipedream Connect spike behind the same adapter shape.

---

## File Structure

- `backend/src/integrationRegistry.ts`: single source of truth for provider metadata, credential fields, user-safe catalog copy, partner app names, capabilities, and boundaries.
- `backend/src/settingsStore.ts`: consume registry definitions for credential fields and env fallback keys.
- `backend/src/agent-studio/settingsRoutes.ts`: consume registry definitions for allowed integration providers and fields.
- `backend/src/server.ts`: expose `/api/integrations/catalog`; later exposes workflow readiness, grants, dry-run, and audit endpoints.
- `backend/tests/integrationRegistry.test.ts`: registry serialization and source-of-truth tests.
- `frontend/src/pages/IntegrationsPage.tsx`: use the catalog and remove internal deployment language from the customer-facing surface.
- Future files:
  - `backend/src/integrationGateway/types.ts`
  - `backend/src/integrationGateway/connectionStore.ts`
  - `backend/src/integrationGateway/adapters/nativeStripe.ts`
  - `backend/src/integrationGateway/adapters/partnerPipedream.ts`
  - `backend/src/integrationGateway/adapters/partnerComposio.ts`
  - `frontend/src/pages/WorkflowReadinessSetup.tsx`

## Task 1: Catalog And Copy Foundation

**Files:**
- Create: `backend/src/integrationRegistry.ts`
- Create: `backend/tests/integrationRegistry.test.ts`
- Modify: `backend/src/settingsStore.ts`
- Modify: `backend/src/agent-studio/settingsRoutes.ts`
- Modify: `backend/src/server.ts`
- Modify: `frontend/src/pages/IntegrationsPage.tsx`

- [x] **Step 1: Add registry tests**

Run:

```bash
cd /Users/maximisto/Documents/New\ project/backend
node --test -r ts-node/register tests/integrationRegistry.test.ts
```

Expected after implementation: PASS.

- [x] **Step 2: Add `integrationRegistry`**

The registry must include:
- provider id, label, detail, description
- connection method: `native`, `partner`, `manual`, or `internal`
- status: `ready`, `next`, or `planned`
- credential fields and server env fallback keys
- user-facing capabilities and boundaries
- public catalog builder that never exposes env var names

- [x] **Step 3: Make settings backend consume registry**

`settingsStore.ts` and `settingsRoutes.ts` must no longer duplicate integration provider field lists.

- [x] **Step 4: Expose `/api/integrations/catalog`**

The route returns user-safe provider metadata, workflow readiness stages, partner availability, and connected partner apps.

- [x] **Step 5: Update public integrations page**

The page must stop saying `COMPOSIO_API_KEY`, `OAuth`, or "set env var" to users. If the partner layer is unavailable, show:

```text
Some one-click connectors are temporarily unavailable. Violema can still run native and sample-data workflows while we finish the connector layer.
```

## Task 2: Partner Bakeoff

**Files:**
- Create: `docs/products/violema/INTEGRATION_PARTNER_BAKEOFF_2026-05.md`
- Create: `backend/src/integrationGateway/adapters/partnerComposio.ts`
- Create: `backend/src/integrationGateway/adapters/partnerPipedream.ts`
- Create: `backend/tests/integrationPartnerContract.test.ts`

- [ ] **Step 1: Define partner adapter contract**

The contract should expose:

```ts
export interface PartnerIntegrationAdapter {
  id: 'composio' | 'pipedream';
  isConfigured(): boolean;
  listConnections(workspaceId: string): Promise<Array<{ appName: string; accountLabel?: string }>>;
  createConnectUrl(input: { workspaceId: string; appName: string; returnUrl: string }): Promise<string>;
  listActions(input: { workspaceId: string; appName: string }): Promise<IntegrationAction[]>;
  executeAction(input: { workspaceId: string; actionName: string; payload: Record<string, unknown> }): Promise<unknown>;
}
```

- [ ] **Step 2: Run one real workflow through each vendor**

Workflow:
- connect GitHub
- list open issues from `maximisto/violema`
- draft Slack summary
- block posting behind approval

Decision criteria:
- connection UX
- action schema quality
- auth/token behavior
- pricing risk
- auditability
- failure messages

## Task 3: Workflow Readiness Wizard

**Files:**
- Create: `backend/src/integrationGateway/workflowReadiness.ts`
- Create: `frontend/src/pages/WorkflowReadinessSetup.tsx`
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/pages/Signup.tsx`

- [ ] **Step 1: Add outcome templates**

Initial templates:
- Weekly founder update
- Revenue monitor
- Lead follow-up
- Sprint digest
- Customer risk check

- [ ] **Step 2: Map outcomes to required tools**

Example:

```ts
weeklyRevenueUpdate: {
  required: ['stripe', 'slack'],
  optional: ['hubspot', 'linear'],
  firstRunRequiresApproval: true,
}
```

- [ ] **Step 3: Build guided setup UI**

Stages:
- choose outcome
- connect required tools
- approve boundaries
- run sandbox test
- approve first live run
- schedule or keep manual

## Task 4: Real Native Revenue Workflow

**Files:**
- Create: `backend/src/integrationGateway/adapters/nativeStripe.ts`
- Create: `backend/src/integrationGateway/adapters/nativeSlack.ts`
- Create: `backend/tests/revenueWorkflow.integration.test.ts`
- Modify: `backend/src/server.ts`

- [ ] **Step 1: Replace fake Stripe revenue branch**

For connected Stripe credentials, `query_data` must call Stripe. If credentials are missing, return a readiness error instead of fake revenue.

- [ ] **Step 2: Add Slack approval delivery**

Slack posting should remain approval-gated by default for first live runs and external/team-visible messages.

## Task 5: Trust Ledger

**Files:**
- Create: `backend/src/integrationGateway/auditLog.ts`
- Create: `backend/tests/integrationAuditLog.test.ts`
- Modify: `frontend/src/pages/Dashboard.tsx`

- [ ] **Step 1: Persist audit events**

Events:
- tool connected
- access granted
- dry run started/completed
- data read
- draft created
- approval requested
- approval granted/denied
- external action executed
- connector failed/repaired

- [ ] **Step 2: Show the run ledger**

Every workflow run should answer:
- what Violema read
- what Violema drafted
- what Violema changed
- who approved it
- what failed and how to repair it

## Validation

Run after every task:

```bash
cd /Users/maximisto/Documents/New\ project
git diff --check
cd backend && npm run build
cd ../frontend && npm run build
```

Targeted tests:

```bash
cd /Users/maximisto/Documents/New\ project/backend
node --test -r ts-node/register tests/integrationRegistry.test.ts
node --test -r ts-node/register tests/settingsStore.test.ts
```

## Self-Review

- No customer-facing copy should mention MCP, n8n, Composio, Pipedream, env vars, API keys, or callback URLs unless the user is in an advanced/admin path.
- The model must eventually receive only curated workflow-specific actions, not every vendor tool.
- Native core integrations and partner long-tail integrations must share the same Violema permission/audit model.
- The first real demo workflow should be Stripe to Slack with sandbox preview and first-run approval.
