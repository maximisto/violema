export interface MissionSelectableTask {
  id: string | number;
  automationId?: string;
  taskId?: string;
  taskRunId?: string;
  title?: string;
}

const TARGET_QUERY_KEYS = ['automation', 'mission', 'task', 'run'] as const;

export function getMissionSelectionStorageKey(workspaceId: string) {
  return `violema_selected_mission_${workspaceId}`;
}

export function getMissionTargetFromSearch(search: string) {
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  for (const key of TARGET_QUERY_KEYS) {
    const value = params.get(key);
    if (value?.trim()) return value.trim();
  }
  return undefined;
}

export function getPreferredMissionTarget(task: MissionSelectableTask) {
  return task.automationId || task.taskId || task.taskRunId || String(task.id);
}

export function matchesMissionTarget(task: MissionSelectableTask, target: string | number | null | undefined) {
  if (target == null) return false;
  const normalizedTarget = String(target);
  return [
    task.id,
    task.automationId,
    task.taskId,
    task.taskRunId,
  ].some((value) => value != null && String(value) === normalizedTarget);
}

export function findTaskByMissionTarget<T extends MissionSelectableTask>(
  tasks: T[],
  target: string | number | null | undefined,
) {
  if (target == null) return undefined;
  return tasks.find((task) => matchesMissionTarget(task, target));
}

export function resolveInitialSelectedTaskId<T extends MissionSelectableTask>(
  tasks: T[],
  options: {
    search?: string;
    storedTaskId?: string | number | null;
  } = {},
) {
  if (tasks.length === 0) return '';

  const urlTarget = options.search ? getMissionTargetFromSearch(options.search) : undefined;
  const urlMatch = findTaskByMissionTarget(tasks, urlTarget);
  if (urlMatch) return urlMatch.id;

  const storedMatch = findTaskByMissionTarget(tasks, options.storedTaskId);
  if (storedMatch) return storedMatch.id;

  return tasks[0].id;
}

export function buildSelectedMissionSearch(search: string, task: MissionSelectableTask) {
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  TARGET_QUERY_KEYS.forEach((key) => params.delete(key));

  if (task.automationId) {
    params.set('automation', task.automationId);
  } else if (task.taskId) {
    params.set('task', task.taskId);
  } else if (task.taskRunId) {
    params.set('run', task.taskRunId);
  } else {
    params.set('mission', String(task.id));
  }

  const nextSearch = params.toString();
  return nextSearch ? `?${nextSearch}` : '';
}
