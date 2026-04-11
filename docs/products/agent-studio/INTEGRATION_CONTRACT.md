# Agent Studio Integration Contract

This is the minimum stable contract between `Agent Studio` and any runtime it integrates with.

The goal is simple:

- Agent Studio should not need to know internal runtime implementation details.
- A runtime should only need to publish structured workflow, run, replay, and policy data.

## 1. Core identity objects

Every integration should expose:

### Workspace

- `workspaceId`
- `workspaceName` if available

### Workflow

- `workflowId`
- `name`
- `description`
- `status`
- `schedule` if the workflow is recurring
- `createdAt`
- `updatedAt`

### Run

- `runId`
- `workflowId`
- `status`
- `startedAt`
- `finishedAt`
- `estimatedCredits`
- `actualCredits`
- `durationMs`

## 2. Workflow structure

Each workflow should expose a stable step list.

### Step shape

- `stepId`
- `kind`
  - `search`
  - `query`
  - `capture`
  - `analyze`
  - `summarize`
  - `deliver`
  - `note`
- `title`
- `objective`
- `assignedRole`
- `dependsOnStepIds`
- `modelTier`
- `toolName`

## 3. Replay structure

Each run should expose phase- and step-level execution data.

### Step execution shape

- `stepId`
- `kind`
- `title`
- `assignedRole`
- `status`
- `startedAt`
- `finishedAt`
- `durationMs`
- `modelTier`
- `modelSource`
- `directiveMode`
  - `cheaper`
  - `review`
  - `promote`
- `directivePhases`
- `toolCalls`
- `actualCredits`
- `tokenUsage`
  - `inputTokens`
  - `outputTokens`
  - `totalTokens`
- `summary`
- `error`

## 4. Policy structure

Each workflow should expose the currently active policy snapshot.

### Policy shape

- `mode`
  - `recommended`
  - `custom`
- `optimizationGoal`
  - `balanced`
  - `cost_saver`
  - `quality_first`
- `reviewPolicy`
  - `lean`
  - `standard`
  - `strict`
- `maxElasticLanes`

## 5. Studio state structure

If the runtime supports Agent Studio-style optimization state, it should expose:

- `selectedScenarioId`
- `previewPresetId`
- `roleDirectives`
- `experimentHistory`
- `savedPlans`
- `promotionHistory`

This state is optional for integrations that only provide replay and policy data.

## 6. Experiment attribution

To support branch comparison, the runtime should expose when available:

- `experimentId`
- `experimentLabel`
- `branchName`
- `parentExperimentId`
- `matchedSavedExperiment`
- `scenarioId`
- `previewPresetId`

## 7. Promotion and rollback history

Each promotion or rollback event should expose:

- `eventId`
- `appliedAt`
- `mode`
  - `preset`
  - `steering`
  - `full`
  - `phase`
  - `preset_phase`
  - `learning`
  - `graduation`
  - `rollback`
- `summary`
- `sourceExperimentId`
- `sourceExperimentLabel`
- `planId`
- `parentPlanId`
- `phase`
- `autoApplied`
- `confidence`
- `successDelta`
- `creditsDelta`
- `durationDelta`

## 8. Recommended API surface

This is the clean external-facing API shape.

### Workflows

- `GET /api/studio/workflows`
- `GET /api/studio/workflows/:workflowId`

### Runs

- `GET /api/studio/runs?workflowId=...`
- `GET /api/studio/runs/:runId`
- `GET /api/studio/replay/:runId`

### Policies

- `GET /api/studio/policies/:workflowId`
- `PATCH /api/studio/policies/:workflowId`

### Experiments

- `GET /api/studio/experiments?workflowId=...`
- `POST /api/studio/experiments`
- `POST /api/studio/promotions`
- `POST /api/studio/rollbacks`

## 9. Degradation rules

If an integration cannot provide everything:

- replay is more important than live topology polish
- run history is more important than branch visuals
- policy snapshots are more important than recommendation automation

Agent Studio should degrade in this order:

1. Workflows and runs
2. Replay and policy snapshots
3. Experiments and branches
4. Promotion and rollback intelligence

## 10. Current first-party mapping

Inside this repo:

- `Violema` is the first integration
- current data primarily comes from:
  - `/Users/maximisto/Documents/New project/backend/src/server.ts`
  - `/Users/maximisto/Documents/New project/backend/src/scheduler.ts`
  - `/Users/maximisto/Documents/New project/backend/src/platform/topology.ts`
  - `/Users/maximisto/Documents/New project/frontend/src/pages/AgentStudio.tsx`

The next engineering step is to move this contract into code-first shared types and have Studio consume the runtime through that boundary rather than direct product assumptions.
