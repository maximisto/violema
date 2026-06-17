import {
  buildMissionCreditAnalytics,
  buildMissionDetailModel,
  getDefaultMissionSelection,
  isMissionSelectionAvailable,
} from '../src/features/missions/missionDetail';
import type { MissionWorkspaceView } from '../src/features/missions/types';

function assert(condition: unknown, message: string) {
  if (!condition) {
    throw new Error(message);
  }
}

const mission: MissionWorkspaceView = {
  id: 'mission_founder_brief',
  title: 'Weekly founder update',
  description: 'Pull revenue, build, and market signals into a reviewable founder brief.',
  status: 'running',
  statusLabel: 'Running',
  nextRunLabel: 'Tue, 9:00 AM',
  lastRunLabel: 'Jun 16, 9:00 AM',
  scheduleLabel: 'Every Tuesday',
  deliveryLabel: '#founders after approval',
  activeAgentId: 'researcher',
  steps: [
    {
      id: 'trigger',
      title: 'Trigger run',
      objective: 'Start the scheduled mission.',
      kind: 'trigger',
      status: 'completed',
      agentLabel: 'Scheduler',
    },
    {
      id: 'research',
      title: 'Research market signals',
      objective: 'Scan competitor movement and source links.',
      kind: 'search',
      status: 'running',
      agentLabel: 'Market Researcher',
      toolLabel: 'Web',
      estimatedCredits: 24,
    },
  ],
  agents: [
    {
      id: 'researcher',
      label: 'Market Researcher',
      avatarLabel: 'MR',
      role: 'research',
      status: 'working',
      detail: 'Scanning competitor and category signals.',
      creditsLabel: '24 cr',
    },
  ],
  evidence: [
    { id: 'source_1', label: 'Competitor pricing', source: 'Web', detail: 'Two pricing-page changes found.' },
  ],
  metrics: [
    { label: 'Credits', value: '84', detail: 'Latest mission run.', tone: 'violet' },
    { label: 'Efficiency', value: '21 cr / artifact', detail: 'Four useful outputs.', tone: 'green' },
    { label: 'Waste', value: 'Low', detail: 'No repeated failed step.', tone: 'amber' },
  ],
  controlPrimitives: [],
  integrations: [
    { id: 'stripe', label: 'Stripe', shortLabel: 'S', category: 'Revenue' },
  ],
  artifact: {
    title: 'Founder update draft',
    kindLabel: 'Brief',
    sourceLabel: 'Mission output',
    statusLabel: 'Ready for review',
    summary: 'Revenue is steady and product risk is concentrated in one blocker.',
    lastUpdatedLabel: 'Just now',
    primaryActionLabel: 'Review artifact',
    skills: ['Research'],
    sections: [],
  },
  lessons: [
    { id: 'lesson_1', title: 'Keep Stripe first', detail: 'Revenue signal should lead the brief.', status: 'proposed', sourceLabel: 'Run review' },
  ],
  reviewSummary: 'Review before Slack delivery.',
  analyticsSummary: '84 credits for the last run.',
};

const defaultSelection = getDefaultMissionSelection(mission);
assert(defaultSelection.kind === 'step' && defaultSelection.id === 'research', 'defaults to the active step');

const stepModel = buildMissionDetailModel(mission, defaultSelection);
assert(stepModel.title === 'Research market signals', 'builds step detail model');
assert(stepModel.statusLabel === 'running', 'keeps step status label');
assert(stepModel.meta.includes('Market Researcher'), 'includes step agent metadata');

const agentModel = buildMissionDetailModel(mission, { kind: 'agent', id: 'researcher' });
assert(agentModel.primaryActionLabel === 'Chat with agent', 'agent detail supports chat action');
assert(agentModel.tone === 'cyan', 'working agent uses live tone');

const metricModel = buildMissionDetailModel(mission, { kind: 'metric', id: 'Waste' });
assert(metricModel.title === 'Run risk', 'renames waste metric to run risk');
assert(metricModel.statusLabel === 'Low', 'uses metric value as status');

assert(isMissionSelectionAvailable(mission, { kind: 'evidence', id: 'source_1' }), 'accepts known evidence selection');
assert(!isMissionSelectionAvailable(mission, { kind: 'step', id: 'missing' }), 'rejects stale step selection');

const fallbackModel = buildMissionDetailModel(mission, { kind: 'step', id: 'missing' });
assert(fallbackModel.title === 'Research market signals', 'falls back to default when selection is stale');

const analytics = buildMissionCreditAnalytics(mission, {
  creditsRemaining: 1684,
  creditsTotal: 2000,
  projectedDaysLeft: 18,
  automationBurnMonthly: 420,
  planName: 'Pro',
  estimatedTaskCost: 18,
});

assert(analytics.balanceLabel === '1,684 credits left', 'formats credit balance');
assert(analytics.utilizationPercent === 16, 'calculates workspace utilization');
assert(analytics.runCostLabel === '84 credits', 'uses mission run cost metric');
assert(analytics.recommendationTitle === 'Watch burn', 'summarizes runway state');
