import type {
  AgentRole,
  DelegationPlan,
  IntelligenceBand,
  ModelTier,
  TaskDelegationPlan,
  TaskDelegationStep,
  TaskKind,
  TaskOwnershipMetadata,
} from './types';
import { buildWorkerTopologySnapshot, isElasticLane, selectPrimaryWorkerRole } from './topology';

function step(role: AgentRole, objective: string): TaskDelegationStep {
  return {
    id: `step_${role}_${Math.random().toString(36).slice(2, 8)}`,
    role,
    objective,
    status: 'planned',
  };
}

export function selectPrimaryRole(input: {
  taskKind: TaskKind;
  modelTier: ModelTier;
  userText: string;
}): AgentRole {
  return selectPrimaryWorkerRole(input);
}

export function buildDelegationPlan(input: {
  taskKind: TaskKind;
  modelTier: ModelTier;
  userText: string;
}): TaskDelegationPlan {
  const primaryRole = selectPrimaryRole(input);
  const steps: TaskDelegationStep[] = [];
  const supportingRoles = new Set<AgentRole>();

  switch (primaryRole) {
    case 'researcher':
      steps.push(step('researcher', 'Gather current facts, sources, and evidence.'));
      supportingRoles.add('writer');
      steps.push(step('writer', 'Turn findings into a concise user-facing answer.'));
      if (input.modelTier === 'hard' || input.modelTier === 'critical') {
        supportingRoles.add('reviewer');
        steps.push(step('reviewer', 'Stress-test claims and identify gaps or risks.'));
      }
      break;
    case 'analyst':
      steps.push(step('analyst', 'Interpret the evidence and determine the actionable conclusion.'));
      supportingRoles.add('writer');
      steps.push(step('writer', 'Package the analysis into a concise deliverable.'));
      if (input.modelTier === 'hard' || input.modelTier === 'critical') {
        supportingRoles.add('reviewer');
        steps.push(step('reviewer', 'Check the reasoning, risks, and final recommendations.'));
      }
      break;
    case 'engineer':
      steps.push(step('engineer', 'Implement the requested technical change.'));
      if (input.modelTier !== 'micro') {
        supportingRoles.add('reviewer');
        steps.push(step('reviewer', 'Validate behavior, regressions, and test coverage.'));
      }
      break;
    case 'reviewer':
      steps.push(step('reviewer', 'Evaluate the output for correctness and risk.'));
      break;
    case 'operator':
      steps.push(step('operator', 'Coordinate the workflow, tools, and external actions.'));
      supportingRoles.add('scheduler');
      steps.push(step('scheduler', 'Handle timing, cadence, and recurring execution glue.'));
      if (input.taskKind === 'automation' || /monitor|watch|cron|automation/.test(input.userText.toLowerCase())) {
        supportingRoles.add('monitor');
        steps.push(step('monitor', 'Watch recurring inputs and trigger conditions.'));
      }
      if (input.taskKind === 'message' || /slack|email|deliver|notify|reply/.test(input.userText.toLowerCase())) {
        supportingRoles.add('messenger');
        steps.push(step('messenger', 'Handle outbound delivery into external destinations.'));
      }
      break;
    case 'writer':
      steps.push(step('writer', 'Draft the deliverable clearly and efficiently.'));
      if (input.modelTier === 'hard' || input.modelTier === 'critical') {
        supportingRoles.add('reviewer');
        steps.push(step('reviewer', 'Check the final language for accuracy and risk.'));
      }
      break;
    case 'scheduler':
      steps.push(step('scheduler', 'Translate the request into a reliable recurring workflow.'));
      supportingRoles.add('monitor');
      steps.push(step('monitor', 'Watch the recurring inputs and trigger conditions.'));
      supportingRoles.add('messenger');
      steps.push(step('messenger', 'Handle output delivery when a run completes.'));
      break;
    case 'messenger':
      steps.push(step('messenger', 'Deliver the response through the requested communication channel.'));
      break;
    case 'monitor':
      steps.push(step('monitor', 'Observe the recurring source signals and flag meaningful changes.'));
      break;
    default:
      steps.push(step('nexus', 'Handle the request directly while coordinating tools as needed.'));
      break;
  }

  return {
    mode: supportingRoles.size > 0 ? 'delegated' : 'solo',
    primaryRole,
    supportingRoles: [...supportingRoles],
    rationale:
      supportingRoles.size > 0
        ? `${primaryRole} leads while specialists cover adjacent risk or delivery work.`
        : `${primaryRole} can handle this request directly without specialist handoff.`,
    steps,
  };
}

export interface DelegationRuntimeContext {
  taskPlan: TaskDelegationPlan;
  plan: DelegationPlan;
  ownership: TaskOwnershipMetadata;
  taskPatch: {
    assigneeRole: AgentRole;
    ownerRole: AgentRole;
    executorRole: AgentRole;
    reviewerRole?: AgentRole;
    supportingRoles: AgentRole[];
    delegationState: 'planned';
    delegationPlanId: string;
  };
  taskRunPatch: {
    agentRole: AgentRole;
    ownerRole: AgentRole;
    executorRole: AgentRole;
    reviewerRole?: AgentRole;
    supportingRoles: AgentRole[];
  };
}

export function buildDelegationRuntimeContext(input: {
  workspaceId: string;
  taskKind: TaskKind;
  title: string;
  description?: string;
  autonomyMode?: 'autonomous' | 'cautious' | 'supervised';
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  modelTier: ModelTier;
  toolCountHint?: number;
  complexity?: 'low' | 'medium' | 'high';
  requiresHumanReview?: boolean;
  userText?: string;
  executorRoleOverride?: AgentRole;
  supportingRolesOverride?: AgentRole[];
  reasonOverride?: string;
}): DelegationRuntimeContext {
  const userText = input.userText || [input.title, input.description || ''].filter(Boolean).join(' ').trim();
  const baseTaskPlan = buildDelegationPlan({
    taskKind: input.taskKind,
    modelTier: input.modelTier,
    userText,
  });
  const initialSupportingRoles = input.supportingRolesOverride
    ? [...new Set(input.supportingRolesOverride.filter((role) => role !== input.executorRoleOverride))]
    : baseTaskPlan.supportingRoles;
  const overrideSteps = input.executorRoleOverride
    ? [
        step(input.executorRoleOverride, 'Lead execution and coordinate the workflow.'),
        ...initialSupportingRoles.map((role) =>
          step(
            role,
            role === 'reviewer'
              ? 'Review the output for correctness and risk.'
              : 'Support the workflow with specialist execution.'
          )
        ),
      ]
    : baseTaskPlan.steps;
  const taskPlan: TaskDelegationPlan = {
    ...baseTaskPlan,
    primaryRole: input.executorRoleOverride || baseTaskPlan.primaryRole,
    supportingRoles: initialSupportingRoles,
    rationale: input.reasonOverride || baseTaskPlan.rationale,
    steps: overrideSteps,
  };

  const ownerRole: AgentRole = 'nexus';
  const executorRole = taskPlan.primaryRole;
  const reviewerRole =
    taskPlan.supportingRoles.includes('reviewer') || input.requiresHumanReview || input.autonomyMode === 'supervised'
      ? 'reviewer'
      : undefined;
  const supportingRoles = [...new Set(taskPlan.supportingRoles.filter((role) => role !== reviewerRole))];
  const elasticLanes = [...new Set([executorRole, ...supportingRoles].filter((role) => isElasticLane(role)))];
  const suggestedModelTier =
    input.taskKind === 'engineering' && input.modelTier === 'micro'
      ? 'default'
      : input.complexity === 'high' && input.modelTier === 'micro'
        ? 'default'
        : input.modelTier;
  const topology = buildWorkerTopologySnapshot({
    primaryRole: executorRole,
    supportingRoles,
    elasticLanes,
    modelTier: suggestedModelTier,
    complexity: input.complexity,
    taskKind: input.taskKind,
  });
  const primaryBand = topology.primaryBand as IntelligenceBand;

  const plan: DelegationPlan = {
    id: `delegation_${input.workspaceId}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    workspaceId: input.workspaceId,
    taskKind: input.taskKind,
    ownerRole,
    executorRole,
    reviewerRole,
    supportingRoles,
    delegationDepth: taskPlan.mode === 'delegated' ? 1 : 0,
    requiresReview: Boolean(reviewerRole),
    suggestedModelTier,
    reason: taskPlan.rationale,
    confidence:
      input.priority === 'urgent' || input.complexity === 'high'
        ? 'high'
        : taskPlan.mode === 'delegated'
          ? 'medium'
          : 'high',
    createdAt: new Date().toISOString(),
    metadata: {
      title: input.title,
      autonomyMode: input.autonomyMode || 'cautious',
      priority: input.priority || 'medium',
      toolCountHint: input.toolCountHint || 0,
      complexity: input.complexity || 'low',
      steps: taskPlan.steps,
      topology,
    },
  };

  const ownership: TaskOwnershipMetadata = {
    planId: plan.id,
    ownerRole,
    executorRole,
    reviewerRole,
    supportingRoles,
    delegationDepth: plan.delegationDepth,
    requiresReview: plan.requiresReview,
    reason: plan.reason,
    confidence: plan.confidence,
    elasticLanes,
    primaryBand,
  };

  return {
    taskPlan,
    plan,
    ownership,
    taskPatch: {
      assigneeRole: executorRole,
      ownerRole,
      executorRole,
      reviewerRole,
      supportingRoles,
      delegationState: 'planned',
      delegationPlanId: plan.id,
    },
    taskRunPatch: {
      agentRole: executorRole,
      ownerRole,
      executorRole,
      reviewerRole,
      supportingRoles,
    },
  };
}

export function describeDelegationRuntime(context: DelegationRuntimeContext): string {
  return `${context.plan.executorRole}:${context.taskPlan.mode}:${context.plan.supportingRoles.join(',') || 'none'}`;
}
