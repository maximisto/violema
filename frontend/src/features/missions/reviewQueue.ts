// Explicit `.ts` specifier (allowed here by `allowImportingTsExtensions` in
// tsconfig) so the Node contract test can import this module directly. The rest
// of the feature folder uses extensionless imports; only the modules on this
// test-loadable leaf path spell the extension out.
import { isAwaitingReview, type MissionStatusSource } from './missionStatus.ts';

/**
 * The Reviews tab's queue.
 *
 * Root cause this exists to fix: the Reviews area rendered `MissionReviews` for
 * the *selected* mission only. A mission in `waiting_review` that the API
 * returned first was still invisible whenever the selection pointer (URL param,
 * then the persisted `violema_selected_mission_<workspaceId>` key, then
 * `tasks[0]`) resolved to some other mission — the tab then showed that other
 * mission's empty gate ("No review gate is open") with nothing on screen
 * admitting an approval was pending elsewhere. A tab named Reviews has to list
 * every mission awaiting review, independent of which one is selected.
 */

export interface MissionReviewQueueTask extends MissionStatusSource {
  id: string | number;
  title?: string;
  automationId?: string;
  taskId?: string;
  taskRunId?: string;
  description?: string;
}

export interface MissionReviewQueueEntry {
  id: string | number;
  key: string;
  title: string;
  deliveryLabel: string;
  automationId?: string;
}

function entryKey(task: MissionReviewQueueTask) {
  return String(task.automationId || task.taskId || task.taskRunId || task.id);
}

/**
 * Every mission holding a delivery behind an approval gate, in the order the
 * API served them. Delivered receipts drop out via `isAwaitingReview`, so an
 * already-approved run never lingers in the queue.
 */
export function buildMissionReviewQueue<T extends MissionReviewQueueTask>(
  tasks: readonly T[] | null | undefined,
): MissionReviewQueueEntry[] {
  if (!Array.isArray(tasks)) return [];

  const seen = new Set<string>();
  const queue: MissionReviewQueueEntry[] = [];

  tasks.forEach((task) => {
    if (!isAwaitingReview(task)) return;
    const key = entryKey(task);
    if (seen.has(key)) return;
    seen.add(key);
    queue.push({
      id: task.id,
      key,
      title: task.title?.trim() || 'Untitled mission',
      deliveryLabel: task.notify?.trim() || 'Review before delivery',
      automationId: task.automationId,
    });
  });

  return queue;
}

/**
 * Which mission the Reviews tab should focus. Keeps the user's selection when
 * that mission is itself awaiting review; otherwise hands focus to the first
 * pending approval so opening Reviews never lands on an empty gate while work
 * is queued. Returns `null` when there is nothing to move to.
 */
export function resolveReviewQueueFocus(
  queue: readonly MissionReviewQueueEntry[],
  selectedTaskId: string | number | null | undefined,
): string | number | null {
  if (queue.length === 0) return null;
  if (selectedTaskId != null && queue.some((entry) => String(entry.id) === String(selectedTaskId))) {
    return null;
  }
  return queue[0].id;
}
