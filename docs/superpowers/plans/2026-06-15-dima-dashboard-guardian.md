# Dima Dashboard Guardian Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Dima, a gray Cane Corso dashboard guardian that gives contextual advice, celebrates solved work, and offers optional mischief rituals.

**Architecture:** Add a focused guardian feature folder with pure logic plus a React overlay. Mount it once from `Dashboard.tsx` and keep styling scoped through CSS classes in `index.css`.

**Tech Stack:** React 18, TypeScript, Tailwind classes, Vite, existing node-executable contract tests.

---

### Task 1: Guardian Contract Logic

**Files:**
- Create: `frontend/src/features/guardian/dashboardGuardian.ts`
- Test: `frontend/tests/dashboardGuardian.contract.ts`

- [ ] **Step 1: Write the failing contract test**

Create `frontend/tests/dashboardGuardian.contract.ts` with assertions for storage keys, area-specific advice, low-credit warning, success kiss, and weak-work mischief rituals.

- [ ] **Step 2: Run the contract test to verify it fails**

Run: `cd frontend && npx tsx tests/dashboardGuardian.contract.ts`

Expected: FAIL because `dashboardGuardian.ts` does not exist.

- [ ] **Step 3: Implement pure guardian helpers**

Create `frontend/src/features/guardian/dashboardGuardian.ts` exporting:

- `GuardianRitual`
- `GuardianContext`
- `GuardianCue`
- `getDimaHiddenStorageKey`
- `getDimaMischiefStorageKey`
- `selectDimaCue`
- `getDimaPatternNotes`

- [ ] **Step 4: Run the contract test to verify it passes**

Run: `cd frontend && npx tsx tests/dashboardGuardian.contract.ts`

Expected: PASS.

### Task 2: Dashboard Overlay

**Files:**
- Create: `frontend/src/features/guardian/DashboardGuardian.tsx`
- Modify: `frontend/src/pages/Dashboard.tsx`
- Modify: `frontend/src/index.css`

- [ ] **Step 1: Add the overlay component**

Create `DashboardGuardian.tsx` with the existing `/brand/violema-trust-cane-corso.png` asset, gray/silver treatment, advice bubble, hide/show control, mischief toggle, and ritual visual states.

- [ ] **Step 2: Add scoped motion styles**

Modify `frontend/src/index.css` with `.dima-guardian`, `.dima-guardian--kiss`, `.dima-guardian--chew`, `.dima-guardian--mark`, and reduced-motion overrides.

- [ ] **Step 3: Mount the component**

Modify `Dashboard.tsx` to import and render `DashboardGuardian` inside the main dashboard root with `workspaceId`, `workspaceArea`, `activeWorkspaceTab`, `selectedMission`, and `lowCreditRunway`.

### Task 3: Validation

**Files:**
- Validate current frontend.

- [ ] **Step 1: Run the guardian contract test**

Run: `cd frontend && npx tsx tests/dashboardGuardian.contract.ts`

Expected: PASS.

- [ ] **Step 2: Run the frontend build**

Run: `cd frontend && npm run build`

Expected: TypeScript and Vite build pass.

- [ ] **Step 3: Visual smoke test**

Open the local dashboard with the existing dev server or start one if needed. Verify Dima appears, hide/show works, mischief toggle works, and the overlay does not block the chat or mission inspector.
