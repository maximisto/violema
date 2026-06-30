# Real Founder Workflow Design

**Date:** 2026-06-29
**Goal:** Turn Violema from a convincing AI coworker demo into a founder-grade operating loop that reads real systems, drafts useful work, asks for approval, delivers through a real channel, and leaves an inspectable record.

## Problem

Violema already has the right product shape: beta auth, admin recovery, workflow templates, a user-safe integration catalog, native Slack and email delivery, Tavily search, and Composio scaffolding.

The credibility gap is narrower and more important: core data queries still return mock Stripe, GitHub, HubSpot, Linear, PostHog, Salesforce, and Google Analytics data inside `query_data`. That makes demos feel alive but prevents the product from becoming a trusted operating layer for founders.

The next move is not "more integrations." It is one real workflow that proves the whole trust loop.

## Approved Direction

Build the first real founder workflow as:

**Stripe revenue read -> Revenue Watch draft -> human approval -> Slack delivery -> run ledger**

This is the smallest strong proof because:

- Stripe creates immediate business value and investor-relevant proof.
- Slack delivery is already real and live-configured.
- Revenue monitoring is high-frequency enough to show habit potential.
- The workflow is simple enough to validate without building a broad integration platform.
- The same pattern later upgrades into Weekly Founder Brief by adding GitHub delivery signals and Tavily market scan.

## Product Shape

The user-facing promise:

> Violema watches the operating signals you approve, drafts the update, waits for your review, then posts it with a record of what it read and changed.

The first workflow is **Revenue Watch**:

- Pull Stripe revenue pulse: MRR/ARR, new subscriptions, churn, upgrades, downgrades, failed payments, and at-risk revenue.
- Draft a short founder brief: what changed, why it matters, what needs attention.
- Hold delivery for approval by default.
- Send the approved brief to Slack.
- Show a run ledger with reads, draft, approval, delivery, and failures.

## Non-Goals

- No full OAuth marketplace in this slice.
- No Composio/Pipedream bakeoff before the native Stripe proof.
- No broad CRM, PostHog, Linear, or GitHub adapter work yet.
- No automated external posting without first-run approval.
- No fake data fallback for Stripe once this workflow is active.

## Architecture

### Backend

Create a small integration gateway layer, focused only on the Revenue Watch path first.

New modules:

- `backend/src/integrationGateway/types.ts`
  - Shared DTOs for readiness errors, workflow run events, integration reads, draft artifacts, approval requests, and delivery receipts.
- `backend/src/integrationGateway/adapters/nativeStripe.ts`
  - Reads Stripe through the existing `stripe` dependency.
  - Uses workspace credential first, then server env fallback.
  - Produces a normalized revenue summary.
  - Never mutates Stripe state.
- `backend/src/integrationGateway/adapters/nativeSlack.ts`
  - Thin wrapper over existing `sendMessage`.
  - Makes approval-gated delivery explicit.
- `backend/src/integrationGateway/workflowReadiness.ts`
  - Maps workflow templates to required and optional integrations.
  - Returns missing credentials, unavailable tools, and next repair action.
- `backend/src/integrationGateway/auditLog.ts`
  - Persists run ledger events in JSON storage for now.

Modify:

- `backend/src/server.ts`
  - Route `query_data` for `source: "stripe"` to `nativeStripe` when credentials exist.
  - Return a readiness error when Stripe credentials are missing.
  - Add minimal workflow readiness and ledger endpoints.
- `backend/src/settingsStore.ts`
  - Reuse existing encrypted workspace integration credentials.

### Frontend

Modify the existing workflow surfaces rather than creating a new product area first.

- `frontend/src/content/workflowTemplates.ts`
  - Keep `revenue-watch` as the canonical first real workflow.
  - Add explicit readiness metadata: `requiredIntegrationIds`, `optionalIntegrationIds`, and `firstRunRequiresApproval`.
- `frontend/src/pages/IntegrationsPage.tsx`
  - Continue positioning integrations as workflow readiness, not connector setup.
- `frontend/src/pages/Dashboard.tsx`
  - Show Revenue Watch readiness before save/run.
  - If Stripe is missing, show the specific next action.
  - If ready, let the user run a sandbox preview and approve first delivery.

## Data Flow

1. Founder selects or creates Revenue Watch.
2. Backend checks readiness:
   - required: Stripe read access
   - required for live delivery: Slack target
   - default policy: approval before delivery
3. User runs a sandbox preview.
4. Backend reads Stripe and records `data_read`.
5. Violema drafts the Revenue Watch brief and records `draft_created`.
6. UI shows the draft and ledger.
7. User approves delivery.
8. Backend posts to Slack through existing delivery code and records `external_action_executed`.
9. UI shows delivery receipt and final ledger.

## Readiness Errors

Stripe must not silently fall back to mock data.

If credentials are missing, `query_data` returns a structured readiness error:

```ts
{
  ok: false,
  code: 'integration_not_ready',
  source: 'stripe',
  workflowId: 'revenue-watch',
  message: 'Stripe read access is required before Revenue Watch can run with real data.',
  nextAction: {
    label: 'Connect Stripe',
    route: '/integrations?provider=stripe&workflow=revenue-watch'
  }
}
```

If Slack is missing for delivery, the draft can still be created, but promotion to live delivery is blocked until a destination is configured.

## Run Ledger

Every Revenue Watch run should answer:

- What did Violema read?
- What did Violema draft?
- What did the founder approve or reject?
- What did Violema send?
- What failed, and what should be repaired?

Initial event types:

- `workflow_readiness_checked`
- `data_read`
- `draft_created`
- `approval_requested`
- `approval_granted`
- `approval_denied`
- `external_action_executed`
- `connector_failed`

The ledger can start as JSON-backed storage. A database migration is not required for this proof.

## Testing

Backend targeted tests:

- `nativeStripe` normalizes subscription, invoice, and payment failure data.
- Missing Stripe credentials produce readiness error, not mock data.
- `query_data` routes Stripe revenue queries to the native adapter.
- Slack delivery remains approval-gated for the first live run.
- Ledger persists each event with workspace, workflow, run, event type, timestamp, and safe metadata.

Frontend targeted tests:

- Revenue Watch shows required Stripe and delivery readiness.
- Missing Stripe blocks live run and points to `/integrations`.
- Ready workflow can show sandbox preview before delivery.
- Approval state is visible before Slack posting.

Validation commands:

```bash
cd /Users/maximisto/Documents/New\ project/backend
node --test -r ts-node/register tests/integrationRegistry.test.ts
node --test -r ts-node/register tests/settingsStore.test.ts
node --test -r ts-node/register tests/revenueWorkflow.integration.test.ts

cd /Users/maximisto/Documents/New\ project
git diff --check
cd backend && npm run build
cd ../frontend && npm run build
```

## Rollout

### Phase 1: Real Revenue Read

- Add `nativeStripe`.
- Replace Stripe mock branch in `query_data`.
- Return readiness errors when Stripe is missing.
- Add contract tests.

### Phase 2: Approval-Gated Delivery

- Make Revenue Watch produce a draft artifact first.
- Require approval before Slack delivery.
- Reuse existing automation review endpoints where practical.

### Phase 3: Ledger

- Persist read, draft, approval, delivery, and failure events.
- Surface the ledger in the dashboard run detail.

### Phase 4: Upgrade to Weekly Founder Brief

- Add GitHub delivery signals.
- Add Tavily market scan.
- Keep the same readiness, approval, and ledger model.

## Success Criteria

- A founder can run Revenue Watch against real Stripe data.
- Missing Stripe credentials never produce fake revenue.
- The first external Slack delivery requires approval.
- The run ledger makes the workflow inspectable.
- The implementation creates a reusable pattern for Weekly Founder Brief without overbuilding the integration platform.
