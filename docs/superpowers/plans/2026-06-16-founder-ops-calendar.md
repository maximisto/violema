# Founder Ops Calendar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the mission Calendar tab into a colorful founder-ops schedule with week load, rich agenda cards, app logo chips, and agent avatars.

**Architecture:** Add a small presenter module that derives demo calendar state from the existing `MissionWorkspaceView`, then keep the React component focused on rendering. The calendar remains frontend-only demo data for now, but its shape can later map to backend scheduled mission records.

**Tech Stack:** React, TypeScript, Tailwind CSS, Lucide icons, existing `BrandIcon` integration logo helper, `tsx` contract tests.

---

### Task 1: Calendar Presenter

**Files:**
- Create: `frontend/src/features/missions/missionCalendarSchedule.ts`
- Create: `frontend/tests/missionCalendarSchedule.contract.ts`

- [x] **Step 1: Define calendar data types and a deterministic `buildFounderOpsCalendar(mission)` presenter.**

- [x] **Step 2: Cover the presenter with a contract test that verifies primary mission, colorful weekly load, app badges, and agent avatars.**

### Task 2: Calendar UI

**Files:**
- Modify: `frontend/src/features/missions/MissionCalendar.tsx`

- [x] **Step 1: Replace the plain schedule tiles with a top rhythm band, seven-day load rail, connected stack strip, and colorful agenda cards.**

- [x] **Step 2: Keep existing run/pause behavior wired through the existing props.**

### Task 3: Validation

**Files:**
- Test: `frontend/tests/missionCalendarSchedule.contract.ts`
- Test: `frontend/tests/dashboardGuardian.contract.ts`

- [x] **Step 1: Run `npx tsx tests/missionCalendarSchedule.contract.ts`.**

- [x] **Step 2: Run `npx tsx tests/dashboardGuardian.contract.ts`.**

- [x] **Step 3: Run `npm run build`.**

- [x] **Step 4: Smoke-check `/dashboard-preview` Calendar tab visually.**
