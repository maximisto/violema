import type { Express, Request } from 'express';
import type { TaskRecord, TaskRunRecord } from '../platform/types';
import type { AutomationRecord } from '../scheduler';
import { listAutomations, getAutomationById } from '../scheduler';
import { listTasks, listTaskRuns } from '../platform/store';
import {
  mapViolemaRunToAgentStudioRun,
  mapViolemaWorkflowToAgentStudioWorkflow,
} from './adapters/violema';
import type { AgentStudioPhaseKind } from './contract';

type WorkflowBlockKind = AgentStudioPhaseKind;

interface StudioRoutesDeps {
  resolveWorkspaceContext(req: Request): { workspaceId: string };
}

interface StudioRowSummary {
  automation: AutomationRecord;
  task?: TaskRecord;
  runs: TaskRunRecord[];
  latestRun?: TaskRunRecord;
  workerTopology?: unknown;
  stepExecutions: ReturnType<typeof readStepExecutions>;
  workflowSteps: Array<{
    id: string;
    kind: WorkflowBlockKind;
    title: string;
    objective: string;
    inputs?: Record<string, unknown>;
    deliveryTarget?: { channel: 'slack' | 'email'; target: string } | null;
  }>;
  successRate: number;
  averageCredits: number;
  averageDurationMs: number;
}

export function registerAgentStudioRoutes(app: Express, deps: StudioRoutesDeps) {
  app.get('/api/studio/workflows', (req, res) => {
    const { workspaceId } = deps.resolveWorkspaceContext(req);
    res.json({ workspaceId, items: buildStudioWorkflowRows(workspaceId) });
  });

  app.get('/api/studio/workflows/:workflowId', (req, res) => {
    const { workspaceId } = deps.resolveWorkspaceContext(req);
    const row = buildStudioWorkflowRows(workspaceId).find((item) => item.automation.id === req.params.workflowId);
    if (!row) {
      res.status(404).json({ error: 'Workflow not found' });
      return;
    }
    res.json({ workspaceId, item: row, workflow: mapViolemaWorkflowToAgentStudioWorkflow(workspaceId, row.automation) });
  });

  app.get('/api/studio/runs', (req, res) => {
    const { workspaceId } = deps.resolveWorkspaceContext(req);
    const workflowId = typeof req.query.workflowId === 'string' ? req.query.workflowId : undefined;
    const rows = buildStudioWorkflowRows(workspaceId);
    const runs = workflowId
      ? (rows.find((row) => row.automation.id === workflowId)?.runs || [])
        .map((run) => mapViolemaRunToAgentStudioRun(workflowId, run))
      : rows.flatMap((row) => row.runs.map((run) => mapViolemaRunToAgentStudioRun(row.automation.id, run)));
    res.json({ workspaceId, items: runs });
  });

  app.get('/api/studio/replay/:runId', (req, res) => {
    const { workspaceId } = deps.resolveWorkspaceContext(req);
    const rows = buildStudioWorkflowRows(workspaceId);
    const match = rows.find((row) => row.runs.some((run) => run.id === req.params.runId));
    if (!match) {
      res.status(404).json({ error: 'Run not found' });
      return;
    }

    const run = match.runs.find((item) => item.id === req.params.runId)!;
    const stepExecutions = readStepExecutions(run.metadata?.stepExecutions);
    res.json({
      workspaceId,
      workflowId: match.automation.id,
      workflow: mapViolemaWorkflowToAgentStudioWorkflow(workspaceId, match.automation),
      run: mapViolemaRunToAgentStudioRun(match.automation.id, run),
      stepExecutions,
      workerTopology: run.metadata?.topology || run.metadata?.workerTopology || match.task?.metadata?.workerTopology,
      studioState: match.automation.studio_state || {},
    });
  });

  app.get('/api/studio/policies/:workflowId', (req, res) => {
    const { workspaceId } = deps.resolveWorkspaceContext(req);
    const automation = getAutomationById(req.params.workflowId);
    if (!automation) {
      res.status(404).json({ error: 'Workflow not found' });
      return;
    }
    res.json({
      workspaceId,
      workflowId: automation.id,
      policy: automation.execution_policy || null,
      studioState: automation.studio_state || {},
    });
  });
}

function buildStudioWorkflowRows(workspaceId: string): StudioRowSummary[] {
  const automations = listAutomations();
  const tasks = listTasks(workspaceId);
  const runs = listTaskRuns(workspaceId);

  const taskByAutomationId = new Map<string, TaskRecord>();
  const automationIdByTaskId = new Map<string, string>();
  tasks.forEach((task) => {
    const automationId = getTaskAutomationId(task);
    if (!automationId) return;
    taskByAutomationId.set(automationId, task);
    automationIdByTaskId.set(task.id, automationId);
  });

  const runsByAutomationId = new Map<string, TaskRunRecord[]>();
  runs.forEach((run) => {
    const automationId = readString(run.metadata?.automationId) || automationIdByTaskId.get(run.taskId);
    if (!automationId) return;
    const current = runsByAutomationId.get(automationId) || [];
    current.push(run);
    runsByAutomationId.set(automationId, current);
  });

  return automations
    .map((automation) => {
      const task = taskByAutomationId.get(automation.id);
      const workflowSteps = Array.isArray(automation.steps) && automation.steps.length > 0
        ? automation.steps.map((step) => ({
            id: step.id,
            kind: step.kind,
            title: step.title || step.objective,
            objective: step.objective,
            inputs: step.inputs,
            deliveryTarget: step.deliveryTarget,
          }))
        : automation.authoring_mode === 'describe'
          ? buildWorkflowBlocksFromPrompt(automation.workflow_prompt)
          : (automation.actions || []).map((action) => parseLegacyActionToWorkflowBlock(action));

      const rowRuns = (runsByAutomationId.get(automation.id) || [])
        .slice()
        .sort((a, b) => {
          const aTime = Date.parse(a.finishedAt || a.startedAt || '');
          const bTime = Date.parse(b.finishedAt || b.startedAt || '');
          return bTime - aTime;
        });

      const latestRun = rowRuns[0];
      const latestRunSteps = readStepExecutions(latestRun?.metadata?.stepExecutions);
      const stepExecutions = latestRunSteps.length > 0
        ? latestRunSteps
        : readStepExecutions(task?.metadata?.latestStepExecutions);

      const workerTopology = latestRun?.metadata?.topology || latestRun?.metadata?.workerTopology || task?.metadata?.workerTopology;

      const completedRuns = rowRuns.filter((run) => run.status === 'succeeded' || run.status === 'failed');
      const succeededRuns = completedRuns.filter((run) => run.status === 'succeeded');
      const averageCredits = completedRuns.length > 0
        ? completedRuns.reduce((sum, run) => sum + (run.actualCredits || 0), 0) / completedRuns.length
        : 0;
      const averageDurationMs = completedRuns.length > 0
        ? completedRuns.reduce((sum, run) => {
            const started = Date.parse(run.startedAt || '');
            const finished = Date.parse(run.finishedAt || '');
            return sum + (Number.isNaN(started) || Number.isNaN(finished) ? 0 : Math.max(0, finished - started));
          }, 0) / completedRuns.length
        : 0;

      return {
        automation,
        task,
        runs: rowRuns,
        latestRun,
        workerTopology,
        stepExecutions,
        workflowSteps,
        successRate: completedRuns.length > 0 ? succeededRuns.length / completedRuns.length : 0,
        averageCredits,
        averageDurationMs,
      };
    })
    .sort((a, b) => {
      const aTime = Date.parse(a.automation.next_run_at || a.latestRun?.finishedAt || a.automation.created_at || '');
      const bTime = Date.parse(b.automation.next_run_at || b.latestRun?.finishedAt || b.automation.created_at || '');
      return bTime - aTime;
    });
}

function isRecord(value: unknown): value is Record<string, any> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function readString(value: unknown) {
  return typeof value === 'string' && value.trim().length > 0 ? value : undefined;
}

function getTaskAutomationId(task?: TaskRecord) {
  return readString(task?.metadata?.automationId);
}

function parseLegacyActionToWorkflowBlock(action: string) {
  const trimmed = action.trim();
  const normalized = trimmed.toLowerCase();
  const id = `step-${Math.random().toString(36).slice(2, 8)}`;

  if (/(summary|digest|report|golden nuggets|briefing|recap)/.test(normalized)) {
    return { id, kind: 'summarize' as const, title: trimmed, objective: trimmed };
  }
  if (/(deliver|send|slack|email|notify|message)/.test(normalized)) {
    return { id, kind: 'deliver' as const, title: trimmed, objective: trimmed };
  }
  if (/(analy[sz]e|diagnos|compare|review|audit)/.test(normalized)) {
    return { id, kind: 'analyze' as const, title: trimmed, objective: trimmed };
  }
  if (/(query|stripe|posthog|github|linear|notion)/.test(normalized)) {
    return { id, kind: 'query' as const, title: trimmed, objective: trimmed };
  }
  if (/(capture|screenshot)/.test(normalized)) {
    return { id, kind: 'capture' as const, title: trimmed, objective: trimmed };
  }
  if (/(search|scan|research|news|look up|find)/.test(normalized)) {
    return { id, kind: 'search' as const, title: trimmed, objective: trimmed };
  }
  return { id, kind: 'note' as const, title: trimmed, objective: trimmed };
}

function buildWorkflowBlocksFromPrompt(prompt?: string) {
  if (!prompt?.trim()) return [];
  return prompt
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => parseLegacyActionToWorkflowBlock(line));
}

function normalizeDirectivePhases(value: unknown): WorkflowBlockKind[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const phases = value.filter((phase): phase is WorkflowBlockKind => (
    phase === 'search' ||
    phase === 'query' ||
    phase === 'capture' ||
    phase === 'analyze' ||
    phase === 'summarize' ||
    phase === 'deliver' ||
    phase === 'note'
  ));
  return phases.length > 0 ? [...new Set(phases)] : undefined;
}

function readStepExecutions(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (!isRecord(item)) return null;
      const stepId = readString(item.stepId);
      const kind = readString(item.kind);
      const title = readString(item.title);
      const assignedRole = readString(item.assignedRole);
      const status = readString(item.status);
      if (!stepId || !kind || !title || !assignedRole || !status) return null;

      return {
        stepId,
        kind: kind as WorkflowBlockKind,
        title,
        assignedRole,
        status,
        summary: readString(item.summary),
        error: readString(item.error),
        startedAt: readString(item.startedAt),
        finishedAt: readString(item.finishedAt),
        modelTier: readString(item.modelTier),
        directiveMode: item.directiveMode === 'cheaper' || item.directiveMode === 'review' || item.directiveMode === 'promote' ? item.directiveMode : undefined,
        directivePhases: normalizeDirectivePhases(item.directivePhases),
        modelSource: readString(item.modelSourceLabel) || readString(item.modelSource),
        actualCredits: typeof item.actualCredits === 'number' ? item.actualCredits : undefined,
        toolCalls: typeof item.toolCalls === 'number' ? item.toolCalls : undefined,
        durationMs: typeof item.durationMs === 'number' ? item.durationMs : undefined,
        tokenUsage: isRecord(item.tokenUsage)
          ? {
              inputTokens: typeof item.tokenUsage.inputTokens === 'number' ? item.tokenUsage.inputTokens : undefined,
              outputTokens: typeof item.tokenUsage.outputTokens === 'number' ? item.tokenUsage.outputTokens : undefined,
              totalTokens: typeof item.tokenUsage.totalTokens === 'number' ? item.tokenUsage.totalTokens : undefined,
            }
          : undefined,
      };
    })
    .filter(Boolean) as any[];
}
