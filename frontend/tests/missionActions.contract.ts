import {
  applyMissionAction,
  buildMissionActionId,
  findMissionAction,
  normalizeMissionActions,
} from '../src/features/missions/missionActions';

function assert(condition: unknown, message: string) {
  if (!condition) {
    throw new Error(message);
  }
}

const actionId = buildMissionActionId({
  workspaceId: 'acme',
  missionId: 'weekly-founder-update',
  kind: 'lesson_saved',
  targetId: 'credit-pattern',
});

assert(
  actionId === 'acme:weekly-founder-update:lesson_saved:credit-pattern',
  'builds a stable mission action id'
);

const first = applyMissionAction([], {
  workspaceId: 'acme',
  missionId: 'weekly-founder-update',
  kind: 'lesson_saved',
  targetId: 'credit-pattern',
  label: 'Saved credit pattern',
}, '2026-06-15T10:00:00.000Z');

assert(first.length === 1, 'stores the first mission action');
assert(first[0]?.createdAt === '2026-06-15T10:00:00.000Z', 'stores the action timestamp');

const updated = applyMissionAction(first, {
  workspaceId: 'acme',
  missionId: 'weekly-founder-update',
  kind: 'lesson_saved',
  targetId: 'credit-pattern',
  label: 'Updated credit pattern',
}, '2026-06-15T11:00:00.000Z');

assert(updated.length === 1, 'upserts duplicate mission actions by stable id');
assert(updated[0]?.label === 'Updated credit pattern', 'refreshes the action label');
assert(updated[0]?.createdAt === '2026-06-15T10:00:00.000Z', 'keeps the original saved timestamp');

const found = findMissionAction(updated, {
  workspaceId: 'acme',
  missionId: 'weekly-founder-update',
  kind: 'lesson_saved',
  targetId: 'credit-pattern',
});

assert(found?.label === 'Updated credit pattern', 'finds a stored mission action');

const normalized = normalizeMissionActions([
  updated[0],
  { id: 'bad', workspaceId: 'acme', missionId: 'weekly', kind: 'unknown' },
  null,
]);

assert(normalized.length === 1, 'drops malformed mission action records');
