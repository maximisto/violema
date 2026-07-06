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

test('buildMissionRecords keeps the freshest automation task context when stale tasks appear later', () => {
  const currentPlan = {
    ...automationPlan,
    steps: automationPlan.steps.map((step) => step.id === 'step_deliver'
      ? { ...step, deliveryTarget: { channel: 'slack' as const, target: '#all-purple-orange' } }
      : step),
  } satisfies AutomationExecutionPlan;

  const freshTask = {
    id: 'task_fresh_weekly',
    workspaceId: 'purpleorangehq',
    title: 'Weekly founder update',
    description: 'Current weekly operating brief.',
    kind: 'automation',
    status: 'blocked',
    priority: 'medium',
    executorRole: 'analyst',
    createdAt: '2026-07-06T16:51:30.178Z',
    updatedAt: '2026-07-06T16:52:01.366Z',
    metadata: {
      automationId: 'auto_weekly',
      notify: '#all-purple-orange',
      automationPlan: currentPlan,
      latestSummary: 'Current run needs source fixes before review.',
      latestStepExecutions: [
        {
          stepId: 'step_deliver',
          kind: 'deliver',
          title: 'Deliver to Slack',
          assignedRole: 'messenger',
          status: 'succeeded',
          output: { status: 'waiting_review', to: '#all-purple-orange' },
        },
      ],
    },
  } satisfies TaskRecord;

  const staleTask = {
    id: 'task_stale_weekly',
    workspaceId: 'purpleorangehq',
    title: 'Weekly founder update',
    description: 'Stale weekly operating brief.',
    kind: 'automation',
    status: 'running',
    priority: 'medium',
    executorRole: 'analyst',
    createdAt: '2026-06-15T14:00:00.736Z',
    updatedAt: '2026-06-28T02:29:22.613Z',
    metadata: {
      automationId: 'auto_weekly',
      notify: '#founders',
      automationPlan,
      deliveryError: 'Slack target "#founders" is not resolvable.',
      latestSummary: 'Stale run with legacy Slack target.',
    },
  } satisfies TaskRecord;

  const freshRun = {
    id: 'run_fresh_weekly',
    workspaceId: 'purpleorangehq',
    taskId: 'task_fresh_weekly',
    agentRole: 'analyst',
    modelTier: 'default',
    status: 'failed',
    estimatedCredits: 72,
    actualCredits: 44,
    startedAt: '2026-07-06T16:51:30.300Z',
    finishedAt: '2026-07-06T16:52:01.300Z',
    metadata: {
      automationId: 'auto_weekly',
      automationPlan: currentPlan,
      summary: 'Current run needs source fixes before review.',
      stepExecutions: freshTask.metadata.latestStepExecutions,
    },
  } satisfies TaskRunRecord;

  const staleRun = {
    id: 'run_stale_weekly',
    workspaceId: 'purpleorangehq',
    taskId: 'task_stale_weekly',
    agentRole: 'analyst',
    modelTier: 'default',
    status: 'succeeded',
    estimatedCredits: 72,
    startedAt: '2026-06-15T14:00:00.965Z',
    finishedAt: '2026-06-15T14:00:26.412Z',
    metadata: {
      automationId: 'auto_weekly',
      automationPlan,
      summary: 'Stale run with legacy Slack target.',
    },
  } satisfies TaskRunRecord;

  const [mission] = buildMissionRecords({
    workspaceId: 'purpleorangehq',
    automations: [
      {
        id: 'auto_weekly',
        name: 'Weekly founder update',
        description: 'Create a source-linked weekly operating brief.',
        schedule: 'every monday at 9am',
        actions: ['Query Stripe revenue movement', 'Deliver latest result to #all-purple-orange'],
        steps: currentPlan.steps,
        execution_policy: { mode: 'recommended', optimizationGoal: 'balanced', reviewPolicy: 'standard', maxElasticLanes: 2 },
        notify: '#all-purple-orange',
        status: 'paused',
        workflow_prompt: 'Query Stripe revenue movement\nDeliver latest result to #all-purple-orange',
        last_run_at: '2026-07-06T16:52:01.300Z',
      },
    ],
    tasks: [freshTask, staleTask],
    taskRuns: [freshRun, staleRun],
  });

  assert.equal(mission.activeTaskId, 'task_fresh_weekly');
  assert.equal(mission.activeRunId, 'run_fresh_weekly');
  assert.equal(mission.metadata?.notify, '#all-purple-orange');
  assert.equal(mission.plan.steps.find((step) => step.id === 'step_deliver')?.deliveryTarget?.target, '#all-purple-orange');
  assert.doesNotMatch(JSON.stringify(mission), /#founders/);
});
