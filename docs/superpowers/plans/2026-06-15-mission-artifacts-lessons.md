# Mission Artifacts And Lessons Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fold living artifacts and learning-loop memory updates into the existing Violema mission workspace.

**Architecture:** Extend the mission presenter view model with `artifact` and `lessons` fields derived from existing run artifacts, summaries, steps, and metrics. Add two focused React surfaces and wire them into Mission tabs plus the fold-in context inspector, keeping the top-level navigation unchanged.

**Tech Stack:** React 18, TypeScript, Vite, Tailwind, existing lucide icon imports.

---

### Task 1: Presenter Contract

**Files:**
- Create: `frontend/tests/missionPresenter.contract.ts`
- Modify: `frontend/src/features/missions/types.ts`
- Modify: `frontend/src/features/missions/missionPresenter.ts`

- [ ] **Step 1: Write the failing contract test**

Create a contract test that calls `buildMissionWorkspaceView()` with artifacts and verifies the returned view exposes a living artifact, validation sections, and lessons.

- [ ] **Step 2: Run the focused contract command and verify it fails**

Run:

```bash
cd frontend && rm -rf /tmp/violema-mission-contract && ./node_modules/.bin/tsc tests/missionPresenter.contract.ts --target ES2020 --module commonjs --moduleResolution node --esModuleInterop --skipLibCheck --strict --outDir /tmp/violema-mission-contract --noEmit false && node /tmp/violema-mission-contract/tests/missionPresenter.contract.js
```

Expected: FAIL because `MissionWorkspaceView` does not yet include `artifact` and `lessons`.

- [ ] **Step 3: Implement the minimal presenter/types**

Add typed artifact and lesson view models. Derive defaults for empty missions and richer values for missions with artifacts, steps, metrics, evidence, and summaries.

- [ ] **Step 4: Re-run the contract command**

Expected: PASS.

### Task 2: Mission Surfaces

**Files:**
- Create: `frontend/src/features/missions/MissionArtifact.tsx`
- Create: `frontend/src/features/missions/MissionLessons.tsx`
- Modify: `frontend/src/features/missions/MissionOverview.tsx`
- Modify: `frontend/src/features/missions/MissionWorkspacePanel.tsx`

- [ ] **Step 1: Add artifact UI**

Create a polished living-artifact view with output title, source, validation tiles, delivery state, and active skill/context labels.

- [ ] **Step 2: Add lessons UI**

Create a compact learning-loop queue showing saved, proposed, and waiting memories/rules that Violema can turn into repeatable behavior.

- [ ] **Step 3: Add inspector tabs**

Add `Artifact` and `Lessons` to the fold-in inspector tabs.

### Task 3: Dashboard Wiring

**Files:**
- Modify: `frontend/src/features/missions/workspaceShell.ts`
- Modify: `frontend/src/pages/Dashboard.tsx`

- [ ] **Step 1: Add mission tabs**

Add `Artifact`, `Lessons`, and rename the visible `Controls` label to `Schedule` while preserving current scheduler behavior.

- [ ] **Step 2: Route tabs to surfaces**

Wire mission workspace and main mission area to the new components. Empty states should mention artifacts and lessons without adding a new top-level nav.

- [ ] **Step 3: Keep schedule controls intact**

Ensure existing run now, pause, and open schedule controls continue to be reachable.

### Task 4: Verification

**Files:**
- Modify: none unless verification exposes defects.

- [ ] **Step 1: Run the contract test**

Expected: PASS.

- [ ] **Step 2: Run frontend build**

Run: `cd frontend && npm run build`

Expected: PASS.

- [ ] **Step 3: Browser smoke**

Open `http://localhost:5173/dashboard-preview`, switch to Missions, open `Artifact` and `Lessons`, and verify the inspector tabs exist without breaking chat.
