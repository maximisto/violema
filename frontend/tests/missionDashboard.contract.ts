import {
  buildMissionDashboardSummary,
  getMissionDashboardPatternNotes,
} from '../src/features/missions/missionDashboard';
import type { MissionWorkspaceView } from '../src/features/missions/types';

function assert(condition: unknown, message: string) {
  if (!condition) {
    throw new Error(message);
  }
}

const mission: MissionWorkspaceView = {
  id: 'mission_weekly',
  title: 'Weekly founder update',
  description: 'Founder operating brief.',
  status: 'running',
  statusLabel: 'Running',
  nextRunLabel: 'Mon, 9:00 AM',
  lastRunLabel: 'Jun 14, 9:04 AM',
  scheduleLabel: 'every monday at 9am',
  deliveryLabel: '#founders',
  activeAgentId: 'researcher',
  steps: [
    {
      id: 'step_1',
      title: 'Pull Stripe revenue',
      objective: 'Find revenue movement.',
      kind: 'query',
      status: 'running',
      agentLabel: 'Finance Analyst',
      toolLabel: 'Stripe',
      estimatedCredits: 12,
    },
    {
      id: 'step_2',
      title: 'Review blocker',
      objective: 'Check delivery risk.',
      kind: 'review',
      status: 'waiting_review',
      agentLabel: 'Reviewer',
    },
    {
      id: 'step_3',
      title: 'Summarize brief',
      objective: 'Prepare the output.',
      kind: 'summarize',
      status: 'completed',
      agentLabel: 'Writer',
      actualCredits: 18,
    },
    {
      id: 'step_4',
      title: 'Send to Slack',
      objective: 'Deliver after approval.',
      kind: 'deliver',
      status: 'planned',
      agentLabel: 'Messenger',
    },
  ],
  agents: [
    {
      id: 'researcher',
      label: 'Researcher',
      avatarLabel: 'R',
      role: 'researcher',
      status: 'working',
      detail: 'Scanning market signals.',
      creditsLabel: '12 cr',
    },
    {
      id: 'writer',
      label: 'Writer',
      avatarLabel: 'W',
      role: 'writer',
      status: 'queued',
      detail: 'Waiting for evidence.',
    },
  ],
  evidence: [
    { id: 'e1', label: 'Stripe revenue', source: 'Stripe', detail: 'Revenue movement.' },
  ],
  metrics: [
    { label: 'Credits', value: '44', detail: 'actual run cost', tone: 'violet' },
    { label: 'Artifacts', value: '1', detail: 'stored output', tone: 'cyan' },
    { label: 'Efficiency', value: '44 cr', detail: 'per artifact', tone: 'amber' },
  ],
  controlPrimitives: [],
  integrations: [
    { id: 'slack', label: 'Slack', shortLabel: 'SL', category: 'Delivery' },
    { id: 'stripe', label: 'Stripe', shortLabel: 'ST', category: 'Revenue' },
  ],
  artifact: {
    title: 'Founder brief',
    kindLabel: 'Brief',
    sourceLabel: 'Run output',
    statusLabel: 'Living artifact',
    summary: 'Founder-ready update.',
    lastUpdatedLabel: 'Jun 14',
    primaryActionLabel: 'Open artifact',
    skills: ['Writer'],
    sections: [],
  },
  lessons: [],
  reviewSummary: 'Review before delivery.',
  analyticsSummary: 'Tracked at 44 credits.',
};

const summary = buildMissionDashboardSummary(mission);

assert(summary.stepCounts.active === 1, 'counts active steps');
assert(summary.stepCounts.review === 1, 'counts review steps');
assert(summary.stepCounts.done === 1, 'counts done steps');
assert(summary.stepCounts.waiting === 1, 'counts waiting steps');
assert(summary.activeAgent?.label === 'Researcher', 'selects the active agent');
assert(summary.creditMetric?.value === '44', 'finds credit metric');
assert(summary.efficiencyMetric?.value === '44 cr', 'finds efficiency metric');
assert(summary.primaryIntegrationLabels.join(',') === 'Slack,Stripe', 'keeps integration labels compact and ordered');

const notes = getMissionDashboardPatternNotes();
assert(notes.length >= 6, 'documents competitor functions adapted into the dashboard');
assert(notes.some((note) => note.adapted === 'Fold-in mission workspace'), 'keeps the fold-in workspace adaptation');
