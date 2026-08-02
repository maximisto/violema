// The single implementation of "approve this review" and "request changes on
// this review", shared by the dashboard's HTTP routes and the Slack interactive
// card.
//
// Why this module exists: an approval is a decision to send something real. If
// Slack and the dashboard each had their own copy of that decision path, the
// provenance re-scan, the dry-run semantics, the ledger events, and the
// consumed-review guard would drift, and the two surfaces would eventually
// disagree about what has already been sent. They call the same function
// instead, and the caller's only job is to render the outcome.
//
// Outcomes are returned, not thrown, as a discriminated union. The HTTP layer
// maps them to status codes and the Slack layer maps them to a chat.update —
// from the same values, so "already approved" means the same thing on both.

import { getAutomationById } from './scheduler';
import { listTaskRuns, listTasks, updateTask, updateTaskRun } from './platform/store';
import { approveAutomationReview, requestAutomationChanges } from './platform/automationLifecycle';
import { buildFabricatedEvidenceDeliveryError, findFabricatedEvidence } from './platform/provenance';
import { isDemoWorkspace } from './platform/demoWorkspace';
import { DEFAULT_WORKSPACE_ID } from './platform/workspace';
import { inferWorkflowIdFromAutomation } from './integrationGateway/workflowPolicy';
import { appendWorkflowLedgerEvent } from './integrationGateway/auditLog';
import type { AutomationStepDeliveryTarget, TaskRecord, TaskRunRecord } from './platform/types';

/**
 * Who performed the action. Recorded on every ledger event so the audit trail
 * distinguishes a dashboard click from a Slack button, and names the human.
 * Identifiers only — never message content.
 */
export interface ReviewActor {
  surface: 'dashboard' | 'slack';
  /** Human-readable reviewer name stored on the receipt. */
  label: string;
  slackUserId?: string;
  email?: string;
}

export interface ReviewSendInput {
  to: string;
  body: string;
  subject?: string;
  channel?: AutomationStepDeliveryTarget['channel'];
  evidenceLinks?: Array<{ url: string; label: string }>;
  chartSpecs?: unknown[];
}

export type ReviewSend = (input: ReviewSendInput) => Promise<Record<string, unknown>>;

/** Summary of a review that was already closed, so callers can say by whom and when. */
export interface ResolvedReviewSummary {
  status: 'delivered' | 'changes_requested';
  reviewer: string;
  reviewedAt: string;
}

/** The full automation record, so callers that also need steps/schedule (the rerun route) keep working. */
export type ReviewAutomation = NonNullable<ReturnType<typeof getAutomationById>>;

export interface ReviewActionContext {
  automation: ReviewAutomation;
  task: TaskRecord;
  taskRun: TaskRunRecord;
}

/**
 * `missionName` is present whenever the failure happened after the review was
 * resolved, so a Slack card can name the mission it is reporting on instead of
 * degrading to a generic label.
 */
export type ReviewActionFailure =
  | { status: 'not_found'; error: string; missionName?: string }
  | { status: 'invalid'; error: string; missionName?: string; resolved?: ResolvedReviewSummary }
  | { status: 'fabricated_evidence'; error: string; missionName?: string }
  | { status: 'scan_failed'; error: string; missionName?: string }
  | { status: 'failed'; error: string; missionName?: string };

export type ApproveReviewResult =
  | {
      status: 'ok';
      dryRun: boolean;
      context: ReviewActionContext;
      receipt: Record<string, unknown>;
      delivery: Record<string, unknown>;
      task?: TaskRecord | null;
      taskRun?: TaskRunRecord | null;
      taskPatch: unknown;
      runPatch: unknown;
      ledgerEvents: Array<Record<string, unknown>>;
    }
  | ReviewActionFailure;

export type RequestChangesResult =
  | {
      status: 'ok';
      dryRun: boolean;
      context: ReviewActionContext;
      reviewRequest: Record<string, unknown>;
      task?: TaskRecord | null;
      taskRun?: TaskRunRecord | null;
      taskPatch: unknown;
      runPatch: unknown;
      ledgerEvents: Array<Record<string, unknown>>;
    }
  | ReviewActionFailure;

function getAutomationWorkspaceId(automation: { workspaceId?: string } | null | undefined) {
  return automation?.workspaceId || DEFAULT_WORKSPACE_ID;
}

function automationBelongsToWorkspace(
  automation: { workspaceId?: string } | null | undefined,
  workspaceId: string,
) {
  return getAutomationWorkspaceId(automation) === workspaceId;
}

/**
 * Resolves the automation + task + run triple for a review, scoped to the
 * workspace. Kept here rather than in server.ts so both surfaces resolve
 * reviews through identical rules.
 */
export function findAutomationReviewContext(
  workspaceId: string,
  automationId: string,
  runId: string,
): ReviewActionContext | { error: string } {
  const automation = getAutomationById(automationId);
  if (!automation || !automationBelongsToWorkspace(automation, workspaceId)) {
    return { error: 'Automation not found' };
  }

  const taskRun = listTaskRuns(workspaceId).find((run) =>
    run.id === runId &&
    typeof run.metadata?.automationId === 'string' &&
    run.metadata.automationId === automationId
  );
  if (!taskRun) return { error: 'Automation run not found' };

  const task = listTasks(workspaceId).find((item) => item.id === taskRun.taskId);
  if (!task) return { error: 'Mission task not found' };

  return { automation, task, taskRun };
}

function toFailure(error: string): ReviewActionFailure {
  return error === 'Automation not found'
    ? { status: 'not_found', error }
    : { status: 'invalid', error };
}

/**
 * Reads the receipt left behind by whichever surface closed this review first.
 * This is what turns a second click into "already approved by X at Y" instead
 * of an opaque error.
 */
export function readResolvedReviewSummary(
  task: TaskRecord,
  taskRun: TaskRunRecord,
): ResolvedReviewSummary | undefined {
  const candidates = [
    taskRun.metadata?.reviewReceipt,
    task.metadata?.reviewReceipt,
    taskRun.metadata?.reviewRequest,
    task.metadata?.reviewRequest,
  ];

  for (const candidate of candidates) {
    if (!candidate || typeof candidate !== 'object') continue;
    const record = candidate as Record<string, unknown>;
    const status = record.status;
    if (status !== 'delivered' && status !== 'changes_requested') continue;
    return {
      status,
      reviewer: typeof record.reviewer === 'string' ? record.reviewer : 'someone',
      reviewedAt: typeof record.reviewedAt === 'string' ? record.reviewedAt : '',
    };
  }

  return undefined;
}

function applyReviewTaskPatch(
  taskId: string,
  currentMetadata: Record<string, unknown> | undefined,
  patch: { status: 'completed' | 'blocked'; delegationState: 'completed' | 'review'; metadata?: Record<string, unknown> },
) {
  return updateTask(taskId, {
    ...patch,
    metadata: {
      ...(currentMetadata || {}),
      ...(patch.metadata || {}),
    },
  });
}

/**
 * The ledger records THAT a delivery happened — target, channel, status,
 * timestamps — never what it said.
 *
 * `approveAutomationReview` returns the send result with the rendered brief
 * appended as `body`, which is the right shape for the HTTP response but must
 * not be persisted: the repo rule is that raw bodies and full document text
 * stay out of ledger metadata. Stripped here, at the one place that writes it.
 */
function summarizeDeliveryForLedger(delivery: Record<string, unknown>) {
  const { body, text, blocks, ...rest } = delivery;
  void body;
  void text;
  void blocks;
  return rest;
}

/** Identifiers only — the audit trail records who acted, never what was written. */
function actorMetadata(actor: ReviewActor) {
  return {
    surface: actor.surface,
    ...(actor.slackUserId ? { slackUserId: actor.slackUserId } : {}),
    ...(actor.email ? { email: actor.email } : {}),
    label: actor.label,
  };
}

/**
 * Runs the provenance re-scan that guards the approval gate.
 *
 * The run-time scan fires at delivery; this is a second, later decision against
 * evidence stored on disk, so what is about to be sent is checked again using
 * the same artifact resolution order the delivery path uses. A scan that cannot
 * complete fails CLOSED.
 */
function scanStoredEvidence(context: ReviewActionContext, workspaceId: string): ReviewActionFailure | null {
  if (isDemoWorkspace(workspaceId)) return null;

  try {
    const storedArtifacts = (Array.isArray(context.taskRun.metadata?.artifacts)
      ? context.taskRun.metadata.artifacts
      : Array.isArray(context.task.metadata?.latestArtifacts)
        ? context.task.metadata.latestArtifacts
        : []) as Parameters<typeof findFabricatedEvidence>[0]['artifacts'];
    const storedStepExecutions = (Array.isArray(context.taskRun.metadata?.stepExecutions)
      ? context.taskRun.metadata.stepExecutions
      : Array.isArray(context.task.metadata?.latestStepExecutions)
        ? context.task.metadata.latestStepExecutions
        : []) as Parameters<typeof findFabricatedEvidence>[0]['stepExecutions'];
    const fabricated = findFabricatedEvidence({
      artifacts: storedArtifacts,
      stepExecutions: storedStepExecutions,
    });
    if (fabricated) {
      return {
        status: 'fabricated_evidence',
        error: buildFabricatedEvidenceDeliveryError(fabricated),
        missionName: context.automation.name,
      };
    }
  } catch (error) {
    console.error('[automation] provenance re-scan failed at approval', error);
    return {
      status: 'scan_failed',
      error: 'Could not verify stored run evidence before sending. Try again.',
      missionName: context.automation.name,
    };
  }

  return null;
}

export async function executeReviewApproval(input: {
  workspaceId: string;
  automationId: string;
  runId: string;
  actor: ReviewActor;
  dryRun?: boolean;
  send: ReviewSend;
  onBroadcast?: (context: ReviewActionContext, eventType: string) => void;
}): Promise<ApproveReviewResult> {
  const context = findAutomationReviewContext(input.workspaceId, input.automationId, input.runId);
  if ('error' in context) return toFailure(context.error);

  const scanFailure = scanStoredEvidence(context, input.workspaceId);
  if (scanFailure) return scanFailure;

  // Claim the review BEFORE the send. `approveAutomationReview` awaits a real
  // network send, so without a synchronous claim two approvals arriving inside
  // that window (dashboard + Slack button, or two Slack clicks) would both pass
  // the waiting_review check and deliver the same brief twice. The store is
  // single-process, so flipping status here is atomic with respect to the next
  // caller; the claim is reverted below if the send fails, leaving the review
  // exactly as it was.
  const claim = input.dryRun ? null : claimReviewForDelivery(context, input.actor);
  if (claim && 'alreadyClaimed' in claim) {
    return {
      status: 'invalid',
      error: 'This mission is not waiting for review.',
      missionName: context.automation.name,
      resolved: readResolvedReviewSummary(context.task, context.taskRun),
    };
  }

  try {
    const result = await approveAutomationReview({
      task: context.task,
      taskRun: context.taskRun,
      reviewer: input.actor.label,
      send: input.send,
    });

    const workflowId = inferWorkflowIdFromAutomation(context.automation);
    const actor = actorMetadata(input.actor);
    const approvalLedgerEvent = {
      workspaceId: input.workspaceId,
      workflowId,
      automationId: context.automation.id,
      taskId: context.task.id,
      taskRunId: context.taskRun.id,
      type: 'approval_granted' as const,
      summary: `Approved delivery to ${result.receipt.deliveryTarget || 'configured destination'}.`,
      metadata: { receipt: result.receipt, actor },
    };
    const deliveryLedgerEvent = {
      workspaceId: input.workspaceId,
      workflowId,
      automationId: context.automation.id,
      taskId: context.task.id,
      taskRunId: context.taskRun.id,
      type: 'external_action_executed' as const,
      summary: `Delivered approved workflow output to ${result.receipt.deliveryTarget || 'configured destination'}.`,
      metadata: { delivery: summarizeDeliveryForLedger(result.delivery), actor },
    };

    if (input.dryRun) {
      return {
        status: 'ok',
        dryRun: true,
        context,
        receipt: result.receipt as unknown as Record<string, unknown>,
        delivery: result.delivery,
        taskPatch: result.taskPatch,
        runPatch: result.runPatch,
        ledgerEvents: [approvalLedgerEvent, deliveryLedgerEvent],
      };
    }

    const task = applyReviewTaskPatch(context.task.id, context.task.metadata, result.taskPatch);
    const taskRun = updateTaskRun(context.taskRun.id, result.runPatch);
    appendWorkflowLedgerEvent(approvalLedgerEvent);
    appendWorkflowLedgerEvent(deliveryLedgerEvent);
    input.onBroadcast?.(context, 'automation_review_approved');

    return {
      status: 'ok',
      dryRun: false,
      context,
      receipt: result.receipt as unknown as Record<string, unknown>,
      delivery: result.delivery,
      task,
      taskRun,
      taskPatch: result.taskPatch,
      runPatch: result.runPatch,
      ledgerEvents: [approvalLedgerEvent, deliveryLedgerEvent],
    };
  } catch (error) {
    // The send failed, so nothing was delivered: give the review back exactly
    // as it was, or an operator would be left with a mission that can never be
    // approved again.
    if (claim && 'release' in claim) claim.release();
    // `approveAutomationReview` throws when the review is no longer open — the
    // dashboard already consumed it, or the run never parked at review. Carry
    // the existing receipt so the caller can name who closed it.
    return {
      status: 'invalid',
      error: error instanceof Error ? error.message : 'Could not approve delivery',
      missionName: context.automation.name,
      resolved: readResolvedReviewSummary(context.task, context.taskRun),
    };
  }
}

/**
 * Take exclusive ownership of an open review so only one approval can deliver.
 *
 * Moves the task out of `waiting_review` synchronously — the state
 * `assertReviewable` guards on — and records who claimed it. Returns a handle
 * that restores the prior state if the delivery never happens.
 */
function claimReviewForDelivery(
  context: ReviewActionContext,
  actor: ReviewActor,
): { release: () => void } | { alreadyClaimed: true } {
  const current = listTasks(context.task.workspaceId).find((task) => task.id === context.task.id);
  if (!current || current.status !== 'waiting_review') {
    return { alreadyClaimed: true };
  }

  const previousStatus = current.status;
  const previousDelegationState = current.delegationState;
  // `running` is the honest status while the delivery is in flight, and it is
  // not `waiting_review`, which is what makes the claim exclusive.
  updateTask(context.task.id, {
    status: 'running',
    delegationState: 'in_progress',
    metadata: {
      ...(current.metadata || {}),
      deliveryClaim: { by: actor.label, at: new Date().toISOString() },
    },
  });

  return {
    release: () => {
      const claimed = listTasks(context.task.workspaceId).find((task) => task.id === context.task.id);
      const metadata = { ...(claimed?.metadata || current.metadata || {}) };
      delete (metadata as Record<string, unknown>).deliveryClaim;
      updateTask(context.task.id, {
        status: previousStatus,
        delegationState: previousDelegationState,
        metadata,
      });
    },
  };
}

export function executeReviewChangeRequest(input: {
  workspaceId: string;
  automationId: string;
  runId: string;
  actor: ReviewActor;
  note: string;
  dryRun?: boolean;
  onBroadcast?: (context: ReviewActionContext, eventType: string) => void;
}): RequestChangesResult {
  const context = findAutomationReviewContext(input.workspaceId, input.automationId, input.runId);
  if ('error' in context) return toFailure(context.error);

  try {
    const result = requestAutomationChanges({
      task: context.task,
      taskRun: context.taskRun,
      reviewer: input.actor.label,
      note: input.note,
    });

    const deniedLedgerEvent = {
      workspaceId: input.workspaceId,
      workflowId: inferWorkflowIdFromAutomation(context.automation),
      automationId: context.automation.id,
      taskId: context.task.id,
      taskRunId: context.taskRun.id,
      type: 'approval_denied' as const,
      summary: 'Reviewer requested changes before delivery.',
      metadata: { reviewRequest: result.reviewRequest, actor: actorMetadata(input.actor) },
    };

    if (input.dryRun) {
      return {
        status: 'ok',
        dryRun: true,
        context,
        reviewRequest: result.reviewRequest as unknown as Record<string, unknown>,
        taskPatch: result.taskPatch,
        runPatch: result.runPatch,
        ledgerEvents: [deniedLedgerEvent],
      };
    }

    const task = applyReviewTaskPatch(context.task.id, context.task.metadata, result.taskPatch);
    const taskRun = updateTaskRun(context.taskRun.id, result.runPatch);
    appendWorkflowLedgerEvent(deniedLedgerEvent);
    input.onBroadcast?.(context, 'automation_review_changes_requested');

    return {
      status: 'ok',
      dryRun: false,
      context,
      reviewRequest: result.reviewRequest as unknown as Record<string, unknown>,
      task,
      taskRun,
      taskPatch: result.taskPatch,
      runPatch: result.runPatch,
      ledgerEvents: [deniedLedgerEvent],
    };
  } catch (error) {
    return {
      status: 'invalid',
      error: error instanceof Error ? error.message : 'Could not request changes',
      missionName: context.automation.name,
      resolved: readResolvedReviewSummary(context.task, context.taskRun),
    };
  }
}

/** Shared HTTP mapping so both routes answer identically. */
export function reviewFailureStatusCode(failure: ReviewActionFailure): number {
  switch (failure.status) {
    case 'not_found': return 404;
    case 'fabricated_evidence': return 409;
    case 'scan_failed': return 500;
    default: return 400;
  }
}
