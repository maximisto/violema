import {
  buildCompactMissionProgressPhases,
  buildMissionProgressPhases,
} from '../src/features/missions/missionProgress';
import type { MissionWorkspaceView } from '../src/features/missions/types';

function assert(condition: unknown, message: string) {
  if (!condition) {
    throw new Error(message);
  }
}

const mission: MissionWorkspaceView = {
  id: 'mission_progress',
  title: 'Launch weekly founder brief',
  description: 'Pull signals, draft the brief, and deliver after review.',
  status: 'running',
  statusLabel: 'Running',
  nextRunLabel: 'Tue, 9:00 AM',
  lastRunLabel: 'Jun 16, 9:00 AM',
  scheduleLabel: 'Every Tuesday',
  deliveryLabel: '#founders',
  activeAgentId: 'research',
  steps: [
    {
      id: 'trigger',
      title: 'Scheduled trigger',
      objective: 'Start the mission from the weekly cadence.',
      kind: 'trigger',
      status: 'completed',
      agentLabel: 'Scheduler',
      finishedAt: '2026-06-16T14:00:00.000Z',
    },
    {
      id: 'research',
      title: 'Research market movement',
      objective: 'Search customer, competitor, and web signals.',
      kind: 'search',
      status: 'running',
      agentLabel: 'Researcher',
      startedAt: '2026-06-16T14:01:00.000Z',
    },
    {
      id: 'analysis',
      title: 'Analyze revenue risk',
      objective: 'Compare the sources and identify signal drift.',
      kind: 'analyze',
      status: 'failed',
      agentLabel: 'Analyst',
      error: 'Stripe query returned partial data.',
    },
    {
      id: 'draft',
      title: 'Draft founder update',
      objective: 'Write the operating brief.',
      kind: 'summarize',
      status: 'waiting_review',
      agentLabel: 'Writer',
    },
    {
      id: 'review',
      title: 'Review evidence',
      objective: 'Approve sensitive claims before delivery.',
      kind: 'review',
      status: 'waiting_review',
      agentLabel: 'Reviewer',
    },
    {
      id: 'deliver',
      title: 'Deliver to Slack',
      objective: 'Post the approved update.',
      kind: 'deliver',
      status: 'planned',
      agentLabel: 'Messenger',
    },
  ],
  agents: [],
  evidence: [],
  metrics: [],
  controlPrimitives: [],
  integrations: [],
  artifact: {
    title: 'Founder brief',
    kindLabel: 'Brief',
    sourceLabel: 'Run output',
    statusLabel: 'Draft pending',
    summary: 'Waiting for delivery.',
    lastUpdatedLabel: 'Not run yet',
    primaryActionLabel: 'Open',
    skills: [],
    sections: [],
  },
  lessons: [],
  reviewSummary: 'Review before delivery.',
  analyticsSummary: 'No credits logged.',
};

const phases = buildMissionProgressPhases(mission);

assert(
  phases.map((phase) => phase.label).join(' -> ') === 'Trigger -> Research -> Analysis -> Draft -> Review -> Deliver',
  'uses the canonical phase language',
);
assert(phases.find((phase) => phase.id === 'trigger')?.status === 'completed', 'maps completed setup to Trigger');
assert(phases.find((phase) => phase.id === 'research')?.status === 'running', 'maps live search/query work to Research');
assert(phases.find((phase) => phase.id === 'analysis')?.status === 'failed', 'problem status wins in phase rollup');
assert(phases.find((phase) => phase.id === 'draft')?.status === 'waiting_review', 'review waits can surface before final review');
assert(phases.find((phase) => phase.id === 'review')?.status === 'waiting_review', 'explicit review step maps to Review');
assert(phases.find((phase) => phase.id === 'deliver')?.status === 'planned', 'delivery phase stays planned until it runs');
assert(phases.find((phase) => phase.id === 'trigger')?.metaLabel === '9:00 AM', 'uses real completed timestamps when present');
assert(phases.find((phase) => phase.id === 'research')?.metaLabel === 'Now', 'running steps get a live label');
assert(phases.find((phase) => phase.id === 'analysis')?.tone === 'red', 'failed phases render as red');
assert(phases.find((phase) => phase.id === 'draft')?.tone === 'amber', 'waiting phases render as amber');
assert(phases.find((phase) => phase.id === 'research')?.tone === 'live', 'running phases render as live');
assert(buildCompactMissionProgressPhases(mission).length === 6, 'compact model still exposes all canonical phases');
