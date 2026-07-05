import type { AgentStudioOperationalContext } from './contract';
import type { AgentStudioRow, AutomationApiRecord, PlatformTaskRunRecord, StudioRoom } from './types';
import type { DimaSprite } from '../guardian/dashboardGuardian';

export type DimaStudioAdvisorTone = 'neutral' | 'warning' | 'action' | 'success';

export interface DimaStudioAdvice {
  tone: DimaStudioAdvisorTone;
  sprite: DimaSprite;
  title: string;
  message: string;
  nextAction: string;
  evidence: string[];
}

export interface DimaStudioAdvisorInput {
  activeRoom?: StudioRoom;
  row?: AgentStudioRow | null;
  workflow?: AutomationApiRecord | null;
  selectedRun?: PlatformTaskRunRecord | null;
  operationalContext?: AgentStudioOperationalContext | null;
}

function normalizeStatus(value?: string) {
  return (value || '').trim().toLowerCase();
}

function readString(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function sentence(value: string, maxLength = 150) {
  const clean = value.replace(/\s+/g, ' ').trim();
  if (clean.length <= maxLength) return clean;
  return `${clean.slice(0, Math.max(0, maxLength - 1)).trim()}...`;
}

function getWorkflow(input: DimaStudioAdvisorInput) {
  return input.workflow || input.row?.automation || null;
}

function getSelectedOrLatestRun(input: DimaStudioAdvisorInput) {
  return input.selectedRun || input.row?.latestRun || input.row?.runs?.[0] || null;
}

function getRunError(run?: PlatformTaskRunRecord | null) {
  return readString(run?.error) || readString(run?.metadata?.error) || readString(run?.metadata?.failureReason);
}

function getFailedStepEvidence(row?: AgentStudioRow | null) {
  const failedStep = row?.stepExecutions.find((step) => normalizeStatus(step.status) === 'failed');
  if (!failedStep) return '';
  const detail = readString(failedStep.error) || readString(failedStep.summary);
  return sentence(detail ? `${failedStep.title}: ${detail}` : `${failedStep.title} failed`);
}

function hasExternalDelivery(workflow?: AutomationApiRecord | null) {
  if (!workflow) return false;

  const stepHasDelivery = workflow.steps?.some((step) => {
    if (step.deliveryTarget) return true;
    return step.kind === 'deliver' || /send|slack|email|notify|publish|deliver/i.test(`${step.title} ${step.objective}`);
  });

  const actionHasDelivery = workflow.actions.some((action) => /send|slack|email|notify|publish|deliver/i.test(action));
  const notifyHasDelivery = /slack|email|webhook|notify|deliver/i.test(workflow.notify || '');

  return Boolean(stepHasDelivery || actionHasDelivery || notifyHasDelivery);
}

function getRunLabel(run?: PlatformTaskRunRecord | null) {
  if (!run) return 'No run selected';
  return run.finishedAt || run.startedAt || run.id;
}

function getRunEvidence(run?: PlatformTaskRunRecord | null) {
  if (!run) return '';
  const status = normalizeStatus(run.status) || 'unknown';
  const credits = typeof run.actualCredits === 'number' ? `, ${Math.round(run.actualCredits)} credits` : '';
  return `Selected run ${run.id}: ${status}${credits}`;
}

function getStableRunCount(row?: AgentStudioRow | null) {
  return row?.runs?.length || 0;
}

export function selectDimaStudioAdvice(input: DimaStudioAdvisorInput): DimaStudioAdvice {
  const row = input.row || null;
  const workflow = getWorkflow(input);
  const selectedRun = getSelectedOrLatestRun(input);
  const context = input.operationalContext || null;
  const evidence = context?.recommendationEvidence?.[0];
  const runStatus = normalizeStatus(selectedRun?.status);
  const runError = getRunError(selectedRun);
  const failedStepEvidence = getFailedStepEvidence(row);

  if (!workflow && !row) {
    return {
      tone: 'neutral',
      sprite: 'thinking',
      title: 'Dima is reading the room',
      message: 'Agent Studio needs one selected workflow before Dima can give useful advice.',
      nextAction: 'Select a workflow to inspect its policy, latest run, and evidence.',
      evidence: ['No workflow selected'],
    };
  }

  if (runStatus === 'failed' || failedStepEvidence) {
    return {
      tone: 'warning',
      sprite: 'chew',
      title: 'Dima found the weak link',
      message: 'Fix the failed run before changing the workflow policy or promoting a branch.',
      nextAction: 'Open Replay, inspect the failed step, then rerun before tuning cost or model lanes.',
      evidence: [
        getRunEvidence(selectedRun) || `Latest run for ${workflow?.name || 'this workflow'} failed`,
        runError ? sentence(runError) : '',
        failedStepEvidence,
      ].filter(Boolean),
    };
  }

  if (workflow?.execution_policy?.reviewPolicy === 'lean' && hasExternalDelivery(workflow)) {
    return {
      tone: 'warning',
      sprite: 'mark',
      title: 'Dima would not ship this lean',
      message: 'This workflow can deliver outside the app while review is set to lean.',
      nextAction: 'Add standard review before external delivery, then use Optimize for cost cuts.',
      evidence: [
        `${workflow.name} review policy: lean`,
        'External delivery detected in workflow actions or steps',
      ],
    };
  }

  if (evidence) {
    const similarRun = context?.similarRuns?.[0];
    return {
      tone: 'action',
      sprite: 'action',
      title: 'Dima sees a real tuning move',
      message: sentence(`${evidence.title}. ${evidence.body}`, 190),
      nextAction: input.activeRoom === 'optimize'
        ? 'Compare the candidate against this evidence before applying it.'
        : 'Open Optimize and test the smallest policy change against this evidence.',
      evidence: [
        `${evidence.sourceLabel}: ${evidence.phase || 'workflow'} evidence`,
        similarRun?.label ? `Closest match: ${similarRun.label}` : '',
        context?.lastHealthyComparison?.label ? `Healthy anchor: ${context.lastHealthyComparison.label}` : '',
      ].filter(Boolean),
    };
  }

  if (row && getStableRunCount(row) >= 3 && row.successRate >= 0.85) {
    return {
      tone: 'success',
      sprite: 'kiss',
      title: 'Dima approves the operating line',
      message: `${workflow?.name || 'This workflow'} is holding ${Math.round(row.successRate * 100)}% success across ${getStableRunCount(row)} observed runs.`,
      nextAction: 'Review the release candidate, then graduate only the change with evidence.',
      evidence: [
        `${getStableRunCount(row)} observed runs`,
        `${Math.round(row.successRate * 100)}% success`,
        row.averageCredits ? `${Math.round(row.averageCredits)} average credits` : '',
      ].filter(Boolean),
    };
  }

  if (row && row.successRate > 0 && row.successRate < 0.7) {
    return {
      tone: 'warning',
      sprite: 'thinking',
      title: 'Dima wants more proof',
      message: `${workflow?.name || 'This workflow'} is only landing ${Math.round(row.successRate * 100)}% of recent runs.`,
      nextAction: 'Use Replay to isolate the failing phase before adding cheaper or stronger lanes.',
      evidence: [
        `${Math.round(row.successRate * 100)}% success`,
        getRunEvidence(selectedRun),
      ].filter(Boolean),
    };
  }

  if (row && row.averageCredits >= 30 && row.successRate >= 0.75) {
    return {
      tone: 'action',
      sprite: 'credits',
      title: 'Dima sees spend to trim',
      message: 'The workflow is healthy enough to look for cheaper lanes without weakening the owner-facing output.',
      nextAction: 'Test a cost-saver candidate on capture or query before touching summarize or deliver.',
      evidence: [
        `${Math.round(row.successRate * 100)}% success`,
        `${Math.round(row.averageCredits)} average credits`,
      ],
    };
  }

  return {
    tone: 'neutral',
    sprite: input.activeRoom === 'replay' ? 'thinking' : 'patrol',
    title: 'Dima is watching the evidence',
    message: 'There is not enough signal yet for a promotion or a cost cut.',
    nextAction: 'Run the workflow again or inspect Replay until the next move has receipts.',
    evidence: [
      workflow?.name ? `Workflow: ${workflow.name}` : '',
      getRunLabel(selectedRun),
    ].filter(Boolean),
  };
}
