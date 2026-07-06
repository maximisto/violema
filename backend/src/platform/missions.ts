import type {
  AgentRole,
  AutomationExecutionPlan,
  AutomationExecutionPolicy,
  AutomationStepDefinition,
  AutomationStepDeliveryTarget,
  AutomationStepKind,
  AutomationStepStatus,
  MissionPlanStep,
  MissionRecord,
  MissionReviewPolicy,
  MissionStatus,
  PersistedAutomationStep,
  TaskRecord,
  TaskRunRecord,
} from './types';

export interface MissionAutomationRecord {
  id: string;
  name: string;
  description?: string;
  authoring_mode?: 'guided' | 'describe';
  workflow_prompt?: string;
  schedule: string;
  timezone?: string;
  actions: string[];
  steps?: PersistedAutomationStep[];
  execution_policy?: AutomationExecutionPolicy;
  notify?: string;
  condition?: string;
  status: 'active' | 'paused';
  last_run_at?: string;
  last_run_status?: 'succeeded' | 'failed';
  next_run_at?: string;
  created_at?: string;
}

export interface BuildMissionRecordsInput {
  workspaceId: string;
  automations: MissionAutomationRecord[];
  tasks: TaskRecord[];
  taskRuns: TaskRunRecord[];
}

const AGENT_ROLES = new Set<AgentRole>([
  'nexus',
  'researcher',
  'operator',
  'engineer',
  'reviewer',
  'analyst',
  'scheduler',
  'writer',
  'messenger',
  'monitor',
]);

const AUTOMATION_STEP_KINDS = new Set<AutomationStepKind>([
  'search',
  'query',
  'summarize',
  'deliver',
  'capture',
  'analyze',
  'note',
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function readString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function readNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function readAgentRole(value: unknown, fallback: AgentRole): AgentRole {
  return typeof value === 'string' && AGENT_ROLES.has(value as AgentRole) ? value as AgentRole : fallback;
}

function readStepKind(value: unknown): AutomationStepKind {
  return typeof value === 'string' && AUTOMATION_STEP_KINDS.has(value as AutomationStepKind)
    ? value as AutomationStepKind
    : 'note';
}

function readAutomationPlan(value: unknown): AutomationExecutionPlan | undefined {
  if (!isRecord(value) || !Array.isArray(value.steps)) return undefined;
  return value as unknown as AutomationExecutionPlan;
}

function readAutomationPlanFromMetadata(task?: TaskRecord, run?: TaskRunRecord) {
  return (
    readAutomationPlan(run?.metadata?.automationPlan) ||
    readAutomationPlan(task?.metadata?.automationPlan)
  );
}

function hasDeliveredReview(task?: TaskRecord, run?: TaskRunRecord) {
  const taskReceipt = isRecord(task?.metadata?.reviewReceipt) ? task.metadata.reviewReceipt : undefined;
  const runReceipt = isRecord(run?.metadata?.reviewReceipt) ? run.metadata.reviewReceipt : undefined;
  const taskDelivery = isRecord(task?.metadata?.latestDelivery) ? task.metadata.latestDelivery : undefined;
  const runDelivery = isRecord(run?.metadata?.delivery) ? run.metadata.delivery : undefined;
  return (
    readString(taskReceipt?.status) === 'delivered' ||
    readString(runReceipt?.status) === 'delivered' ||
    readString(taskDelivery?.status) === 'delivered' ||
    readString(runDelivery?.status) === 'delivered'
  );
}

function readStepExecutions(value: unknown, options?: { deliveredReview?: boolean }): Map<string, AutomationStepStatus | 'waiting_review'> {
  const statuses = new Map<string, AutomationStepStatus | 'waiting_review'>();
  if (!Array.isArray(value)) return statuses;

  value.forEach((item) => {
    if (!isRecord(item)) return;
    const stepId = readString(item.stepId) || readString(item.id);
    const kind = readString(item.kind);
    const status = readString(item.status);
    const output = isRecord(item.output) ? item.output : undefined;
    const outputStatus = readString(output?.status);
    if (!stepId) return;
    if (kind === 'deliver' && options?.deliveredReview) {
      statuses.set(stepId, 'succeeded');
      return;
    }
    if (kind === 'deliver' && outputStatus === 'waiting_review') {
      statuses.set(stepId, 'waiting_review');
      return;
    }
    if (
      status === 'planned' ||
      status === 'running' ||
      status === 'succeeded' ||
      status === 'failed' ||
      status === 'skipped' ||
      status === 'waiting_review'
    ) {
      statuses.set(stepId, status);
    }
  });

  return statuses;
}

function getTaskAutomationId(task?: TaskRecord, run?: TaskRunRecord) {
  return (
    readString(run?.metadata?.automationId) ||
    readString(task?.metadata?.automationId)
  );
}

function getLatestRunByTaskId(taskRuns: TaskRunRecord[]) {
  const latestRunByTaskId = new Map<string, TaskRunRecord>();

  taskRuns.forEach((run) => {
    const existing = latestRunByTaskId.get(run.taskId);
    const runTime = Date.parse(run.finishedAt || run.startedAt || '');
    const existingTime = existing ? Date.parse(existing.finishedAt || existing.startedAt || '') : 0;
    if (!existing || runTime > existingTime) {
      latestRunByTaskId.set(run.taskId, run);
    }
  });

  return latestRunByTaskId;
}

function readTimestamp(value?: string) {
  if (!value) return 0;
  const time = Date.parse(value);
  return Number.isFinite(time) ? time : 0;
}

function getTaskContextTime(task: TaskRecord, run?: TaskRunRecord) {
  return Math.max(
    readTimestamp(run?.finishedAt),
    readTimestamp(run?.startedAt),
    readTimestamp(task.updatedAt),
    readTimestamp(task.createdAt),
  );
}

function getTaskContextByAutomationId(tasks: TaskRecord[], taskRuns: TaskRunRecord[]) {
  const latestRunByTaskId = getLatestRunByTaskId(taskRuns);
  const taskContextByAutomationId = new Map<string, { task: TaskRecord; latestRun?: TaskRunRecord }>();

  tasks.forEach((task) => {
    const latestRun = latestRunByTaskId.get(task.id);
    const automationId = getTaskAutomationId(task, latestRun);
    if (automationId) {
      const existing = taskContextByAutomationId.get(automationId);
      if (existing && getTaskContextTime(existing.task, existing.latestRun) >= getTaskContextTime(task, latestRun)) {
        return;
      }
      taskContextByAutomationId.set(automationId, { task, latestRun });
    }
  });

  return taskContextByAutomationId;
}

function missionStatusFromRecords(
  automation: MissionAutomationRecord | undefined,
  task: TaskRecord | undefined,
  run: TaskRunRecord | undefined,
): MissionStatus {
  if (hasDeliveredReview(task, run)) return 'completed';

  const activeStatuses = [task?.status, run?.status].filter(Boolean);
  if (activeStatuses.includes('waiting_review')) return 'waiting_review';
  if (activeStatuses.some((status) => status === 'running' || status === 'retrying' || status === 'queued')) return 'running';
  if (activeStatuses.includes('failed')) return 'failed';
  if (activeStatuses.includes('blocked')) return 'blocked';
  if (activeStatuses.includes('canceled')) return 'canceled';

  if (automation?.status === 'paused') return 'paused';

  const status = run?.status || task?.status || automation?.last_run_status;
  if (status === 'succeeded' || status === 'completed') return 'completed';
  return 'planned';
}

function inferWorkflowTemplateId(automation: MissionAutomationRecord, task?: TaskRecord) {
  const text = [
    automation.name,
    automation.description,
    automation.workflow_prompt,
    task?.title,
    task?.description,
    ...(automation.actions || []),
  ].filter(Boolean).join('\n').toLowerCase();

  if (/weekly\s+founder|founder\s+(update|brief)|operating\s+brief/.test(text)) {
    return 'weekly-founder-update';
  }
  if (/failed\s+payment|payment\s+failure/.test(text)) return 'failed-payments-monitor';
  if (/github|pull request|release|shipping|linear/.test(text)) return 'shipping-digest';
  if (/competitor|pricing|market/.test(text)) return 'competitor-watch';
  if (/investor|board update/.test(text)) return 'investor-update';
  if (/calendar|email|inbox/.test(text)) return 'daily-email-calendar-brief';
  return undefined;
}

function inferIntegrationId(step: AutomationStepDefinition | PersistedAutomationStep) {
  const source = isRecord(step.inputs) ? readString(step.inputs.source) : undefined;
  if (source) return source;
  if ('toolName' in step && step.toolName === 'send_message') return step.deliveryTarget?.channel || 'slack';
  if ('toolName' in step && step.toolName === 'query_data') return 'workspace-data';
  if ('toolName' in step && step.toolName === 'web_search') return 'web-search';
  if ('toolName' in step && step.toolName === 'browser_screenshot') return 'browser';
  return undefined;
}

function reviewPolicyFromAutomation(automation: MissionAutomationRecord): MissionReviewPolicy {
  const policy = automation.execution_policy?.reviewPolicy;
  if (policy === 'strict') return 'strict';
  if (policy === 'lean' && !automation.notify) return 'none';
  return 'before_delivery';
}

function approvalChannelFromNotify(notify?: string) {
  if (!notify) return 'app';
  return notify.includes('@') ? 'email' : 'slack';
}

function mapPlanStep(
  step: AutomationStepDefinition,
  statusByStepId: Map<string, AutomationStepStatus | 'waiting_review'>,
): MissionPlanStep {
  return {
    id: step.id,
    title: step.title,
    objective: step.objective,
    kind: step.kind,
    assignedRole: step.assignedRole,
    toolName: step.toolName,
    integrationId: inferIntegrationId(step),
    dependencies: step.dependsOnStepIds,
    inputs: step.inputs,
    deliveryTarget: step.deliveryTarget,
    reviewGate: step.kind === 'deliver',
    estimatedCredits: step.estimatedCredits,
    currentStatus: statusByStepId.get(step.id) || 'planned',
  };
}

function mapPersistedStep(
  step: PersistedAutomationStep,
  index: number,
  statusByStepId: Map<string, AutomationStepStatus | 'waiting_review'>,
): MissionPlanStep {
  const id = step.id || `step_${index + 1}`;
  return {
    id,
    title: step.title || step.objective,
    objective: step.objective,
    kind: step.kind,
    assignedRole: step.kind === 'deliver' ? 'messenger' : 'operator',
    integrationId: inferIntegrationId(step),
    inputs: step.inputs,
    deliveryTarget: step.deliveryTarget,
    reviewGate: step.kind === 'deliver',
    currentStatus: statusByStepId.get(id) || 'planned',
  };
}

function inferActionKind(action: string): AutomationStepKind {
  const normalized = action.trim().toLowerCase();
  if (/query|stripe|posthog|github|linear|notion/.test(normalized)) return 'query';
  if (/screenshot|capture/.test(normalized)) return 'capture';
  if (/(analy[sz]e|diagnos|compare|inspect|audit|review)/.test(normalized)) return 'analyze';
  if (/(send|post|slack|email|deliver|notify|message)/.test(normalized)) return 'deliver';
  if (/(summary|digest|report|briefing|recap)/.test(normalized)) return 'summarize';
  if (/(search|scan|research|news|competitor)/.test(normalized)) return 'search';
  return 'note';
}

function mapActionStep(action: string, index: number): MissionPlanStep {
  const kind = inferActionKind(action);
  return {
    id: `action_${index + 1}`,
    title: action.length > 72 ? `${action.slice(0, 69)}...` : action,
    objective: action,
    kind,
    assignedRole: kind === 'deliver' ? 'messenger' : kind === 'summarize' ? 'writer' : kind === 'search' ? 'researcher' : 'operator',
    reviewGate: kind === 'deliver',
    currentStatus: 'planned',
  };
}

function buildMissionPlanSteps(
  automation: MissionAutomationRecord,
  task: TaskRecord | undefined,
  run: TaskRunRecord | undefined,
) {
  const automationPlan = readAutomationPlanFromMetadata(task, run);
  const statusByStepId = readStepExecutions(run?.metadata?.stepExecutions || task?.metadata?.latestStepExecutions, {
    deliveredReview: hasDeliveredReview(task, run),
  });

  if (automationPlan?.steps?.length) {
    return automationPlan.steps.map((step) => mapPlanStep(step, statusByStepId));
  }

  if (automation.steps?.length) {
    return automation.steps.map((step, index) => mapPersistedStep(step, index, statusByStepId));
  }

  return automation.actions.map((action, index) => mapActionStep(action, index));
}

function readLatestSummary(task?: TaskRecord, run?: TaskRunRecord) {
  return (
    readString(run?.metadata?.summary) ||
    readString(task?.metadata?.latestSummary)
  );
}

function buildMissionMetadata(automation: MissionAutomationRecord, task?: TaskRecord, run?: TaskRunRecord) {
  return {
    authoringMode: automation.authoring_mode,
    schedule: automation.schedule,
    timezone: automation.timezone,
    notify: automation.notify,
    condition: automation.condition,
    nextRunAt: automation.next_run_at,
    lastRunAt: run?.finishedAt || run?.startedAt || automation.last_run_at,
    lastRunStatus: run?.status || automation.last_run_status,
    actualCredits: readNumber(run?.actualCredits),
    estimatedCredits: readNumber(run?.estimatedCredits),
    latestSummary: readLatestSummary(task, run),
    latestArtifacts: run?.metadata?.artifacts || task?.metadata?.latestArtifacts,
    latestStepExecutions: run?.metadata?.stepExecutions || task?.metadata?.latestStepExecutions,
    reviewReceipt: run?.metadata?.reviewReceipt || task?.metadata?.reviewReceipt,
    latestDelivery: task?.metadata?.latestDelivery || run?.metadata?.delivery,
    workerTopology: run?.metadata?.workerTopology || task?.metadata?.workerTopology,
    sourceSteps: automation.steps,
    actions: automation.actions,
  };
}

function compactMetadata(metadata: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(metadata).filter(([, value]) => value !== undefined)
  );
}

export function buildMissionRecords(input: BuildMissionRecordsInput): MissionRecord[] {
  const taskContextByAutomationId = getTaskContextByAutomationId(input.tasks, input.taskRuns);

  return input.automations
    .map((automation) => {
      const context = taskContextByAutomationId.get(automation.id);
      const task = context?.task;
      const latestRun = context?.latestRun;
      const automationPlan = readAutomationPlanFromMetadata(task, latestRun);
      const steps = buildMissionPlanSteps(automation, task, latestRun);
      const primaryRole = readAgentRole(
        automationPlan?.primaryRole || task?.executorRole || task?.ownerRole || latestRun?.agentRole,
        'operator',
      );
      const supportingRoles = (
        automationPlan?.supportingRoles ||
        task?.supportingRoles ||
        []
      ).map((role) => readAgentRole(role, 'operator'));
      const createdAt = task?.createdAt || automation.created_at || new Date().toISOString();
      const updatedAt = task?.updatedAt || latestRun?.finishedAt || latestRun?.startedAt || automation.last_run_at || createdAt;

      return {
        id: `mission_${automation.id}`,
        workspaceId: input.workspaceId,
        title: automation.name,
        goal: automation.description || task?.description || automation.workflow_prompt || automation.actions[0] || automation.name,
        status: missionStatusFromRecords(automation, task, latestRun),
        ownerRole: task?.ownerRole || primaryRole,
        source: 'automation',
        sourcePrompt: automation.workflow_prompt,
        workflowTemplateId: inferWorkflowTemplateId(automation, task),
        scheduleId: `schedule_${automation.id}`,
        automationId: automation.id,
        activeTaskId: task?.id,
        activeRunId: latestRun?.id,
        creditBudget: task?.budgetCredits,
        review: {
          policy: reviewPolicyFromAutomation(automation),
          requiredRoles: reviewPolicyFromAutomation(automation) === 'none' ? [] : ['reviewer'],
          approvalChannel: approvalChannelFromNotify(automation.notify),
        },
        plan: {
          steps,
          primaryRole,
          supportingRoles,
          estimatedCredits: automationPlan?.estimatedCredits || latestRun?.estimatedCredits,
          executionPolicy: automation.execution_policy,
          automationPlan,
        },
        createdAt,
        updatedAt,
        metadata: compactMetadata(buildMissionMetadata(automation, task, latestRun)),
      } satisfies MissionRecord;
    })
    .sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt));
}
