import assert from 'node:assert/strict';
import test from 'node:test';
import type {
  MissionPlanStep,
  MissionRecord,
  MissionReviewSettings,
} from '../src/platform/types';

test('mission schema captures the founder mission control source of truth', () => {
  const review = {
    policy: 'before_delivery',
    requiredRoles: ['reviewer'],
    approvalChannel: 'slack',
  } satisfies MissionReviewSettings;

  const step = {
    id: 'step_revenue',
    title: 'Check Stripe revenue',
    objective: 'Pull MRR, failed payments, and expansion signals from Stripe.',
    kind: 'query',
    assignedRole: 'analyst',
    toolName: 'query_data',
    integrationId: 'stripe',
    dependencies: [],
    deliveryTarget: null,
    reviewGate: false,
    estimatedCredits: 12,
    currentStatus: 'planned',
  } satisfies MissionPlanStep;

  const mission = {
    id: 'mission_weekly_founder_update',
    workspaceId: 'purpleorangehq',
    title: 'Weekly founder update',
    goal: 'Create a source-linked weekly operating brief for the founder.',
    status: 'planned',
    ownerRole: 'nexus',
    sourcePrompt: 'Send me a weekly founder update every Monday morning.',
    workflowTemplateId: 'weekly-founder-update',
    automationId: 'auto_weekly_founder_update',
    activeTaskId: 'task_weekly_founder_update',
    activeRunId: 'run_weekly_founder_update',
    creditBudget: 120,
    review,
    plan: {
      steps: [step],
      primaryRole: 'analyst',
      supportingRoles: ['researcher', 'writer', 'messenger'],
      estimatedCredits: 72,
    },
    createdAt: '2026-06-14T00:00:00.000Z',
    updatedAt: '2026-06-14T00:00:00.000Z',
  } satisfies MissionRecord;

  assert.equal(mission.status, 'planned');
  assert.equal(mission.review.policy, 'before_delivery');
  assert.equal(mission.plan.steps[0].integrationId, 'stripe');
});
