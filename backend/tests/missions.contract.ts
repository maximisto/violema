import assert from 'node:assert/strict';
import test from 'node:test';
import { buildMissionRecords } from '../src/platform/missions';
import type { AutomationExecutionPlan, TaskRecord, TaskRunRecord } from '../src/platform/types';

const automationPlan = {
  primaryRole: 'analyst',
  supportingRoles: ['researcher', 'writer', 'messenger'],
  rationale: 'Weekly update needs revenue, build, market, and delivery roles.',
  suggestedModelTier: 'default',
  complexity: 'medium',
  estimatedToolCalls: 3,
  estimatedCredits: 72,
  topology: {
    version: 'violema-10',
    primaryRole: 'analyst',
    primaryBand: 'default',
    coreWorkers: ['analyst', 'researcher', 'writer', 'messenger'],
    elasticLanes: [],
    activeRoles: ['analyst', 'researcher', 'writer', 'messenger'],
    bandByRole: { analyst: 'default' },
    summary: 'Analyst leads the founder update.',
    workers: [],
  },
  steps: [
    {
      id: 'step_stripe',
      kind: 'query',
      title: 'Query Stripe revenue movement',
      objective: 'Pull revenue, churn, expansion, and failed-payment signals.',
      assignedRole: 'analyst',
      toolName: 'query_data',
      inputs: { source: 'stripe', query_type: 'revenue_summary' },
      estimatedCredits: 12,
    },
    {
      id: 'step_deliver',
      kind: 'deliver',
      title: 'Deliver to Slack',
      objective: 'Send the reviewed update to the founder channel.',
      assignedRole: 'messenger',
      toolName: 'send_message',
      deliveryTarget: { channel: 'slack', target: '#founders' },
      estimatedCredits: 4,
    },
  ],
} satisfies AutomationExecutionPlan;

test('buildMissionRecords derives weekly founder mission from live automation task and run data', () => {
  const task = {
    id: 'task_weekly',
    workspaceId: 'purpleorangehq',
    title: 'Weekly founder update',
    description: 'Create a source-linked weekly operating brief.',
    kind: 'automation',
    status: 'completed',
    priority: 'medium',
    executorRole: 'analyst',
    supportingRoles: ['researcher', 'writer', 'messenger'],
    createdAt: '2026-06-14T00:00:00.000Z',
    updatedAt: '2026-06-14T09:05:00.000Z',
    metadata: {
      automationId: 'auto_weekly',
      automationPlan,
      latestSummary: 'Revenue is steady and one GitHub blocker needs owner attention.',
      latestArtifacts: [
        {
          id: 'artifact_weekly',
          kind: 'brief',
          title: 'Weekly founder update',
          payload: { markdown: 'Founder-ready brief.' },
        },
      ],
    },
  } satisfies TaskRecord;

  const run = {
    id: 'run_weekly',
    workspaceId: 'purpleorangehq',
    taskId: 'task_weekly',
    agentRole: 'analyst',
    modelTier: 'default',
    status: 'succeeded',
    estimatedCredits: 72,
    actualCredits: 44,
    startedAt: '2026-06-14T09:00:00.000Z',
    finishedAt: '2026-06-14T09:04:00.000Z',
    metadata: {
      automationId: 'auto_weekly',
      automationPlan,
      summary: 'Revenue is steady and one GitHub blocker needs owner attention.',
      stepExecutions: [
        {
          stepId: 'step_stripe',
          kind: 'query',
          title: 'Query Stripe revenue movement',
          assignedRole: 'analyst',
          status: 'succeeded',
          actualCredits: 18,
        },
      ],
    },
  } satisfies TaskRunRecord;

  const missions = buildMissionRecords({
    workspaceId: 'purpleorangehq',
    automations: [
      {
        id: 'auto_weekly',
        name: 'Weekly founder update',
        description: 'Create a source-linked weekly operating brief.',
        schedule: 'every monday at 9am',
        actions: ['Query Stripe revenue movement', 'Deliver latest result to #founders'],
        steps: [],
        execution_policy: { mode: 'recommended', optimizationGoal: 'balanced', reviewPolicy: 'standard', maxElasticLanes: 2 },
        notify: '#founders',
        status: 'active',
        workflow_prompt: 'Query Stripe revenue movement\nDeliver latest result to #founders',
        next_run_at: '2026-06-21T09:00:00.000Z',
        last_run_at: '2026-06-14T09:04:00.000Z',
      },
    ],
    tasks: [task],
    taskRuns: [run],
  });

  assert.equal(missions.length, 1);
  const mission = missions[0];
  assert.equal(mission.id, 'mission_auto_weekly');
  assert.equal(mission.workflowTemplateId, 'weekly-founder-update');
  assert.equal(mission.status, 'completed');
  assert.equal(mission.review.policy, 'before_delivery');
  assert.equal(mission.review.approvalChannel, 'slack');
  assert.equal(mission.activeTaskId, 'task_weekly');
  assert.equal(mission.activeRunId, 'run_weekly');
  assert.equal(mission.plan.primaryRole, 'analyst');
  assert.equal(mission.plan.steps[0].integrationId, 'stripe');
  assert.equal(mission.plan.steps[0].currentStatus, 'succeeded');
  assert.equal(mission.metadata?.latestSummary, 'Revenue is steady and one GitHub blocker needs owner attention.');
  assert.equal(mission.metadata?.actualCredits, 44);
});
