import { buildMissionWorkspaceView } from '../src/features/missions/missionPresenter';

function assert(condition: unknown, message: string) {
  if (!condition) {
    throw new Error(message);
  }
}

const mission = buildMissionWorkspaceView({
  id: 'weekly-founder-update',
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
      summary: 'Revenue, product, and GTM narrative with source-linked claims.',
    },
    {
      id: 'chart-1',
      title: 'Revenue movement chart',
      kind: 'chart',
      source: 'Stripe',
      summary: 'Week-over-week revenue and churn movement.',
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
      actualCredits: 18,
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

assert(mission.artifact.title === 'Weekly founder update', 'uses the first artifact as the living artifact title');
assert(mission.artifact.statusLabel === 'Ready for review', 'marks review-held artifacts clearly');
assert(mission.artifact.sections.some((section) => section.label === 'Validation'), 'includes validation section');
assert(mission.artifact.sections.some((section) => section.value.includes('2 evidence')), 'counts evidence-backed artifacts');
assert(mission.artifact.sections.some((section) => section.label === 'Skills'), 'includes active skills/context');
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
