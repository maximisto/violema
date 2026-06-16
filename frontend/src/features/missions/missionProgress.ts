import type { MissionStatus, MissionStepView, MissionWorkspaceView } from './types';

export type MissionProgressPhaseId =
  | 'trigger'
  | 'research'
  | 'analysis'
  | 'draft'
  | 'review'
  | 'deliver';

export type MissionProgressTone = 'muted' | 'done' | 'live' | 'amber' | 'red';

export interface MissionProgressPhase {
  id: MissionProgressPhaseId;
  label: string;
  compactLabel: string;
  status: MissionStatus;
  tone: MissionProgressTone;
  metaLabel: string;
  detailLabel: string;
  stepCount: number;
  primaryStep?: MissionStepView;
}

const PHASES: Array<{ id: MissionProgressPhaseId; label: string; compactLabel: string }> = [
  { id: 'trigger', label: 'Trigger', compactLabel: 'Trig' },
  { id: 'research', label: 'Research', compactLabel: 'Res' },
  { id: 'analysis', label: 'Analysis', compactLabel: 'Ana' },
  { id: 'draft', label: 'Draft', compactLabel: 'Draft' },
  { id: 'review', label: 'Review', compactLabel: 'Rev' },
  { id: 'deliver', label: 'Deliver', compactLabel: 'Send' },
];

const STATUS_COPY: Record<MissionStatus, string> = {
  planned: 'Planned',
  running: 'Now',
  waiting_review: 'Review',
  failed: 'Issue',
  completed: 'Done',
  paused: 'Paused',
};

function normalize(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function phaseFromStep(step: MissionStepView, index: number, stepCount: number): MissionProgressPhaseId {
  const haystack = normalize(`${step.kind} ${step.title} ${step.objective} ${step.toolLabel || ''}`);

  if (/\b(trigger|schedule|scheduled|cadence|start|cron|webhook)\b/.test(haystack)) return 'trigger';
  if (/\b(review|approve|approval|evidence|gate|human)\b/.test(haystack)) return 'review';
  if (/\b(deliver|delivery|send|post|slack|email|notify|message|publish)\b/.test(haystack)) return 'deliver';
  if (/\b(draft|write|writer|summarize|summary|brief|report|compose|artifact|output)\b/.test(haystack)) return 'draft';
  if (/\b(analyze|analysis|compare|diagnose|score|audit|inspect|synthesi|rank)\b/.test(haystack)) return 'analysis';
  if (/\b(research|search|query|scan|source|capture|read|pull|fetch|collect|stripe|github|linear|notion|hubspot)\b/.test(haystack)) return 'research';

  if (stepCount <= 1) return 'research';
  const fallbackIndex = Math.min(PHASES.length - 1, Math.floor((index / Math.max(1, stepCount - 1)) * (PHASES.length - 1)));
  return PHASES[fallbackIndex].id;
}

function phaseStatus(steps: MissionStepView[]): MissionStatus {
  if (steps.length === 0) return 'planned';
  if (steps.some((step) => step.status === 'failed')) return 'failed';
  if (steps.some((step) => step.status === 'running')) return 'running';
  if (steps.some((step) => step.status === 'waiting_review')) return 'waiting_review';
  if (steps.some((step) => step.status === 'paused')) return 'paused';
  if (steps.every((step) => step.status === 'completed')) return 'completed';
  return 'planned';
}

function phaseTone(status: MissionStatus): MissionProgressTone {
  if (status === 'completed') return 'done';
  if (status === 'running') return 'live';
  if (status === 'waiting_review' || status === 'paused') return 'amber';
  if (status === 'failed') return 'red';
  return 'muted';
}

function primaryStepForStatus(steps: MissionStepView[], status: MissionStatus) {
  if (status === 'completed') {
    return [...steps]
      .reverse()
      .find((step) => step.status === 'completed' && (step.finishedAt || step.startedAt))
      || steps.find((step) => step.status === 'completed')
      || steps[0];
  }

  return steps.find((step) => step.status === status) || steps[0];
}

function formatTimeLabel(value?: string) {
  if (!value) return undefined;
  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) return undefined;

  return new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(timestamp));
}

function metaLabel(status: MissionStatus, primaryStep?: MissionStepView) {
  if (!primaryStep) return STATUS_COPY[status];
  if (status === 'running') return STATUS_COPY.running;
  if (status === 'completed') {
    return formatTimeLabel(primaryStep.finishedAt || primaryStep.startedAt) || STATUS_COPY.completed;
  }
  if (status === 'failed') return primaryStep.error ? 'Issue' : STATUS_COPY.failed;
  if (status === 'waiting_review') return STATUS_COPY.waiting_review;
  if (status === 'paused') return STATUS_COPY.paused;
  return formatTimeLabel(primaryStep.startedAt) || STATUS_COPY.planned;
}

function detailLabel(status: MissionStatus, phaseLabel: string, steps: MissionStepView[], primaryStep?: MissionStepView) {
  if (primaryStep?.agentLabel) return primaryStep.agentLabel;
  if (steps.length > 1) return `${steps.length} steps`;
  if (status === 'planned') return `${phaseLabel} queued`;
  return STATUS_COPY[status];
}

function stepsFromInput(input: MissionWorkspaceView | MissionStepView[]) {
  return Array.isArray(input) ? input : input.steps;
}

export function buildMissionProgressPhases(input: MissionWorkspaceView | MissionStepView[]): MissionProgressPhase[] {
  const steps = stepsFromInput(input);
  const phaseSteps = new Map<MissionProgressPhaseId, MissionStepView[]>();

  PHASES.forEach((phase) => {
    phaseSteps.set(phase.id, []);
  });

  steps.forEach((step, index) => {
    const phaseId = phaseFromStep(step, index, steps.length);
    phaseSteps.get(phaseId)?.push(step);
  });

  return PHASES.map((phase) => {
    const matchingSteps = phaseSteps.get(phase.id) || [];
    const status = phaseStatus(matchingSteps);
    const primaryStep = primaryStepForStatus(matchingSteps, status);

    return {
      ...phase,
      status,
      tone: phaseTone(status),
      metaLabel: metaLabel(status, primaryStep),
      detailLabel: detailLabel(status, phase.label, matchingSteps, primaryStep),
      stepCount: matchingSteps.length,
      primaryStep,
    };
  });
}

export function buildCompactMissionProgressPhases(input: MissionWorkspaceView | MissionStepView[]) {
  return buildMissionProgressPhases(input);
}
