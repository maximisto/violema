import type { MissionAgentView, MissionMetricView, MissionStepView, MissionWorkspaceView } from './types';

export interface MissionDashboardSummary {
  stepCounts: {
    active: number;
    waiting: number;
    review: number;
    done: number;
  };
  activeAgent?: MissionAgentView;
  activeStep?: MissionStepView;
  reviewStep?: MissionStepView;
  creditMetric?: MissionMetricView;
  efficiencyMetric?: MissionMetricView;
  wasteMetric?: MissionMetricView;
  primaryIntegrationLabels: string[];
}

export interface MissionDashboardPatternNote {
  source: string;
  function: string;
  adapted: string;
  reason: string;
}

const DASHBOARD_PATTERN_NOTES: MissionDashboardPatternNote[] = [
  {
    source: 'Airtable Superagent / Hyperagent',
    function: 'Multi-agent coordination with specialist workers',
    adapted: 'Agent roster and current-worker visibility',
    reason: 'Founders need to see which role owns each part of a mission without managing an agent lab.',
  },
  {
    source: 'n8n',
    function: 'Visual workflow construction and execution history',
    adapted: 'Map tab with steps, tools, integrations, and run anatomy',
    reason: 'The map is for understanding and editing missions, while chat remains the default surface.',
  },
  {
    source: 'ChatGPT Canvas / Claude Artifacts',
    function: 'Chat beside an inspectable work surface',
    adapted: 'Fold-in mission workspace',
    reason: 'Users keep the clean conversation while opening real work only when there is something to inspect.',
  },
  {
    source: 'Gumloop',
    function: 'AI-native workflows where every step can reason',
    adapted: 'Step-level agent/tool cards and reusable founder workflow templates',
    reason: 'Violema should make automation useful out of the box before asking users to build from scratch.',
  },
  {
    source: 'Relevance AI',
    function: 'AI workforce management and monitoring',
    adapted: 'Mission dashboard with worker status, queue state, and role-based execution',
    reason: 'The office metaphor is stronger when each worker has a visible job and current state.',
  },
  {
    source: 'Relay.app',
    function: 'Human-in-the-loop approvals over Slack/email',
    adapted: 'Reviews tab, approval queue, delivery gate, and evidence-first output review',
    reason: 'Founder work needs control at the exact moment output can affect customers, money, or reputation.',
  },
  {
    source: 'LangSmith',
    function: 'Agent traces, costs, failures, and latency observability',
    adapted: 'Advanced replay/debug plus quiet dashboard credit and waste signals',
    reason: 'Daily users need simple cost and quality signals; operators still need deeper traces later.',
  },
  {
    source: 'Zapier Agents',
    function: 'Agents connected to a large app ecosystem',
    adapted: 'Elegant integration line plus Core, Suites, and MCP expansion tabs',
    reason: 'The product must feel connected to the founder stack without looking like a crowded marketplace.',
  },
];

export function getMissionDashboardPatternNotes() {
  return DASHBOARD_PATTERN_NOTES;
}

function countSteps(steps: MissionStepView[]) {
  return steps.reduce(
    (counts, step) => {
      if (step.status === 'running') counts.active += 1;
      else if (step.status === 'waiting_review' || step.status === 'failed') counts.review += 1;
      else if (step.status === 'completed') counts.done += 1;
      else counts.waiting += 1;
      return counts;
    },
    { active: 0, waiting: 0, review: 0, done: 0 },
  );
}

function findMetric(metrics: MissionMetricView[], label: string) {
  const normalized = label.toLowerCase();
  return metrics.find((metric) => metric.label.toLowerCase() === normalized);
}

export function buildMissionDashboardSummary(mission: MissionWorkspaceView): MissionDashboardSummary {
  const activeAgent = mission.agents.find((agent) => agent.id === mission.activeAgentId)
    || mission.agents.find((agent) => agent.status === 'working')
    || mission.agents[0];

  return {
    stepCounts: countSteps(mission.steps),
    activeAgent,
    activeStep: mission.steps.find((step) => step.status === 'running') || mission.steps[0],
    reviewStep: mission.steps.find((step) => step.status === 'waiting_review' || step.status === 'failed'),
    creditMetric: findMetric(mission.metrics, 'Credits'),
    efficiencyMetric: findMetric(mission.metrics, 'Efficiency'),
    wasteMetric: findMetric(mission.metrics, 'Waste'),
    primaryIntegrationLabels: mission.integrations.map((integration) => integration.label).slice(0, 8),
  };
}
