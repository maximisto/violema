/**
 * Platform self-observation.
 *
 * Violema runs other people's workflows. This module is how Violema observes
 * ITSELF: it aggregates operational metadata across every workspace into a
 * single snapshot the operator (and, later, the orchestrator's build queue) can
 * reason about — what is working, what is blocking activation, what users keep
 * correcting.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * THE PRIVACY BOUNDARY — read this before adding a field
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * This is the one place in the codebase that reads ACROSS workspace boundaries.
 * That is only defensible because it reads operational metadata and nothing
 * else. The rule is not "be careful"; it is structural:
 *
 *   1. Every raw store record is projected, at the boundary, into a private
 *      `*Facts` shape holding only allowlisted primitives. All downstream logic
 *      works on those projections and never sees the raw record again.
 *   2. Nothing is ever spread. There is no `...record` anywhere in this file,
 *      by design. A field can only reach the output if a human wrote a reader
 *      for it and put it in a `*Facts` type.
 *   3. Free-text-capable identifiers (source slugs, workflow ids, blocker keys)
 *      are resolved against a CLOSED allowlist. An unrecognized value buckets
 *      to a constant — it is never echoed. That is what stops a user-authored
 *      string from riding out inside an "id".
 *
 * NEVER admissible, however useful it would be:
 *   - artifact payloads, summaries, drafts, briefs, report bodies
 *   - email/calendar/document/query RESULT data of any kind
 *   - automation names, step titles, objectives, review notes, or any other
 *     user-authored text (aggregate by workflowId / step kind / source slug)
 *   - email addresses, tokens, credentials, workspace display names
 *
 * Workspace IDS may appear: the operator is the audience and needs to know
 * which workspace is stuck. Nothing a workspace's owner typed or received may.
 *
 * `tests/platformTelemetry.test.ts` poisons store records with sentinel strings
 * and asserts they cannot reach the serialized snapshot. A reader that violates
 * the rule above should make that test fail.
 */

import { getPlatformState } from './store';
import { listWorkspaces } from './workspace';
import { readAllWorkflowLedgerEvents } from '../integrationGateway/auditLog';
import { isFabricatedEvidenceDeliveryError } from './provenance';
import type { CreditLedgerEntry, TaskRecord, TaskRunRecord, WorkspaceProfile } from './types';
import type { WorkflowLedgerEvent } from '../integrationGateway/types';

/**
 * The query source id that returns this snapshot. Internal-only: deliberately
 * absent from the integrations catalog and from the chat agent's `query_data`
 * source enum, and both the readiness gate and the data layer refuse it for any
 * workspace but the default one.
 */
export const PLATFORM_TELEMETRY_SOURCE = 'platform_telemetry';

/** Workflow identity used by the internal Platform learning brief automation. */
export const PLATFORM_LEARNING_BRIEF_WORKFLOW_ID = 'platform-learning-brief';

const TRAILING_WINDOW_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Caps on identifier lists so one pathological store cannot bloat the brief. */
const MAX_LISTED_WORKSPACES = 25;
const MAX_LISTED_BLOCKERS = 10;

/**
 * Closed allowlist of query-source slugs. Anything outside it — including a
 * source string a user typed into a custom automation — buckets to
 * `UNRECOGNIZED_SOURCE` rather than being echoed. The bucket still carries the
 * learning signal ("people asked for sources we cannot read") without the text.
 */
const KNOWN_SOURCE_SLUGS = new Set<string>([
  'stripe',
  'github',
  'linear',
  'email',
  'calendar',
  'google_drive',
  'hubspot',
  'notion',
  'salesforce',
  'jira',
  'posthog',
  'google_analytics',
  PLATFORM_TELEMETRY_SOURCE,
]);
const UNRECOGNIZED_SOURCE = 'unrecognized_source';

/** Closed allowlist of workflow ids. Unknown ids bucket rather than echo. */
const KNOWN_WORKFLOW_IDS = new Set<string>([
  'weekly-founder-update',
  'revenue-watch',
  'custom-workflow',
  PLATFORM_LEARNING_BRIEF_WORKFLOW_ID,
]);
const UNRECOGNIZED_WORKFLOW = 'unrecognized_workflow';

/**
 * Closed allowlist of readiness blocker keys — integration slugs plus the
 * gate's own synthetic keys. Blocker labels and details are generated prose
 * about the workspace's setup and are never read.
 */
const KNOWN_BLOCKER_KEYS = new Set<string>([
  ...KNOWN_SOURCE_SLUGS,
  'unknown_source',
  'slack',
  'postmark',
  'tavily',
  'delivery_target',
  'model_provider',
]);
const UNRECOGNIZED_BLOCKER = 'unrecognized_blocker';

// ───────────────────────────────────────────────────────────── output shape ──

export interface TelemetryWindow {
  trailingDays: number;
  from: string;
  to: string;
  priorFrom: string;
  priorTo: string;
}

export interface TelemetryWorkspaceCounts {
  total: number;
  createdInWindow: number;
  /** Had at least one run. */
  activeInWindow: number;
  activeCumulative: number;
  /** Had at least one approved, externally executed delivery. */
  deliveredInWindow: number;
  deliveredCumulative: number;
}

export interface TelemetryActivationFunnel {
  signedUp: number;
  /** Proved a working connection by producing at least one live data read. */
  connectedAtLeastOneSource: number;
  reachedFirstRun: number;
  reachedFirstDelivery: number;
  connectRatePct: number;
  firstRunRatePct: number;
  firstDeliveryRatePct: number;
  medianHoursToFirstDelivery: number | null;
  /** Signed up, never delivered — the actionable end of the funnel. */
  stalledWorkspaceIds: string[];
  stalledWorkspaceCount: number;
}

export interface TelemetryWorkflowReliability {
  workflowId: string;
  runs: number;
  succeeded: number;
  failed: number;
  blocked: number;
  successRatePct: number;
  blockedRatePct: number;
}

export interface TelemetrySourceReliability {
  source: string;
  reads: number;
  ok: number;
  failed: number;
  liveReads: number;
  simulatedReads: number;
  okRatePct: number;
}

export interface TelemetryBlockerCount {
  key: string;
  count: number;
  workspaces: number;
}

export interface TelemetryStepReliability {
  kind: string;
  executions: number;
  succeeded: number;
  failed: number;
  skipped: number;
  liveDataSteps: number;
  simulatedDataSteps: number;
}

export interface TelemetryReliability {
  byWorkflowId: TelemetryWorkflowReliability[];
  bySource: TelemetrySourceReliability[];
  byStepKind: TelemetryStepReliability[];
  topBlockers: TelemetryBlockerCount[];
}

export interface TelemetryReviewOutcomes {
  approved: number;
  changesRequested: number;
  rejected: number;
  blockedFabricated: number;
  awaitingReview: number;
  correctionRatePct: number;
}

export interface TelemetryCreditBurnBucket {
  workflowId: string;
  runs: number;
  p50Credits: number | null;
  p90Credits: number | null;
}

export interface TelemetryCreditBurn {
  chargedRuns: number;
  p50CreditsPerRun: number | null;
  p90CreditsPerRun: number | null;
  totalSpentCredits: number;
  byWorkflowId: TelemetryCreditBurnBucket[];
}

export interface TelemetryDelta {
  metric: string;
  current: number;
  prior: number;
  delta: number;
}

export interface PlatformTelemetrySnapshot {
  schemaVersion: 1;
  generatedAt: string;
  window: TelemetryWindow;
  workspaces: TelemetryWorkspaceCounts;
  activation: TelemetryActivationFunnel;
  reliability: TelemetryReliability;
  review: TelemetryReviewOutcomes;
  creditBurn: TelemetryCreditBurn;
  deltasVsPriorWeek: TelemetryDelta[];
  /** Definitions the reader needs to interpret the numbers honestly. */
  notes: string[];
}

// ──────────────────────────────────────────────────── boundary projections ──

interface WorkspaceFacts {
  id: string;
  createdAtMs: number;
}

interface StepFacts {
  kind: string;
  status: string;
  dataOrigin: string;
  source: string | null;
  fabricatedDeliveryBlocked: boolean;
}

interface RunFacts {
  id: string;
  workspaceId: string;
  taskId: string;
  status: string;
  startedAtMs: number;
  actualCredits: number | null;
  reviewRequired: boolean;
  readinessBlockerKeys: string[];
  wasReadinessBlocked: boolean;
  steps: StepFacts[];
}

interface TaskFacts {
  id: string;
  workspaceId: string;
  status: string;
  createdAtMs: number;
}

interface LedgerEventFacts {
  workspaceId: string;
  workflowId: string;
  taskRunId: string | null;
  type: string;
  createdAtMs: number;
  source: string | null;
  live: boolean;
  ok: boolean;
}

interface CreditEntryFacts {
  workspaceId: string;
  deltaCredits: number;
  createdAtMs: number;
}

// ─────────────────────────────────────────────────────────── typed readers ──

function readRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function readArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

/**
 * The allowlist primitive: a value is emitted only if it is one of a closed set
 * of known constants. Every identifier in the snapshot goes through this.
 */
function readEnum(value: unknown, allowed: ReadonlySet<string>, fallback: string): string {
  const normalized = typeof value === 'string' ? value.trim().toLowerCase() : '';
  return allowed.has(normalized) ? normalized : fallback;
}

function readBoolean(value: unknown): boolean | null {
  return typeof value === 'boolean' ? value : null;
}

function readFiniteNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function readTimestampMs(value: unknown): number {
  if (typeof value !== 'string') return Number.NaN;
  return Date.parse(value);
}

/** Opaque record/workspace handles. Never a display name, never an email. */
function readIdentifier(value: unknown): string {
  return typeof value === 'string' && value.trim() ? value.trim() : '';
}

const STEP_KINDS = new Set(['search', 'query', 'summarize', 'deliver', 'capture', 'analyze', 'note']);
const STEP_STATUSES = new Set(['planned', 'running', 'succeeded', 'failed', 'skipped']);
const DATA_ORIGINS = new Set(['live', 'simulated', 'none']);
const RUN_STATUSES = new Set(['queued', 'running', 'succeeded', 'failed', 'canceled', 'retrying']);
const TASK_STATUSES = new Set([
  'queued',
  'running',
  'waiting_review',
  'blocked',
  'completed',
  'failed',
  'canceled',
]);
const LEDGER_EVENT_TYPES = new Set([
  'workflow_readiness_checked',
  'data_read',
  'draft_created',
  'approval_requested',
  'approval_granted',
  'approval_denied',
  'external_action_executed',
  'connector_failed',
]);

function projectWorkspace(profile: WorkspaceProfile): WorkspaceFacts | null {
  const id = readIdentifier(profile?.id);
  if (!id) return null;
  // `name`, `slug`, `ownerEmail`, and `metadata` are deliberately not read.
  return { id, createdAtMs: readTimestampMs(profile.createdAt) };
}

function projectStep(value: unknown): StepFacts | null {
  const step = readRecord(value);
  if (!step) return null;

  // `output` is the raw tool payload. Exactly one field is read from it — the
  // source slug, through the allowlist. Never `data`, never anything else.
  const output = readRecord(step.output);
  const source = output && typeof output.source === 'string'
    ? readEnum(output.source, KNOWN_SOURCE_SLUGS, UNRECOGNIZED_SOURCE)
    : null;

  // `error` is read to CLASSIFY only; the string itself never reaches output.
  const errorText = typeof step.error === 'string' ? step.error : '';

  return {
    kind: readEnum(step.kind, STEP_KINDS, 'note'),
    status: readEnum(step.status, STEP_STATUSES, 'planned'),
    dataOrigin: readEnum(step.dataOrigin, DATA_ORIGINS, 'none'),
    source,
    fabricatedDeliveryBlocked: isFabricatedEvidenceDeliveryError(errorText),
  };
}

function projectReadinessBlockerKeys(metadata: Record<string, unknown> | null): string[] {
  const readinessBlock = readRecord(metadata?.readinessBlock);
  if (!readinessBlock) return [];
  return readArray(readinessBlock.blockers)
    .map((entry) => readRecord(entry))
    .filter((entry): entry is Record<string, unknown> => Boolean(entry))
    // Only `key`. `label`, `detail`, and `route` are generated prose.
    .map((entry) => readEnum(entry.key, KNOWN_BLOCKER_KEYS, UNRECOGNIZED_BLOCKER));
}

function projectRun(run: TaskRunRecord): RunFacts | null {
  const workspaceId = readIdentifier(run?.workspaceId);
  if (!workspaceId) return null;

  const metadata = readRecord(run.metadata);

  return {
    id: readIdentifier(run.id),
    workspaceId,
    taskId: readIdentifier(run.taskId),
    status: readEnum(run.status, RUN_STATUSES, 'queued'),
    startedAtMs: readTimestampMs(run.startedAt),
    actualCredits: readFiniteNumber(run.actualCredits),
    reviewRequired: readBoolean(metadata?.reviewRequired) === true,
    readinessBlockerKeys: projectReadinessBlockerKeys(metadata),
    wasReadinessBlocked: Boolean(readRecord(metadata?.readinessBlock)),
    // `artifacts`, `summary`, `delivery`, and `reviewReceipt.note` are the
    // workspace's own content and are never touched.
    steps: readArray(metadata?.stepExecutions)
      .map(projectStep)
      .filter((step): step is StepFacts => Boolean(step)),
  };
}

function projectTask(task: TaskRecord): TaskFacts | null {
  const workspaceId = readIdentifier(task?.workspaceId);
  if (!workspaceId) return null;
  // `title`, `description`, and `metadata` payloads are deliberately not read.
  return {
    id: readIdentifier(task.id),
    workspaceId,
    status: readEnum(task.status, TASK_STATUSES, 'queued'),
    createdAtMs: readTimestampMs(task.createdAt),
  };
}

function projectLedgerEvent(event: WorkflowLedgerEvent): LedgerEventFacts | null {
  const workspaceId = readIdentifier(event?.workspaceId);
  if (!workspaceId) return null;

  // `summary` is generated prose describing the workspace's own data. Not read.
  const metadata = readRecord(event.metadata);

  return {
    workspaceId,
    workflowId: readEnum(event.workflowId, KNOWN_WORKFLOW_IDS, UNRECOGNIZED_WORKFLOW),
    taskRunId: readIdentifier(event.taskRunId) || null,
    type: readEnum(event.type, LEDGER_EVENT_TYPES, ''),
    createdAtMs: readTimestampMs(event.createdAt),
    source: metadata && typeof metadata.source === 'string'
      ? readEnum(metadata.source, KNOWN_SOURCE_SLUGS, UNRECOGNIZED_SOURCE)
      : null,
    live: readBoolean(metadata?.live) === true,
    ok: readBoolean(metadata?.ok) !== false,
  };
}

function projectCreditEntry(entry: CreditLedgerEntry): CreditEntryFacts | null {
  const workspaceId = readIdentifier(entry?.workspaceId);
  if (!workspaceId) return null;
  // `note` and `metadata` are not read.
  return {
    workspaceId,
    deltaCredits: readFiniteNumber(entry.deltaCredits) ?? 0,
    createdAtMs: readTimestampMs(entry.createdAt),
  };
}

// ────────────────────────────────────────────────────────────────── helpers ──

function inWindow(timestampMs: number, fromMs: number, toMs: number): boolean {
  return Number.isFinite(timestampMs) && timestampMs >= fromMs && timestampMs < toMs;
}

function ratePct(numerator: number, denominator: number): number {
  if (denominator <= 0) return 0;
  return Math.round((numerator / denominator) * 1000) / 10;
}

function round(value: number, decimals = 1): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

/** Nearest-rank percentile. Null for an empty sample rather than a fake zero. */
function percentile(values: number[], p: number): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((left, right) => left - right);
  const rank = Math.ceil((p / 100) * sorted.length);
  const index = Math.min(sorted.length - 1, Math.max(0, rank - 1));
  return round(sorted[index], 2);
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function delta(metric: string, current: number, prior: number): TelemetryDelta {
  return { metric, current, prior, delta: current - prior };
}

// ──────────────────────────────────────────────────────────────── composer ──

export interface PlatformTelemetryComposeInput {
  workspaces: WorkspaceProfile[];
  tasks: TaskRecord[];
  taskRuns: TaskRunRecord[];
  ledger: CreditLedgerEntry[];
  ledgerEvents: WorkflowLedgerEvent[];
  now?: Date;
}

/**
 * Pure aggregation over already-loaded records, kept separate from the store
 * read so it can be exercised with fixtures — including the poisoned records
 * the leak test feeds it.
 */
export function composePlatformTelemetrySnapshot(
  input: PlatformTelemetryComposeInput,
): PlatformTelemetrySnapshot {
  const now = input.now || new Date();
  const toMs = now.getTime();
  const fromMs = toMs - TRAILING_WINDOW_DAYS * DAY_MS;
  const priorFromMs = fromMs - TRAILING_WINDOW_DAYS * DAY_MS;

  const workspaces = input.workspaces
    .map(projectWorkspace)
    .filter((item): item is WorkspaceFacts => Boolean(item));
  const tasks = input.tasks.map(projectTask).filter((item): item is TaskFacts => Boolean(item));
  const runs = input.taskRuns.map(projectRun).filter((item): item is RunFacts => Boolean(item));
  const events = input.ledgerEvents
    .map(projectLedgerEvent)
    .filter((item): item is LedgerEventFacts => Boolean(item));
  const creditEntries = input.ledger
    .map(projectCreditEntry)
    .filter((item): item is CreditEntryFacts => Boolean(item));

  const runsInWindow = runs.filter((run) => inWindow(run.startedAtMs, fromMs, toMs));
  const runsInPriorWindow = runs.filter((run) => inWindow(run.startedAtMs, priorFromMs, fromMs));
  const eventsInWindow = events.filter((event) => inWindow(event.createdAtMs, fromMs, toMs));
  const eventsInPriorWindow = events.filter((event) => inWindow(event.createdAtMs, priorFromMs, fromMs));

  // workflowId is not stored on the run record; the workflow ledger is the join.
  const workflowIdByRunId = new Map<string, string>();
  for (const event of events) {
    if (event.taskRunId && !workflowIdByRunId.has(event.taskRunId)) {
      workflowIdByRunId.set(event.taskRunId, event.workflowId);
    }
  }
  const workflowIdForRun = (run: RunFacts) =>
    workflowIdByRunId.get(run.id) || UNRECOGNIZED_WORKFLOW;

  // ── workspace counts
  const workspacesWithRun = new Set(runs.map((run) => run.workspaceId));
  const workspacesWithRunInWindow = new Set(runsInWindow.map((run) => run.workspaceId));
  const deliveryEvents = events.filter((event) => event.type === 'external_action_executed');
  const workspacesWithDelivery = new Set(deliveryEvents.map((event) => event.workspaceId));
  const workspacesWithDeliveryInWindow = new Set(
    deliveryEvents
      .filter((event) => inWindow(event.createdAtMs, fromMs, toMs))
      .map((event) => event.workspaceId),
  );

  const workspaceCounts: TelemetryWorkspaceCounts = {
    total: workspaces.length,
    createdInWindow: workspaces.filter((item) => inWindow(item.createdAtMs, fromMs, toMs)).length,
    activeInWindow: workspacesWithRunInWindow.size,
    activeCumulative: workspacesWithRun.size,
    deliveredInWindow: workspacesWithDeliveryInWindow.size,
    deliveredCumulative: workspacesWithDelivery.size,
  };

  // ── activation funnel (cumulative: activation is a lifetime property)
  const workspacesWithLiveRead = new Set(
    events
      .filter((event) => event.type === 'data_read' && event.ok && event.live)
      .map((event) => event.workspaceId),
  );

  const firstDeliveryMsByWorkspace = new Map<string, number>();
  for (const event of deliveryEvents) {
    if (!Number.isFinite(event.createdAtMs)) continue;
    const existing = firstDeliveryMsByWorkspace.get(event.workspaceId);
    if (existing === undefined || event.createdAtMs < existing) {
      firstDeliveryMsByWorkspace.set(event.workspaceId, event.createdAtMs);
    }
  }

  const hoursToFirstDelivery: number[] = [];
  const stalledWorkspaceIds: string[] = [];
  for (const workspace of workspaces) {
    const firstDeliveryMs = firstDeliveryMsByWorkspace.get(workspace.id);
    if (firstDeliveryMs === undefined) {
      stalledWorkspaceIds.push(workspace.id);
      continue;
    }
    if (!Number.isFinite(workspace.createdAtMs)) continue;
    const hours = (firstDeliveryMs - workspace.createdAtMs) / (60 * 60 * 1000);
    if (hours >= 0) hoursToFirstDelivery.push(hours);
  }

  const medianHours = median(hoursToFirstDelivery);
  const activation: TelemetryActivationFunnel = {
    signedUp: workspaces.length,
    connectedAtLeastOneSource: workspacesWithLiveRead.size,
    reachedFirstRun: workspacesWithRun.size,
    reachedFirstDelivery: workspacesWithDelivery.size,
    connectRatePct: ratePct(workspacesWithLiveRead.size, workspaces.length),
    firstRunRatePct: ratePct(workspacesWithRun.size, workspaces.length),
    firstDeliveryRatePct: ratePct(workspacesWithDelivery.size, workspaces.length),
    medianHoursToFirstDelivery: medianHours === null ? null : round(medianHours),
    stalledWorkspaceIds: stalledWorkspaceIds.slice(0, MAX_LISTED_WORKSPACES),
    stalledWorkspaceCount: stalledWorkspaceIds.length,
  };

  // ── reliability by workflow
  const workflowBuckets = new Map<string, { runs: number; succeeded: number; failed: number; blocked: number }>();
  for (const run of runsInWindow) {
    const workflowId = workflowIdForRun(run);
    const bucket = workflowBuckets.get(workflowId) || { runs: 0, succeeded: 0, failed: 0, blocked: 0 };
    bucket.runs += 1;
    if (run.status === 'succeeded') bucket.succeeded += 1;
    if (run.status === 'failed') bucket.failed += 1;
    if (run.wasReadinessBlocked) bucket.blocked += 1;
    workflowBuckets.set(workflowId, bucket);
  }

  const byWorkflowId: TelemetryWorkflowReliability[] = [...workflowBuckets.entries()]
    .map(([workflowId, bucket]) => ({
      workflowId,
      runs: bucket.runs,
      succeeded: bucket.succeeded,
      failed: bucket.failed,
      blocked: bucket.blocked,
      successRatePct: ratePct(bucket.succeeded, bucket.runs),
      blockedRatePct: ratePct(bucket.blocked, bucket.runs),
    }))
    .sort((left, right) => right.runs - left.runs);

  // ── reliability by source: the workflow ledger records every attempted
  //    external read, across every workspace, with no payload attached.
  const sourceBuckets = new Map<string, { reads: number; ok: number; failed: number; live: number; simulated: number }>();
  for (const event of eventsInWindow) {
    if (event.type !== 'data_read' && event.type !== 'connector_failed') continue;
    const source = event.source || UNRECOGNIZED_SOURCE;
    const bucket = sourceBuckets.get(source) || { reads: 0, ok: 0, failed: 0, live: 0, simulated: 0 };
    bucket.reads += 1;
    if (event.type === 'data_read' && event.ok) {
      bucket.ok += 1;
      if (event.live) bucket.live += 1;
      else bucket.simulated += 1;
    } else {
      bucket.failed += 1;
    }
    sourceBuckets.set(source, bucket);
  }

  const bySource: TelemetrySourceReliability[] = [...sourceBuckets.entries()]
    .map(([source, bucket]) => ({
      source,
      reads: bucket.reads,
      ok: bucket.ok,
      failed: bucket.failed,
      liveReads: bucket.live,
      simulatedReads: bucket.simulated,
      okRatePct: ratePct(bucket.ok, bucket.reads),
    }))
    .sort((left, right) => right.reads - left.reads);

  // ── reliability by step kind
  const stepBuckets = new Map<string, TelemetryStepReliability>();
  for (const run of runsInWindow) {
    for (const step of run.steps) {
      const bucket = stepBuckets.get(step.kind) || {
        kind: step.kind,
        executions: 0,
        succeeded: 0,
        failed: 0,
        skipped: 0,
        liveDataSteps: 0,
        simulatedDataSteps: 0,
      };
      bucket.executions += 1;
      if (step.status === 'succeeded') bucket.succeeded += 1;
      if (step.status === 'failed') bucket.failed += 1;
      if (step.status === 'skipped') bucket.skipped += 1;
      if (step.dataOrigin === 'live') bucket.liveDataSteps += 1;
      if (step.dataOrigin === 'simulated') bucket.simulatedDataSteps += 1;
      stepBuckets.set(step.kind, bucket);
    }
  }
  const byStepKind = [...stepBuckets.values()].sort((left, right) => right.executions - left.executions);

  // ── top blockers
  const blockerCounts = new Map<string, number>();
  const blockerWorkspaces = new Map<string, Set<string>>();
  for (const run of runsInWindow) {
    for (const key of run.readinessBlockerKeys) {
      blockerCounts.set(key, (blockerCounts.get(key) || 0) + 1);
      const seen = blockerWorkspaces.get(key) || new Set<string>();
      seen.add(run.workspaceId);
      blockerWorkspaces.set(key, seen);
    }
  }
  const topBlockers: TelemetryBlockerCount[] = [...blockerCounts.entries()]
    .map(([key, count]) => ({ key, count, workspaces: blockerWorkspaces.get(key)?.size || 0 }))
    .sort((left, right) => right.count - left.count)
    .slice(0, MAX_LISTED_BLOCKERS);

  // ── review outcomes
  const taskStatusById = new Map(tasks.map((task) => [task.id, task.status]));
  const approved = eventsInWindow.filter((event) => event.type === 'approval_granted').length;
  const changesRequested = eventsInWindow.filter((event) => event.type === 'approval_denied').length;
  // Violema has no explicit "reject" action; a review-gated run the operator
  // canceled instead of approving is the closest honest signal.
  const rejected = runsInWindow.filter(
    (run) => run.reviewRequired && taskStatusById.get(run.taskId) === 'canceled',
  ).length;
  const blockedFabricated = runsInWindow.filter((run) =>
    run.steps.some((step) => step.fabricatedDeliveryBlocked),
  ).length;
  const awaitingReview = tasks.filter((task) => task.status === 'waiting_review').length;
  const reviewedTotal = approved + changesRequested + rejected;

  const review: TelemetryReviewOutcomes = {
    approved,
    changesRequested,
    rejected,
    blockedFabricated,
    awaitingReview,
    correctionRatePct: ratePct(changesRequested + rejected, reviewedTotal),
  };

  // ── credit burn
  const chargedRuns = runsInWindow.filter(
    (run) => run.actualCredits !== null && run.actualCredits > 0,
  );
  const allCharges = chargedRuns.map((run) => run.actualCredits as number);
  const chargesByWorkflow = new Map<string, number[]>();
  for (const run of chargedRuns) {
    const workflowId = workflowIdForRun(run);
    const charges = chargesByWorkflow.get(workflowId) || [];
    charges.push(run.actualCredits as number);
    chargesByWorkflow.set(workflowId, charges);
  }

  const totalSpentCredits = creditEntries
    .filter((entry) => inWindow(entry.createdAtMs, fromMs, toMs) && entry.deltaCredits < 0)
    .reduce((total, entry) => total + Math.abs(entry.deltaCredits), 0);

  const creditBurn: TelemetryCreditBurn = {
    chargedRuns: allCharges.length,
    p50CreditsPerRun: percentile(allCharges, 50),
    p90CreditsPerRun: percentile(allCharges, 90),
    totalSpentCredits: round(totalSpentCredits, 2),
    byWorkflowId: [...chargesByWorkflow.entries()]
      .map(([workflowId, charges]) => ({
        workflowId,
        runs: charges.length,
        p50Credits: percentile(charges, 50),
        p90Credits: percentile(charges, 90),
      }))
      .sort((left, right) => right.runs - left.runs),
  };

  // ── deltas vs the prior week
  const deltasVsPriorWeek: TelemetryDelta[] = [
    delta('runs', runsInWindow.length, runsInPriorWindow.length),
    delta(
      'runs_succeeded',
      runsInWindow.filter((run) => run.status === 'succeeded').length,
      runsInPriorWindow.filter((run) => run.status === 'succeeded').length,
    ),
    delta(
      'runs_failed',
      runsInWindow.filter((run) => run.status === 'failed').length,
      runsInPriorWindow.filter((run) => run.status === 'failed').length,
    ),
    delta(
      'runs_readiness_blocked',
      runsInWindow.filter((run) => run.wasReadinessBlocked).length,
      runsInPriorWindow.filter((run) => run.wasReadinessBlocked).length,
    ),
    delta(
      'deliveries',
      eventsInWindow.filter((event) => event.type === 'external_action_executed').length,
      eventsInPriorWindow.filter((event) => event.type === 'external_action_executed').length,
    ),
    delta(
      'approvals',
      approved,
      eventsInPriorWindow.filter((event) => event.type === 'approval_granted').length,
    ),
    delta(
      'changes_requested',
      changesRequested,
      eventsInPriorWindow.filter((event) => event.type === 'approval_denied').length,
    ),
    delta(
      'active_workspaces',
      workspacesWithRunInWindow.size,
      new Set(runsInPriorWindow.map((run) => run.workspaceId)).size,
    ),
  ];

  return {
    schemaVersion: 1,
    generatedAt: now.toISOString(),
    window: {
      trailingDays: TRAILING_WINDOW_DAYS,
      from: new Date(fromMs).toISOString(),
      to: new Date(toMs).toISOString(),
      priorFrom: new Date(priorFromMs).toISOString(),
      priorTo: new Date(fromMs).toISOString(),
    },
    workspaces: workspaceCounts,
    activation,
    reliability: { byWorkflowId, bySource, byStepKind, topBlockers },
    review,
    creditBurn,
    deltasVsPriorWeek,
    notes: [
      'Operational metadata only. No artifact contents, drafts, summaries, integration result data, or user-authored text is aggregated here.',
      'A workspace counts as connected once it produces at least one successful LIVE data read — a working connection, not merely a saved credential.',
      'A delivery is an externally executed send after approval, not a prepared draft.',
      `Source slugs, workflow ids, and blocker keys resolve against a closed allowlist; unrecognized values bucket to "${UNRECOGNIZED_SOURCE}" / "${UNRECOGNIZED_WORKFLOW}" / "${UNRECOGNIZED_BLOCKER}" rather than being echoed.`,
      'Reliability, credit burn, and review counts cover the trailing window; activation counts are cumulative.',
    ],
  };
}

/**
 * Read every workspace-scoped store and aggregate. This is the only function
 * that crosses workspace boundaries, and it is reachable only through the
 * `platform_telemetry` query source, which is gated to the default workspace.
 */
export function buildPlatformTelemetrySnapshot(input?: { now?: Date }): PlatformTelemetrySnapshot {
  const state = getPlatformState();
  return composePlatformTelemetrySnapshot({
    workspaces: listWorkspaces(),
    tasks: state.tasks,
    taskRuns: state.taskRuns,
    ledger: state.ledger,
    ledgerEvents: readAllWorkflowLedgerEvents(),
    now: input?.now,
  });
}
