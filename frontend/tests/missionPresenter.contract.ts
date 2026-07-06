import { buildMissionWorkspaceView } from '../src/features/missions/missionPresenter';

function assert(condition: unknown, message: string) {
  if (!condition) {
    throw new Error(message);
  }
}

const mission = buildMissionWorkspaceView({
  id: 'weekly-founder-update',
  taskId: 'task_weekly',
  taskRunId: 'run_weekly',
  automationId: 'auto_weekly',
  title: 'Weekly founder update',
  description: 'Refresh revenue, product, and market signals into one founder-ready brief.',
  status: 'waiting_review',
  schedule: 'Every Monday at 9am',
  notify: '#founders',
  actualCredits: 84,
  latestSummary: 'Revenue is up 18% week over week, churn is steady, and two enterprise leads need follow-up.',
  actions: [
    'Query Stripe for weekly revenue and churn',
    'Scan GitHub and Linear for shipping signals',
    'Draft a founder-ready Slack update',
  ],
  latestArtifacts: [
    {
      id: 'brief-1',
      title: 'Weekly founder update',
      kind: 'brief',
      source: 'Slack draft',
      payload: {
        markdown: 'Revenue, product, and GTM narrative with source-linked claims.',
        sources: [
          {
            title: 'Stripe MRR report',
            source: 'Stripe',
            url: 'https://stripe.example/reports/mrr',
            detail: 'Revenue is up 18% WoW.',
          },
        ],
      },
    },
    {
      id: 'chart-1',
      title: 'Revenue movement chart',
      kind: 'chart',
      source: 'Stripe',
      payload: {
        artifact_type: 'chart',
        chart: {
          type: 'line',
          title: 'Revenue movement chart',
          subtitle: 'Weekly Stripe signal',
          y_label: 'Revenue',
          unit: '$',
          insight: 'Revenue is moving up while churn stays flat.',
          data: [
            { label: 'Week 1', value: 12400 },
            { label: 'Week 2', value: 14600 },
            { label: 'Week 3', value: 17100 },
          ],
        },
        results: [
          {
            title: 'Stripe churn export',
            url: 'https://stripe.example/reports/churn',
            snippet: 'Churn stayed flat this week.',
          },
        ],
      },
    },
  ],
  latestStepExecutions: [
    {
      id: 'stripe',
      title: 'Stripe revenue pull',
      objective: 'Query Stripe for weekly revenue and churn',
      kind: 'query',
      status: 'completed',
      assignedRole: 'finance_checker',
      toolName: 'Stripe',
      charge: { actualCredits: 18 },
      output: {
        sources: [
          {
            title: 'Failed payment queue',
            source: 'Stripe',
            detail: 'Three failed payments need follow-up.',
          },
        ],
      },
      summary: 'Revenue up 18%.',
    },
    {
      id: 'brief',
      title: 'Draft founder update',
      objective: 'Prepare the Slack-ready weekly update',
      kind: 'summarize',
      status: 'waiting_review',
      assignedRole: 'brief_writer',
      toolName: 'Slack',
      actualCredits: 27,
      summary: 'Draft ready for approval.',
    },
  ],
});

assert(mission.taskId === 'task_weekly', 'preserves task id for mission actions');
assert(mission.taskRunId === 'run_weekly', 'preserves task run id for review actions');
assert(mission.automationId === 'auto_weekly', 'preserves automation id for schedule/review actions');
assert(mission.artifact.title === 'Weekly founder update', 'uses the first artifact as the living artifact title');
assert(mission.artifact.statusLabel === 'Ready for approval', 'marks review-held artifacts clearly');
assert(mission.artifact.sections.some((section) => section.label === 'Validation'), 'includes validation section');
assert(mission.artifact.sections.some((section) => section.value.includes('3 evidence')), 'counts source evidence from artifact and step payloads');
assert(mission.artifact.sections.some((section) => section.label === 'Skills'), 'includes active skills/context');
assert(mission.artifact.chart?.title === 'Revenue movement chart', 'promotes stored chart payloads into reusable mission artifacts');
assert(mission.artifact.chart?.data.length === 3, 'keeps chart data points available for mission rendering');
assert(mission.controlPrimitives.length === 6, 'builds the borrowed control primitive deck');
assert(mission.controlPrimitives.some((item) => item.id === 'plan' && item.value === '2 checkpoints'), 'shows visible plan checkpoints');
assert(mission.controlPrimitives.some((item) => item.id === 'trust' && item.value === 'Human gate'), 'shows human approval boundary');
assert(mission.controlPrimitives.some((item) => item.id === 'trace' && item.value === '2 tool calls'), 'shows visible tool-call trace');
assert(mission.controlPrimitives.some((item) => item.id === 'playbook' && item.value === 'Reusable'), 'shows reusable mission/playbook state');
assert(mission.controlPrimitives.some((item) => item.id === 'delivery' && item.value === '#founders'), 'shows delivery surface');
assert(mission.controlPrimitives.some((item) => item.id === 'cost' && item.value === '84 cr'), 'shows mission cost signal');
assert(mission.lessons.length >= 3, 'builds a learning-loop queue');
assert(mission.lessons.some((lesson) => lesson.status === 'proposed'), 'proposes a saved rule from the reviewed artifact');
assert(mission.lessons.some((lesson) => lesson.title.includes('Credit pattern')), 'includes credit-utilization learning');
assert(mission.steps[0]?.actualCredits === 18, 'reads actual credits from nested step charge');
assert(mission.evidence.some((item) => item.label === 'Stripe MRR report'), 'extracts artifact source evidence');
assert(mission.evidence.some((item) => item.label === 'Failed payment queue'), 'extracts step output source evidence');

const slackReviewMission = buildMissionWorkspaceView({
  id: 'weekly-founder-update-slack-review',
  title: 'Weekly founder update',
  status: 'blocked',
  latestStepExecutions: [
    {
      stepId: 'step_founder_brief',
      title: 'Draft founder brief',
      objective: 'Prepare the founder-ready weekly update.',
      kind: 'summarize',
      assignedRole: 'writer',
      status: 'failed',
      error: 'Model route closed before the draft finished.',
    },
    {
      stepId: 'step_slack_delivery',
      title: 'Deliver to Slack',
      objective: 'Send the reviewed weekly founder update to Slack after approval.',
      kind: 'deliver',
      assignedRole: 'messenger',
      status: 'succeeded',
      output: {
        success: true,
        channel: 'slack',
        to: '#all-purple-orange',
        status: 'waiting_review',
        approval_required: true,
      },
    },
  ],
});

assert(
  slackReviewMission.steps.find((step) => step.id === 'step_slack_delivery')?.status === 'waiting_review',
  'shows Slack delivery as waiting review when the run prepared an approval gate',
);
assert(
  slackReviewMission.steps.find((step) => step.id === 'step_founder_brief')?.status === 'failed',
  'keeps the actual failed draft step visible',
);

const deliveredMission = buildMissionWorkspaceView({
  id: 'weekly-founder-update-delivered',
  title: 'Weekly founder update',
  status: 'completed',
  runStatus: 'succeeded',
  notify: '#all-purple-orange',
  latestSummary: 'Founder update was approved and delivered.',
  latestArtifacts: [
    {
      id: 'review-gate',
      title: 'Ready for review: Weekly founder update',
      kind: 'review_gate',
      payload: {
        markdown: 'Founder update markdown.',
        deliveryTarget: '#all-purple-orange',
        approvalRequired: true,
      },
    },
  ],
  latestStepExecutions: [
    {
      stepId: 'step_slack_delivery',
      title: 'Deliver to Slack',
      objective: 'Send the approved weekly founder update to Slack.',
      kind: 'deliver',
      assignedRole: 'messenger',
      status: 'succeeded',
      output: {
        success: true,
        channel: 'slack',
        to: '#all-purple-orange',
        status: 'waiting_review',
        approval_required: true,
      },
    },
  ],
  latestDelivery: {
    success: true,
    channel: 'slack',
    to: '#all-purple-orange',
    status: 'delivered',
    slack_ts: '1783362663.292479',
  },
  reviewReceipt: {
    status: 'delivered',
    deliveryTarget: '#all-purple-orange',
  },
} as any);

assert(deliveredMission.status === 'completed', 'approved deliveries stay completed');
assert(deliveredMission.artifact.statusLabel === 'Delivered', 'approved deliveries show delivered artifact state');
assert(deliveredMission.artifact.primaryActionLabel === 'Open receipt', 'approved deliveries point to receipt instead of another review');
assert(
  deliveredMission.steps.find((step) => step.id === 'step_slack_delivery')?.status === 'completed',
  'approved deliveries override stale waiting-review step output',
);
assert(
  deliveredMission.reviewSummary.includes('Delivered to #all-purple-orange'),
  'approved deliveries explain where the Slack message landed',
);

const emptyMission = buildMissionWorkspaceView(null);

assert(emptyMission.artifact.title === 'No live artifact yet', 'empty state has artifact placeholder');
assert(emptyMission.controlPrimitives.some((item) => item.id === 'trust' && item.value === 'Scope pending'), 'empty state explains trust setup');
assert(emptyMission.lessons[0]?.status === 'waiting', 'empty state starts with waiting lesson');

const payloadOnlyMission = buildMissionWorkspaceView({
  id: 'payload-only',
  title: 'Payload-only report',
  latestArtifacts: [
    {
      title: 'Stored markdown report',
      kind: 'report',
      payload: {
        markdown: 'Actual markdown body from stored artifact.',
      },
    },
  ],
});

assert(
  payloadOnlyMission.artifact.summary === 'Actual markdown body from stored artifact.',
  'reads artifact body from payload markdown when summary is absent'
);
