import {
  buildSelectedMissionSearch,
  findTaskByMissionTarget,
  getMissionSelectionStorageKey,
  resolveInitialSelectedTaskId,
} from '../src/features/missions/missionSelectionState';

function assert(condition: unknown, message: string) {
  if (!condition) {
    throw new Error(message);
  }
}

const tasks = [
  {
    id: 'auto_weekly',
    automationId: 'auto_weekly',
    taskId: 'task_weekly',
    taskRunId: 'run_weekly',
    title: 'Weekly founder update',
  },
  {
    id: 'auto_pipeline',
    automationId: 'auto_pipeline',
    taskId: 'task_pipeline',
    taskRunId: 'run_pipeline',
    title: 'Pipeline review',
  },
];

assert(
  getMissionSelectionStorageKey('purpleorangehq') === 'violema_selected_mission_purpleorangehq',
  'builds workspace-scoped selection storage key',
);

assert(
  findTaskByMissionTarget(tasks, 'task_pipeline')?.id === 'auto_pipeline',
  'finds a task by backend task id',
);

assert(
  findTaskByMissionTarget(tasks, 'run_weekly')?.id === 'auto_weekly',
  'finds a task by backend run id',
);

assert(
  resolveInitialSelectedTaskId(tasks, {
    search: '?automation=auto_pipeline',
    storedTaskId: 'auto_weekly',
  }) === 'auto_pipeline',
  'URL automation target wins over stored selection',
);

assert(
  resolveInitialSelectedTaskId(tasks, {
    search: '?task=task_weekly',
    storedTaskId: 'auto_pipeline',
  }) === 'auto_weekly',
  'URL task target can restore a mission across backend ids',
);

assert(
  resolveInitialSelectedTaskId(tasks, {
    search: '',
    storedTaskId: 'run_pipeline',
  }) === 'auto_pipeline',
  'stored backend run id resolves to the current dashboard task id',
);

assert(
  resolveInitialSelectedTaskId(tasks, {
    search: '?automation=missing',
    storedTaskId: 'missing',
  }) === 'auto_weekly',
  'falls back to the first task when URL and storage are stale',
);

assert(
  buildSelectedMissionSearch('?panel=schedules&checkout=success', tasks[0]) === '?panel=schedules&checkout=success&automation=auto_weekly',
  'writes the automation id while preserving unrelated query state',
);

assert(
  buildSelectedMissionSearch('?automation=old&task=old_task&run=old_run', {
    id: 'task_only',
    taskId: 'task_live',
    title: 'Task-only mission',
  }) === '?task=task_live',
  'uses task id when no automation id exists and removes stale run targets',
);
