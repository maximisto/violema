export type MissionActionKind = 'artifact_opened' | 'artifact_reviewed' | 'lesson_saved';

export interface MissionActionRecord {
  id: string;
  workspaceId: string;
  missionId: string;
  kind: MissionActionKind;
  targetId: string;
  label: string;
  createdAt: string;
}

export interface MissionActionInput {
  workspaceId: string;
  missionId: string;
  kind: MissionActionKind;
  targetId: string;
  label: string;
  createdAt?: string;
}

export function getMissionActionsStorageKey(workspaceId: string) {
  return `violema_mission_actions_${workspaceId}`;
}

export function buildMissionActionId(input: Pick<MissionActionInput, 'workspaceId' | 'missionId' | 'kind' | 'targetId'>) {
  return [input.workspaceId, input.missionId, input.kind, input.targetId]
    .map((part) => String(part).trim().replace(/\s+/g, '-'))
    .join(':');
}

export function applyMissionAction(
  records: MissionActionRecord[],
  input: MissionActionInput,
  now = new Date().toISOString(),
): MissionActionRecord[] {
  const id = buildMissionActionId(input);
  const existing = records.find((record) => record.id === id);
  const next: MissionActionRecord = {
    id,
    workspaceId: input.workspaceId,
    missionId: input.missionId,
    kind: input.kind,
    targetId: input.targetId,
    label: input.label,
    createdAt: existing?.createdAt || input.createdAt || now,
  };

  return [next, ...records.filter((record) => record.id !== id)];
}

export function findMissionAction(
  records: MissionActionRecord[],
  input: Pick<MissionActionInput, 'workspaceId' | 'missionId' | 'kind' | 'targetId'>,
) {
  const id = buildMissionActionId(input);
  return records.find((record) => record.id === id);
}

function isMissionActionRecord(value: unknown): value is MissionActionRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.id === 'string' &&
    typeof record.workspaceId === 'string' &&
    typeof record.missionId === 'string' &&
    (record.kind === 'artifact_opened' || record.kind === 'artifact_reviewed' || record.kind === 'lesson_saved') &&
    typeof record.targetId === 'string' &&
    typeof record.label === 'string' &&
    typeof record.createdAt === 'string'
  );
}

export function normalizeMissionActions(value: unknown): MissionActionRecord[] {
  if (!Array.isArray(value)) return [];
  return value.filter(isMissionActionRecord);
}
