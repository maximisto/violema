## What you implemented

- Added `backend/src/integrationGateway/workflowReadiness.ts` with `checkWorkflowReadiness(...)`, typed readiness/blocker/report interfaces, Revenue Watch workflow requirements, and a Stripe readiness check that works with both the real `WorkspaceSettingsView` shape and the minimal test shape.
- Added `GET /api/workflows/:workflowId/readiness` to `backend/src/server.ts`, resolving the workspace context and optional `deliveryTarget` from the request before returning a structured readiness report.
- Extended `frontend/src/content/workflowTemplates.ts` with readiness metadata fields:
  - `requiredIntegrationIds`
  - `optionalIntegrationIds`
  - `firstRunRequiresApproval`
- Marked the `revenue-watch` template with:
  - `requiredIntegrationIds: ['stripe']`
  - `optionalIntegrationIds: []`
  - `firstRunRequiresApproval: true`
- Updated `frontend/tests/workflowTemplates.contract.ts` to assert Revenue Watch readiness metadata.
- Added `frontend/tests/workflowReadiness.contract.ts` to verify the Revenue Watch template keeps Slack delivery, Stripe-only first-proof requirements, no optional integrations, and an explicit approval gate.

## What you tested and exact test results

### Backend

Command:

```bash
cd /Users/maximisto/Documents/New\ project/backend
node --test -r ts-node/register tests/workflowReadiness.test.ts
```

Result:

```text
TAP version 13
# Subtest: Revenue Watch readiness blocks missing Stripe and missing Slack target
ok 1 - Revenue Watch readiness blocks missing Stripe and missing Slack target
# Subtest: Revenue Watch readiness passes with Stripe and Slack target
ok 2 - Revenue Watch readiness passes with Stripe and Slack target
1..2
# tests 2
# pass 2
# fail 0
```

Command:

```bash
cd /Users/maximisto/Documents/New\ project/backend
npx tsc -p tsconfig.json --noEmit --incremental false
```

Result:

```text
exit code 0
```

### Frontend

Command:

```bash
cd /Users/maximisto/Documents/New\ project/frontend
npx tsx tests/workflowTemplates.contract.ts
```

Result:

```text
workflowTemplates.contract: 6 templates verified
```

Command:

```bash
cd /Users/maximisto/Documents/New\ project/frontend
npx tsx tests/workflowReadiness.contract.ts
```

Result:

```text
workflowReadiness.contract: Revenue Watch metadata verified
```

Command:

```bash
cd /Users/maximisto/Documents/New\ project/frontend
npx tsc --noEmit
```

Result:

```text
exit code 0
```

## TDD Evidence if applicable

### RED

Command:

```bash
cd /Users/maximisto/Documents/New\ project/backend
node --test -r ts-node/register tests/workflowReadiness.test.ts
```

Output:

```text
TSError: Unable to compile TypeScript:
tests/workflowReadiness.test.ts(3,40): error TS2307: Cannot find module '../src/integrationGateway/workflowReadiness' or its corresponding type declarations.
```

This was the expected missing-module failure after adding the new backend test first.

### GREEN

Command:

```bash
cd /Users/maximisto/Documents/New\ project/backend
node --test -r ts-node/register tests/workflowReadiness.test.ts
```

Output:

```text
TAP version 13
# Subtest: Revenue Watch readiness blocks missing Stripe and missing Slack target
ok 1 - Revenue Watch readiness blocks missing Stripe and missing Slack target
# Subtest: Revenue Watch readiness passes with Stripe and Slack target
ok 2 - Revenue Watch readiness passes with Stripe and Slack target
1..2
# tests 2
# pass 2
# fail 0
```

## Files changed

- `backend/src/integrationGateway/workflowReadiness.ts`
- `backend/tests/workflowReadiness.test.ts`
- `backend/src/server.ts`
- `frontend/src/content/workflowTemplates.ts`
- `frontend/tests/workflowTemplates.contract.ts`
- `frontend/tests/workflowReadiness.contract.ts`

## Self-review findings

- Kept Stripe readiness strict and read-only: readiness only checks configuration state and does not touch Stripe mutation paths.
- Kept the slice scoped to readiness only: no ledger storage, no dashboard panel work, no Composio/Pipedream changes.
- Used the real workspace settings view contract instead of assuming the brief’s minimal shape, while preserving support for the minimal test fixture.
- Kept non-Stripe mock handling untouched; the new readiness logic only governs Revenue Watch workflow readiness.

## Issues or concerns

- The readiness endpoint currently treats an empty `deliveryTarget` as a blocker even though the Revenue Watch template has a default Slack channel in frontend metadata. That matches the brief and keeps readiness explicit, but the eventual UI should decide whether to pass the saved destination automatically or require the user to confirm it.
