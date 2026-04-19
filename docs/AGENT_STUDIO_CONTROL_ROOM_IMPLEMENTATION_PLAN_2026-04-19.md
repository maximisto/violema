# Agent Studio Control Room Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reshape Agent Studio into a clearer operator control room centered on Workflow, Run, Replay, and Release.

**Architecture:** Keep existing backend primitives and most frontend logic, but change the room structure so primary operator tasks are visible by default and advanced governance is explicitly hidden behind advanced sections. Do a first-pass extraction of reusable room UI so the product shape is enforceable in code.

**Tech Stack:** React, TypeScript, Tailwind, Vite

---

### Task 1: Add durable room scaffolding

**Files:**
- Create: `frontend/src/features/agent-studio/components/RoomSection.tsx`
- Create: `frontend/src/features/agent-studio/components/AdvancedPanel.tsx`
- Modify: `frontend/src/features/agent-studio/rooms/LiveRoom.tsx`
- Modify: `frontend/src/features/agent-studio/rooms/OptimizeRoom.tsx`
- Modify: `frontend/src/features/agent-studio/rooms/ReplayRoom.tsx`

- [ ] Create reusable section and advanced-panel components for the rooms.
- [ ] Update the three room files so they provide real structure, not just a wrapper `section`.
- [ ] Keep the API small and obvious: title, description, children.

### Task 2: Simplify the top Agent Studio shell

**Files:**
- Modify: `frontend/src/pages/AgentStudio.tsx`

- [ ] Reduce top-of-page explanatory sprawl so the selected workflow and room switcher lead quickly into the active room.
- [ ] Replace the large “Path forward” treatment with a more compact operator-loop summary.
- [ ] Preserve the workflow summary but reduce visual competition before the room content starts.

### Task 3: Recut Live around operation, not overview sprawl

**Files:**
- Modify: `frontend/src/pages/AgentStudio.tsx`

- [ ] Keep `Live system map` as the hero surface.
- [ ] Keep `Node inspector`, `Activation trail`, and `Next experiments` in the default path.
- [ ] Move `Lane roster`, `Live pulse`, `Active scenario`, `Phase steering`, and `Optimization loop` into an explicit advanced live section.

### Task 4: Recut Optimize around release decisions

**Files:**
- Modify: `frontend/src/pages/AgentStudio.tsx`

- [ ] Keep `Scenario simulator`, `Preset sandbox`, `Preset preview`, and release diff in the default path.
- [ ] Collapse diagnostics into a lighter current-release card or move them after the primary decision path.
- [ ] Keep plans, families, branches, graduation, rollback, and experiments inside the existing advanced optimize section.

### Task 5: Recut Replay around run understanding

**Files:**
- Modify: `frontend/src/pages/AgentStudio.tsx`

- [ ] Keep `Run replay`, `Run comparison`, `Dual-run replay canvas`, `Paired replay timeline`, `Phase overlay`, and `Replay findings` visible by default.
- [ ] Move promotion, gate, branch, and history machinery into an explicit advanced replay section.
- [ ] Preserve the actions that connect replay to live/optimize.

### Task 6: Tighten terminology toward Workflow / Run / Replay / Release

**Files:**
- Modify: `frontend/src/pages/AgentStudio.tsx`

- [ ] Adjust room copy and helper labels so the main path reads like an operator control room.
- [ ] De-emphasize concepts like branch families and governance unless the user has opened advanced sections.
- [ ] Make the release/candidate framing clearer in Optimize.

### Task 7: Verify and stabilize

**Files:**
- Modify: `frontend/src/pages/AgentStudio.tsx`
- Modify: `frontend/src/features/agent-studio/components/RoomSection.tsx`
- Modify: `frontend/src/features/agent-studio/components/AdvancedPanel.tsx`
- Modify: `frontend/src/features/agent-studio/rooms/LiveRoom.tsx`
- Modify: `frontend/src/features/agent-studio/rooms/OptimizeRoom.tsx`
- Modify: `frontend/src/features/agent-studio/rooms/ReplayRoom.tsx`

- [ ] Run `npm run build` in `frontend`.
- [ ] Fix any TypeScript or JSX regressions.
- [ ] Confirm the new room structure does not reintroduce jumpy layout behavior.

### Task 8: Document the product pass

**Files:**
- Modify: `docs/AGENT_STUDIO_CONTROL_ROOM_DESIGN_2026-04-19.md`

- [ ] Add a short implementation status note if the final code shape differs from the original plan in a meaningful way.
- [ ] Keep the doc aligned with what actually shipped.
