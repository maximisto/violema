import type { MissionStatus } from './types';

/**
 * Mission status normalization, extracted out of `missionPresenter` so that
 * anything needing to answer "is this mission waiting for a human?" agrees with
 * the presenter instead of re-deriving it. The Reviews queue and the mission
 * detail view diverging on that question is what made a `waiting_review`
 * mission invisible in the Reviews tab.
 *
 * This module is deliberately a leaf: it imports nothing at runtime (the one
 * import is type-only and erased), which keeps it directly loadable by the
 * Node-based contract tests without a bundler.
 */

/** Minimal structural shape needed to decide a mission's review state. */
export interface MissionStatusSource {
  status?: string;
  runStatus?: string;
  lastRunStatus?: string;
  automationStatus?: string;
  notify?: string;
  latestDelivery?: Record<string, unknown>;
  reviewReceipt?: Record<string, unknown>;
}

export function readStringValue(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

/** A delivered receipt outranks any stale `waiting_review` run status. */
export function isDeliveredReview(task?: MissionStatusSource | null) {
  return (
    readStringValue(task?.latestDelivery?.status) === 'delivered' ||
    readStringValue(task?.reviewReceipt?.status) === 'delivered'
  );
}

export function deliveredTargetLabel(task?: MissionStatusSource | null) {
  return (
    readStringValue(task?.latestDelivery?.to) ||
    readStringValue(task?.reviewReceipt?.deliveryTarget) ||
    task?.notify ||
    'the configured delivery target'
  );
}

export function normalizeMissionStatus(task?: MissionStatusSource | null): MissionStatus {
  if (!task) return 'planned';
  if (isDeliveredReview(task)) return 'completed';
  if (task.automationStatus === 'paused') return 'paused';
  const status = task.runStatus || task.lastRunStatus || task.status || 'planned';
  if (status === 'running' || status === 'retrying' || status === 'active') return 'running';
  if (status === 'waiting_review' || status === 'review') return 'waiting_review';
  if (status === 'failed' || status === 'alert' || status === 'error') return 'failed';
  if (status === 'succeeded' || status === 'complete' || status === 'completed') return 'completed';
  return 'planned';
}

/** True when this mission is holding a delivery behind a human approval gate. */
export function isAwaitingReview(task?: MissionStatusSource | null) {
  return normalizeMissionStatus(task) === 'waiting_review';
}
