# Claude handoff - Violema platform - 2026-06-21

## Current state

- Repo: `/Users/maximisto/Documents/New project`
- Branch: `claude/build-ai-assistant-platform-BsdRr`
- Local HEAD: `208d100` (`docs: add 2026-06-19 session handoff`)
- Local branch status at handoff creation: clean and in sync with `origin/claude/build-ai-assistant-platform-BsdRr`
- Production server checkout: `adcb5ee`
- Production branch: `claude/build-ai-assistant-platform-BsdRr`
- Production process: `violema-backend` online in PM2, 0 restarts at check time
- Live health check: `https://violema.com/api/health` returned `status: ok` with Anthropic, OpenAI, Tavily, Postmark, and Slack configured

Important: production is live and healthy, but it is behind the pushed branch.
The currently deployed app is `adcb5ee`; commits `9e96dc5` and `208d100` are
pushed but not deployed unless someone deploys after this handoff.

## Product direction

Violema is being repositioned from a narrow Agent Studio/testing surface into an
AI operations platform for founder-led teams. The core user experience should
feel like a polished work platform that can:

- turn requests into monitored missions
- split work into steps and agents
- show current state, evidence, progress, costs, and review requirements
- let the founder approve, adjust, rerun, and deliver results
- make recurring automations discoverable through templates
- keep chat as the familiar home surface while adding board, map, calendar,
  analytics, reviews, integrations, and advanced controls as usable work views

The approved direction is not "chat plus a dashboard bolted on." It is a mission
control shell where chat remains central, and the surrounding surfaces explain
what the platform is doing, what it costs, what needs review, and what happens
next.

## Recent work that matters

### `adcb5ee` - deployed

`feat(dashboard): harden automation review loop`

This is the last confirmed deployed commit. It added:

- automation lifecycle helpers in `backend/src/platform/automationLifecycle.ts`
- tool artifact helpers in `backend/src/platform/toolArtifacts.ts`
- automation/review/server wiring in `backend/src/server.ts`
- Slack destination validation that is less brittle about channel names
- chart artifact persistence for `render_chart`
- mission map, analytics, and review surfaces in the frontend
- founder workflow template hooks in the dashboard
- backend tests:
  - `backend/tests/automationLifecycle.contract.ts`
  - `backend/tests/toolArtifacts.contract.ts`
- frontend tests:
  - `frontend/tests/missionPresenter.contract.ts`

Validation previously run for this work:

```bash
cd backend && npx --yes tsx tests/automationLifecycle.contract.ts
cd backend && npx --yes tsx tests/toolArtifacts.contract.ts
cd frontend && npx --yes tsx tests/missionPresenter.contract.ts
npm run build
```

### `9e96dc5` - pushed, not deployed at handoff check

`feat(templates): surface a discoverable workflow gallery`

This adds the activation layer:

- shared workflow template catalog in `frontend/src/content/workflowTemplates.ts`
- template gallery in `frontend/src/features/templates/WorkflowTemplateGallery.tsx`
- dashboard integration so "Use template" opens the existing workflow editor
  prefilled for review before shipping
- contract coverage in `frontend/tests/workflowTemplates.contract.ts`

This is a strong next deployment candidate because it makes recurring founder
automations easier to discover.

### `208d100` - pushed, not deployed at handoff check

`docs: add 2026-06-19 session handoff`

Adds `docs/handoffs/2026-06-19-session-handoff.md`. It is useful history, but
its deployment note is stale relative to this handoff because production is now
confirmed at `adcb5ee`.

## Important files

Frontend shell and dashboard:

- `frontend/src/pages/Dashboard.tsx`
- `frontend/src/features/missions/MissionCommandDashboard.tsx`
- `frontend/src/features/missions/MissionWorkspacePanel.tsx`
- `frontend/src/features/missions/MissionProgressRail.tsx`
- `frontend/src/features/missions/MissionBoard.tsx`
- `frontend/src/features/missions/MissionCalendar.tsx`
- `frontend/src/features/missions/MissionMap.tsx`
- `frontend/src/features/missions/MissionAnalytics.tsx`
- `frontend/src/features/missions/MissionReviews.tsx`
- `frontend/src/features/missions/MissionIntegrationsStrip.tsx`
- `frontend/src/features/missions/missionApi.ts`
- `frontend/src/features/missions/missionActions.ts`
- `frontend/src/features/missions/missionDashboard.ts`
- `frontend/src/features/missions/missionProgress.ts`
- `frontend/src/features/missions/missionPresenter.ts`

Templates:

- `frontend/src/content/workflowTemplates.ts`
- `frontend/src/features/templates/WorkflowTemplateGallery.tsx`
- `frontend/tests/workflowTemplates.contract.ts`

Dima guardian:

- `frontend/src/features/guardian/dashboardGuardian.ts`
- `frontend/src/features/guardian/DimaDashboardGuardian.tsx`
- `frontend/src/features/guardian/DimaSidebarNote.tsx`
- `frontend/tests/dashboardGuardian.contract.ts`

Backend automation/runtime:

- `backend/src/server.ts`
- `backend/src/platform/automationLifecycle.ts`
- `backend/src/platform/toolArtifacts.ts`
- `backend/src/platform/missions.ts`
- `backend/tests/automationLifecycle.contract.ts`
- `backend/tests/toolArtifacts.contract.ts`
- `backend/tests/missions.contract.ts`
- `backend/tests/missionSchema.contract.ts`

## Product decisions to preserve

- Chat remains the home/default surface. Do not bury it.
- Left sidebar should be useful for navigation and conversation/project context,
  not dominated by credit upsells.
- Credits should be visible but quiet. Big credit meters compete with the work.
- Top navigation tabs should carry major work modes: Chat, Missions, Board, Map,
  Reviews, Calendar, Analytics, Integrations, Advanced.
- The mission progress language should stay consistent:
  `Trigger -> Research -> Analysis -> Draft -> Review -> Deliver`.
- `MissionProgressRail` should be reusable, not decorative.
  - full version near mission/project title
  - compact version in cards, board items, and calendar items
  - completed as checked dots
  - current as violet/cyan glow
  - waiting/review as amber
  - failed/problem as red
  - planned as muted
- The left sidebar Cane Corso silhouette is a static brand/design element. Do
  not rotate it for moods.
- The bottom-right Dima guardian can vary by context, mood, and advice. Keep it
  optional and non-blocking.
- Cosmetics are secondary to getting the task scheduling and automation flow
  working end to end.

## Known gaps and next loops

Highest priority:

1. Run an authenticated live smoke test for task scheduling end to end:
   - login works for approved/admin users
   - create/edit workflow works
   - changing Slack destination saves
   - run starts
   - all steps complete or enter honest review/failure state
   - artifacts render when visual/chart output is requested
   - approve/rerun/request changes buttons work
   - Slack delivery works or shows a specific actionable error
2. Deploy pushed branch HEAD if the goal is to make template gallery + docs live.
3. Fix remaining OAuth/admin access issues for:
   - `max@purpleorange.io`
   - `max.markovtsev@gmail.com`
4. Workspace-scope automations before broader beta. Current review notes flag a
   multi-tenant authorization gap: automations are global and should not remain
   that way for investor/user access.
5. Add a chat empty-state CTA into templates. New users land on chat, so the
   template gallery should be discoverable from there.
6. Add public `/templates/<slug>` pages using the shared catalog for SEO and
   activation.
7. Decompose `backend/src/server.ts`; it is carrying too much route/runtime
   logic and slows down safe iteration.
8. Continue dashboard UX polish after workflow reliability is proven:
   - board and calendar density
   - avatar/icon richness
   - empty states
   - mobile fit
   - bundle/performance cleanup

## Verification commands

Local state:

```bash
git status --short --branch
git log -5 --oneline --decorate
```

Build:

```bash
npm run build
```

Frontend contract tests:

```bash
cd frontend
for t in tests/*.contract.ts; do npx --yes tsx "$t" && echo "PASS $t"; done
```

Backend build and contract tests:

```bash
cd backend
npm run build
for t in tests/*.ts; do npx --yes tsx "$t" && echo "PASS $t"; done
```

Local dev:

```bash
npm run dev
# frontend: http://localhost:5173
# dashboard preview: http://localhost:5173/dashboard-preview
```

Production smoke:

```bash
curl -fsS https://violema.com/api/health
curl -I -sS https://violema.com/login
curl -I -sS https://violema.com/dashboard-preview
curl -I -sS https://violema.com/api/automations
# unauthenticated /api/automations should return 401
```

Server checkout/process:

```bash
ssh root@187.77.220.60 'cd /var/www/nexus && git rev-parse --short HEAD && git rev-parse --abbrev-ref HEAD && pm2 status violema-backend --no-color'
```

Deploy command used successfully for `adcb5ee`:

```bash
ssh root@187.77.220.60 'set -e; cd /var/www/nexus; DOMAIN=violema.com LEGACY_DOMAIN=nexus.purpleorange.io APP_DIR=/var/www/nexus PM2_APP_NAME=violema-backend bash deploy/deploy.sh --skip-deps'
```

After deploy, verify the server checkout moved to the intended commit:

```bash
ssh root@187.77.220.60 'cd /var/www/nexus && git rev-parse --short HEAD'
curl -fsS https://violema.com/api/health
```

## Operational gotchas

- Push does not deploy. The VPS only updates when the deploy script runs.
- Do not claim production includes commits after `adcb5ee` unless the server
  checkout confirms it.
- `/api/automations` is auth-protected; a 401 without a session is expected.
- Use `npx --yes tsx` for contract tests; do not assume `tsx` is installed.
- The browser/Playwright extension bridge may not be available in this
  environment. If visual QA is needed, use the backend Playwright dependency or
  manual browser checks.
- Inspect `git status` before edits. This repo has had multiple sessions and
  agents touching dashboard, SEO, and docs work.
- Preserve user/product decisions around Dima and the left sidebar silhouette.
- If working on SEO cleanup, classify files against sitemap, `llms.txt`, blog
  hub, primary SEO page, and IndexNow references before deleting anything.

## Recommended next move

Do not start with more UI polish. Start with the authenticated workflow smoke.
The product only becomes investable when the user can edit a workflow, run it,
see honest progress/artifacts, review the output, and deliver it without a
silent failure.

If that passes, deploy `208d100` or the current branch HEAD. If it fails, fix the
failure at the lifecycle/API boundary before touching visuals.
