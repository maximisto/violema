# Violema Agent Office MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first chat-first Agent Office MVP: a fold-in mission workspace that preserves Violema chat while surfacing mission steps, agents, scheduler/cadence, reviews, map, integrations, and credit analytics.

**Architecture:** Keep `Dashboard.tsx` as the app shell, but extract focused mission components under `frontend/src/features/missions/`. Reuse existing automation/task/run data already assembled in Dashboard instead of adding a new backend model in this pass. Keep Agent Studio data as an internal source for agent/state views, not as a user-facing Live/Replay/Optimize journey.

**Tech Stack:** React 18, TypeScript, Vite, Tailwind, existing Violema API endpoints, existing credit/task/scheduler models. No new dependency for the first MVP; React Flow can be introduced in a later map-building pass after the simple anatomy view proves useful.

---

## Scope

This plan implements the first working product slice from the approved spec:

- chat-first shell remains the default
- fold-in mission workspace replaces the current narrow "Schedules" panel framing
- scheduler and step editor stay first-class
- weekly founder operating brief is represented as the flagship mission/workflow pattern
- integrations are presented cleanly without user-facing readiness badges
- credit analytics explains value and waste, not only balance

This plan does not implement:

- full graph editing
- full email/calendar automation
- custom MCP hosting
- a new backend mission database model
- a separate Agent Studio product surface

## File Structure

- Create: `frontend/src/features/missions/types.ts`
  - Owns UI-facing mission types decoupled from `Dashboard.tsx`.
- Create: `frontend/src/features/missions/missionPresenter.ts`
  - Converts existing dashboard task/run/automation fields into mission workspace view models.
- Create: `frontend/src/features/missions/MissionWorkspacePanel.tsx`
  - Fold-in panel shell with mission tabs and compact rail behavior.
- Create: `frontend/src/features/missions/MissionOverview.tsx`
  - Mission progress, steps, active agents, and current agent summary.
- Create: `frontend/src/features/missions/MissionBoard.tsx`
  - Kanban-like view derived from existing task/run statuses.
- Create: `frontend/src/features/missions/MissionMap.tsx`
  - Lightweight visual anatomy of integrations -> agents -> review/delivery.
- Create: `frontend/src/features/missions/MissionReviews.tsx`
  - Review gates, evidence, draft/output, and delivery controls.
- Create: `frontend/src/features/missions/MissionCalendar.tsx`
  - Scheduler/cadence view using existing automation schedule fields.
- Create: `frontend/src/features/missions/MissionAnalytics.tsx`
  - Credit efficiency, saved-time estimate, artifacts, and waste indicators.
- Create: `frontend/src/features/missions/MissionIntegrationsStrip.tsx`
  - Elegant integration logo/label strip without public status badges.
- Modify: `frontend/src/pages/Dashboard.tsx`
  - Replace task panel framing with mission workspace framing while preserving automation editor and task actions.
- Modify: `frontend/src/components/ChatInterface.tsx`
  - Add optional mission-aware header/context props without changing the default chat behavior.
- Modify: `frontend/src/lib/credits.ts`
  - Add lightweight utility functions for credit efficiency view models if needed by `MissionAnalytics`.

## Task 1: Mission View Model Foundation

**Files:**
- Create: `frontend/src/features/missions/types.ts`
- Create: `frontend/src/features/missions/missionPresenter.ts`
- Modify: `frontend/src/pages/Dashboard.tsx`

- [ ] **Step 1: Add mission UI types**

Create `frontend/src/features/missions/types.ts`:

```ts
export type MissionWorkspaceTab =
  | 'mission'
  | 'agents'
  | 'board'
  | 'map'
  | 'reviews'
  | 'calendar'
  | 'analytics';

export type MissionStatus =
  | 'planned'
  | 'running'
  | 'waiting_review'
  | 'failed'
  | 'completed'
  | 'paused';

export interface MissionStepView {
  id: string;
  title: string;
  objective: string;
  kind: string;
  status: MissionStatus;
  agentLabel: string;
  toolLabel?: string;
  estimatedCredits?: number;
  actualCredits?: number;
  summary?: string;
  error?: string;
}

export interface MissionAgentView {
  id: string;
  label: string;
  avatarLabel: string;
  role: string;
  status: 'done' | 'working' | 'queued' | 'waiting' | 'review' | 'ready';
  detail: string;
  creditsLabel?: string;
  sourceLabel?: string;
}

export interface MissionEvidenceItem {
  id: string;
  label: string;
  source: string;
  detail: string;
}

export interface MissionMetricView {
  label: string;
  value: string;
  detail: string;
  tone: 'violet' | 'cyan' | 'green' | 'amber' | 'slate';
}

export interface MissionIntegrationView {
  id: string;
  label: string;
  shortLabel: string;
  category: string;
}

export interface MissionWorkspaceView {
  id: string;
  title: string;
  description: string;
  status: MissionStatus;
  statusLabel: string;
  nextRunLabel: string;
  lastRunLabel: string;
  scheduleLabel: string;
  deliveryLabel: string;
  activeAgentId?: string;
  steps: MissionStepView[];
  agents: MissionAgentView[];
  evidence: MissionEvidenceItem[];
  metrics: MissionMetricView[];
  integrations: MissionIntegrationView[];
  reviewSummary: string;
  analyticsSummary: string;
}
```

- [ ] **Step 2: Add presenter input and default helpers**

Create `frontend/src/features/missions/missionPresenter.ts`:

```ts
import type {
  MissionAgentView,
  MissionEvidenceItem,
  MissionIntegrationView,
  MissionMetricView,
  MissionStatus,
  MissionStepView,
  MissionWorkspaceView,
} from './types';

export interface MissionSourceStep {
  id: string;
  kind: string;
  title?: string;
  objective?: string;
  status?: string;
  assignedRole?: string;
  modelTier?: string;
  toolName?: string;
  estimatedCredits?: number;
  actualCredits?: number;
  summary?: string;
  error?: string;
}

export interface MissionSourceAgent {
  role: string;
  label?: string;
  status?: string;
  summary?: string;
  reason?: string;
  modelLabel?: string;
}

export interface MissionSourceTask {
  id: string;
  title: string;
  description?: string;
  status?: string;
  runStatus?: string;
  lastRunStatus?: string;
  automationStatus?: string;
  schedule?: string;
  time?: string;
  notify?: string;
  nextRunAt?: string;
  lastRunAt?: string;
  estimatedCredits?: number;
  actualCredits?: number;
  latestSummary?: string;
  failureReason?: string;
  latestArtifacts?: Array<{ id?: string; title?: string; kind?: string; source?: string; summary?: string }>;
  latestStepExecutions?: MissionSourceStep[];
  steps?: MissionSourceStep[];
  workerTopology?: { summary?: string; workers?: MissionSourceAgent[] };
}

export function normalizeMissionStatus(task?: MissionSourceTask): MissionStatus {
  if (!task) return 'planned';
  if (task.automationStatus === 'paused') return 'paused';
  const status = task.runStatus || task.lastRunStatus || task.status || 'planned';
  if (status === 'running' || status === 'retrying') return 'running';
  if (status === 'waiting_review') return 'waiting_review';
  if (status === 'failed' || status === 'alert') return 'failed';
  if (status === 'succeeded' || status === 'complete' || status === 'completed') return 'completed';
  return 'planned';
}

function statusLabel(status: MissionStatus) {
  switch (status) {
    case 'running':
      return 'Running';
    case 'waiting_review':
      return 'Needs review';
    case 'failed':
      return 'Needs attention';
    case 'completed':
      return 'Completed';
    case 'paused':
      return 'Paused';
    default:
      return 'Planned';
  }
}

function normalizeStepStatus(value?: string): MissionStatus {
  if (value === 'running') return 'running';
  if (value === 'failed') return 'failed';
  if (value === 'succeeded' || value === 'completed') return 'completed';
  if (value === 'waiting_review') return 'waiting_review';
  if (value === 'skipped') return 'paused';
  return 'planned';
}

function roleLabel(role?: string) {
  if (!role) return 'Violema';
  return role
    .split(/[_-]/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function avatarLabel(label: string) {
  return label
    .split(' ')
    .filter(Boolean)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() || 'V';
}

function formatCredits(value?: number) {
  if (!value || value <= 0) return undefined;
  return `${Math.round(value)} cr`;
}

function buildSteps(task?: MissionSourceTask): MissionStepView[] {
  const sourceSteps = task?.latestStepExecutions?.length
    ? task.latestStepExecutions
    : task?.steps || [];

  if (sourceSteps.length > 0) {
    return sourceSteps.map((step, index) => {
      const agentLabel = roleLabel(step.assignedRole);
      return {
        id: step.id || `step-${index + 1}`,
        title: step.title || step.objective || `Step ${index + 1}`,
        objective: step.objective || step.title || 'Complete this mission step.',
        kind: step.kind || 'note',
        status: normalizeStepStatus(step.status),
        agentLabel,
        toolLabel: step.toolName,
        estimatedCredits: step.estimatedCredits,
        actualCredits: step.actualCredits,
        summary: step.summary,
        error: step.error,
      };
    });
  }

  return [
    { id: 'plan', title: 'Plan', objective: 'Split the mission into clear work lanes.', kind: 'note', status: 'completed', agentLabel: 'Violema Manager' },
    { id: 'staff', title: 'Staff', objective: 'Assign the right agent roles and tools.', kind: 'note', status: 'completed', agentLabel: 'Violema Manager' },
    { id: 'collect', title: 'Collect', objective: 'Gather connected workspace signals.', kind: 'query', status: normalizeMissionStatus(task) === 'running' ? 'running' : 'planned', agentLabel: 'Analyst' },
    { id: 'draft', title: 'Draft', objective: 'Prepare the founder-ready output.', kind: 'summarize', status: 'planned', agentLabel: 'Writer' },
    { id: 'review', title: 'Review', objective: 'Check evidence and approval gates.', kind: 'analyze', status: 'planned', agentLabel: 'Reviewer' },
    { id: 'deliver', title: 'Deliver', objective: 'Send the approved output.', kind: 'deliver', status: 'planned', agentLabel: 'Messenger' },
  ];
}

function buildAgents(task: MissionSourceTask | undefined, steps: MissionStepView[]): MissionAgentView[] {
  const workers = task?.workerTopology?.workers || [];
  if (workers.length > 0) {
    return workers.slice(0, 8).map((worker) => {
      const label = worker.label || roleLabel(worker.role);
      const workingStep = steps.find((step) => step.agentLabel === label && step.status === 'running');
      return {
        id: worker.role,
        label,
        avatarLabel: avatarLabel(label),
        role: worker.role,
        status: workingStep ? 'working' : worker.status === 'active' ? 'ready' : 'waiting',
        detail: worker.summary || worker.reason || 'Ready for mission work.',
        sourceLabel: worker.modelLabel,
      };
    });
  }

  return [
    { id: 'manager', label: 'Violema Manager', avatarLabel: 'V', role: 'manager', status: 'done', detail: 'Owns the mission plan and handoffs.' },
    { id: 'researcher', label: 'Researcher', avatarLabel: 'R', role: 'researcher', status: 'queued', detail: 'Finds market and workspace context.' },
    { id: 'analyst', label: 'Analyst', avatarLabel: 'A', role: 'analyst', status: normalizeMissionStatus(task) === 'running' ? 'working' : 'queued', detail: 'Compares revenue, product, and risk signals.' },
    { id: 'builder', label: 'Builder', avatarLabel: 'B', role: 'builder', status: 'queued', detail: 'Turns shipped work into clear operational notes.' },
    { id: 'writer', label: 'Writer', avatarLabel: 'W', role: 'writer', status: 'waiting', detail: 'Drafts founder-ready artifacts.' },
    { id: 'reviewer', label: 'Reviewer', avatarLabel: 'R', role: 'reviewer', status: 'review', detail: 'Checks evidence and holds sensitive delivery.' },
    { id: 'messenger', label: 'Messenger', avatarLabel: 'M', role: 'messenger', status: 'ready', detail: 'Prepares Slack and email delivery.' },
  ];
}

function buildEvidence(task?: MissionSourceTask): MissionEvidenceItem[] {
  const artifacts = task?.latestArtifacts || [];
  if (artifacts.length > 0) {
    return artifacts.slice(0, 6).map((artifact, index) => ({
      id: artifact.id || `artifact-${index + 1}`,
      label: artifact.title || artifact.kind || `Artifact ${index + 1}`,
      source: artifact.source || artifact.kind || 'Run artifact',
      detail: artifact.summary || 'Generated during the latest run.',
    }));
  }

  return [
    { id: 'stripe', label: 'Stripe', source: 'Revenue', detail: 'Revenue, churn, failed payments, and subscription changes.' },
    { id: 'github', label: 'GitHub', source: 'Build', detail: 'Merged pull requests, blockers, and shipped work.' },
    { id: 'slack', label: 'Slack', source: 'Team', detail: 'Review channel, team notes, and delivery target.' },
  ];
}

function buildMetrics(task: MissionSourceTask | undefined, steps: MissionStepView[]): MissionMetricView[] {
  const actualCredits = task?.actualCredits || steps.reduce((sum, step) => sum + (step.actualCredits || 0), 0);
  const estimatedCredits = task?.estimatedCredits || steps.reduce((sum, step) => sum + (step.estimatedCredits || 0), 0) || 38;
  const credits = actualCredits || estimatedCredits;
  const completedSteps = steps.filter((step) => step.status === 'completed').length;
  const failedSteps = steps.filter((step) => step.status === 'failed').length;
  const artifactCount = Math.max(1, task?.latestArtifacts?.length || completedSteps || 1);
  const creditsPerArtifact = Math.max(1, Math.round(credits / artifactCount));

  return [
    { label: 'Credits', value: String(Math.round(credits)), detail: actualCredits ? 'actual run cost' : 'estimated run cost', tone: 'violet' },
    { label: 'Artifacts', value: String(artifactCount), detail: 'useful outputs expected', tone: 'cyan' },
    { label: 'Efficiency', value: `${creditsPerArtifact} cr`, detail: 'per useful artifact', tone: creditsPerArtifact <= 10 ? 'green' : 'amber' },
    { label: 'Waste', value: failedSteps > 0 ? 'Watch' : 'Low', detail: failedSteps > 0 ? `${failedSteps} failed step${failedSteps === 1 ? '' : 's'}` : 'no failed loop detected', tone: failedSteps > 0 ? 'amber' : 'green' },
  ];
}

export const CORE_MISSION_INTEGRATIONS: MissionIntegrationView[] = [
  { id: 'slack', label: 'Slack', shortLabel: 'SL', category: 'Review and delivery' },
  { id: 'stripe', label: 'Stripe', shortLabel: 'ST', category: 'Revenue signal' },
  { id: 'github', label: 'GitHub', shortLabel: 'GH', category: 'Build signal' },
  { id: 'gmail', label: 'Gmail', shortLabel: 'GM', category: 'Email' },
  { id: 'google-calendar', label: 'Google Calendar', shortLabel: 'GC', category: 'Calendar' },
  { id: 'outlook', label: 'Outlook', shortLabel: 'OL', category: 'Email' },
  { id: 'microsoft-teams', label: 'Microsoft Teams', shortLabel: 'MT', category: 'Team' },
];

export function buildMissionWorkspaceView(task?: MissionSourceTask): MissionWorkspaceView {
  const status = normalizeMissionStatus(task);
  const steps = buildSteps(task);
  const agents = buildAgents(task, steps);
  const activeAgent = agents.find((agent) => agent.status === 'working') || agents[0];
  const evidence = buildEvidence(task);
  const metrics = buildMetrics(task, steps);
  const title = task?.title || 'Weekly founder operating brief';

  return {
    id: task?.id || 'weekly-founder-brief',
    title,
    description: task?.description || 'Collect revenue, product, and team signals into a reviewed founder-ready operating brief.',
    status,
    statusLabel: statusLabel(status),
    nextRunLabel: task?.nextRunAt || task?.schedule || task?.time || 'Not scheduled',
    lastRunLabel: task?.lastRunAt || 'No completed run yet',
    scheduleLabel: task?.schedule || task?.time || 'Manual run',
    deliveryLabel: task?.notify || 'Review before delivery',
    activeAgentId: activeAgent?.id,
    steps,
    agents,
    evidence,
    metrics,
    integrations: CORE_MISSION_INTEGRATIONS,
    reviewSummary: task?.failureReason || task?.latestSummary || 'Reviewer will hold sensitive claims and delivery until evidence is attached.',
    analyticsSummary: `This mission is estimated at ${metrics[0].value} credits with ${metrics[2].value} per useful artifact.`,
  };
}
```

- [ ] **Step 3: Import the presenter in Dashboard**

Modify `frontend/src/pages/Dashboard.tsx` near the existing imports:

```ts
import { buildMissionWorkspaceView } from '../features/missions/missionPresenter';
import type { MissionWorkspaceTab } from '../features/missions/types';
```

- [ ] **Step 4: Add mission workspace state in Dashboard**

In `frontend/src/pages/Dashboard.tsx`, near the existing `taskPanelOpen` state, add:

```ts
  const [missionWorkspaceOpen, setMissionWorkspaceOpen] = useState(false);
  const [missionWorkspaceTab, setMissionWorkspaceTab] = useState<MissionWorkspaceTab>('mission');
```

- [ ] **Step 5: Derive selected mission view in Dashboard**

After `selectedTask` is defined in `frontend/src/pages/Dashboard.tsx`, add:

```ts
  const selectedMission = useMemo(
    () => buildMissionWorkspaceView(selectedTask),
    [selectedTask],
  );
```

- [ ] **Step 6: Run frontend build**

Run:

```bash
cd /Users/maximisto/Documents/New\ project/frontend
npm run build
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
cd /Users/maximisto/Documents/New\ project
git add frontend/src/features/missions/types.ts frontend/src/features/missions/missionPresenter.ts frontend/src/pages/Dashboard.tsx
git commit -m "feat(missions): add mission workspace presenter"
```

## Task 2: Mission Workspace Panel Shell

**Files:**
- Create: `frontend/src/features/missions/MissionWorkspacePanel.tsx`
- Modify: `frontend/src/pages/Dashboard.tsx`

- [ ] **Step 1: Add the fold-in workspace shell component**

Create `frontend/src/features/missions/MissionWorkspacePanel.tsx`:

```tsx
import X from 'lucide-react/dist/esm/icons/x.js';
import PanelRightClose from 'lucide-react/dist/esm/icons/panel-right-close.js';
import type { MissionWorkspaceTab, MissionWorkspaceView } from './types';

interface MissionWorkspacePanelProps {
  mission: MissionWorkspaceView;
  activeTab: MissionWorkspaceTab;
  onTabChange(tab: MissionWorkspaceTab): void;
  onClose(): void;
  children: React.ReactNode;
}

const TABS: Array<{ id: MissionWorkspaceTab; label: string }> = [
  { id: 'mission', label: 'Mission' },
  { id: 'agents', label: 'Agents' },
  { id: 'board', label: 'Board' },
  { id: 'map', label: 'Map' },
  { id: 'reviews', label: 'Reviews' },
  { id: 'calendar', label: 'Calendar' },
  { id: 'analytics', label: 'Analytics' },
];

export function MissionWorkspacePanel({
  mission,
  activeTab,
  onTabChange,
  onClose,
  children,
}: MissionWorkspacePanelProps) {
  return (
    <aside className="flex min-h-0 w-full flex-col overflow-hidden border-l border-navy-800/80 bg-gradient-to-b from-navy-900/72 via-navy-900/46 to-navy-950/78 backdrop-blur-md lg:w-[30rem] xl:w-[34rem]">
      <div className="flex items-start justify-between gap-3 border-b border-navy-800/80 bg-gradient-to-r from-violet-500/8 via-navy-950/34 to-cyan-500/6 px-4 py-3.5">
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-[0.22em] text-slate-600">Mission workspace</p>
          <h2 className="mt-1 truncate text-sm font-semibold text-white">{mission.title}</h2>
          <p className="mt-1 truncate text-[11px] text-slate-500">{mission.statusLabel} · {mission.scheduleLabel}</p>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-navy-900/70 hover:text-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
            aria-label="Fold mission workspace"
          >
            <PanelRightClose className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-navy-900/70 hover:text-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
            aria-label="Close mission workspace"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="scrollbar-thin flex gap-1 overflow-x-auto border-b border-navy-800/70 px-3 py-2">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => onTabChange(tab.id)}
            className={`rounded-full border px-3 py-1.5 text-[11px] font-medium transition-colors ${
              activeTab === tab.id
                ? 'border-violet-500/30 bg-violet-500/14 text-violet-100'
                : 'border-transparent text-slate-500 hover:bg-navy-900/70 hover:text-slate-200'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="panel-scroll min-h-0 flex-1 overflow-y-auto px-3 py-3">
        {children}
      </div>
    </aside>
  );
}
```

- [ ] **Step 2: Import the panel in Dashboard**

Modify `frontend/src/pages/Dashboard.tsx` imports:

```ts
import { MissionWorkspacePanel } from '../features/missions/MissionWorkspacePanel';
```

- [ ] **Step 3: Rename top-bar task toggle label to Mission**

In `frontend/src/pages/Dashboard.tsx`, replace the existing "Schedules" toggle button behavior:

```tsx
          <button
            onClick={() => {
              setMissionWorkspaceOpen((value) => !value);
              setTaskPanelOpen(false);
            }}
            aria-pressed={missionWorkspaceOpen}
            aria-label="Toggle mission workspace"
            className={`hidden sm:flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 ${
              missionWorkspaceOpen
                ? 'bg-violet-900/30 border-violet-700/50 text-violet-300 shadow-sm'
                : 'bg-navy-800/80 border-navy-700 text-slate-400 hover:text-slate-200'
            }`}
          >
            <CheckSquare className="w-3.5 h-3.5" />
            <span className="hidden lg:inline">Mission</span>
          </button>
```

- [ ] **Step 4: Render the panel next to chat**

In `frontend/src/pages/Dashboard.tsx`, inside the chat body where the task panel currently renders, add this before the old task panel block:

```tsx
          {missionWorkspaceOpen && (
            <MissionWorkspacePanel
              mission={selectedMission}
              activeTab={missionWorkspaceTab}
              onTabChange={setMissionWorkspaceTab}
              onClose={() => setMissionWorkspaceOpen(false)}
            >
              <div className="rounded-2xl border border-navy-700/70 bg-navy-950/35 p-4">
                <p className="text-[10px] uppercase tracking-[0.22em] text-violet-300/80">Selected mission</p>
                <h3 className="mt-1 text-sm font-semibold text-white">{selectedMission.title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-400">{selectedMission.description}</p>
              </div>
            </MissionWorkspacePanel>
          )}
```

- [ ] **Step 5: Keep the old task panel closed by default**

In `frontend/src/pages/Dashboard.tsx`, do not delete the old `taskPanelOpen` path yet. Ensure both panels are not open together by changing the old task panel toggle to:

```ts
setTaskPanelOpen((value) => {
  const next = !value;
  if (next) setMissionWorkspaceOpen(false);
  return next;
});
```

- [ ] **Step 6: Run frontend build**

```bash
cd /Users/maximisto/Documents/New\ project/frontend
npm run build
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
cd /Users/maximisto/Documents/New\ project
git add frontend/src/features/missions/MissionWorkspacePanel.tsx frontend/src/pages/Dashboard.tsx
git commit -m "feat(ui): add fold-in mission workspace shell"
```

## Task 3: Mission Overview And Agent Floor

**Files:**
- Create: `frontend/src/features/missions/MissionOverview.tsx`
- Modify: `frontend/src/pages/Dashboard.tsx`

- [ ] **Step 1: Add mission overview component**

Create `frontend/src/features/missions/MissionOverview.tsx`:

```tsx
import type { MissionWorkspaceView } from './types';

function statusClass(status: string) {
  if (status === 'completed' || status === 'done') return 'border-green-500/20 bg-green-500/10 text-green-200';
  if (status === 'running' || status === 'working') return 'border-cyan-500/20 bg-cyan-500/10 text-cyan-200';
  if (status === 'failed') return 'border-red-500/20 bg-red-500/10 text-red-200';
  if (status === 'review' || status === 'waiting_review') return 'border-amber-500/20 bg-amber-500/10 text-amber-200';
  return 'border-navy-700 bg-navy-900/60 text-slate-400';
}

export function MissionOverview({ mission }: { mission: MissionWorkspaceView }) {
  const activeAgent = mission.agents.find((agent) => agent.id === mission.activeAgentId) || mission.agents[0];

  return (
    <div className="space-y-3">
      <section className="rounded-2xl border border-navy-700/70 bg-navy-950/35 p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] uppercase tracking-[0.22em] text-violet-300/80">Mission</p>
            <h3 className="mt-1 text-base font-semibold text-white">{mission.title}</h3>
            <p className="mt-2 text-sm leading-6 text-slate-400">{mission.description}</p>
          </div>
          <span className={`rounded-full border px-2.5 py-1 text-[10px] font-medium ${statusClass(mission.status)}`}>
            {mission.statusLabel}
          </span>
        </div>
      </section>

      <section className="grid grid-cols-3 gap-2">
        <div className="rounded-2xl border border-navy-700/70 bg-navy-950/35 p-3">
          <p className="text-[10px] uppercase tracking-[0.18em] text-slate-600">Next run</p>
          <p className="mt-1 text-sm font-medium text-white">{mission.nextRunLabel}</p>
        </div>
        <div className="rounded-2xl border border-navy-700/70 bg-navy-950/35 p-3">
          <p className="text-[10px] uppercase tracking-[0.18em] text-slate-600">Delivery</p>
          <p className="mt-1 text-sm font-medium text-white">{mission.deliveryLabel}</p>
        </div>
        <div className="rounded-2xl border border-navy-700/70 bg-navy-950/35 p-3">
          <p className="text-[10px] uppercase tracking-[0.18em] text-slate-600">Last run</p>
          <p className="mt-1 text-sm font-medium text-white">{mission.lastRunLabel}</p>
        </div>
      </section>

      <section className="rounded-2xl border border-navy-700/70 bg-navy-950/35 p-4">
        <div className="flex items-center justify-between">
          <p className="text-[10px] uppercase tracking-[0.22em] text-slate-600">Mission plan</p>
          <span className="text-[11px] text-slate-500">{mission.steps.length} steps</span>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          {mission.steps.map((step, index) => (
            <div key={step.id} className={`rounded-2xl border p-3 ${statusClass(step.status)}`}>
              <p className="text-[10px] uppercase tracking-[0.16em] opacity-75">Step {index + 1}</p>
              <h4 className="mt-1 text-sm font-semibold text-white">{step.title}</h4>
              <p className="mt-1 text-[11px] leading-5 opacity-80">{step.agentLabel}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-navy-700/70 bg-navy-950/35 p-4">
        <div className="flex items-center justify-between">
          <p className="text-[10px] uppercase tracking-[0.22em] text-slate-600">Agent floor</p>
          {activeAgent ? <span className="text-[11px] text-cyan-300">{activeAgent.label} active</span> : null}
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          {mission.agents.map((agent) => (
            <article
              key={agent.id}
              className={`rounded-2xl border p-3 ${
                agent.id === mission.activeAgentId
                  ? 'border-violet-500/30 bg-violet-500/12'
                  : 'border-navy-700/70 bg-navy-950/35'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-cyan-300 text-xs font-bold text-navy-950">
                  {agent.avatarLabel}
                </div>
                <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${statusClass(agent.status)}`}>
                  {agent.status}
                </span>
              </div>
              <h4 className="mt-3 text-sm font-semibold text-white">{agent.label}</h4>
              <p className="mt-1 text-[11px] leading-5 text-slate-400">{agent.detail}</p>
              {agent.sourceLabel ? <p className="mt-2 text-[10px] text-slate-600">{agent.sourceLabel}</p> : null}
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
```

- [ ] **Step 2: Render MissionOverview for mission and agents tabs**

Modify `frontend/src/pages/Dashboard.tsx` imports:

```ts
import { MissionOverview } from '../features/missions/MissionOverview';
```

Inside `MissionWorkspacePanel`, replace the temporary selected mission block:

```tsx
              {(missionWorkspaceTab === 'mission' || missionWorkspaceTab === 'agents') && (
                <MissionOverview mission={selectedMission} />
              )}
```

- [ ] **Step 3: Run frontend build**

```bash
cd /Users/maximisto/Documents/New\ project/frontend
npm run build
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
cd /Users/maximisto/Documents/New\ project
git add frontend/src/features/missions/MissionOverview.tsx frontend/src/pages/Dashboard.tsx
git commit -m "feat(missions): show mission overview and agent floor"
```

## Task 4: Board, Reviews, Calendar, And Map Tabs

**Files:**
- Create: `frontend/src/features/missions/MissionBoard.tsx`
- Create: `frontend/src/features/missions/MissionReviews.tsx`
- Create: `frontend/src/features/missions/MissionCalendar.tsx`
- Create: `frontend/src/features/missions/MissionMap.tsx`
- Modify: `frontend/src/pages/Dashboard.tsx`

- [ ] **Step 1: Add Board tab**

Create `frontend/src/features/missions/MissionBoard.tsx`:

```tsx
import type { MissionWorkspaceView, MissionStatus } from './types';

const COLUMNS: Array<{ id: MissionStatus | 'follow_up'; label: string }> = [
  { id: 'planned', label: 'Planned' },
  { id: 'running', label: 'Running' },
  { id: 'waiting_review', label: 'Review' },
  { id: 'failed', label: 'Needs attention' },
  { id: 'completed', label: 'Done' },
  { id: 'follow_up', label: 'Follow-up' },
];

export function MissionBoard({ mission }: { mission: MissionWorkspaceView }) {
  return (
    <div className="grid gap-3">
      {COLUMNS.map((column) => {
        const items = column.id === 'follow_up'
          ? mission.evidence.slice(0, 2).map((item) => ({ id: item.id, title: item.label, detail: item.detail }))
          : mission.steps
              .filter((step) => step.status === column.id)
              .map((step) => ({ id: step.id, title: step.title, detail: step.objective }));

        return (
          <section key={column.id} className="rounded-2xl border border-navy-700/70 bg-navy-950/35 p-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white">{column.label}</h3>
              <span className="rounded-full border border-navy-700 bg-navy-900/70 px-2 py-0.5 text-[10px] text-slate-400">{items.length}</span>
            </div>
            <div className="mt-3 space-y-2">
              {items.length > 0 ? items.map((item) => (
                <article key={item.id} className="rounded-xl border border-navy-700/60 bg-navy-900/45 p-3">
                  <h4 className="text-sm font-medium text-white">{item.title}</h4>
                  <p className="mt-1 text-[11px] leading-5 text-slate-500">{item.detail}</p>
                </article>
              )) : (
                <p className="rounded-xl border border-dashed border-navy-700/70 bg-navy-950/20 p-3 text-[11px] text-slate-600">
                  No mission work in this lane.
                </p>
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Add Reviews tab**

Create `frontend/src/features/missions/MissionReviews.tsx`:

```tsx
import type { MissionWorkspaceView } from './types';

export function MissionReviews({ mission }: { mission: MissionWorkspaceView }) {
  return (
    <div className="space-y-3">
      <section className="rounded-2xl border border-amber-500/18 bg-amber-500/8 p-4">
        <p className="text-[10px] uppercase tracking-[0.22em] text-amber-200/80">Review gate</p>
        <h3 className="mt-1 text-base font-semibold text-white">Approval before delivery</h3>
        <p className="mt-2 text-sm leading-6 text-slate-300">{mission.reviewSummary}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" className="rounded-xl bg-violet-600 px-3 py-2 text-xs font-medium text-white shadow-glow-violet">
            Approve delivery
          </button>
          <button type="button" className="rounded-xl border border-navy-700 bg-navy-900/70 px-3 py-2 text-xs font-medium text-slate-300">
            Request changes
          </button>
          <button type="button" className="rounded-xl border border-navy-700 bg-navy-900/70 px-3 py-2 text-xs font-medium text-slate-300">
            Rerun failed step
          </button>
        </div>
      </section>

      <section className="rounded-2xl border border-navy-700/70 bg-navy-950/35 p-4">
        <p className="text-[10px] uppercase tracking-[0.22em] text-slate-600">Evidence</p>
        <div className="mt-3 space-y-2">
          {mission.evidence.map((item) => (
            <article key={item.id} className="grid grid-cols-[2rem_1fr] gap-3 rounded-xl border border-navy-700/60 bg-navy-900/45 p-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-navy-800 text-[10px] font-bold text-cyan-300">
                {item.label.slice(0, 2).toUpperCase()}
              </div>
              <div>
                <h4 className="text-sm font-medium text-white">{item.label}</h4>
                <p className="mt-1 text-[11px] leading-5 text-slate-500">{item.detail}</p>
                <p className="mt-1 text-[10px] uppercase tracking-[0.16em] text-slate-700">{item.source}</p>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
```

- [ ] **Step 3: Add Calendar tab**

Create `frontend/src/features/missions/MissionCalendar.tsx`:

```tsx
import Clock3 from 'lucide-react/dist/esm/icons/clock-3.js';
import CalendarDays from 'lucide-react/dist/esm/icons/calendar-days.js';
import Play from 'lucide-react/dist/esm/icons/play.js';
import Pause from 'lucide-react/dist/esm/icons/pause.js';
import type { MissionWorkspaceView } from './types';

interface MissionCalendarProps {
  mission: MissionWorkspaceView;
  onRunNow(): void;
  onPauseToggle(): void;
}

export function MissionCalendar({ mission, onRunNow, onPauseToggle }: MissionCalendarProps) {
  return (
    <div className="space-y-3">
      <section className="rounded-2xl border border-navy-700/70 bg-navy-950/35 p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] uppercase tracking-[0.22em] text-slate-600">Cadence</p>
            <h3 className="mt-1 text-base font-semibold text-white">{mission.scheduleLabel}</h3>
            <p className="mt-2 text-sm leading-6 text-slate-400">Next run: {mission.nextRunLabel}</p>
          </div>
          <CalendarDays className="h-5 w-5 text-violet-300" />
        </div>
      </section>

      <section className="grid grid-cols-2 gap-2">
        <button type="button" onClick={onRunNow} className="rounded-2xl border border-violet-500/25 bg-violet-500/12 p-4 text-left text-violet-100">
          <Play className="mb-3 h-4 w-4" />
          <span className="block text-sm font-semibold">Run once now</span>
          <span className="mt-1 block text-[11px] text-violet-100/70">Save cadence and trigger a fresh mission run.</span>
        </button>
        <button type="button" onClick={onPauseToggle} className="rounded-2xl border border-navy-700 bg-navy-950/35 p-4 text-left text-slate-300">
          <Pause className="mb-3 h-4 w-4" />
          <span className="block text-sm font-semibold">{mission.status === 'paused' ? 'Resume cadence' : 'Pause cadence'}</span>
          <span className="mt-1 block text-[11px] text-slate-500">Keep the workflow saved while changing its schedule state.</span>
        </button>
      </section>

      <section className="rounded-2xl border border-navy-700/70 bg-navy-950/35 p-4">
        <div className="flex items-center gap-2">
          <Clock3 className="h-4 w-4 text-cyan-300" />
          <p className="text-sm font-medium text-white">Monthly burn estimate</p>
        </div>
        <p className="mt-2 text-sm leading-6 text-slate-400">{mission.analyticsSummary}</p>
      </section>
    </div>
  );
}
```

- [ ] **Step 4: Add Map tab**

Create `frontend/src/features/missions/MissionMap.tsx`:

```tsx
import type { MissionWorkspaceView } from './types';

export function MissionMap({ mission }: { mission: MissionWorkspaceView }) {
  const reviewNode = mission.steps.find((step) => step.kind === 'analyze') || mission.steps[mission.steps.length - 2];
  const deliveryNode = mission.steps.find((step) => step.kind === 'deliver') || mission.steps[mission.steps.length - 1];

  return (
    <div className="space-y-3">
      <section className="rounded-2xl border border-navy-700/70 bg-navy-950/35 p-4">
        <p className="text-[10px] uppercase tracking-[0.22em] text-slate-600">Workflow anatomy</p>
        <h3 className="mt-1 text-base font-semibold text-white">Signals -> agents -> review -> delivery</h3>
        <div className="mt-4 space-y-3">
          {mission.integrations.slice(0, 5).map((integration, index) => {
            const agent = mission.agents[index % mission.agents.length];
            return (
              <div key={integration.id} className="grid grid-cols-[5.5rem_1fr_6.5rem] items-center gap-2">
                <div className="rounded-xl border border-navy-700 bg-navy-900/70 px-3 py-2 text-center text-xs font-medium text-white">
                  {integration.label}
                </div>
                <div className="h-px bg-gradient-to-r from-violet-500/30 to-cyan-300/70" />
                <div className="rounded-xl border border-navy-700 bg-navy-900/70 px-3 py-2 text-center text-xs font-medium text-cyan-100">
                  {agent?.label || 'Violema'}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="grid grid-cols-2 gap-2">
        <div className="rounded-2xl border border-amber-500/18 bg-amber-500/8 p-3">
          <p className="text-[10px] uppercase tracking-[0.18em] text-amber-200/80">Review gate</p>
          <h4 className="mt-1 text-sm font-semibold text-white">{reviewNode?.title || 'Review'}</h4>
        </div>
        <div className="rounded-2xl border border-green-500/18 bg-green-500/8 p-3">
          <p className="text-[10px] uppercase tracking-[0.18em] text-green-200/80">Delivery</p>
          <h4 className="mt-1 text-sm font-semibold text-white">{deliveryNode?.title || 'Deliver'}</h4>
        </div>
      </section>
    </div>
  );
}
```

- [ ] **Step 5: Wire tabs in Dashboard**

Modify `frontend/src/pages/Dashboard.tsx` imports:

```ts
import { MissionBoard } from '../features/missions/MissionBoard';
import { MissionCalendar } from '../features/missions/MissionCalendar';
import { MissionMap } from '../features/missions/MissionMap';
import { MissionReviews } from '../features/missions/MissionReviews';
```

Inside `MissionWorkspacePanel`, render:

```tsx
              {(missionWorkspaceTab === 'mission' || missionWorkspaceTab === 'agents') && (
                <MissionOverview mission={selectedMission} />
              )}
              {missionWorkspaceTab === 'board' && (
                <MissionBoard mission={selectedMission} />
              )}
              {missionWorkspaceTab === 'map' && (
                <MissionMap mission={selectedMission} />
              )}
              {missionWorkspaceTab === 'reviews' && (
                <MissionReviews mission={selectedMission} />
              )}
              {missionWorkspaceTab === 'calendar' && (
                <MissionCalendar
                  mission={selectedMission}
                  onRunNow={() => { void handleAutomationRun(selectedTask); }}
                  onPauseToggle={() => { void handleAutomationPauseToggle(selectedTask); }}
                />
              )}
```

- [ ] **Step 6: Run frontend build**

```bash
cd /Users/maximisto/Documents/New\ project/frontend
npm run build
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
cd /Users/maximisto/Documents/New\ project
git add frontend/src/features/missions/MissionBoard.tsx frontend/src/features/missions/MissionReviews.tsx frontend/src/features/missions/MissionCalendar.tsx frontend/src/features/missions/MissionMap.tsx frontend/src/pages/Dashboard.tsx
git commit -m "feat(missions): add board map reviews and cadence tabs"
```

## Task 5: Credit Analytics And Integration Strip

**Files:**
- Create: `frontend/src/features/missions/MissionAnalytics.tsx`
- Create: `frontend/src/features/missions/MissionIntegrationsStrip.tsx`
- Modify: `frontend/src/pages/Dashboard.tsx`

- [ ] **Step 1: Add Analytics tab**

Create `frontend/src/features/missions/MissionAnalytics.tsx`:

```tsx
import type { MissionWorkspaceView } from './types';

const toneClass = {
  violet: 'border-violet-500/18 bg-violet-500/10 text-violet-100',
  cyan: 'border-cyan-500/18 bg-cyan-500/10 text-cyan-100',
  green: 'border-green-500/18 bg-green-500/10 text-green-100',
  amber: 'border-amber-500/18 bg-amber-500/10 text-amber-100',
  slate: 'border-navy-700 bg-navy-950/35 text-slate-300',
};

export function MissionAnalytics({ mission }: { mission: MissionWorkspaceView }) {
  return (
    <div className="space-y-3">
      <section className="rounded-2xl border border-navy-700/70 bg-navy-950/35 p-4">
        <p className="text-[10px] uppercase tracking-[0.22em] text-slate-600">Credit analytics</p>
        <h3 className="mt-1 text-base font-semibold text-white">Is the mission worth the spend?</h3>
        <p className="mt-2 text-sm leading-6 text-slate-400">{mission.analyticsSummary}</p>
      </section>

      <section className="grid grid-cols-2 gap-2">
        {mission.metrics.map((metric) => (
          <article key={metric.label} className={`rounded-2xl border p-3 ${toneClass[metric.tone]}`}>
            <p className="text-[10px] uppercase tracking-[0.18em] opacity-75">{metric.label}</p>
            <p className="mt-2 text-2xl font-semibold text-white">{metric.value}</p>
            <p className="mt-1 text-[11px] leading-5 opacity-80">{metric.detail}</p>
          </article>
        ))}
      </section>
    </div>
  );
}
```

- [ ] **Step 2: Add clean integrations strip**

Create `frontend/src/features/missions/MissionIntegrationsStrip.tsx`:

```tsx
import type { MissionIntegrationView } from './types';

export function MissionIntegrationsStrip({ integrations }: { integrations: MissionIntegrationView[] }) {
  return (
    <section className="rounded-2xl border border-navy-700/70 bg-navy-950/35 p-4">
      <p className="text-[10px] uppercase tracking-[0.22em] text-slate-600">Works with your operating stack</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {integrations.map((integration) => (
          <div
            key={integration.id}
            className="inline-flex items-center gap-2 rounded-full border border-navy-700/70 bg-navy-900/70 px-3 py-2 text-xs font-medium text-slate-200"
            title={integration.category}
          >
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-navy-800 text-[10px] font-bold text-cyan-300">
              {integration.shortLabel}
            </span>
            {integration.label}
          </div>
        ))}
      </div>
    </section>
  );
}
```

- [ ] **Step 3: Render analytics and integration strip in Dashboard**

Modify `frontend/src/pages/Dashboard.tsx` imports:

```ts
import { MissionAnalytics } from '../features/missions/MissionAnalytics';
import { MissionIntegrationsStrip } from '../features/missions/MissionIntegrationsStrip';
```

Inside `MissionWorkspacePanel`, render:

```tsx
              {missionWorkspaceTab === 'analytics' && (
                <MissionAnalytics mission={selectedMission} />
              )}
              <div className="mt-3">
                <MissionIntegrationsStrip integrations={selectedMission.integrations} />
              </div>
```

- [ ] **Step 4: Run frontend build**

```bash
cd /Users/maximisto/Documents/New\ project/frontend
npm run build
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
cd /Users/maximisto/Documents/New\ project
git add frontend/src/features/missions/MissionAnalytics.tsx frontend/src/features/missions/MissionIntegrationsStrip.tsx frontend/src/pages/Dashboard.tsx
git commit -m "feat(missions): add credit analytics and integration strip"
```

## Task 6: Preserve Chat Feel And Make It Mission-Aware

**Files:**
- Modify: `frontend/src/components/ChatInterface.tsx`
- Modify: `frontend/src/pages/Dashboard.tsx`

- [ ] **Step 1: Extend ChatInterface props**

In `frontend/src/components/ChatInterface.tsx`, update the props interface:

```ts
interface ChatInterfaceProps {
  conversationId?: string;
  initialMessages?: Message[];
  autonomyMode?: AutonomyMode;
  onMessagesChange?: (messages: Message[]) => void;
  missionTitle?: string;
  missionStatusLabel?: string;
  onOpenMissionWorkspace?: () => void;
}
```

- [ ] **Step 2: Accept the new props**

In `frontend/src/components/ChatInterface.tsx`, update the function signature:

```ts
function ChatInterface({
  conversationId,
  initialMessages = [],
  autonomyMode = 'balanced',
  onMessagesChange,
  missionTitle,
  missionStatusLabel,
  onOpenMissionWorkspace,
}: ChatInterfaceProps) {
```

- [ ] **Step 3: Add mission context chip to the status bar**

In `frontend/src/components/ChatInterface.tsx`, inside the status bar where message count and mode are shown, add this before the mode block:

```tsx
            {missionTitle && (
              <button
                type="button"
                onClick={onOpenMissionWorkspace}
                className="hidden items-center gap-1.5 rounded-full border border-violet-500/18 bg-violet-500/10 px-2.5 py-1 text-[10px] font-medium text-violet-200 transition-colors hover:bg-violet-500/16 md:flex"
              >
                <span>{missionTitle}</span>
                {missionStatusLabel ? <span className="text-violet-200/60">· {missionStatusLabel}</span> : null}
              </button>
            )}
```

- [ ] **Step 4: Pass mission props from Dashboard**

In `frontend/src/pages/Dashboard.tsx`, update the `ChatInterface` call:

```tsx
            <ChatInterface
              conversationId={activeConvoId}
              initialMessages={currentMessages}
              onMessagesChange={handleMessagesChange}
              autonomyMode={autonomyMode}
              missionTitle={selectedMission.title}
              missionStatusLabel={selectedMission.statusLabel}
              onOpenMissionWorkspace={() => {
                setMissionWorkspaceOpen(true);
                setTaskPanelOpen(false);
              }}
            />
```

- [ ] **Step 5: Run frontend build**

```bash
cd /Users/maximisto/Documents/New\ project/frontend
npm run build
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
cd /Users/maximisto/Documents/New\ project
git add frontend/src/components/ChatInterface.tsx frontend/src/pages/Dashboard.tsx
git commit -m "feat(chat): add mission-aware workspace affordance"
```

## Task 7: Retire Default Agent Studio Button And Preserve Advanced Path

**Files:**
- Modify: `frontend/src/pages/Dashboard.tsx`

- [ ] **Step 1: Change Agent Studio button copy**

In `frontend/src/pages/Dashboard.tsx`, replace the top-bar Agent Studio button:

```tsx
          <button
            onClick={() => navigate('/dashboard/agents')}
            className="hidden sm:flex items-center gap-1.5 rounded-full border border-navy-700 bg-navy-800/80 px-3 py-1.5 text-xs text-slate-300 transition-colors hover:border-cyan-500/30 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500"
          >
            <Bot className="w-3.5 h-3.5" />
            <span className="hidden lg:inline">Advanced</span>
          </button>
```

- [ ] **Step 2: Update selected workflow advanced copy**

In the existing selected workflow card in `Dashboard.tsx`, replace:

```tsx
Workflow lives here. The full worker system lives in Agent Studio, where you can compare presets, inspect performance, and tune routing without burying it under schedule tracking.
```

with:

```tsx
Mission work stays in this workspace. Advanced controls open the underlying run analysis, replay, and routing tools when you need deeper debugging.
```

- [ ] **Step 3: Update mobile advanced copy**

In the mobile shortcut row in `Dashboard.tsx`, replace:

```tsx
Agent Studio
```

with:

```tsx
Advanced
```

- [ ] **Step 4: Run frontend build**

```bash
cd /Users/maximisto/Documents/New\ project/frontend
npm run build
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
cd /Users/maximisto/Documents/New\ project
git add frontend/src/pages/Dashboard.tsx
git commit -m "refactor(ui): move agent studio behind advanced controls"
```

## Task 8: Final Validation And UX Smoke Pass

**Files:**
- Modify if validation finds defects: files touched in Tasks 1-7

- [ ] **Step 1: Run backend tests that protect integration/settings behavior**

```bash
cd /Users/maximisto/Documents/New\ project/backend
node --test -r ts-node/register tests/integrationRegistry.test.ts
node --test -r ts-node/register tests/settingsStore.test.ts
```

Expected: PASS.

- [ ] **Step 2: Run backend build**

```bash
cd /Users/maximisto/Documents/New\ project/backend
npm run build
```

Expected: PASS.

- [ ] **Step 3: Run frontend build**

```bash
cd /Users/maximisto/Documents/New\ project/frontend
npm run build
```

Expected: PASS.

- [ ] **Step 4: Run full workspace build**

```bash
cd /Users/maximisto/Documents/New\ project
npm run build
```

Expected: PASS.

- [ ] **Step 5: Start dev server**

```bash
cd /Users/maximisto/Documents/New\ project
npm run dev
```

Expected: backend and frontend start. Vite prints a localhost URL.

- [ ] **Step 6: Manual smoke test**

Open the Vite URL and verify:

- default dashboard still opens as clean chat
- sidebar still opens and collapses
- mission chip appears in chat status bar
- clicking mission chip opens the fold-in workspace
- Mission tab shows steps and agent cards
- Board tab shows lanes
- Map tab shows integrations feeding agent roles
- Reviews tab shows evidence and approval controls
- Calendar tab exposes run-now and pause/resume actions
- Analytics tab shows credit metrics
- Integrations strip has no public readiness/status badges
- old automation editor can still open, save, and run once now
- mobile width shows one usable surface at a time

- [ ] **Step 7: Stop dev server**

Stop the server with `Ctrl+C`.

- [ ] **Step 8: Commit validation fixes**

If Step 6 required fixes:

```bash
cd /Users/maximisto/Documents/New\ project
git add frontend/src backend/src frontend/src/features/missions
git commit -m "fix(missions): polish agent office workspace smoke issues"
```

If Step 6 required no fixes, do not create an empty commit.

## Self-Review

Spec coverage:

- Chat-first shell: Tasks 2 and 6.
- Fold-in workspace: Task 2.
- Mission object and plan view: Tasks 1 and 3.
- Scheduler and steps preservation: Tasks 1, 4, and 8.
- Agent floor: Task 3.
- Board / Map / Reviews / Calendar: Task 4.
- Credit analytics: Task 5.
- Clean integrations without public status clutter: Task 5.
- Agent Studio becomes advanced/internal: Task 7.
- Core Slack/Stripe/GitHub plus visible future integrations: Tasks 1 and 5.

Red-flag scan:

- No red-flag tokens were found in task bodies.
- Every code-changing step includes concrete code.

Type consistency:

- `MissionWorkspaceTab`, `MissionWorkspaceView`, and component props are defined in Task 1 and reused consistently in later tasks.
- `buildMissionWorkspaceView` accepts the selected dashboard task shape through `MissionSourceTask`.
- Dashboard state names are consistent: `missionWorkspaceOpen`, `missionWorkspaceTab`, `selectedMission`.
