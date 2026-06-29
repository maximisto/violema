## What you implemented

- Added `backend/src/integrationGateway/queryData.ts` as the workspace-aware query gateway.
- Routed Stripe queries through `queryStripeRevenue(...)` with no fake Stripe fallback, preserving the native adapter contract and readiness behavior.
- Kept temporary legacy mock data for non-Stripe sources isolated inside the new gateway.
- Replaced the inline `query_data` mock block in `backend/src/server.ts` with `executeQueryData(...)`.
- Threaded `workspaceId` into tool execution for both chat tool calls and automation query steps.
- Made automation execution workspace-aware by using `automation.workspaceId || DEFAULT_WORKSPACE_ID` for credits, model routing, task/task-run creation, ledger entries, and task-panel broadcasts.
- Added optional `workspaceId` persistence to scheduler records and automation creation defaults.
- Scoped automation/missions server reads and mutation routes to the resolved workspace context.

## What you tested and exact test results

1. RED:
   - Command:
     ```bash
     cd /Users/maximisto/Documents/New\ project/backend
     node --test -r ts-node/register tests/queryDataGateway.test.ts
     ```
   - Result: failed as expected because `../src/integrationGateway/queryData` did not exist.

2. GREEN:
   - Command:
     ```bash
     cd /Users/maximisto/Documents/New\ project/backend
     node --test -r ts-node/register tests/queryDataGateway.test.ts
     ```
   - Result:
     - `executeQueryData routes Stripe through native adapter` — pass
     - `executeQueryData never returns fake Stripe revenue when Stripe is missing` — pass
     - `executeQueryData keeps legacy non-Stripe mock data isolated` — pass
     - Totals: `3 pass, 0 fail`

3. Focused regression set:
   - Command:
     ```bash
     cd /Users/maximisto/Documents/New\ project/backend
     node --test -r ts-node/register tests/nativeStripe.test.ts tests/integrationRegistry.test.ts tests/settingsStore.test.ts tests/automationLifecycle.contract.ts
     ```
   - Result:
     - Totals: `16 pass, 0 fail`
     - Combined runner did not hang.

4. Compiler verification:
   - Command:
     ```bash
     cd /Users/maximisto/Documents/New\ project/backend
     npx tsc -p tsconfig.json --noEmit --incremental false
     ```
   - Result: passed with exit code `0`.

## TDD Evidence if applicable

### RED command/output

Command:
```bash
cd /Users/maximisto/Documents/New\ project/backend
node --test -r ts-node/register tests/queryDataGateway.test.ts
```

Output:
```text
TAP version 13
# /Users/maximisto/Documents/New project/backend/node_modules/ts-node/src/index.ts:859
# TSError: Unable to compile TypeScript:
# tests/queryDataGateway.test.ts(3,34): error TS2307: Cannot find module '../src/integrationGateway/queryData' or its corresponding type declarations.
not ok 1 - tests/queryDataGateway.test.ts
1..1
# tests 1
# pass 0
# fail 1
```

### GREEN command/output

Command:
```bash
cd /Users/maximisto/Documents/New\ project/backend
node --test -r ts-node/register tests/queryDataGateway.test.ts
```

Output:
```text
TAP version 13
# Subtest: executeQueryData routes Stripe through native adapter
ok 1 - executeQueryData routes Stripe through native adapter
# Subtest: executeQueryData never returns fake Stripe revenue when Stripe is missing
ok 2 - executeQueryData never returns fake Stripe revenue when Stripe is missing
# Subtest: executeQueryData keeps legacy non-Stripe mock data isolated
ok 3 - executeQueryData keeps legacy non-Stripe mock data isolated
1..3
# tests 3
# pass 3
# fail 0
```

## Files changed

- `backend/src/integrationGateway/queryData.ts`
- `backend/tests/queryDataGateway.test.ts`
- `backend/src/server.ts`
- `backend/src/scheduler.ts`

## Self-review findings

- Stripe now has a single live/readiness path through the gateway, so the old fake revenue payload cannot leak through `query_data`.
- Workspace context now reaches both direct tool execution and automation execution, which keeps credentials, credits, tasks, ledger entries, and task-panel events aligned.
- Legacy mock data remains available for non-Stripe sources without reintroducing fake Stripe behavior.
- I kept the scheduler change limited to optional `workspaceId` persistence/default handling, per brief.

## Issues or concerns

- `npm run build` (`tsc` emit path) did not finish within the manual wait window during an optional check, so I used `npx tsc -p tsconfig.json --noEmit --incremental false` as the compiler verification command instead.
- Non-Stripe sources still use temporary mock data in the gateway by design for this slice.

---

## Review Fix Follow-up

### What I changed

- Added `applyQueryStepPayloadToExecution(...)` in `backend/src/integrationGateway/queryData.ts`.
- Changed the automation query-step branch in `backend/src/server.ts` to use that helper so `{ ok: false, code: 'integration_not_ready', ... }` is treated as a failed step instead of a successful one.
- Preserved readiness-error payloads in `stepExecution.output`, surfaced the payload message in `stepExecution.summary` and `stepExecution.error`, appended a step error entry, and kept tool/artifact counts coherent.
- Prevented chart-artifact generation for failed query payloads.
- Added focused regression coverage for:
  - readiness-error query payloads becoming failed automation steps,
  - successful query payloads still producing successful steps,
  - scheduler persistence of optional `workspaceId`.

### Review-fix TDD evidence

#### RED command/output

Command:
```bash
cd /Users/maximisto/Documents/New\ project/backend
node --test -r ts-node/register tests/queryDataGateway.test.ts
```

Output:
```text
TAP version 13
# TSError: Unable to compile TypeScript:
# tests/queryDataGateway.test.ts(3,10): error TS2305: Module '"../src/integrationGateway/queryData"' has no exported member 'applyQueryStepPayloadToExecution'.
not ok 1 - tests/queryDataGateway.test.ts
1..1
# tests 1
# pass 0
# fail 1
```

#### GREEN command/output

Command:
```bash
cd /Users/maximisto/Documents/New\ project/backend
node --test -r ts-node/register tests/queryDataGateway.test.ts
```

Output:
```text
TAP version 13
# Subtest: executeQueryData routes Stripe through native adapter
ok 1 - executeQueryData routes Stripe through native adapter
# Subtest: executeQueryData never returns fake Stripe revenue when Stripe is missing
ok 2 - executeQueryData never returns fake Stripe revenue when Stripe is missing
# Subtest: executeQueryData keeps legacy non-Stripe mock data isolated
ok 3 - executeQueryData keeps legacy non-Stripe mock data isolated
# Subtest: applyQueryStepPayloadToExecution marks readiness errors as failed automation steps
ok 4 - applyQueryStepPayloadToExecution marks readiness errors as failed automation steps
# Subtest: applyQueryStepPayloadToExecution keeps successful query payloads successful
ok 5 - applyQueryStepPayloadToExecution keeps successful query payloads successful
1..5
# tests 5
# pass 5
# fail 0
```

### Additional verification

1. Focused automation/workspace coverage:
   - Command:
     ```bash
     cd /Users/maximisto/Documents/New\ project/backend
     node --test -r ts-node/register tests/automationSeeds.contract.ts
     ```
   - Result:
     - `ensureCoreAutomationSeeds creates the weekly founder update mission workflow once` — pass
     - `createAutomation persists optional workspaceId without forcing a default` — pass
     - Totals: `2 pass, 0 fail`

2. Focused regression set rerun:
   - Command:
     ```bash
     cd /Users/maximisto/Documents/New\ project/backend
     node --test -r ts-node/register tests/nativeStripe.test.ts tests/integrationRegistry.test.ts tests/settingsStore.test.ts tests/automationLifecycle.contract.ts
     ```
   - Result: `16 pass, 0 fail`

3. Compiler verification:
   - Command:
     ```bash
     cd /Users/maximisto/Documents/New\ project/backend
     npx tsc -p tsconfig.json --noEmit --incremental false
     ```
   - Result: passed with exit code `0`.

### Files changed in this follow-up

- `backend/src/integrationGateway/queryData.ts`
- `backend/src/server.ts`
- `backend/tests/queryDataGateway.test.ts`
- `backend/tests/automationSeeds.contract.ts`

### Follow-up self-review

- The key contract now holds: missing Stripe credentials make the automation query step fail, and that failure reaches `classifyAutomationRunOutcome(...)` through `stepErrors` and failed step status.
- The fix stays inside the gateway/query-step path and does not alter Task 1 Stripe adapter behavior.
