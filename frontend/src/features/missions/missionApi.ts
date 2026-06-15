import type { MissionSourceTask } from './missionPresenter';

export interface MissionApiPlanStep {
  id: string;
  title: string;
  objective: string;
  kind: string;
  assignedRole: string;
  toolName?: string;
  integrationId?: string;
  currentStatus: string;
  estimatedCredits?: number;
  actualCredits?: number;
  summary?: string;
  error?: string;
}

export interface MissionApiRecord {
  id: string;
  workspaceId: string;
  title: string;
  goal: string;
  status: string;
  source?: string;
  sourcePrompt?: string;
  workflowTemplateId?: string;
  automationId?: string;
  activeTaskId?: string;
  activeRunId?: string;
  creditBudget?: number;
  review: {
    policy: string;
    requiredRoles?: string[];
    approvalChannel?: string;
  };
  plan: {
    steps: MissionApiPlanStep[];
    primaryRole: string;
    supportingRoles: string[];
    estimatedCredits?: number;
  };
  createdAt: string;
  updatedAt: string;
  metadata?: Record<string, unknown>;
}

function readString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function readNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function readStringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : undefined;
}

function readRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
}

function readArtifactItems(value: unknown): MissionSourceTask['latestArtifacts'] {
  if (!Array.isArray(value)) return undefined;
  const items: NonNullable<MissionSourceTask['latestArtifacts']> = [];
  value
    .map((item) => {
      const record = readRecord(item);
      if (!record) return null;
      const title = readString(record.title);
      const kind = readString(record.kind);
      if (!title || !kind) return null;
      return {
        id: readString(record.id),
        title,
        kind,
        source: readString(record.source),
        summary: readString(record.summary),
        payload: readRecord(record.payload),
      };
    })
    .forEach((item) => {
      if (item) items.push(item);
    });
  return items;
}

function readStepItems(value: unknown): MissionSourceTask['latestStepExecutions'] {
  if (!Array.isArray(value)) return undefined;
  const items: NonNullable<MissionSourceTask['latestStepExecutions']> = [];
  value
    .map((item) => {
      const record = readRecord(item);
      if (!record) return null;
      const stepId = readString(record.stepId) || readString(record.id);
      const kind = readString(record.kind);
      const title = readString(record.title);
      const assignedRole = readString(record.assignedRole);
      const status = readString(record.status);
      if (!stepId || !kind || !title || !assignedRole || !status) return null;
      return {
        id: readString(record.id),
        stepId,
        kind,
        title,
        objective: readString(record.objective),
        status,
        assignedRole,
        modelTier: readString(record.modelTier),
        modelSource: readString(record.modelSourceLabel) || readString(record.modelSource),
        toolName: readString(record.toolName),
        estimatedCredits: readNumber(record.estimatedCredits),
        actualCredits: readNumber(record.actualCredits),
        summary: readString(record.summary),
        error: readString(record.error),
      };
    })
    .forEach((item) => {
      if (item) items.push(item);
    });
  return items;
}

function mapPlanSteps(steps: MissionApiPlanStep[]): MissionSourceTask['steps'] {
  return steps.map((step) => ({
    id: step.id,
    stepId: step.id,
    title: step.title,
    objective: step.objective,
    kind: step.kind,
    status: step.currentStatus,
    assignedRole: step.assignedRole,
    toolName: step.toolName || step.integrationId,
    estimatedCredits: step.estimatedCredits,
    actualCredits: step.actualCredits,
    summary: step.summary,
    error: step.error,
  }));
}

export function mapMissionRecordToSourceTask(mission: MissionApiRecord): MissionSourceTask {
  const metadata = mission.metadata || {};
  const latestStepExecutions = readStepItems(metadata.latestStepExecutions);

  return {
    id: mission.id,
    taskId: mission.activeTaskId,
    taskRunId: mission.activeRunId,
    automationId: mission.automationId,
    title: mission.title,
    description: mission.goal,
    authoringMode: readString(metadata.authoringMode),
    workflowPrompt: mission.sourcePrompt,
    status: mission.status,
    runStatus: mission.status,
    lastRunStatus: readString(metadata.lastRunStatus),
    automationStatus: mission.status === 'paused' ? 'paused' : undefined,
    schedule: readString(metadata.schedule),
    notify: readString(metadata.notify) || mission.review.approvalChannel,
    condition: readString(metadata.condition),
    nextRunAt: readString(metadata.nextRunAt),
    lastRunAt: readString(metadata.lastRunAt),
    estimatedCredits: readNumber(metadata.estimatedCredits) || mission.plan.estimatedCredits,
    actualCredits: readNumber(metadata.actualCredits),
    agentRole: mission.plan.primaryRole,
    latestSummary: readString(metadata.latestSummary),
    latestArtifacts: readArtifactItems(metadata.latestArtifacts),
    latestStepExecutions,
    steps: latestStepExecutions?.length ? undefined : mapPlanSteps(mission.plan.steps),
    actions: readStringArray(metadata.actions),
    workerTopology: readRecord(metadata.workerTopology) as MissionSourceTask['workerTopology'],
  };
}
