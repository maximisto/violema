# Agent Studio Next Four Steps Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Finish the room-boundary cleanup in `Optimize` and `Replay`, then ship the first real Agent Studio capability upgrade: an evidence-backed Operational Context Map MVP.

**Architecture:** Keep the same sequence that worked for `Live`: extract one bounded surface at a time, validate it, then move the room-level advanced wrapper only after the content is safely componentized. Do not introduce Graphiti, Mem0, or any external memory layer yet; first prove the product shape with an internal evidence layer built from existing workflow, run, phase, and policy data.

**Tech Stack:** React, TypeScript, Vite, existing Agent Studio frontend components, existing `/api/studio/*` and workflow/run state, repo docs under `docs/`

---

### Task 1: Extract Optimize Advanced Surfaces

**Files:**
- Create: `frontend/src/features/agent-studio/components/OptimizeDiagnosticsSection.tsx`
- Create: `frontend/src/features/agent-studio/components/OptimizeAdvancedControlsSection.tsx`
- Modify: `frontend/src/pages/AgentStudio.tsx`
- Verify: `frontend/src/features/agent-studio/rooms/OptimizeRoom.tsx`

- [ ] **Step 1: Extract the diagnostics slab**

Move these out of `AgentStudio.tsx` into `OptimizeDiagnosticsSection.tsx`:
- `Waste diagnostics`
- `Risk diagnostics`

The component should accept typed arrays of diagnostics plus:
- `actionBusy`
- `onApplyRecommendation`

- [ ] **Step 2: Extract the strategy-lab slab**

Move these out of `AgentStudio.tsx` into `OptimizeAdvancedControlsSection.tsx`:
- `Workflow fingerprint`
- `Advanced overrides`
- saved-plan and plan-family surfaces that still live inside advanced optimize

Do not redesign behavior here. Preserve the existing controls and state flow.

- [ ] **Step 3: Rewire the page to use the new components**

Replace the inline JSX in `AgentStudio.tsx` with the new sections, keeping state in the page.

- [ ] **Step 4: QA gate**

Run:

```bash
cd /Users/maximisto/Documents/New\ project/frontend
npm run build
```

Expected:
- TypeScript passes
- Vite build passes
- only the existing chunk-size warning remains

- [ ] **Step 5: Structural audit before continuing**

Confirm:
- `Optimize` advanced content is no longer one giant inline slab
- no behavioral logic was moved accidentally
- the page diff is mostly deletion from `AgentStudio.tsx`

If this audit fails, stop and fix it before Task 2.


### Task 2: Move Optimize Advanced Wrapper Into OptimizeRoom

**Files:**
- Modify: `frontend/src/pages/AgentStudio.tsx`
- Verify: `frontend/src/features/agent-studio/rooms/OptimizeRoom.tsx`

- [ ] **Step 1: Pass advanced content through the room shell**

Wire `OptimizeRoom` with:
- `advanced={...}`
- `showAdvanced={showOptimizeAdvanced}`
- `onToggleAdvanced={() => setShowOptimizeAdvanced((current) => !current)}`

- [ ] **Step 2: Delete duplicated page-owned wrapper UI**

Remove from `AgentStudio.tsx`:
- the standalone `Advanced optimize controls` card
- the inline show/hide button block
- the page-owned conditional wrapper around advanced optimize content

The room shell should own the advanced panel, not the page.

- [ ] **Step 3: QA gate**

Run:

```bash
cd /Users/maximisto/Documents/New\ project/frontend
npm run build
```

Expected:
- build passes
- no new warnings beyond the existing bundle-size warning

- [ ] **Step 4: Structural audit before continuing**

Confirm:
- `Optimize` now matches `Live` structurally
- the room shell owns the advanced wrapper
- `AgentStudio.tsx` still holds state, but no longer owns duplicate advanced-panel scaffolding

If this audit fails, revert only the wrapper move and keep the component extractions.


### Task 3: Extract Replay Governance Surfaces And Move Replay Wrapper

**Files:**
- Create: `frontend/src/features/agent-studio/components/ReplayGovernanceSection.tsx`
- Create: `frontend/src/features/agent-studio/components/ReplayBranchHistorySection.tsx`
- Modify: `frontend/src/pages/AgentStudio.tsx`
- Verify: `frontend/src/features/agent-studio/rooms/ReplayRoom.tsx`

- [ ] **Step 1: Extract replay governance blocks**

Move out of `AgentStudio.tsx`:
- `Causal report`
- `Experiment scorecards`
- `Promotion history`
- `Role heatmap`
- branch-family / branch-history surfaces that are part of advanced replay

Use one or two bounded components. Do not explode this into too many files.

- [ ] **Step 2: Move advanced replay content into `ReplayRoom`**

After extraction, wire:
- `advanced={...}`
- `showAdvanced={showReplayAdvanced}`
- `onToggleAdvanced={() => setShowReplayAdvanced((current) => !current)}`

Remove the duplicate page-owned advanced replay wrapper.

- [ ] **Step 3: QA gate**

Run:

```bash
cd /Users/maximisto/Documents/New\ project/frontend
npm run build
```

Expected:
- build passes
- replay still compiles cleanly after wrapper move

- [ ] **Step 4: Structural audit before continuing**

Confirm:
- all three rooms now follow the same shell pattern
- page-owned advanced wrapper duplication is gone for `Live`, `Optimize`, and `Replay`
- `AgentStudio.tsx` is materially smaller and easier to reason about

If this audit fails, keep the extracted replay components but roll back the wrapper move only.


### Task 4: Ship Operational Context Map MVP

**Files:**
- Create: `frontend/src/features/agent-studio/components/OperationalContextMapSection.tsx`
- Modify: `frontend/src/pages/AgentStudio.tsx`
- Modify: `backend/src/agent-studio/violemaStudio.ts`
- Modify: `backend/src/agent-studio/contract.ts`
- Optional modify: `backend/src/agent-studio/adapters/violema.ts`

- [ ] **Step 1: Define the MVP scope**

Do not add generic RAG chat.

The MVP must show only:
- `Similar runs`
- `Why this recommendation`
- `What changed since last healthy state`

Build it from existing internal data first:
- workflow runs
- phase evidence
- directives
- promotion / rollback history
- current vs prior cohort deltas

- [ ] **Step 2: Add a small normalized backend surface**

Expose a compact evidence payload for the selected workflow using existing history.

Payload should support:
- nearest similar runs by phase/status/cost pattern
- latest healthy comparison window
- recommendation evidence rows with provenance

Do not introduce external retrieval infra in this step.

- [ ] **Step 3: Add the MVP UI surface**

Place the first context-map surface where it helps decisions most:
- `Replay` is the strongest first home
- optional small summary chip in `Live`

The UI should answer:
- have we seen this before?
- what changed?
- why is this recommendation being made?

- [ ] **Step 4: QA gate**

Run:

```bash
cd /Users/maximisto/Documents/New\ project/backend
npm run build
cd /Users/maximisto/Documents/New\ project/frontend
npm run build
```

Expected:
- backend build passes
- frontend build passes
- no external service is required

- [ ] **Step 5: Product audit**

Confirm:
- the new capability increases clarity rather than adding another dashboard slab
- recommendations have visible evidence
- the system feels more agentic and grounded, not more abstract

If this audit fails, cut scope until the MVP is evidence-first and obvious.


## QA System For Every Task

Use the same sequence after each task:

1. Build the smallest affected surface.
2. Audit the diff for structural sanity.
3. Decide whether the next step is still the right next step.
4. Only continue if the result made the product clearer.

Stop conditions:

- if the wrapper move causes scope or build breakage, revert only that move
- if a new component adds indirection without shrinking page complexity, rewrite it
- if a “capability” becomes generic AI noise, cut it immediately


## Recommendation

Implement these in order:

1. Optimize extraction
2. Optimize wrapper migration
3. Replay extraction + wrapper migration
4. Operational Context Map MVP

That is the strongest path because it finishes the room architecture first, then adds the first real intelligence layer on top of stable room boundaries.
