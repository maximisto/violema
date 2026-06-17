import { mapMissionRecordToSourceTask } from '../src/features/missions/missionApi';

function assert(condition: unknown, message: string) {
  if (!condition) {
    throw new Error(message);
  }
}

const source = mapMissionRecordToSourceTask({
  id: 'mission_auto_weekly',
  workspaceId: 'purpleorangehq',
  title: 'Weekly founder update',
  goal: 'Create a source-linked weekly operating brief.',
  status: 'completed',
  source: 'automation',
  sourcePrompt: 'Query Stripe revenue movement',
  workflowTemplateId: 'weekly-founder-update',
  automationId: 'auto_weekly',
  activeTaskId: 'task_weekly',
  activeRunId: 'run_weekly',
  review: { policy: 'before_delivery', requiredRoles: ['reviewer'], approvalChannel: 'slack' },
  plan: {
    primaryRole: 'analyst',
    supportingRoles: ['researcher', 'writer'],
    estimatedCredits: 72,
    steps: [
      {
        id: 'step_stripe',
        title: 'Query Stripe revenue movement',
        objective: 'Pull revenue, churn, and failed-payment signals.',
        kind: 'query',
        assignedRole: 'analyst',
        toolName: 'query_data',
        integrationId: 'stripe',
        currentStatus: 'succeeded',
        estimatedCredits: 12,
      },
    ],
  },
  metadata: {
    schedule: 'every monday at 9am',
    notify: '#founders',
    nextRunAt: '2026-06-21T09:00:00.000Z',
    lastRunAt: '2026-06-14T09:04:00.000Z',
    latestSummary: 'Revenue is steady and one GitHub blocker needs owner attention.',
    actualCredits: 44,
    latestArtifacts: [
      {
        id: 'artifact_weekly',
        title: 'Weekly founder update',
        kind: 'brief',
        payload: {
          markdown: 'Founder-ready brief.',
          sources: [
            { title: 'Stripe MRR report', url: 'https://stripe.example/report', source: 'Stripe' },
          ],
        },
      },
    ],
    latestStepExecutions: [
      {
        stepId: 'step_stripe',
        title: 'Query Stripe revenue movement',
        objective: 'Pull revenue, churn, and failed-payment signals.',
        kind: 'query',
        assignedRole: 'analyst',
        status: 'succeeded',
        charge: { actualCredits: 17 },
        output: {
          sources: [
            { title: 'Stripe failed payments', source: 'Stripe', detail: 'Three failed payments need follow-up.' },
          ],
        },
      },
    ],
  },
  createdAt: '2026-06-14T00:00:00.000Z',
  updatedAt: '2026-06-14T09:05:00.000Z',
});

assert(source.id === 'mission_auto_weekly', 'uses mission id');
assert(source.automationId === 'auto_weekly', 'maps automation id');
assert(source.taskId === 'task_weekly', 'maps active task id');
assert(source.taskRunId === 'run_weekly', 'maps active run id');
assert(source.title === 'Weekly founder update', 'maps title');
assert(source.status === 'completed', 'maps status');
assert(source.schedule === 'every monday at 9am', 'maps schedule');
assert(source.notify === '#founders', 'maps notify target');
assert(
  source.latestSummary === 'Revenue is steady and one GitHub blocker needs owner attention.',
  'maps latest summary',
);
assert(source.actualCredits === 44, 'maps actual credits');
assert(source.latestArtifacts?.[0]?.payload?.sources, 'preserves artifact source payload');
assert(source.latestStepExecutions?.[0]?.stepId === 'step_stripe', 'maps latest step execution id');
assert(source.latestStepExecutions?.[0]?.actualCredits === 17, 'maps nested step charge actual credits');
assert(source.latestStepExecutions?.[0]?.output?.sources, 'preserves step output source payload');
