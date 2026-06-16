# Mission Progress Rail Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a reusable mission progress rail that shows Trigger -> Research -> Analysis -> Draft -> Review -> Deliver from real mission step state.

**Architecture:** Normalize `MissionWorkspaceView.steps` into canonical phases in a pure helper, then render the same model through one React component with full and compact variants. Existing mission surfaces keep owning their layout; the rail becomes a shared primitive imported where each surface needs context.

**Tech Stack:** React, TypeScript, Tailwind CSS, lucide-react, `npx tsx` contract tests.

---

### Task 1: Progress Model Contract

**Files:**
- Create: `frontend/tests/missionProgress.contract.ts`
- Create: `frontend/src/features/missions/missionProgress.ts`
- Modify: `frontend/src/features/missions/types.ts`
- Modify: `frontend/src/features/missions/missionApi.ts`
- Modify: `frontend/src/features/missions/missionPresenter.ts`

- [ ] **Step 1: Write the failing test**

```ts
const phases = buildMissionProgressPhases(mission);
assert(phases.map((phase) => phase.label).join(' -> ') === 'Trigger -> Research -> Analysis -> Draft -> Review -> Deliver', 'uses the canonical phase language');
assert(phases.find((phase) => phase.id === 'trigger')?.status === 'completed', 'maps completed setup to Trigger');
assert(phases.find((phase) => phase.id === 'research')?.status === 'running', 'maps live search/query work to Research');
assert(phases.find((phase) => phase.id === 'analysis')?.status === 'failed', 'problem status wins in phase rollup');
assert(phases.find((phase) => phase.id === 'draft')?.status === 'waiting_review', 'review waits can surface before final review');
assert(phases.find((phase) => phase.id === 'review')?.status === 'waiting_review', 'explicit review step maps to Review');
assert(phases.find((phase) => phase.id === 'deliver')?.status === 'planned', 'delivery phase stays planned until it runs');
assert(phases.find((phase) => phase.id === 'trigger')?.metaLabel === '9:00 AM', 'uses real completed timestamps when present');
assert(phases.find((phase) => phase.id === 'research')?.metaLabel === 'Now', 'running steps get a live label');
assert(buildCompactMissionProgressPhases(mission).length === 6, 'compact model still exposes all canonical phases');
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx tsx tests/missionProgress.contract.ts`

Expected: FAIL because `missionProgress.ts` does not exist yet.

- [ ] **Step 3: Write minimal implementation**

Create `missionProgress.ts` with phase definitions, kind/title/objective classification, severity-aware status rollup, and timestamp/status label formatting.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npx tsx tests/missionProgress.contract.ts`

Expected: PASS.

### Task 2: Shared Rail Component

**Files:**
- Create: `frontend/src/features/missions/MissionProgressRail.tsx`
- Modify: `frontend/src/features/missions/MissionCommandDashboard.tsx`
- Modify: `frontend/src/features/missions/MissionOverview.tsx`
- Modify: `frontend/src/features/missions/MissionBoard.tsx`
- Modify: `frontend/src/features/missions/MissionCalendar.tsx`
- Modify: `frontend/src/pages/Dashboard.tsx`

- [ ] **Step 1: Build component**

Create `MissionProgressRail` with `variant="full" | "compact"`, checked completed dots, glowing violet/cyan running dot, amber review/waiting state, red failed state, muted planned state, and small metadata labels.

- [ ] **Step 2: Place full rail**

Render the full rail under the mission title/status row in `MissionCommandDashboard` and inside the mission workspace header card in `Dashboard.tsx`.

- [ ] **Step 3: Place compact rail**

Render compact rail in `MissionOverview`, board step cards, and calendar agenda cards.

- [ ] **Step 4: Validate UI code**

Run: `cd frontend && npm run build`

Expected: TypeScript and Vite build complete.

### Task 3: Final Verification

**Files:**
- Test: `frontend/tests/missionProgress.contract.ts`
- Test: `frontend/tests/missionDashboard.contract.ts`

- [ ] **Step 1: Run focused contracts**

Run:
```bash
cd frontend
npx tsx tests/missionProgress.contract.ts
npx tsx tests/missionDashboard.contract.ts
```

Expected: Both commands pass.

- [ ] **Step 2: Review diff**

Run: `git diff -- frontend/src/features/missions frontend/src/pages/Dashboard.tsx frontend/tests/missionProgress.contract.ts docs/superpowers/plans/2026-06-16-mission-progress-rail.md`

Expected: Diff is limited to the mission progress rail feature.
