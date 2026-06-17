import type { CreditSnapshot } from '../../lib/credits';
import { buildMissionDashboardSummary } from './missionDashboard';
import type {
  MissionAgentView,
  MissionEvidenceItem,
  MissionLessonView,
  MissionMetricView,
  MissionStepView,
  MissionWorkspaceView,
} from './types';

export type MissionSelectionKind =
  | 'mission'
  | 'step'
  | 'agent'
  | 'evidence'
  | 'metric'
  | 'artifact'
  | 'lesson'
  | 'calendar';

export interface MissionSelection {
  kind: MissionSelectionKind;
  id: string;
}

export interface MissionDetailModel {
  selection: MissionSelection;
  eyebrow: string;
  title: string;
  detail: string;
  statusLabel: string;
  meta: string[];
  primaryActionLabel: string;
  tone: 'violet' | 'cyan' | 'green' | 'amber' | 'red' | 'slate';
}

export interface MissionCreditAnalytics {
  balanceLabel: string;
  runwayLabel: string;
  utilizationPercent: number;
  runCostLabel: string;
  efficiencyLabel: string;
  wasteLabel: string;
  recommendationTitle: string;
  recommendationDetail: string;
  burnLabel: string;
}

function compactCredits(value: number) {
  return new Intl.NumberFormat('en-US').format(Math.max(0, Math.round(value)));
}

function statusTone(status: MissionStepView['status']): MissionDetailModel['tone'] {
  if (status === 'running') return 'cyan';
  if (status === 'completed') return 'green';
  if (status === 'waiting_review' || status === 'paused') return 'amber';
  if (status === 'failed') return 'red';
  return 'slate';
}

function metricTone(metric?: MissionMetricView): MissionDetailModel['tone'] {
  if (!metric) return 'slate';
  if (metric.tone === 'amber') return 'amber';
  if (metric.tone === 'green') return 'green';
  if (metric.tone === 'cyan') return 'cyan';
  if (metric.tone === 'violet') return 'violet';
  return 'slate';
}

function agentTone(agent?: MissionAgentView): MissionDetailModel['tone'] {
  if (!agent) return 'slate';
  if (agent.status === 'working') return 'cyan';
  if (agent.status === 'done') return 'green';
  if (agent.status === 'review') return 'amber';
  return 'violet';
}

function findBySelection<T extends { id: string }>(items: T[], selection: MissionSelection | null | undefined) {
  if (!selection) return undefined;
  return items.find((item) => item.id === selection.id);
}

export function getDefaultMissionSelection(mission: MissionWorkspaceView): MissionSelection {
  const summary = buildMissionDashboardSummary(mission);
  const step = summary.activeStep || summary.reviewStep || mission.steps[0];
  if (step) return { kind: 'step', id: step.id };
  if (summary.activeAgent) return { kind: 'agent', id: summary.activeAgent.id };
  return { kind: 'mission', id: mission.id };
}

export function isMissionSelectionAvailable(mission: MissionWorkspaceView, selection: MissionSelection | null | undefined) {
  if (!selection) return false;
  if (selection.kind === 'mission') return selection.id === mission.id;
  if (selection.kind === 'step') return mission.steps.some((step) => step.id === selection.id);
  if (selection.kind === 'agent') return mission.agents.some((agent) => agent.id === selection.id);
  if (selection.kind === 'evidence') return mission.evidence.some((item) => item.id === selection.id);
  if (selection.kind === 'metric') return mission.metrics.some((metric) => metric.label === selection.id);
  if (selection.kind === 'lesson') return mission.lessons.some((lesson) => lesson.id === selection.id);
  if (selection.kind === 'artifact') return selection.id === mission.artifact.title || selection.id === mission.id;
  return selection.id.length > 0;
}

function buildStepModel(selection: MissionSelection, step: MissionStepView): MissionDetailModel {
  return {
    selection,
    eyebrow: 'Current step',
    title: step.title,
    detail: step.summary || step.error || step.objective,
    statusLabel: step.status.replace('_', ' '),
    meta: [
      step.agentLabel,
      step.toolLabel,
      step.actualCredits ? `${compactCredits(step.actualCredits)} credits used` : undefined,
      step.estimatedCredits ? `${compactCredits(step.estimatedCredits)} credits estimated` : undefined,
    ].filter((item): item is string => Boolean(item)),
    primaryActionLabel: step.status === 'waiting_review' ? 'Review step' : step.status === 'failed' ? 'Inspect issue' : 'Open step',
    tone: statusTone(step.status),
  };
}

function buildAgentModel(selection: MissionSelection, agent: MissionAgentView): MissionDetailModel {
  return {
    selection,
    eyebrow: 'Agent',
    title: agent.label,
    detail: agent.detail,
    statusLabel: agent.status,
    meta: [
      agent.role,
      agent.sourceLabel,
      agent.creditsLabel,
    ].filter((item): item is string => Boolean(item)),
    primaryActionLabel: 'Chat with agent',
    tone: agentTone(agent),
  };
}

function buildEvidenceModel(selection: MissionSelection, evidence: MissionEvidenceItem): MissionDetailModel {
  return {
    selection,
    eyebrow: 'Evidence',
    title: evidence.label,
    detail: evidence.detail,
    statusLabel: 'Source linked',
    meta: [evidence.source],
    primaryActionLabel: 'Open evidence',
    tone: 'cyan',
  };
}

function buildMetricModel(selection: MissionSelection, metric: MissionMetricView): MissionDetailModel {
  return {
    selection,
    eyebrow: 'Metric',
    title: metric.label.toLowerCase() === 'waste' ? 'Run risk' : metric.label,
    detail: metric.detail,
    statusLabel: metric.value,
    meta: ['Mission analytics'],
    primaryActionLabel: 'Explain metric',
    tone: metricTone(metric),
  };
}

function buildLessonModel(selection: MissionSelection, lesson: MissionLessonView): MissionDetailModel {
  return {
    selection,
    eyebrow: 'Learning loop',
    title: lesson.title,
    detail: lesson.detail,
    statusLabel: lesson.status,
    meta: [lesson.sourceLabel],
    primaryActionLabel: lesson.actionLabel || 'Save lesson',
    tone: lesson.status === 'saved' ? 'green' : lesson.status === 'waiting' ? 'amber' : 'violet',
  };
}

export function buildMissionDetailModel(
  mission: MissionWorkspaceView,
  selection: MissionSelection | null | undefined,
): MissionDetailModel {
  const safeSelection = isMissionSelectionAvailable(mission, selection)
    ? selection as MissionSelection
    : getDefaultMissionSelection(mission);

  if (safeSelection.kind === 'step') {
    const step = findBySelection(mission.steps, safeSelection);
    if (step) return buildStepModel(safeSelection, step);
  }

  if (safeSelection.kind === 'agent') {
    const agent = findBySelection(mission.agents, safeSelection);
    if (agent) return buildAgentModel(safeSelection, agent);
  }

  if (safeSelection.kind === 'evidence') {
    const evidence = findBySelection(mission.evidence, safeSelection);
    if (evidence) return buildEvidenceModel(safeSelection, evidence);
  }

  if (safeSelection.kind === 'metric') {
    const metric = mission.metrics.find((item) => item.label === safeSelection.id);
    if (metric) return buildMetricModel(safeSelection, metric);
  }

  if (safeSelection.kind === 'lesson') {
    const lesson = findBySelection(mission.lessons, safeSelection);
    if (lesson) return buildLessonModel(safeSelection, lesson);
  }

  if (safeSelection.kind === 'artifact') {
    return {
      selection: safeSelection,
      eyebrow: 'Living artifact',
      title: mission.artifact.title,
      detail: mission.artifact.summary,
      statusLabel: mission.artifact.statusLabel,
      meta: [mission.artifact.kindLabel, mission.artifact.sourceLabel, mission.artifact.lastUpdatedLabel],
      primaryActionLabel: mission.artifact.primaryActionLabel,
      tone: 'violet',
    };
  }

  if (safeSelection.kind === 'calendar') {
    return {
      selection: safeSelection,
      eyebrow: 'Calendar event',
      title: mission.title,
      detail: `${mission.scheduleLabel}. ${mission.deliveryLabel}.`,
      statusLabel: mission.nextRunLabel,
      meta: [mission.lastRunLabel, mission.analyticsSummary],
      primaryActionLabel: 'Open schedule',
      tone: 'amber',
    };
  }

  return {
    selection: { kind: 'mission', id: mission.id },
    eyebrow: 'Mission',
    title: mission.title,
    detail: mission.description,
    statusLabel: mission.statusLabel,
    meta: [mission.scheduleLabel, mission.nextRunLabel, mission.deliveryLabel],
    primaryActionLabel: 'Open mission',
    tone: 'violet',
  };
}

function readMetricValue(mission: MissionWorkspaceView, label: string, fallback: string) {
  return mission.metrics.find((metric) => metric.label.toLowerCase() === label.toLowerCase())?.value || fallback;
}

export function buildMissionCreditAnalytics(
  mission: MissionWorkspaceView,
  snapshot: Pick<CreditSnapshot, 'creditsRemaining' | 'creditsTotal' | 'projectedDaysLeft' | 'automationBurnMonthly' | 'planName' | 'estimatedTaskCost'>,
): MissionCreditAnalytics {
  const utilizationPercent = snapshot.creditsTotal > 0
    ? Math.min(100, Math.max(0, Math.round(((snapshot.creditsTotal - snapshot.creditsRemaining) / snapshot.creditsTotal) * 100)))
    : 0;
  const lowRunway = snapshot.projectedDaysLeft <= 7;
  const watchRunway = snapshot.projectedDaysLeft <= 18;

  return {
    balanceLabel: `${compactCredits(snapshot.creditsRemaining)} credits left`,
    runwayLabel: `${snapshot.projectedDaysLeft} day runway on ${snapshot.planName}`,
    utilizationPercent,
    runCostLabel: `${readMetricValue(mission, 'Credits', compactCredits(snapshot.estimatedTaskCost))} credits`,
    efficiencyLabel: readMetricValue(mission, 'Efficiency', mission.analyticsSummary),
    wasteLabel: readMetricValue(mission, 'Waste', 'No waste signal yet'),
    recommendationTitle: lowRunway ? 'Low runway' : watchRunway ? 'Watch burn' : 'Healthy runway',
    recommendationDetail: lowRunway
      ? 'Add credits before recurring missions start competing for budget.'
      : watchRunway
        ? 'Current plan works, but a top-up would protect the next sprint.'
        : 'You have enough room to run and compare workflows.',
    burnLabel: `${compactCredits(snapshot.automationBurnMonthly)} credits monthly automation burn`,
  };
}
