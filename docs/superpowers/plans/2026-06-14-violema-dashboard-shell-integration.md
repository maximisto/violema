# Violema Dashboard Shell Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the dashboard into a real Agent Office shell where the side menu switches primary work areas and top tabs switch the selected area's content.

**Architecture:** Keep `/dashboard-preview` and the existing `Dashboard` component as the integration surface. Add a small workspace shell config module for left nav/top tabs, then make `Dashboard.tsx` render chat, mission, board, map, reviews, calendar, analytics, integrations, and advanced content from that state. Keep the existing mission fold-in panel as a contextual inspector instead of the main navigation surface.

**Tech Stack:** React 18, TypeScript, Vite, Tailwind, existing Lucide deep imports, existing mission components.

**Status:** Superseded by `docs/superpowers/plans/2026-06-14-dashboard-nav-rebalance.md` and the architecture lock in `docs/superpowers/specs/2026-06-14-violema-agent-office-design.md`. Keep this file as implementation history only; do not use its left-side primary navigation guidance for new work.

---

### Task 1: Workspace Shell Navigation Model

**Files:**
- Create: `frontend/src/features/missions/workspaceShell.ts`

- [ ] **Step 1: Add area and tab types**

Create `workspaceShell.ts` with:

```ts
import MessageSquare from 'lucide-react/dist/esm/icons/message-square.js';
import CheckSquare from 'lucide-react/dist/esm/icons/check-square.js';
import Kanban from 'lucide-react/dist/esm/icons/kanban.js';
import Network from 'lucide-react/dist/esm/icons/network.js';
import Eye from 'lucide-react/dist/esm/icons/eye.js';
import CalendarDays from 'lucide-react/dist/esm/icons/calendar-days.js';
import CreditCard from 'lucide-react/dist/esm/icons/credit-card.js';
import Plug from 'lucide-react/dist/esm/icons/plug.js';
import Bot from 'lucide-react/dist/esm/icons/bot.js';

export type WorkspaceAreaId =
  | 'home'
  | 'missions'
  | 'board'
  | 'map'
  | 'reviews'
  | 'calendar'
  | 'analytics'
  | 'integrations'
  | 'advanced';

export type WorkspaceTabId =
  | 'chat'
  | 'activity'
  | 'overview'
  | 'agents'
  | 'steps'
  | 'evidence'
  | 'controls'
  | 'active'
  | 'waiting'
  | 'review'
  | 'done'
  | 'workflow'
  | 'tools'
  | 'mcp'
  | 'approvals'
  | 'outputs'
  | 'upcoming'
  | 'recurring'
  | 'history'
  | 'credits'
  | 'efficiency'
  | 'run-cost'
  | 'forecast'
  | 'core'
  | 'suites'
  | 'debug'
  | 'replay'
  | 'optimize';

export interface WorkspaceAreaConfig {
  id: WorkspaceAreaId;
  label: string;
  shortLabel: string;
  description: string;
  icon: typeof MessageSquare;
  defaultTab: WorkspaceTabId;
  tabs: Array<{ id: WorkspaceTabId; label: string }>;
}
```

- [ ] **Step 2: Add nav config and helpers**

In the same file, add:

```ts
export const WORKSPACE_AREAS: WorkspaceAreaConfig[] = [
  {
    id: 'home',
    label: 'Home / Chat',
    shortLabel: 'Chat',
    description: 'Command Violema and keep the current conversation clean.',
    icon: MessageSquare,
    defaultTab: 'chat',
    tabs: [
      { id: 'chat', label: 'Chat' },
      { id: 'activity', label: 'Activity' },
    ],
  },
  {
    id: 'missions',
    label: 'Missions',
    shortLabel: 'Missions',
    description: 'See the active automation as a mission with steps, agents, evidence, and controls.',
    icon: CheckSquare,
    defaultTab: 'overview',
    tabs: [
      { id: 'overview', label: 'Overview' },
      { id: 'agents', label: 'Agents' },
      { id: 'steps', label: 'Steps' },
      { id: 'evidence', label: 'Evidence' },
      { id: 'controls', label: 'Controls' },
    ],
  },
  {
    id: 'board',
    label: 'Board',
    shortLabel: 'Board',
    description: 'Manage mission work by status.',
    icon: Kanban,
    defaultTab: 'active',
    tabs: [
      { id: 'active', label: 'Active' },
      { id: 'waiting', label: 'Waiting' },
      { id: 'review', label: 'Review' },
      { id: 'done', label: 'Done' },
    ],
  },
  {
    id: 'map',
    label: 'Map',
    shortLabel: 'Map',
    description: 'Inspect workflow steps, tools, integrations, and future MCP connections.',
    icon: Network,
    defaultTab: 'workflow',
    tabs: [
      { id: 'workflow', label: 'Workflow' },
      { id: 'integrations', label: 'Integrations' },
      { id: 'tools', label: 'Tools' },
      { id: 'mcp', label: 'MCP' },
    ],
  },
  {
    id: 'reviews',
    label: 'Reviews',
    shortLabel: 'Reviews',
    description: 'Review outputs, approvals, and source-linked evidence.',
    icon: Eye,
    defaultTab: 'approvals',
    tabs: [
      { id: 'approvals', label: 'Approvals' },
      { id: 'evidence', label: 'Evidence' },
      { id: 'outputs', label: 'Outputs' },
    ],
  },
  {
    id: 'calendar',
    label: 'Calendar',
    shortLabel: 'Calendar',
    description: 'Schedule recurring work and review upcoming runs.',
    icon: CalendarDays,
    defaultTab: 'upcoming',
    tabs: [
      { id: 'upcoming', label: 'Upcoming' },
      { id: 'recurring', label: 'Recurring' },
      { id: 'history', label: 'History' },
    ],
  },
  {
    id: 'analytics',
    label: 'Analytics',
    shortLabel: 'Analytics',
    description: 'Understand credit use, efficiency, run cost, and forecast.',
    icon: CreditCard,
    defaultTab: 'credits',
    tabs: [
      { id: 'credits', label: 'Credits' },
      { id: 'efficiency', label: 'Efficiency' },
      { id: 'run-cost', label: 'Run cost' },
      { id: 'forecast', label: 'Forecast' },
    ],
  },
  {
    id: 'integrations',
    label: 'Integrations',
    shortLabel: 'Integrations',
    description: 'Connect the founder stack and prepare future suite/MCP expansion.',
    icon: Plug,
    defaultTab: 'core',
    tabs: [
      { id: 'core', label: 'Core' },
      { id: 'suites', label: 'Suites' },
      { id: 'mcp', label: 'MCP' },
    ],
  },
  {
    id: 'advanced',
    label: 'Advanced',
    shortLabel: 'Advanced',
    description: 'Open the deeper replay, optimization, and diagnostics layer.',
    icon: Bot,
    defaultTab: 'debug',
    tabs: [
      { id: 'debug', label: 'Debug' },
      { id: 'replay', label: 'Replay' },
      { id: 'optimize', label: 'Optimize' },
    ],
  },
];

export function getWorkspaceArea(id: WorkspaceAreaId) {
  return WORKSPACE_AREAS.find((area) => area.id === id) || WORKSPACE_AREAS[0];
}
```

- [ ] **Step 3: Validate types**

Run: `cd frontend && npm run build`

Expected: build passes or only exposes pre-existing unrelated errors.

### Task 2: Dashboard State and Side Menu

**Files:**
- Modify: `frontend/src/pages/Dashboard.tsx`

- [ ] **Step 1: Import the shell model**

Add imports:

```ts
import { WORKSPACE_AREAS, getWorkspaceArea, type WorkspaceAreaId, type WorkspaceTabId } from '../features/missions/workspaceShell';
```

- [ ] **Step 2: Add shell state**

Near existing workspace state, add:

```ts
const [workspaceArea, setWorkspaceArea] = useState<WorkspaceAreaId>('home');
const [workspaceTabs, setWorkspaceTabs] = useState<Record<WorkspaceAreaId, WorkspaceTabId>>(() => {
  const initial = {} as Record<WorkspaceAreaId, WorkspaceTabId>;
  WORKSPACE_AREAS.forEach((area) => {
    initial[area.id] = area.defaultTab;
  });
  return initial;
});
const activeWorkspaceArea = getWorkspaceArea(workspaceArea);
const activeWorkspaceTab = workspaceTabs[workspaceArea] || activeWorkspaceArea.defaultTab;
```

- [ ] **Step 3: Add switch helpers**

Add:

```ts
const selectWorkspaceArea = useCallback((areaId: WorkspaceAreaId) => {
  setWorkspaceArea(areaId);
  setTaskPanelOpen(false);
  if (areaId !== 'home') {
    setMissionWorkspaceOpen(false);
  }
  if (isMobileSidebar) setSidebarOpen(false);
  if (areaId === 'advanced') {
    navigate('/dashboard/agents');
  }
}, [isMobileSidebar, navigate]);

const selectWorkspaceTab = useCallback((tabId: WorkspaceTabId) => {
  setWorkspaceTabs((current) => ({
    ...current,
    [workspaceArea]: tabId,
  }));
}, [workspaceArea]);
```

If keeping Advanced inline for preview is preferred, do not navigate automatically; render the advanced teaser in Task 4 instead.

- [ ] **Step 4: Render side menu above conversations**

Inside the sidebar after the new conversation/mode block, render `WORKSPACE_AREAS` as compact nav buttons. Each item uses the configured icon and highlights `workspaceArea`.

### Task 3: Top Tabs and Center Rendering

**Files:**
- Modify: `frontend/src/pages/Dashboard.tsx`

- [ ] **Step 1: Replace header Mission/Advanced pills with top tabs**

Keep the conversation title/status, but render `activeWorkspaceArea.tabs` as horizontally scrollable top tabs.

- [ ] **Step 2: Keep an Inspector button**

Add a compact button:

```tsx
<button type="button" onClick={() => setMissionWorkspaceOpen((open) => !open)}>
  Inspector
</button>
```

This preserves the fold-in panel without making it the main navigation.

- [ ] **Step 3: Render center content by area**

Add a `renderWorkspaceMain()` helper:

```tsx
if (workspaceArea === 'home') return <ChatInterface ... />;
if (workspaceArea === 'missions') return <MissionOverview ... />;
if (workspaceArea === 'board') return <MissionBoard ... />;
if (workspaceArea === 'map') return <MissionMap ... />;
if (workspaceArea === 'reviews') return <MissionReviews ... />;
if (workspaceArea === 'calendar') return <MissionCalendar ... />;
if (workspaceArea === 'analytics') return <MissionAnalytics ... />;
if (workspaceArea === 'integrations') return <MissionIntegrationsStrip ... />;
return <Advanced workspace card with Open Advanced button />;
```

- [ ] **Step 4: Empty states stay honest**

If no `selectedTask`, non-chat areas show the existing no-active-mission card plus `Open schedule controls`.

### Task 4: Right Inspector Semantics

**Files:**
- Modify: `frontend/src/pages/Dashboard.tsx`
- Modify: `frontend/src/features/missions/MissionWorkspacePanel.tsx` only if naming needs to become "Inspector"

- [ ] **Step 1: Rename header CTA to Inspector**

Do not call the right drawer "Mission" in the top chrome. It is now the selected object inspector.

- [ ] **Step 2: Keep existing mission tabs inside inspector**

The inspector can keep its internal Mission/Agents/Board/Map/Reviews/Calendar/Analytics tabs for now. This is acceptable because it is an inspection surface, not the primary nav.

- [ ] **Step 3: Chat chip opens inspector**

Keep `ChatInterface` mission chip behavior, but it should be clear it opens context/inspector rather than switching the whole app.

### Task 5: Validation and Review

**Files:**
- Review: `frontend/src/pages/Dashboard.tsx`
- Review: `frontend/src/features/missions/workspaceShell.ts`

- [ ] **Step 1: Build**

Run: `cd frontend && npm run build`

Expected: success.

- [ ] **Step 2: Browser smoke**

Open: `http://localhost:5173/dashboard-preview`

Verify:
- Side menu shows Home/Chat, Missions, Board, Map, Reviews, Calendar, Analytics, Integrations, Advanced.
- Selecting each side menu item changes center content.
- Top tabs change with the selected menu item.
- Chat remains clean on Home/Chat.
- Inspector opens and closes.

- [ ] **Step 3: Subagent spec review**

Ask a subagent to verify the implementation matches this plan.

- [ ] **Step 4: Subagent quality review**

Ask a subagent to check layout risk, state safety, mobile behavior, and whether `Dashboard.tsx` became harder to maintain.
