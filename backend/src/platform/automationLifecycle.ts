import type {
  AutomationStepExecution,
  AutomationStepDeliveryTarget,
  PersistedAutomationStep,
  TaskRecord,
  TaskRunStatus,
  TaskRunRecord,
  TaskStatus,
} from './types';

type SendReviewMessage = (input: {
  to: string;
  body: string;
  subject?: string;
  channel?: AutomationStepDeliveryTarget['channel'];
}) => Promise<Record<string, unknown>>;

interface ReviewArtifact {
  kind?: string;
  title?: string;
  payload?: {
    markdown?: string;
    deliveryTarget?: string;
    approvalRequired?: boolean;
  };
}

export interface AutomationRunReceipt {
  id: string;
  status: 'delivered' | 'changes_requested';
  reviewer: string;
  reviewedAt: string;
  automationId?: string;
  taskId: string;
  taskRunId: string;
  deliveryTarget?: string;
  artifactTitle?: string;
  note?: string;
  delivery?: Record<string, unknown>;
}

export interface AutomationPreflightBlocker {
  key: string;
  label: string;
  detail: string;
  severity: 'blocking' | 'warning';
}

export interface AutomationPreflightReport {
  ready: boolean;
  summary: string;
  blockers: AutomationPreflightBlocker[];
  warnings: AutomationPreflightBlocker[];
}

export interface AutomationDeliveryDraftValidation {
  ok: true;
  warnings: AutomationPreflightBlocker[];
}

export interface AutomationRunOutcome {
  taskStatus: TaskStatus;
  runStatus: TaskRunStatus;
  delegationState: NonNullable<TaskRecord['delegationState']>;
  schedulerOk: boolean;
  reviewRequired: boolean;
  reviewSummary?: string;
}

function readRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function readString(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function readArtifacts(task: TaskRecord, taskRun: TaskRunRecord): ReviewArtifact[] {
  const taskMetadata = readRecord(task.metadata) || {};
  const runMetadata = readRecord(taskRun.metadata) || {};
  const source = Array.isArray(runMetadata.artifacts)
    ? runMetadata.artifacts
    : Array.isArray(taskMetadata.latestArtifacts)
      ? taskMetadata.latestArtifacts
      : [];

  return source
    .map((item) => readRecord(item))
    .filter((item): item is Record<string, unknown> => Boolean(item))
    .map((item) => ({
      kind: readString(item.kind),
      title: readString(item.title),
      payload: readRecord(item.payload) ? {
        markdown: readString(readRecord(item.payload)?.markdown),
        deliveryTarget: readString(readRecord(item.payload)?.deliveryTarget),
        approvalRequired: Boolean(readRecord(item.payload)?.approvalRequired),
      } : undefined,
    }));
}

function readAutomationId(task: TaskRecord, taskRun: TaskRunRecord) {
  const taskMetadata = readRecord(task.metadata) || {};
  const runMetadata = readRecord(taskRun.metadata) || {};
  return readString(runMetadata.automationId) || readString(taskMetadata.automationId) || undefined;
}

function findReviewArtifact(task: TaskRecord, taskRun: TaskRunRecord) {
  return readArtifacts(task, taskRun).find((artifact) =>
    artifact.kind === 'review_gate' &&
    artifact.payload?.approvalRequired &&
    artifact.payload?.markdown &&
    artifact.payload?.deliveryTarget
  );
}

function assertReviewable(task: TaskRecord, taskRun: TaskRunRecord) {
  if (task.status !== 'waiting_review') {
    throw new Error('This mission is not waiting for review.');
  }

  const artifact = findReviewArtifact(task, taskRun);
  if (!artifact) {
    throw new Error('No prepared review artifact is available for delivery.');
  }

  return artifact;
}

function buildReceipt(input: {
  status: AutomationRunReceipt['status'];
  task: TaskRecord;
  taskRun: TaskRunRecord;
  reviewer: string;
  reviewedAt: string;
  deliveryTarget?: string;
  artifactTitle?: string;
  note?: string;
  delivery?: Record<string, unknown>;
}): AutomationRunReceipt {
  return {
    id: `receipt_${input.taskRun.id}_${input.status}`,
    status: input.status,
    reviewer: input.reviewer,
    reviewedAt: input.reviewedAt,
    automationId: readAutomationId(input.task, input.taskRun),
    taskId: input.task.id,
    taskRunId: input.taskRun.id,
    deliveryTarget: input.deliveryTarget,
    artifactTitle: input.artifactTitle,
    note: input.note,
    delivery: input.delivery,
  };
}

export async function approveAutomationReview(input: {
  task: TaskRecord;
  taskRun: TaskRunRecord;
  reviewer: string;
  now?: () => string;
  send: SendReviewMessage;
}) {
  const reviewedAt = input.now ? input.now() : new Date().toISOString();
  const artifact = assertReviewable(input.task, input.taskRun);
  const body = artifact.payload?.markdown || '';
  const deliveryTarget = artifact.payload?.deliveryTarget || '';
  const delivery = await input.send({
    to: deliveryTarget,
    body,
    subject: artifact.title || input.task.title,
    channel: deliveryTarget.includes('@') ? 'email' : 'slack',
  });
  const receipt = buildReceipt({
    status: 'delivered',
    task: input.task,
    taskRun: input.taskRun,
    reviewer: input.reviewer,
    reviewedAt,
    deliveryTarget,
    artifactTitle: artifact.title,
    delivery,
  });

  return {
    delivery: { ...delivery, body },
    receipt,
    taskPatch: {
      status: 'completed' as const,
      delegationState: 'completed' as const,
      metadata: {
        reviewRequired: false,
        reviewReceipt: receipt,
        latestDelivery: delivery,
      },
    },
    runPatch: {
      metadata: {
        reviewRequired: false,
        reviewReceipt: receipt,
        delivery,
      },
    },
  };
}

export function requestAutomationChanges(input: {
  task: TaskRecord;
  taskRun: TaskRunRecord;
  reviewer: string;
  note: string;
  now?: () => string;
}) {
  assertReviewable(input.task, input.taskRun);
  const reviewedAt = input.now ? input.now() : new Date().toISOString();
  const reviewRequest = buildReceipt({
    status: 'changes_requested',
    task: input.task,
    taskRun: input.taskRun,
    reviewer: input.reviewer,
    reviewedAt,
    note: input.note.trim(),
  });

  return {
    reviewRequest,
    taskPatch: {
      status: 'blocked' as const,
      delegationState: 'review' as const,
      metadata: {
        reviewRequired: true,
        reviewRequest,
      },
    },
    runPatch: {
      metadata: {
        reviewRequired: true,
        reviewRequest,
      },
    },
  };
}

function hasEnv(env: Record<string, string | undefined>, key: string) {
  return Boolean(env[key]?.trim());
}

function stepNeedsSearch(step: PersistedAutomationStep) {
  return step.kind === 'search';
}

function stepNeedsModel(step: PersistedAutomationStep) {
  return step.kind === 'summarize' || step.kind === 'analyze';
}

function stepNeedsSlack(step: PersistedAutomationStep, notify?: string) {
  const target = step.deliveryTarget?.target || notify || '';
  const channel = step.deliveryTarget?.channel || (target.includes('@') ? 'email' : 'slack');
  return step.kind === 'deliver' && channel === 'slack';
}

function stepNeedsEmail(step: PersistedAutomationStep, notify?: string) {
  const target = step.deliveryTarget?.target || notify || '';
  const channel = step.deliveryTarget?.channel || (target.includes('@') ? 'email' : 'slack');
  return step.kind === 'deliver' && channel === 'email';
}

function blocker(key: string, label: string, detail: string): AutomationPreflightBlocker {
  return { key, label, detail, severity: 'blocking' };
}

function warning(key: string, label: string, detail: string): AutomationPreflightBlocker {
  return { key, label, detail, severity: 'warning' };
}

function isValidEmailTarget(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function isSlackChannelId(value: string) {
  return /^[CGD][A-Z0-9]{8,}$/.test(value.trim());
}

function collectDeliveryTargets(input: {
  notify?: string | null;
  steps?: PersistedAutomationStep[];
}) {
  const targets: Array<{ channel: AutomationStepDeliveryTarget['channel']; target: string; source: string }> = [];
  const notify = readString(input.notify);
  if (notify) {
    targets.push({
      channel: notify.includes('@') ? 'email' : 'slack',
      target: notify,
      source: 'workspace destination',
    });
  }

  for (const step of input.steps || []) {
    if (step.kind !== 'deliver') continue;
    const target = readString(step.deliveryTarget?.target);
    if (!target) continue;
    targets.push({
      channel: step.deliveryTarget?.channel || (target.includes('@') ? 'email' : 'slack'),
      target,
      source: step.title || step.id || 'delivery step',
    });
  }

  return targets;
}

export function validateAutomationDeliveryDraft(input: {
  notify?: string | null;
  steps?: PersistedAutomationStep[];
}): AutomationDeliveryDraftValidation {
  const warnings: AutomationPreflightBlocker[] = [];
  const warningKeys = new Set<string>();

  for (const item of collectDeliveryTargets(input)) {
    if (item.channel === 'email') {
      if (!isValidEmailTarget(item.target)) {
        throw new Error(`${item.source} needs a valid email address before this workflow can be saved.`);
      }
      continue;
    }

    if (!isSlackChannelId(item.target)) {
      const key = `SLACK_TARGET:${item.target}`;
      if (warningKeys.has(key)) continue;
      warningKeys.add(key);
      warnings.push(warning(
        key,
        'Slack channel visibility',
        `${item.source} uses ${item.target}. Violema will verify the Slack channel at delivery time; invite the app to private channels or use a channel ID for the most reliable run.`,
      ));
    }
  }

  return { ok: true, warnings };
}

export function classifyAutomationRunOutcome(input: {
  deliveryWaitingForReview?: boolean;
  deliveryError?: string | null;
  stepExecutions: Array<Pick<AutomationStepExecution, 'status' | 'title' | 'error' | 'kind' | 'stepId'>>;
}): AutomationRunOutcome {
  const failedStep = input.stepExecutions.find((step) => {
    if (step.status !== 'failed') return false;

    const isSystemSummary =
      step.kind === 'summarize' &&
      step.title === 'Generate automation summary' &&
      /^auto_step_/.test(step.stepId);

    return !isSystemSummary;
  });
  if (input.deliveryError || failedStep) {
    const detail = input.deliveryError || failedStep?.error || `${failedStep?.title || 'A workflow step'} failed.`;
    return {
      taskStatus: 'blocked',
      runStatus: 'failed',
      delegationState: 'review',
      schedulerOk: false,
      reviewRequired: false,
      reviewSummary: `Run needs attention before it can be trusted or delivered. ${detail}`,
    };
  }

  if (input.deliveryWaitingForReview) {
    return {
      taskStatus: 'waiting_review',
      runStatus: 'succeeded',
      delegationState: 'review',
      schedulerOk: true,
      reviewRequired: true,
      reviewSummary: 'Delivery is prepared and waiting for approval.',
    };
  }

  return {
    taskStatus: 'completed',
    runStatus: 'succeeded',
    delegationState: 'completed',
    schedulerOk: true,
    reviewRequired: false,
    reviewSummary: 'Run completed cleanly.',
  };
}

export function buildAutomationPreflightReport(input: {
  automation: {
    id: string;
    name: string;
    schedule: string;
    actions: string[];
    notify?: string;
    steps?: PersistedAutomationStep[];
  };
  env?: Record<string, string | undefined>;
}): AutomationPreflightReport {
  const env = input.env || process.env;
  const steps = input.automation.steps || [];
  const blockers: AutomationPreflightBlocker[] = [];

  if (steps.some(stepNeedsSearch) && !hasEnv(env, 'TAVILY_API_KEY')) {
    blockers.push(blocker(
      'TAVILY_API_KEY',
      'Search provider',
      'Search/research steps need Tavily before this mission can complete.',
    ));
  }

  if (steps.some(stepNeedsModel) && !hasEnv(env, 'ANTHROPIC_API_KEY') && !hasEnv(env, 'OPENROUTER_API_KEY')) {
    blockers.push(blocker(
      'ANTHROPIC_API_KEY or OPENROUTER_API_KEY',
      'Reasoning model',
      'Analysis and summarization steps need at least one configured model provider.',
    ));
  }

  if (steps.some((step) => stepNeedsSlack(step, input.automation.notify)) && !hasEnv(env, 'SLACK_BOT_TOKEN')) {
    blockers.push(blocker(
      'SLACK_BOT_TOKEN',
      'Slack delivery',
      'Slack delivery steps need a bot token and channel visibility before activation.',
    ));
  }

  if (steps.some((step) => stepNeedsEmail(step, input.automation.notify)) && (!hasEnv(env, 'POSTMARK_API_KEY') || !hasEnv(env, 'POSTMARK_FROM_EMAIL'))) {
    blockers.push(blocker(
      'POSTMARK_API_KEY and POSTMARK_FROM_EMAIL',
      'Email delivery',
      'Email delivery steps need Postmark credentials before activation.',
    ));
  }

  let deliveryWarnings: AutomationPreflightBlocker[] = [];
  try {
    deliveryWarnings = validateAutomationDeliveryDraft({
      notify: input.automation.notify,
      steps,
    }).warnings;
  } catch (error) {
    blockers.push(blocker(
      'DELIVERY_TARGET',
      'Delivery target',
      error instanceof Error ? error.message : 'Delivery target needs attention before this mission can complete.',
    ));
  }

  return {
    ready: blockers.length === 0,
    blockers,
    warnings: deliveryWarnings,
    summary: blockers.length === 0
      ? deliveryWarnings.length > 0
        ? 'Ready to run, with delivery visibility checks deferred until send time.'
        : 'Ready to run. Required execution credentials are configured.'
      : `${blockers.length} blocker${blockers.length === 1 ? '' : 's'} must be fixed before this mission can complete.`,
  };
}
