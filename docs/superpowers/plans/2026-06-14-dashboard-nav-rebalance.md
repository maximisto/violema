# Dashboard Navigation Rebalance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move Violema workspace navigation out of the crowded left rail and into the top bar, while demoting credits to a quiet utility pill.

**Architecture:** Keep the existing `workspaceShell.ts` metadata and Dashboard state model. Reuse the same `selectWorkspaceArea` and `selectWorkspaceTab` handlers, but render primary workspace areas in the top header and reserve the left sidebar for conversations/search. Keep billing actions available through a compact bottom utility.

**Tech Stack:** React, TypeScript, Tailwind, existing lucide deep imports, existing Vite build.

**Status:** Architecture locked on 2026-06-14. Primary workspace navigation belongs in the top bar; the left rail is for conversations, search, compact credits, and workspace utilities.

---

### Task 1: Move Primary Workspace Navigation To Top Bar

**Files:**
- Modify: `frontend/src/pages/Dashboard.tsx`

- [ ] Remove the `Workspace areas` nav block from the sidebar.
- [ ] Add a top-row `nav` in the dashboard header that maps `WORKSPACE_AREAS`.
- [ ] Render each primary area as icon + short label using `area.icon` and `area.shortLabel`.
- [ ] Keep `aria-pressed` on primary area buttons and call `selectWorkspaceArea(area.id)`.
- [ ] Preserve the existing contextual tablist below the title/description.

### Task 2: Demote Credits To A Quiet Sidebar Utility

**Files:**
- Modify: `frontend/src/pages/Dashboard.tsx`

- [ ] Replace the large credits card in the sidebar with a compact bottom utility strip.
- [ ] Show remaining credits, runway, and plan name in one small pill-like row.
- [ ] Keep top-up and upgrade actions as icon-only/small buttons.
- [ ] Keep admin-only test credit control available but visually secondary.

### Task 3: Validate

**Files:**
- Validate: `frontend/src/pages/Dashboard.tsx`

- [ ] Run `cd frontend && npm run build`.
- [ ] Smoke test `/dashboard-preview` in the in-app browser.
- [ ] Verify primary tabs switch areas, contextual tabs still switch views, chat remains reachable, and credits no longer dominate the left rail.
