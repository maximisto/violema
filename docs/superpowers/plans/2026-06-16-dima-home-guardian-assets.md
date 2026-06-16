# Dima Home Guardian Assets Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the bottom-right Home guardian sprite with the approved Dima-and-agent-swarm image while reserving the paw-on-credits image for Analytics/Credits.

**Architecture:** Keep the existing guardian state machine in `frontend/src/features/guardian/dashboardGuardian.ts`. Preserve the left sidebar Cane Corso as a static brand mark and only update `frontend/public/brand/dima/dima-patrol.png` and `frontend/public/brand/dima/dima-credits.png`.

**Tech Stack:** Vite, React, TypeScript, public PNG assets, existing `dashboardGuardian` contract test.

---

### Task 1: Preserve The Approved Mapping

**Files:**
- Modify: `frontend/tests/dashboardGuardian.contract.ts`

- [ ] **Step 1: Verify current mapping**

Run: `sed -n '1,180p' frontend/tests/dashboardGuardian.contract.ts`

Expected: Home/chat asserts `patrol`, Analytics/Credits asserts `credits`, and pattern notes assert the left sidebar remains static.

- [ ] **Step 2: Add semantic asset assertions if absent**

Ensure the test says Home/chat uses the patrol sprite and Analytics uses the credits sprite so future asset swaps do not blur the two roles.

- [ ] **Step 3: Run the contract**

Run: `npx tsx tests/dashboardGuardian.contract.ts`

Expected: PASS with no output.

### Task 2: Generate Cropped Transparent Sprites

**Files:**
- Modify: `frontend/public/brand/dima/dima-patrol.png`
- Modify: `frontend/public/brand/dima/dima-credits.png`

- [ ] **Step 1: Convert the approved Home image**

Use `/var/folders/vm/mglk3029699_7qp2cgd_hpz40000gn/T/codex-clipboard-fdf67eb5-b9f0-4708-b1af-3994de8180f9.png` as the source for `dima-patrol.png`. Remove the near-black background, crop transparent edges, and keep the dog plus helper agents.

- [ ] **Step 2: Convert the approved Credits image**

Use `/var/folders/vm/mglk3029699_7qp2cgd_hpz40000gn/T/codex-clipboard-84e92cb2-e9ad-437e-8477-16c9f4f9168f.png` as the source for `dima-credits.png`. Remove the near-black background, crop transparent edges, and keep the paw-on-credits composition.

- [ ] **Step 3: Inspect file metadata**

Run: `file frontend/public/brand/dima/dima-patrol.png frontend/public/brand/dima/dima-credits.png`

Expected: both files are PNG RGBA.

### Task 3: Validate Rendering Safety

**Files:**
- Read: `frontend/src/features/guardian/DimaDashboardGuardian.tsx`
- Read: `frontend/src/index.css`

- [ ] **Step 1: Confirm layout still supports the new aspect ratios**

Verify the component uses `object-contain` and a fixed bottom-right image box, so the new sprites can be different dimensions without shifting the dashboard.

- [ ] **Step 2: Run the app build**

Run: `npm run build`

Expected: Vite build completes successfully.

- [ ] **Step 3: Review changed files**

Run: `git diff --stat && git diff -- frontend/tests/dashboardGuardian.contract.ts frontend/src/features/guardian/dashboardGuardian.ts frontend/src/features/guardian/DimaDashboardGuardian.tsx frontend/src/index.css`

Expected: no unwanted left-sidebar changes.
