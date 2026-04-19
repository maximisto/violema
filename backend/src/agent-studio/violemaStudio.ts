import type { Express, Request } from 'express';
import type { TaskRecord, TaskRunRecord } from '../platform/types';
import type { AutomationRecord } from '../scheduler';
import { listAutomations, getAutomationById } from '../scheduler';
import { listTasks, listTaskRuns } from '../platform/store';
import { getAutomationPresetLabel, getAutomationScenarioLabel } from './automationStudio';
import {
  mapViolemaRunToAgentStudioRun,
  mapViolemaWorkflowToAgentStudioWorkflow,
} from './adapters/violema';
import type {
  AgentStudioOperationalContext,
  AgentStudioOperationalContextEvidenceItem,
  AgentStudioOperationalContextHealthyComparison,
  AgentStudioOperationalContextSimilarRun,
  AgentStudioPhaseKind,
} from './contract';

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

  app.get('/api/studio/context/:workflowId', (req, res) => {
    const { workspaceId } = deps.resolveWorkspaceContext(req);
    const row = buildStudioWorkflowRows(workspaceId).find((item) => item.automation.id === req.params.workflowId);
    if (!row) {
      res.status(404).json({ error: 'Workflow not found' });
      return;
    }

    const runId = typeof req.query.runId === 'string' ? req.query.runId : undefined;
    res.json({
      workspaceId,
      item: buildStudioOperationalContext(row, runId),
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

function buildStudioOperationalContext(
  row: StudioRowSummary,
  selectedRunId?: string,
): AgentStudioOperationalContext {
  const completedRuns = row.runs.filter((run) => run.status === 'succeeded' || run.status === 'failed');
  const selectedRun = completedRuns.find((run) => run.id === selectedRunId) || completedRuns[0];

  if (!selectedRun) {
    return {
      workflowId: row.automation.id,
      runId: selectedRunId,
      generatedAt: new Date().toISOString(),
      similarRuns: [],
      recommendationEvidence: [],
    };
  }

  const similarRuns = buildSimilarRuns(completedRuns, selectedRun);
  const lastHealthyComparison = buildLastHealthyComparison(completedRuns, selectedRun);
  const recommendationEvidence = buildRecommendationEvidence(row, selectedRun, similarRuns, lastHealthyComparison);

  return {
    workflowId: row.automation.id,
    runId: selectedRun.id,
    generatedAt: new Date().toISOString(),
    similarRuns,
    lastHealthyComparison,
    recommendationEvidence,
  };
}

function buildSimilarRuns(
  completedRuns: TaskRunRecord[],
  selectedRun: TaskRunRecord,
): AgentStudioOperationalContextSimilarRun[] {
  const selectedSignals = buildRunSignals(selectedRun);

  return completedRuns
    .filter((run) => run.id !== selectedRun.id)
    .map((run) => {
      const candidateSignals = buildRunSignals(run);
      const matchedSignals: string[] = [];
      let similarityScore = 0;

      if (selectedSignals.failedPhase && candidateSignals.failedPhase === selectedSignals.failedPhase) {
        matchedSignals.push(`${formatPhaseLabel(selectedSignals.failedPhase)} failed in both runs`);
        similarityScore += 4;
      } else if (selectedSignals.phase && candidateSignals.phase === selectedSignals.phase) {
        matchedSignals.push(`${formatPhaseLabel(selectedSignals.phase)} was the dominant phase in both runs`);
        similarityScore += 3;
      }

      if (candidateSignals.status === selectedSignals.status) {
        matchedSignals.push(`Both runs ${selectedSignals.status}`);
        similarityScore += 2;
      }

      if (candidateSignals.scenarioId === selectedSignals.scenarioId) {
        matchedSignals.push(`Same scenario: ${getAutomationScenarioLabel(selectedSignals.scenarioId)}`);
        similarityScore += 1;
      }

      if (candidateSignals.previewPresetId === selectedSignals.previewPresetId) {
        matchedSignals.push(`Same preset: ${getAutomationPresetLabel(selectedSignals.previewPresetId)}`);
        similarityScore += 1;
      }

      const selectedCredits = selectedRun.actualCredits || 0;
      const candidateCredits = run.actualCredits || 0;
      const creditsDelta = Math.abs(candidateCredits - selectedCredits);
      if (creditsDelta <= Math.max(6, selectedCredits * 0.25)) {
        matchedSignals.push('Similar spend profile');
        similarityScore += 1;
      }

      return {
        run,
        similarityScore,
        matchedSignals,
      };
    })
    .filter((item) => item.similarityScore >= 3)
    .sort((left, right) => right.similarityScore - left.similarityScore || getRunTimestamp(right.run) - getRunTimestamp(left.run))
    .slice(0, 3)
    .map(({ run, similarityScore, matchedSignals }) => ({
      runId: run.id,
      label: buildRunLabel(run),
      status: run.status,
      startedAt: run.startedAt,
      finishedAt: run.finishedAt,
      actualCredits: run.actualCredits,
      durationMs: getRunDurationMs(run),
      similarityScore,
      matchedSignals,
    }));
}

function buildLastHealthyComparison(
  completedRuns: TaskRunRecord[],
  selectedRun: TaskRunRecord,
): AgentStudioOperationalContextHealthyComparison | undefined {
  const sortedRuns = completedRuns
    .slice()
    .sort((left, right) => getRunTimestamp(right) - getRunTimestamp(left));
  const selectedIndex = sortedRuns.findIndex((run) => run.id === selectedRun.id);
  const priorHealthy = (
    (selectedIndex >= 0 ? sortedRuns.slice(selectedIndex + 1) : sortedRuns)
      .find((run) => run.status === 'succeeded')
  ) || sortedRuns.find((run) => run.id !== selectedRun.id && run.status === 'succeeded');

  if (!priorHealthy) return undefined;

  const selectedPhases = new Map(buildRunPhaseSummaries(selectedRun).map((item) => [item.phase, item] as const));
  const healthyPhases = new Map(buildRunPhaseSummaries(priorHealthy).map((item) => [item.phase, item] as const));
  const changedSignals: string[] = [];

  const allPhases = new Set<WorkflowBlockKind>([
    ...selectedPhases.keys(),
    ...healthyPhases.keys(),
  ]);

  for (const phase of allPhases) {
    const current = selectedPhases.get(phase);
    const healthy = healthyPhases.get(phase);
    if (current?.status !== healthy?.status && (current || healthy)) {
      changedSignals.push(`${formatPhaseLabel(phase)} moved from ${healthy?.status || 'not used'} to ${current?.status || 'not used'}`);
      continue;
    }
    const creditsDelta = Math.round((current?.credits || 0) - (healthy?.credits || 0));
    if (Math.abs(creditsDelta) >= 6) {
      changedSignals.push(`${formatPhaseLabel(phase)} spend shifted ${formatSignedDelta(creditsDelta)} cr`);
      continue;
    }
    const durationDelta = Math.round(((current?.durationMs || 0) - (healthy?.durationMs || 0)) / 1000);
    if (Math.abs(durationDelta) >= 15) {
      changedSignals.push(`${formatPhaseLabel(phase)} timing shifted ${formatSignedDelta(durationDelta)}s`);
    }
  }

  const creditsDelta = typeof selectedRun.actualCredits === 'number' && typeof priorHealthy.actualCredits === 'number'
    ? Math.round(selectedRun.actualCredits - priorHealthy.actualCredits)
    : undefined;
  const durationDeltaMs = getRunDurationMs(selectedRun);
  const healthyDurationMs = getRunDurationMs(priorHealthy);
  const durationDelta = typeof durationDeltaMs === 'number' && typeof healthyDurationMs === 'number'
    ? Math.round((durationDeltaMs - healthyDurationMs) / 1000)
    : undefined;

  const summary = changedSignals[0]
    || (selectedRun.status !== priorHealthy.status
      ? `Current run ${selectedRun.status} while the last healthy baseline succeeded.`
      : 'No single dominant change stood out against the last healthy baseline.');

  return {
    runId: priorHealthy.id,
    label: buildRunLabel(priorHealthy),
    startedAt: priorHealthy.startedAt,
    finishedAt: priorHealthy.finishedAt,
    creditsDelta,
    durationDelta,
    changedSignals: changedSignals.slice(0, 3),
    summary,
  };
}

function buildRecommendationEvidence(
  row: StudioRowSummary,
  selectedRun: TaskRunRecord,
  similarRuns: AgentStudioOperationalContextSimilarRun[],
  lastHealthyComparison?: AgentStudioOperationalContextHealthyComparison,
): AgentStudioOperationalContextEvidenceItem[] {
  const items: AgentStudioOperationalContextEvidenceItem[] = [];
  const selectedPhases = buildRunPhaseSummaries(selectedRun);
  const failedPhase = selectedPhases.find((phase) => phase.status === 'failed');
  const dominantPhase = failedPhase || selectedPhases.slice().sort((left, right) => right.credits - left.credits)[0];
  const recentPromotion = readPromotionHistory(row.automation.studio_state)[0];

  if (failedPhase) {
    items.push({
      evidenceId: `failed-phase-${failedPhase.phase}`,
      title: `Protect ${formatPhaseLabel(failedPhase.phase)} more aggressively`,
      body: similarRuns.length > 0
        ? `This run failed in ${formatPhaseLabel(failedPhase.phase)}, and ${similarRuns.length} similar run${similarRuns.length === 1 ? '' : 's'} show the same shape. Tighten review or reduce phase complexity before promoting policy changes.`
        : `This run failed in ${formatPhaseLabel(failedPhase.phase)}. Treat that phase as the first place to tighten review or simplify instructions.`,
      sourceLabel: 'Phase failure pattern',
      phase: failedPhase.phase,
      relatedRunIds: [selectedRun.id, ...similarRuns.map((item) => item.runId)],
    });
  } else if (dominantPhase && dominantPhase.credits >= 12) {
    items.push({
      evidenceId: `cost-phase-${dominantPhase.phase}`,
      title: `Look at ${formatPhaseLabel(dominantPhase.phase)} for cheaper routing`,
      body: `${formatPhaseLabel(dominantPhase.phase)} dominated spend in the selected run at ${Math.round(dominantPhase.credits)} credits. This is the strongest candidate for cheaper routing or tighter instructions before changing the rest of the workflow.`,
      sourceLabel: 'Run cost concentration',
      phase: dominantPhase.phase,
      relatedRunIds: [selectedRun.id],
    });
  }

  if (lastHealthyComparison) {
    items.push({
      evidenceId: `healthy-diff-${lastHealthyComparison.runId}`,
      title: 'Compare against the last healthy state before changing policy',
      body: lastHealthyComparison.summary,
      sourceLabel: 'Last healthy baseline',
      relatedRunIds: [selectedRun.id, lastHealthyComparison.runId],
    });
  }

  if (recentPromotion) {
    items.push({
      evidenceId: `promotion-${recentPromotion.eventId}`,
      title: `${formatPromotionMode(recentPromotion.mode)} changed the live setup recently`,
      body: `${recentPromotion.summary} Treat this as a live-system change, not just run noise, when deciding whether to promote again or roll back.`,
      sourceLabel: 'Promotion history',
      phase: recentPromotion.phase,
    });
  }

  if (items.length === 0) {
    items.push({
      evidenceId: `steady-state-${selectedRun.id}`,
      title: 'No strong historical warning surfaced',
      body: 'This run does not yet have a strong historical pattern behind it. Keep the next move small, then use the next run window to confirm whether the change actually helped.',
      sourceLabel: 'Thin historical evidence',
      relatedRunIds: [selectedRun.id],
    });
  }

  return items.slice(0, 3);
}

function buildRunSignals(run: TaskRunRecord) {
  const attribution = readRunAttribution(run);
  const phaseSummaries = buildRunPhaseSummaries(run);
  const failedPhase = phaseSummaries.find((phase) => phase.status === 'failed')?.phase;
  const dominantPhase = failedPhase || phaseSummaries.slice().sort((left, right) => right.credits - left.credits)[0]?.phase;

  return {
    status: run.status,
    phase: dominantPhase,
    failedPhase,
    scenarioId: attribution.scenarioId,
    previewPresetId: attribution.previewPresetId,
  };
}

function buildRunPhaseSummaries(run: TaskRunRecord) {
  const phaseMap = new Map<WorkflowBlockKind, {
    phase: WorkflowBlockKind;
    status: string;
    credits: number;
    durationMs: number;
  }>();

  readStepExecutions(run.metadata?.stepExecutions).forEach((step) => {
    if (!isWorkflowBlockKind(step.kind)) return;
    const current = phaseMap.get(step.kind) || {
      phase: step.kind,
      status: 'unknown',
      credits: 0,
      durationMs: 0,
    };
    current.credits += step.actualCredits || 0;
    current.durationMs += step.durationMs || 0;
    if (step.status === 'failed') {
      current.status = 'failed';
    } else if (current.status !== 'failed' && step.status === 'succeeded') {
      current.status = 'succeeded';
    }
    phaseMap.set(step.kind, current);
  });

  return Array.from(phaseMap.values());
}

function readRunAttribution(run: TaskRunRecord) {
  const raw = isRecord(run.metadata?.experimentAttribution) ? run.metadata?.experimentAttribution : undefined;
  const fallbackStudioState = isRecord(run.metadata?.studioState) ? run.metadata?.studioState : undefined;
  const scenarioId = readString(raw?.scenarioId) || readString(fallbackStudioState?.selectedScenarioId) || 'baseline';
  const previewPresetId = readString(raw?.previewPresetId) || readString(fallbackStudioState?.previewPresetId) || 'recommended';
  const scenarioLabel = readString(raw?.scenarioLabel) || getAutomationScenarioLabel(scenarioId);
  const previewPresetLabel = readString(raw?.previewPresetLabel) || getAutomationPresetLabel(previewPresetId);
  return {
    scenarioId,
    previewPresetId,
    experimentId: readString(raw?.experimentId),
    label: readString(raw?.experimentNotes) || `${scenarioLabel} · ${previewPresetLabel}`,
  };
}

function buildRunLabel(run: TaskRunRecord) {
  return readRunAttribution(run).label;
}

function readPromotionHistory(value: unknown) {
  if (!isRecord(value) || !Array.isArray(value.promotionHistory)) return [];
  return value.promotionHistory
    .map((item) => {
      if (!isRecord(item)) return null;
      const eventId = readString(item.id);
      const appliedAt = readString(item.appliedAt);
      const summary = readString(item.summary);
      const mode = readString(item.mode);
      if (!eventId || !appliedAt || !summary || !mode) return null;
      return {
        eventId,
        appliedAt,
        summary,
        mode,
        phase: isWorkflowBlockKind(item.phase) ? item.phase : undefined,
      };
    })
    .filter(Boolean)
    .sort((left, right) => Date.parse(right!.appliedAt) - Date.parse(left!.appliedAt));
}

function formatPromotionMode(mode: string) {
  switch (mode) {
    case 'full':
      return 'Full promotion';
    case 'preset':
      return 'Preset promotion';
    case 'steering':
      return 'Steering promotion';
    case 'phase':
    case 'preset_phase':
      return 'Phase promotion';
    case 'rollback':
      return 'Rollback';
    case 'graduation':
      return 'Graduation';
    default:
      return 'Policy change';
  }
}

function formatPhaseLabel(phase: WorkflowBlockKind) {
  switch (phase) {
    case 'search':
      return 'Search';
    case 'query':
      return 'Query';
    case 'capture':
      return 'Capture';
    case 'analyze':
      return 'Analyze';
    case 'summarize':
      return 'Summarize';
    case 'deliver':
      return 'Deliver';
    case 'note':
    default:
      return 'Note';
  }
}

function formatSignedDelta(value: number) {
  if (value === 0) return 'no change';
  return `${value > 0 ? '+' : ''}${value}`;
}

function getRunTimestamp(run: TaskRunRecord) {
  return Date.parse(run.finishedAt || run.startedAt || '') || 0;
}

function getRunDurationMs(run: TaskRunRecord) {
  const startedAt = Date.parse(run.startedAt || '');
  const finishedAt = Date.parse(run.finishedAt || '');
  if (Number.isNaN(startedAt) || Number.isNaN(finishedAt)) return undefined;
  return Math.max(0, finishedAt - startedAt);
}

function isWorkflowBlockKind(value: unknown): value is WorkflowBlockKind {
  return value === 'search'
    || value === 'query'
    || value === 'capture'
    || value === 'analyze'
    || value === 'summarize'
    || value === 'deliver'
    || value === 'note';
}
