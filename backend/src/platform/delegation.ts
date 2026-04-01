import type {
  AgentRole,
  DelegationPlan,
  ModelTier,
  TaskDelegationPlan,
  TaskDelegationStep,
  TaskKind,
  TaskOwnershipMetadata,
} from './types';

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
  const text = input.userText.toLowerCase();

  if (input.taskKind === 'automation' || /schedule|monitor|watch|cron|automation/.test(text)) return 'scheduler';
  if (input.taskKind === 'engineering' || /bug|code|build|deploy|typescript|react|api|server/.test(text)) return 'engineer';
  if (input.taskKind === 'analysis' || /analy[sz]e|compare|market|research|investigate/.test(text)) return 'researcher';
  if (/review|check|verify|audit/.test(text) || input.modelTier === 'critical') return 'reviewer';
  if (/write|draft|memo|report|summary/.test(text)) return 'writer';
  if (input.modelTier === 'ops') return 'operator';
  return 'nexus';
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
    case 'engineer':
      steps.push(step('engineer', 'Implement the requested technical change.'));
      if (input.modelTier !== 'micro') {
        supportingRoles.add('reviewer');
        steps.push(step('reviewer', 'Validate behavior, regressions, and test coverage.'));
      }
      break;
    case 'scheduler':
      steps.push(step('scheduler', 'Translate the request into a reliable recurring workflow.'));
      supportingRoles.add('operator');
      steps.push(step('operator', 'Prepare integrations and notifications for the run.'));
      break;
    case 'reviewer':
      steps.push(step('reviewer', 'Evaluate the output for correctness and risk.'));
      break;
    case 'writer':
      steps.push(step('writer', 'Draft the deliverable clearly and efficiently.'));
      break;
    case 'operator':
      steps.push(step('operator', 'Coordinate integrations, actions, and output delivery.'));
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
  const taskPlan: TaskDelegationPlan = {
    ...baseTaskPlan,
    primaryRole: input.executorRoleOverride || baseTaskPlan.primaryRole,
    supportingRoles: input.supportingRolesOverride
      ? [...new Set(input.supportingRolesOverride.filter((role) => role !== input.executorRoleOverride))]
      : baseTaskPlan.supportingRoles,
    rationale: input.reasonOverride || baseTaskPlan.rationale,
  };

  const ownerRole: AgentRole = 'nexus';
  const executorRole = taskPlan.primaryRole;
  const reviewerRole =
    taskPlan.supportingRoles.includes('reviewer') || input.requiresHumanReview || input.autonomyMode === 'supervised'
      ? 'reviewer'
      : undefined;
  const supportingRoles = [...new Set(taskPlan.supportingRoles.filter((role) => role !== reviewerRole))];
  const suggestedModelTier =
    input.taskKind === 'engineering' && input.modelTier === 'micro'
      ? 'default'
      : input.complexity === 'high' && input.modelTier === 'micro'
        ? 'default'
        : input.modelTier;

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
