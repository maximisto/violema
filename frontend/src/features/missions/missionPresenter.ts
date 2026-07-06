import type {
  MissionAgentView,
  MissionArtifactView,
  MissionControlPrimitiveView,
  MissionEvidenceItem,
  MissionIntegrationView,
  MissionLessonView,
  MissionMetricView,
  MissionStatus,
  MissionStepView,
  MissionWorkspaceView,
} from './types';
import { normalizeChartArtifactFromResult, type ChartArtifactSpec } from '../../components/artifacts/ChartArtifact';

export interface MissionSourceStep {
  id?: string;
  stepId?: string;
  kind?: string;
  title?: string;
  objective?: string;
  status?: string;
  assignedRole?: string;
  modelTier?: string;
  modelSource?: string;
  toolName?: string;
  estimatedCredits?: number;
  actualCredits?: number;
  toolCalls?: number;
  artifactCount?: number;
  output?: Record<string, unknown>;
  tokenUsage?: {
    inputTokens?: number;
    outputTokens?: number;
    totalTokens?: number;
  };
  charge?: {
    actualCredits?: number;
    tokenCredits?: number;
    toolCredits?: number;
    artifactCredits?: number;
    durationCredits?: number;
    complexityCredits?: number;
    baseCredits?: number;
    rationale?: string[];
  };
  startedAt?: string;
  finishedAt?: string;
  durationMs?: number;
  summary?: string;
  error?: string;
}

export interface MissionSourceAgent {
  role: string;
  label?: string;
  status?: string;
  summary?: string;
  reason?: string;
  modelLabel?: string;
}

export interface MissionSourceTask {
  id: string | number;
  taskId?: string;
  taskRunId?: string;
  automationId?: string;
  title: string;
  description?: string;
  authoringMode?: string;
  workflowPrompt?: string;
  status?: string;
  runStatus?: string;
  lastRunStatus?: string;
  automationStatus?: string;
  schedule?: string;
  time?: string;
  notify?: string;
  condition?: string;
  nextRunAt?: string;
  lastRunAt?: string;
  estimatedCredits?: number;
  actualCredits?: number;
  agentRole?: string;
  latestSummary?: string;
  failureReason?: string;
  latestArtifacts?: Array<{
    id?: string;
    title?: string;
    kind?: string;
    source?: string;
    summary?: string;
    payload?: Record<string, unknown>;
  }>;
  latestStepExecutions?: MissionSourceStep[];
  steps?: MissionSourceStep[];
  actions?: string[];
  workerTopology?: { summary?: string; workers?: MissionSourceAgent[] };
  latestDelivery?: Record<string, unknown>;
  reviewReceipt?: Record<string, unknown>;
}

type MissionSourceArtifact = NonNullable<MissionSourceTask['latestArtifacts']>[number];

function readArtifactChart(artifact?: MissionSourceArtifact): ChartArtifactSpec | undefined {
  if (!artifact?.payload) return undefined;
  const chart = normalizeChartArtifactFromResult(artifact.payload);
  if (!chart) return undefined;
  return {
    ...chart,
    title: chart.title || artifact.title || 'Generated chart',
  };
}

function isDeliveredReview(task?: MissionSourceTask | null) {
  return (
    readStringValue(task?.latestDelivery?.status) === 'delivered' ||
    readStringValue(task?.reviewReceipt?.status) === 'delivered'
  );
}

function deliveredTargetLabel(task?: MissionSourceTask | null) {
  return (
    readStringValue(task?.latestDelivery?.to) ||
    readStringValue(task?.reviewReceipt?.deliveryTarget) ||
    task?.notify ||
    'the configured delivery target'
  );
}

export function normalizeMissionStatus(task?: MissionSourceTask | null): MissionStatus {
  if (!task) return 'planned';
  if (isDeliveredReview(task)) return 'completed';
  if (task.automationStatus === 'paused') return 'paused';
  const status = task.runStatus || task.lastRunStatus || task.status || 'planned';
  if (status === 'running' || status === 'retrying' || status === 'active') return 'running';
  if (status === 'waiting_review' || status === 'review') return 'waiting_review';
  if (status === 'failed' || status === 'alert' || status === 'error') return 'failed';
  if (status === 'succeeded' || status === 'complete' || status === 'completed') return 'completed';
  return 'planned';
}

function statusLabel(status: MissionStatus) {
  switch (status) {
    case 'running':
      return 'Running';
    case 'waiting_review':
      return 'Needs approval';
    case 'failed':
      return 'Needs attention';
    case 'completed':
      return 'Completed';
    case 'paused':
      return 'Paused';
    default:
      return 'Planned';
  }
}

function normalizeStepStatus(value?: string): MissionStatus {
  if (value === 'running' || value === 'retrying') return 'running';
  if (value === 'failed' || value === 'error') return 'failed';
  if (value === 'succeeded' || value === 'completed' || value === 'complete') return 'completed';
  if (value === 'waiting_review' || value === 'review') return 'waiting_review';
  if (value === 'skipped' || value === 'paused') return 'paused';
  return 'planned';
}

function normalizeStepExecutionStatus(step: MissionSourceStep, deliveredReview = false): MissionStatus {
  const outputStatus = readStringValue(step.output?.status);
  if (deliveredReview && step.kind === 'deliver') return 'completed';
  if (step.kind === 'deliver' && outputStatus === 'waiting_review') return 'waiting_review';
  return normalizeStepStatus(step.status);
}

function roleLabel(role?: string) {
  if (!role) return 'Violema';
  return role
    .split(/[_-]/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function pluralize(count: number, singular: string, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`;
}

function avatarLabel(label: string) {
  return label
    .split(' ')
    .filter(Boolean)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() || 'V';
}

function formatCredits(value?: number) {
  if (!value || value <= 0) return undefined;
  return `${Math.round(value)} cr`;
}

function formatMissionDateTime(value: string | undefined, fallback: string) {
  if (!value) return fallback;
  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) return value;

  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(timestamp));
}

function inferActionKind(action: string) {
  const normalized = action.trim().toLowerCase();
  if (/query|stripe|posthog|github|linear|notion/.test(normalized)) return 'query';
  if (/screenshot|capture/.test(normalized)) return 'capture';
  if (/(analy[sz]e|diagnos|compare|inspect|audit|review)/.test(normalized)) return 'analyze';
  if (/(send|post|slack|email|deliver|notify|message)/.test(normalized)) return 'deliver';
  if (/(summary|digest|report|golden nuggets|nuggets|briefing|recap|share with the team)/.test(normalized)) return 'summarize';
  if (/(search|scan internet|scan the internet|scan web|research|news|competitor)/.test(normalized)) return 'search';
  return 'note';
}

function titleFromAction(action: string, index: number) {
  const trimmed = action.trim();
  if (!trimmed) return `Workflow step ${index + 1}`;
  return trimmed.length > 72 ? `${trimmed.slice(0, 69)}...` : trimmed;
}

function readArtifactDetail(artifact: MissionSourceArtifact) {
  if (artifact.summary) return artifact.summary;
  const payloadText = readArtifactPayloadText(artifact.payload);
  if (payloadText) return payloadText;
  return 'Generated during the latest run.';
}

function readArtifactPayloadText(payload?: Record<string, unknown>, maxLength = 420): string | undefined {
  if (!payload) return undefined;

  const directKeys = [
    'summary',
    'markdown',
    'md',
    'note',
    'body',
    'content',
    'text',
    'report',
    'output',
    'result',
    'message',
  ];

  for (const key of directKeys) {
    const value = payload[key];
    if (typeof value === 'string' && value.trim()) return value.trim().slice(0, maxLength);
  }

  for (const key of ['artifact', 'document', 'draft']) {
    const value = payload[key];
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      const nested: string | undefined = readArtifactPayloadText(value as Record<string, unknown>);
      if (nested) return nested;
    }
  }

  return undefined;
}

function findReviewArtifact(artifacts?: MissionSourceTask['latestArtifacts']) {
  return artifacts?.find((artifact) => {
    const payload = artifact.payload || {};
    return (
      artifact.kind === 'review_gate' ||
      readStringValue(payload.deliveryTarget) ||
      payload.approvalRequired === true
    );
  });
}

function readRecordValue(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
}

function readStringValue(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function readFirstString(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = readStringValue(record[key]);
    if (value) return value;
  }
  return undefined;
}

function evidenceSlug(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48) || 'item';
}

function evidenceItemFromRecord(
  record: Record<string, unknown>,
  fallbackSource: string,
  idPrefix: string,
  index: number,
): MissionEvidenceItem | undefined {
  const label = readFirstString(record, ['title', 'label', 'name', 'url', 'href']);
  if (!label) return undefined;

  const source = readFirstString(record, ['source', 'provider', 'domain', 'url', 'href']) || fallbackSource;
  const detail =
    readFirstString(record, ['detail', 'summary', 'snippet', 'description', 'text', 'markdown', 'content']) ||
    'Source linked from the latest run.';

  return {
    id: `${idPrefix}-${index + 1}-${evidenceSlug(label)}`,
    label,
    source,
    detail: detail.slice(0, 420),
  };
}

function extractEvidenceItems(value: unknown, fallbackSource: string, idPrefix: string): MissionEvidenceItem[] {
  if (Array.isArray(value)) {
    return value
      .map((item, index) => {
        const record = readRecordValue(item);
        return record ? evidenceItemFromRecord(record, fallbackSource, idPrefix, index) : undefined;
      })
      .filter((item): item is MissionEvidenceItem => Boolean(item));
  }

  const record = readRecordValue(value);
  if (!record) return [];

  const collectionKeys = ['sources', 'citations', 'evidence', 'links', 'results', 'references'];
  const nestedItems = collectionKeys.flatMap((key) => {
    const nestedValue = record[key];
    if (Array.isArray(nestedValue)) return extractEvidenceItems(nestedValue, fallbackSource, `${idPrefix}-${key}`);
    const nestedRecord = readRecordValue(nestedValue);
    return nestedRecord ? extractEvidenceItems(nestedRecord, fallbackSource, `${idPrefix}-${key}`) : [];
  });

  if (nestedItems.length > 0) return nestedItems;

  const directItem = evidenceItemFromRecord(record, fallbackSource, idPrefix, 0);
  return directItem ? [directItem] : [];
}

function dedupeEvidenceItems(items: MissionEvidenceItem[]) {
  const seen = new Set<string>();
  const deduped: MissionEvidenceItem[] = [];

  items.forEach((item) => {
    const key = `${item.label.trim().toLowerCase()}::${item.source.trim().toLowerCase()}`;
    if (seen.has(key)) return;
    seen.add(key);
    deduped.push(item);
  });

  return deduped;
}

function artifactStatusLabel(status: MissionStatus, artifactCount: number, deliveredReview = false) {
  if (deliveredReview) return 'Delivered';
  if (status === 'running') return 'Updating now';
  if (status === 'waiting_review') return 'Ready for approval';
  if (status === 'failed') return 'Needs repair';
  if (status === 'paused') return 'Paused';
  if (artifactCount > 0) return 'Living artifact';
  return 'Draft pending';
}

function artifactKindLabel(kind?: string) {
  if (!kind) return 'Mission artifact';
  return roleLabel(kind);
}

function buildArtifactSkills(steps: MissionStepView[]) {
  const labels = steps.flatMap((step) => [
    step.toolLabel,
    step.agentLabel,
    step.kind ? artifactKindLabel(step.kind) : undefined,
  ]);
  return Array.from(new Set(labels.filter((label): label is string => Boolean(label && label.trim())))).slice(0, 6);
}

function buildArtifact(
  task: MissionSourceTask | undefined | null,
  status: MissionStatus,
  steps: MissionStepView[],
  evidence: MissionEvidenceItem[],
  metrics: MissionMetricView[]
): MissionArtifactView {
  const artifactCount = task?.latestArtifacts?.length || 0;
  const deliveredReview = isDeliveredReview(task);
  const reviewArtifact = findReviewArtifact(task?.latestArtifacts);
  const primaryArtifact = reviewArtifact || task?.latestArtifacts?.[0];
  const chart = primaryArtifact
    ? readArtifactChart(primaryArtifact) || task?.latestArtifacts?.map(readArtifactChart).find(Boolean)
    : undefined;
  const creditMetric = metrics.find((metric) => metric.label === 'Credits');
  const efficiencyMetric = metrics.find((metric) => metric.label === 'Efficiency');
  const skills = buildArtifactSkills(steps);
  const validationTone = evidence.length > 0 ? 'green' : status === 'failed' ? 'amber' : 'slate';
  const deliveryTarget = deliveredTargetLabel(task);
  const reviewBody = reviewArtifact
    ? readArtifactPayloadText(reviewArtifact.payload, 12000) || reviewArtifact.summary
    : undefined;
  const reviewTarget = readStringValue(reviewArtifact?.payload?.deliveryTarget) || deliveryTarget;

  if (!task) {
    return {
      title: 'No live artifact yet',
      kindLabel: 'Waiting for first run',
      sourceLabel: 'No source connected',
      statusLabel: 'Draft pending',
      summary: 'Schedule or create a mission and Violema will keep the resulting brief, report, dashboard, or delivery artifact alive here.',
      lastUpdatedLabel: 'Not run yet',
      primaryActionLabel: 'Create mission',
      skills: ['Planner', 'Reviewer', 'Scheduler'],
      sections: [
        {
          id: 'output',
          label: 'Output',
          value: '0 artifacts',
          detail: 'No deliverable has been produced yet.',
          tone: 'slate',
        },
        {
          id: 'validation',
          label: 'Validation',
          value: '0 evidence items',
          detail: 'Source checks begin after the first run.',
          tone: 'slate',
        },
        {
          id: 'credits',
          label: 'Credits',
          value: '—',
          detail: 'Credit usage appears after execution.',
          tone: 'slate',
        },
      ],
    };
  }

  return {
    title: primaryArtifact?.title || task.title,
    kindLabel: artifactKindLabel(primaryArtifact?.kind),
    sourceLabel: primaryArtifact?.source || (artifactCount > 0 ? pluralize(artifactCount, 'stored output') : 'Run output'),
    statusLabel: artifactStatusLabel(status, artifactCount, deliveredReview),
    summary: chart?.insight || (primaryArtifact ? readArtifactDetail(primaryArtifact) : task.latestSummary || task.description || 'This mission has not produced a stored artifact yet.'),
    reviewBody,
    reviewTarget,
    chart,
    lastUpdatedLabel: task.lastRunAt ? formatMissionDateTime(task.lastRunAt, 'Latest run') : task.latestArtifacts?.length ? 'Latest run' : 'Not run yet',
    primaryActionLabel: deliveredReview ? 'Open receipt' : status === 'waiting_review' ? 'Open review' : status === 'running' ? 'Watch run' : 'Open artifact',
    skills: skills.length > 0 ? skills : ['Planner', 'Reviewer', 'Delivery'],
    sections: [
      {
        id: 'output',
        label: 'Output',
        value: pluralize(artifactCount, 'artifact'),
        detail: artifactCount > 0 ? 'Stored as reusable mission output.' : 'No stored deliverable yet.',
        tone: artifactCount > 0 ? 'violet' : 'slate',
      },
      {
        id: 'validation',
        label: 'Validation',
        value: pluralize(evidence.length, 'evidence item', 'evidence items'),
        detail: evidence.length > 0 ? 'Source-linked claims are ready for review.' : 'Hold delivery until evidence is attached.',
        tone: validationTone,
      },
      {
        id: 'credits',
        label: 'Credits',
        value: creditMetric?.value === '—' ? '—' : `${creditMetric?.value || '—'} cr`,
        detail: efficiencyMetric?.value && efficiencyMetric.value !== '—'
          ? `${efficiencyMetric.value} per stored artifact.`
          : creditMetric?.detail || 'No credit profile yet.',
        tone: creditMetric?.tone || 'slate',
      },
      {
        id: 'skills',
        label: 'Skills',
        value: skills.length > 0 ? `${skills.slice(0, 2).join(' + ')}${skills.length > 2 ? ` + ${skills.length - 2} more` : ''}` : 'Mission context',
        detail: 'Active tools, roles, and context packs used to keep this artifact current.',
        tone: 'cyan',
      },
      {
        id: 'delivery',
        label: 'Delivery',
        value: task.notify || 'Review gate',
        detail: deliveredReview
          ? `Delivered to ${deliveryTarget}.`
          : status === 'waiting_review'
            ? 'Draft prepared. Slack has not been sent yet.'
            : 'Delivery follows this mission policy.',
        tone: deliveredReview ? 'green' : status === 'waiting_review' ? 'amber' : 'green',
      },
    ],
  };
}

function buildSteps(task?: MissionSourceTask | null): MissionStepView[] {
  const sourceSteps = task?.latestStepExecutions?.length
    ? task.latestStepExecutions
    : task?.steps || [];
  const deliveredReview = isDeliveredReview(task);

  if (sourceSteps.length > 0) {
    return sourceSteps.map((step, index) => {
      const agentLabel = roleLabel(step.assignedRole);
      return {
        id: step.id || step.stepId || `step-${index + 1}`,
        title: step.title || step.objective || `Step ${index + 1}`,
        objective: step.objective || step.summary || step.title || 'Complete this mission step.',
        kind: step.kind || 'note',
        status: normalizeStepExecutionStatus(step, deliveredReview),
        agentLabel,
        toolLabel: step.toolName || step.modelSource || step.modelTier,
        estimatedCredits: step.estimatedCredits,
        actualCredits: step.actualCredits ?? step.charge?.actualCredits,
        startedAt: step.startedAt,
        finishedAt: step.finishedAt,
        durationMs: step.durationMs,
        summary: step.summary,
        error: step.error,
      };
    });
  }

  if (task?.actions?.length) {
    return task.actions
      .map((action) => action.trim())
      .filter(Boolean)
      .map((action, index) => {
        const kind = inferActionKind(action);
        return {
          id: `action-${index + 1}`,
          title: titleFromAction(action, index),
          objective: action,
          kind,
          status: 'planned' as MissionStatus,
          agentLabel:
            kind === 'deliver'
              ? 'Messenger'
              : kind === 'summarize'
                ? 'Writer'
                : kind === 'analyze'
                  ? 'Analyst'
                  : kind === 'query'
                    ? 'Data Agent'
                    : 'Violema Manager',
        };
      });
  }

  if (task?.workflowPrompt) {
    return task.workflowPrompt
      .split(/\n+/)
      .map((line) => line.trim().replace(/^[-*\d.)\s]+/, '').trim())
      .filter(Boolean)
      .slice(0, 8)
      .map((line, index) => ({
        id: `prompt-${index + 1}`,
        title: titleFromAction(line, index),
        objective: line,
        kind: inferActionKind(line),
        status: 'planned' as MissionStatus,
        agentLabel: 'Violema Manager',
      }));
  }

  return [];
}

function buildAgents(task: MissionSourceTask | undefined | null, steps: MissionStepView[]): MissionAgentView[] {
  const workers = task?.workerTopology?.workers || [];
  if (workers.length > 0) {
    return workers.slice(0, 8).map((worker) => {
      const label = worker.label || roleLabel(worker.role);
      const workingStep = steps.find((step) => step.agentLabel === label && step.status === 'running');
      const credits = steps
        .filter((step) => step.agentLabel === label)
        .reduce((sum, step) => sum + (step.actualCredits || step.estimatedCredits || 0), 0);
      return {
        id: worker.role,
        label,
        avatarLabel: avatarLabel(label),
        role: worker.role,
        status: workingStep ? 'working' : worker.status === 'active' ? 'ready' : 'waiting',
        detail: worker.summary || worker.reason || 'Ready for mission work.',
        creditsLabel: formatCredits(credits),
        sourceLabel: worker.modelLabel,
      };
    });
  }

  if (task) {
    const stepAgentLabels = Array.from(new Set(steps.map((step) => step.agentLabel).filter(Boolean)));
    const labels = stepAgentLabels.length > 0 ? stepAgentLabels : [roleLabel(task.agentRole)];
    return labels.slice(0, 8).map((label, index) => {
      const workingStep = steps.find((step) => step.agentLabel === label && step.status === 'running');
      const failedStep = steps.find((step) => step.agentLabel === label && step.status === 'failed');
      const completedSteps = steps.filter((step) => step.agentLabel === label && step.status === 'completed').length;
      const credits = steps
        .filter((step) => step.agentLabel === label)
        .reduce((sum, step) => sum + (step.actualCredits || step.estimatedCredits || 0), 0);

      return {
        id: label.toLowerCase().replace(/[^a-z0-9]+/g, '-') || `agent-${index + 1}`,
        label,
        avatarLabel: avatarLabel(label),
        role: label.toLowerCase().replace(/\s+/g, '_') || 'agent',
        status: workingStep
          ? 'working'
          : failedStep
            ? 'review'
            : completedSteps > 0
              ? 'done'
              : normalizeMissionStatus(task) === 'waiting_review'
                ? 'review'
                : 'queued',
        detail: workingStep?.summary || failedStep?.error || (steps.length > 0 ? 'Assigned to this mission workflow.' : 'Ready for mission work.'),
        creditsLabel: formatCredits(credits),
      };
    });
  }

  return [];
}

function buildEvidence(task?: MissionSourceTask | null): MissionEvidenceItem[] {
  const artifacts = task?.latestArtifacts || [];
  const evidence: MissionEvidenceItem[] = [];

  artifacts.slice(0, 6).forEach((artifact, index) => {
    const source = artifact.source || artifact.kind || 'Run artifact';
    const payloadEvidence = extractEvidenceItems(
      artifact.payload,
      source,
      artifact.id || `artifact-${index + 1}`,
    );

    if (payloadEvidence.length > 0) {
      evidence.push(...payloadEvidence);
      return;
    }

    evidence.push({
      id: artifact.id || `artifact-${index + 1}`,
      label: artifact.title || artifact.kind || `Artifact ${index + 1}`,
      source,
      detail: readArtifactDetail(artifact),
    });
  });

  (task?.latestStepExecutions || []).forEach((step, index) => {
    evidence.push(...extractEvidenceItems(
      step.output,
      step.toolName || step.modelSource || roleLabel(step.assignedRole),
      step.id || step.stepId || `step-${index + 1}`,
    ));
  });

  if (evidence.length > 0) return dedupeEvidenceItems(evidence).slice(0, 10);

  if (task) return [];

  return [];
}

function buildMetrics(task: MissionSourceTask | undefined | null, steps: MissionStepView[]): MissionMetricView[] {
  const actualCredits = task?.actualCredits ?? steps.reduce((sum, step) => sum + (step.actualCredits || 0), 0);
  const estimatedCredits = task?.estimatedCredits ?? steps.reduce((sum, step) => sum + (step.estimatedCredits || 0), 0);
  const credits = actualCredits || estimatedCredits;
  const completedSteps = steps.filter((step) => step.status === 'completed').length;
  const failedSteps = steps.filter((step) => step.status === 'failed').length;
  const artifactCount = task?.latestArtifacts?.length || 0;
  const creditsPerArtifact = credits > 0 && artifactCount > 0
    ? Math.max(1, Math.round(credits / artifactCount))
    : null;

  return [
    {
      label: 'Credits',
      value: credits > 0 ? String(Math.round(credits)) : '—',
      detail: actualCredits > 0 ? 'actual run cost' : estimatedCredits > 0 ? 'estimated run cost' : 'no credits logged yet',
      tone: 'violet',
    },
    { label: 'Artifacts', value: String(artifactCount), detail: artifactCount > 0 ? 'stored run outputs' : 'none stored yet', tone: 'cyan' },
    {
      label: 'Efficiency',
      value: creditsPerArtifact ? `${creditsPerArtifact} cr` : '—',
      detail: creditsPerArtifact ? 'per stored artifact' : 'waiting for output',
      tone: !creditsPerArtifact || creditsPerArtifact <= 10 ? 'green' : 'amber',
    },
    { label: 'Waste', value: failedSteps > 0 ? 'Watch' : 'Low', detail: failedSteps > 0 ? `${failedSteps} failed step${failedSteps === 1 ? '' : 's'}` : 'no failed loop detected', tone: failedSteps > 0 ? 'amber' : 'green' },
  ];
}

function buildLessons(
  task: MissionSourceTask | undefined | null,
  status: MissionStatus,
  artifact: MissionArtifactView,
  steps: MissionStepView[],
  metrics: MissionMetricView[]
): MissionLessonView[] {
  if (!task) {
    return [
      {
        id: 'waiting-for-first-run',
        title: 'Waiting for first mission',
        detail: 'Violema will propose reusable rules after it sees how you review, edit, approve, and rerun mission work.',
        status: 'waiting',
        sourceLabel: 'Learning loop',
      },
    ];
  }

  const lessons: MissionLessonView[] = [];
  const creditMetric = metrics.find((metric) => metric.label === 'Credits');
  const efficiencyMetric = metrics.find((metric) => metric.label === 'Efficiency');
  const reviewStep = steps.find((step) => step.status === 'waiting_review' || step.status === 'failed');

  if (task.notify) {
    lessons.push({
      id: 'delivery-preference',
      title: 'Delivery preference saved',
      detail: `Reviewed mission outputs should route to ${task.notify} unless a user changes the delivery target.`,
      status: 'saved',
      sourceLabel: 'Mission schedule',
      actionLabel: 'Use next run',
    });
  }

  if (task.latestArtifacts?.length || status === 'waiting_review') {
    lessons.push({
      id: 'artifact-review-rule',
      title: 'Save artifact review pattern',
      detail: `${artifact.kindLabel} outputs should stay in review until evidence, credit usage, and delivery target are visible together.`,
      status: 'proposed',
      sourceLabel: artifact.title,
      actionLabel: 'Save rule',
    });
  }

  if (creditMetric?.value && creditMetric.value !== '—') {
    lessons.push({
      id: 'credit-pattern',
      title: 'Credit pattern detected',
      detail: `${creditMetric.value} credits were used on this mission. ${efficiencyMetric?.detail || 'Keep comparing cost against useful artifacts.'}`,
      status: efficiencyMetric?.value && efficiencyMetric.value !== '—' ? 'saved' : 'proposed',
      sourceLabel: 'Credit analytics',
      actionLabel: 'Track trend',
    });
  }

  if (reviewStep) {
    lessons.push({
      id: `review-step-${reviewStep.id}`,
      title: `${reviewStep.agentLabel} needs a repeatable check`,
      detail: reviewStep.error || reviewStep.summary || reviewStep.objective,
      status: status === 'failed' ? 'proposed' : 'waiting',
      sourceLabel: reviewStep.title,
      actionLabel: status === 'failed' ? 'Create check' : 'Review first',
    });
  }

  if (lessons.length === 0) {
    lessons.push({
      id: 'watch-review-edits',
      title: 'Watch review edits',
      detail: 'The next approval or correction will become a candidate memory for this recurring mission.',
      status: 'waiting',
      sourceLabel: 'Learning loop',
    });
  }

  return lessons.slice(0, 5);
}

function buildControlPrimitives(
  task: MissionSourceTask | undefined | null,
  status: MissionStatus,
  steps: MissionStepView[],
  evidence: MissionEvidenceItem[],
  metrics: MissionMetricView[],
  lessons: MissionLessonView[],
): MissionControlPrimitiveView[] {
  const toolCallCount = steps.filter((step) => Boolean(step.toolLabel)).length;
  const creditMetric = metrics.find((metric) => metric.label === 'Credits');
  const artifactCount = metrics.find((metric) => metric.label === 'Artifacts');
  const hasSchedule = Boolean(task?.schedule || task?.time || task?.nextRunAt);
  const proposedOrSavedLessons = lessons.filter((lesson) => lesson.status === 'saved' || lesson.status === 'proposed').length;
  const hasReusablePattern = Boolean(task && (hasSchedule || proposedOrSavedLessons > 0 || (task.actions?.length || 0) > 0));

  return [
    {
      id: 'plan',
      label: 'Visible plan',
      value: steps.length > 0 ? pluralize(steps.length, 'checkpoint') : 'Plan pending',
      detail: steps.length > 0
        ? 'Steps stay visible before, during, and after the run.'
        : 'Violema will turn the request into inspectable checkpoints.',
      tone: steps.length > 0 ? 'violet' : 'slate',
    },
    {
      id: 'trust',
      label: 'Trust boundary',
      value: task ? (status === 'waiting_review' ? 'Human gate' : 'Scoped run') : 'Scope pending',
      detail: task
        ? 'Sensitive delivery and consequential changes stay behind review controls.'
        : 'Tool access, delivery targets, and approval rules are set before work runs.',
      tone: task ? (status === 'waiting_review' ? 'amber' : 'green') : 'slate',
    },
    {
      id: 'trace',
      label: 'Tool trace',
      value: toolCallCount > 0 ? pluralize(toolCallCount, 'tool call') : 'Trace pending',
      detail: evidence.length > 0
        ? `${pluralize(evidence.length, 'evidence item', 'evidence items')} attached to the current artifact.`
        : 'Tool calls and source evidence will attach to the run as it executes.',
      tone: toolCallCount > 0 || evidence.length > 0 ? 'cyan' : 'slate',
    },
    {
      id: 'playbook',
      label: 'Reusable playbook',
      value: hasReusablePattern ? 'Reusable' : 'Learning',
      detail: hasReusablePattern
        ? 'Successful runs can become repeatable mission patterns instead of one-off prompts.'
        : 'Approvals, edits, and reruns will become reusable operating memory.',
      tone: hasReusablePattern ? 'green' : 'violet',
    },
    {
      id: 'delivery',
      label: 'Delivery surface',
      value: task?.notify || (task ? 'Review first' : 'Not connected'),
      detail: task?.notify
        ? 'The approved artifact has a known delivery destination.'
        : 'Slack, email, Teams, or calendar delivery can be attached when ready.',
      tone: task?.notify ? 'green' : task ? 'amber' : 'slate',
    },
    {
      id: 'cost',
      label: 'Cost signal',
      value: creditMetric?.value && creditMetric.value !== '—' ? `${creditMetric.value} cr` : 'No spend yet',
      detail: artifactCount?.value && artifactCount.value !== '0'
        ? `${creditMetric?.detail || 'Run cost'} measured against ${artifactCount.value} artifacts.`
        : creditMetric?.detail || 'Credits will be measured once this mission runs.',
      tone: creditMetric?.value && creditMetric.value !== '—' ? creditMetric.tone : 'slate',
    },
  ];
}

export const CORE_MISSION_INTEGRATIONS: MissionIntegrationView[] = [
  { id: 'slack', label: 'Slack', shortLabel: 'SL', category: 'Review and delivery' },
  { id: 'stripe', label: 'Stripe', shortLabel: 'ST', category: 'Revenue signal' },
  { id: 'github', label: 'GitHub', shortLabel: 'GH', category: 'Build signal' },
  { id: 'gmail', label: 'Gmail', shortLabel: 'GM', category: 'Email' },
  { id: 'google-calendar', label: 'Google Calendar', shortLabel: 'GC', category: 'Calendar' },
  { id: 'outlook', label: 'Outlook', shortLabel: 'OL', category: 'Email' },
  { id: 'microsoft-teams', label: 'Microsoft Teams', shortLabel: 'MT', category: 'Team' },
];

export function buildMissionWorkspaceView(task?: MissionSourceTask | null): MissionWorkspaceView {
  const status = normalizeMissionStatus(task);
  const steps = buildSteps(task);
  const agents = buildAgents(task, steps);
  const activeAgent = agents.find((agent) => agent.status === 'working') || agents[0];
  const evidence = buildEvidence(task);
  const metrics = buildMetrics(task, steps);
  const artifact = buildArtifact(task, status, steps, evidence, metrics);
  const title = task?.title || 'No active mission';
  const lessons = buildLessons(task, status, artifact, steps, metrics);
  const controlPrimitives = buildControlPrimitives(task, status, steps, evidence, metrics, lessons);

  return {
    id: String(task?.id ?? 'weekly-founder-brief'),
    taskId: task?.taskId,
    taskRunId: task?.taskRunId,
    automationId: task?.automationId,
    title,
    description: task?.description || (task
      ? 'Collect revenue, product, and team signals into a reviewed founder-ready operating brief.'
      : 'Create or select a scheduled automation to see its plan, agents, evidence, and credit usage.'),
    status,
    statusLabel: statusLabel(status),
    nextRunLabel: task?.nextRunAt ? formatMissionDateTime(task.nextRunAt, 'Not scheduled') : task?.schedule || task?.time || 'Not scheduled',
    lastRunLabel: formatMissionDateTime(task?.lastRunAt, 'No completed run yet'),
    scheduleLabel: task?.schedule || task?.time || (task ? 'Manual run' : 'No schedule'),
    deliveryLabel: task?.notify || (task ? 'Review before delivery' : 'No delivery target'),
    activeAgentId: activeAgent?.id,
    steps,
    agents,
    evidence,
    metrics,
    controlPrimitives,
    integrations: CORE_MISSION_INTEGRATIONS,
    artifact,
    lessons,
    reviewSummary: task?.failureReason || (isDeliveredReview(task)
      ? `Delivered to ${deliveredTargetLabel(task)}. Approval receipt is stored with this run.`
      : status === 'waiting_review'
        ? `Run completed and prepared the draft. Approving will send it to ${task?.notify || 'the configured delivery target'}; requesting changes keeps delivery held.`
        : task?.latestSummary || (task
          ? 'Reviewer will hold sensitive claims and delivery until evidence is attached.'
          : 'No mission is waiting for review.')),
    analyticsSummary: metrics[0].value === '—'
      ? (task ? 'Credit usage will appear after this mission runs.' : 'Credit usage will appear after you create or select a mission.')
      : metrics[2].value === '—'
        ? `This mission is currently tracked at ${metrics[0].value} credits. Artifact efficiency will appear after output is stored.`
      : `This mission is currently tracked at ${metrics[0].value} credits with ${metrics[2].value} per stored artifact.`,
  };
}
