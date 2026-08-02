/**
 * The admin privacy boundary.
 *
 * Violema's admin dashboard is operated by one person who is not the tenant.
 * The policy is METADATA ONLY: the operator may see that a run failed, which
 * workspace it belongs to, and which class of failure it was — never what the
 * run produced, drafted, read, or sent.
 *
 * The rule is structural, exactly as in `platform/platformTelemetry.ts`:
 *
 *   1. Every raw store record is projected here, at the boundary, into an
 *      explicit shape holding only allowlisted primitives.
 *   2. Nothing is ever spread. There is no `...record` in this file, by design.
 *      A field can only reach an admin payload if a human wrote a reader for it.
 *   3. Free-text-capable identifiers — readiness blocker keys, which the gate
 *      mints from a custom automation's own `inputs.source` — resolve against a
 *      CLOSED allowlist, and their human labels are DERIVED from the resolved
 *      key rather than echoed from the record. Unrecognized keys bucket.
 *
 * NEVER admissible, however useful it would be:
 *   - artifacts, summaries, step outputs, drafts, delivery bodies, review notes
 *   - raw run/step error text (the fabricated-evidence error embeds the
 *     workspace's own artifact title — see `platform/provenance.ts`)
 *   - ledger notes and ledger metadata
 *
 * Admissible, deliberately: workspace ids and names, and MISSION LABELS
 * (automation / task titles). The operator's job is to answer "which mission in
 * which workspace is stuck", which is unanswerable without them. A label is not
 * content: it is the name the tenant gave a scheduled job.
 *
 * `tests/adminPrivacy.test.ts` plants sentinel strings in artifacts, summaries,
 * step outputs, delivery payloads, errors, and ledger notes, then asserts none
 * of them can reach any serialized admin payload.
 */

import { isFabricatedEvidenceDeliveryError } from './platform/provenance';
import { KNOWN_READINESS_BLOCKER_KEYS } from './platform/platformTelemetry';
import { ACCOUNT_LIBRARY_BACKING_SOURCE } from './integrationGateway/accountLibrary';
import { labelIntegrationId } from './integrationGateway/workflowReadiness';
import type { AutomationRecord } from './scheduler';
import type { CreditLedgerEntry, TaskRecord, TaskRunRecord, WorkspaceProfile } from './platform/types';

// ─────────────────────────────────────────────────────────── typed readers ──

function readRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function readArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function readText(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function readTimestamp(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  return Number.isFinite(Date.parse(value)) ? value : null;
}

function readFiniteNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

/** A value is emitted only if it is one of a closed set of known constants. */
function readEnum(value: unknown, allowed: ReadonlySet<string>, fallback: string): string {
  const normalized = typeof value === 'string' ? value.trim().toLowerCase() : '';
  return allowed.has(normalized) ? normalized : fallback;
}

// ────────────────────────────────────────────────────── readiness blockers ──

/**
 * Blocker keys the admin surface may name.
 *
 * Shares the telemetry allowlist so the two privacy boundaries cannot drift,
 * plus the keys the readiness gate emits that telemetry does not track.
 * `runReadinessGate.ts` mints blocker keys straight from a custom automation's
 * `inputs.source`, so this list is the only thing standing between a tenant's
 * typed string and the admin browser.
 */
export const ADMIN_BLOCKER_KEYS: ReadonlySet<string> = new Set<string>([
  ...KNOWN_READINESS_BLOCKER_KEYS,
  'unsupported_workflow',
  'slack_target',
  ACCOUNT_LIBRARY_BACKING_SOURCE,
]);

export const UNRECOGNIZED_BLOCKER_KEY = 'unrecognized_blocker';

/** Labels for the gate's synthetic keys; product names come from the registry. */
const SYNTHETIC_BLOCKER_LABELS: Record<string, string> = {
  unknown_source: 'An unrecognized data source',
  unsupported_workflow: 'An unsupported workflow',
  delivery_target: 'A delivery destination',
  slack_target: 'A Slack destination',
  model_provider: 'A model provider',
  [UNRECOGNIZED_BLOCKER_KEY]: 'An unrecognized connection',
};

/**
 * The label for a blocker, DERIVED from its allowlisted key.
 *
 * Deliberately not `blocker.label` from the record: `labelIntegrationId`
 * title-cases whatever id it is handed, so echoing the stored label would carry
 * a tenant-authored source string into the admin payload.
 */
export function labelForBlockerKey(key: string): string {
  return SYNTHETIC_BLOCKER_LABELS[key] || labelIntegrationId(key);
}

export interface AdminReadinessBlock {
  blockerKeys: string[];
  blockerLabels: string[];
  blockedAt: string | null;
  workflowId: string | null;
}

const KNOWN_WORKFLOW_IDS = new Set<string>([
  'weekly-founder-update',
  'revenue-watch',
  'custom-workflow',
  'platform-learning-brief',
  'integrations',
]);

/**
 * Read the `readinessBlock` written onto a blocked task/run's metadata.
 * `summary` and each blocker's `detail` are generated prose about the
 * workspace's own setup and are never read.
 */
export function projectReadinessBlock(
  metadata: Record<string, unknown> | null | undefined,
): AdminReadinessBlock | null {
  const readinessBlock = readRecord(metadata?.readinessBlock);
  if (!readinessBlock) return null;

  const blockerKeys: string[] = [];
  for (const entry of readArray(readinessBlock.blockers)) {
    const blocker = readRecord(entry);
    if (!blocker) continue;
    const key = readEnum(blocker.key, ADMIN_BLOCKER_KEYS, UNRECOGNIZED_BLOCKER_KEY);
    if (!blockerKeys.includes(key)) blockerKeys.push(key);
  }

  const workflowId = readText(readinessBlock.workflowId);
  return {
    blockerKeys,
    blockerLabels: blockerKeys.map(labelForBlockerKey),
    blockedAt: readTimestamp(readinessBlock.blockedAt),
    workflowId: workflowId && KNOWN_WORKFLOW_IDS.has(workflowId) ? workflowId : null,
  };
}

// ─────────────────────────────────────────────────── failure classification ──

export type AdminFailureKind =
  | 'fabricated_evidence'
  | 'readiness_blocked'
  | 'connector'
  | 'other';

export const ADMIN_FAILURE_KINDS: readonly AdminFailureKind[] = [
  'fabricated_evidence',
  'readiness_blocked',
  'connector',
  'other',
];

/**
 * Error-text markers for a connector fault. Matched to CLASSIFY only — the
 * matched string never reaches the output, exactly as
 * `isFabricatedEvidenceDeliveryError` is used in platform telemetry.
 */
const CONNECTOR_ERROR_MARKERS =
  /(composio|connector|not connected|no connection|credential|unauthori[sz]ed|forbidden|\b401\b|\b403\b|\b429\b|rate limit|timed? out|econnrefused|enotfound)/i;

function readStepRecords(
  metadata: Record<string, unknown> | null | undefined,
): Record<string, unknown>[] {
  return readArray(metadata?.stepExecutions)
    .map(readRecord)
    .filter((step): step is Record<string, unknown> => Boolean(step));
}

/**
 * Which class of failure this run hit. Reads error text and step outputs, emits
 * only the classification.
 */
export function classifyRunFailure(
  run: Pick<TaskRunRecord, 'error' | 'metadata'>,
): AdminFailureKind {
  const metadata = readRecord(run.metadata);
  const steps = readStepRecords(metadata);

  if (
    isFabricatedEvidenceDeliveryError(run.error)
    || steps.some((step) => isFabricatedEvidenceDeliveryError(
      typeof step.error === 'string' ? step.error : null,
    ))
  ) {
    return 'fabricated_evidence';
  }

  if (readRecord(metadata?.readinessBlock)) return 'readiness_blocked';

  const readFailed = steps.some((step) => readRecord(step.output)?.ok === false);
  if (readFailed) return 'connector';

  const errorText = typeof run.error === 'string' ? run.error : '';
  const stepErrorText = steps
    .map((step) => (typeof step.error === 'string' ? step.error : ''))
    .join(' ');
  if (CONNECTOR_ERROR_MARKERS.test(errorText) || CONNECTOR_ERROR_MARKERS.test(stepErrorText)) {
    return 'connector';
  }

  return 'other';
}

/** Constant summaries. Nothing here is derived from stored text. */
const FAILURE_SUMMARIES: Record<Exclude<AdminFailureKind, 'readiness_blocked'>, string> = {
  fabricated_evidence: 'Blocked: simulated evidence',
  connector: 'Connector could not be read',
  other: 'Run failed',
};

/**
 * A summary the operator can act on that carries no tenant content.
 *
 * The readiness case names the connections to fix, because those labels are
 * ours — derived from allowlisted keys, not echoed from the record. Every other
 * case resolves to a constant: the underlying error strings embed artifact
 * titles, provider responses, and drafted text.
 */
export function buildFailureSummary(
  kind: AdminFailureKind,
  readinessBlock: AdminReadinessBlock | null,
): string {
  if (kind !== 'readiness_blocked') return FAILURE_SUMMARIES[kind];
  const labels = readinessBlock?.blockerLabels || [];
  if (labels.length === 0) return 'Blocked: workspace not ready';
  return `Blocked: connect ${labels.join(', ')}`;
}

// ────────────────────────────────────────────────────────────── projections ──

/**
 * Mission label resolution, in order of trustworthiness: the automation record
 * the run points at, then the task's own title. Never a title read out of run
 * artifacts, which is where fabricated-evidence text lives.
 */
export interface MissionNameLookup {
  automationById?: Map<string, AutomationRecord>;
  taskById?: Map<string, TaskRecord>;
}

function readAutomationId(metadata: Record<string, unknown> | null): string | null {
  return readText(metadata?.automationId);
}

export function resolveMissionName(
  run: Pick<TaskRunRecord, 'taskId' | 'metadata'>,
  lookup: MissionNameLookup,
): string | null {
  const automationId = readAutomationId(readRecord(run.metadata));
  const automation = automationId ? lookup.automationById?.get(automationId) : undefined;
  if (automation) return readText(automation.name);
  const task = lookup.taskById?.get(run.taskId);
  return task ? readText(task.title) : null;
}

export interface AdminFailedRunSummary {
  runId: string;
  workspaceId: string;
  workspaceName: string;
  automationName: string | null;
  status: string;
  failureKind: AdminFailureKind;
  failureSummary: string;
  blockerKeys: string[];
  startedAt: string | null;
  finishedAt: string | null;
}

export function projectFailedRun(input: {
  run: TaskRunRecord;
  workspaceName: string;
  lookup?: MissionNameLookup;
}): AdminFailedRunSummary {
  const { run } = input;
  const readinessBlock = projectReadinessBlock(readRecord(run.metadata));
  const failureKind = classifyRunFailure(run);

  return {
    runId: run.id,
    workspaceId: run.workspaceId,
    workspaceName: input.workspaceName,
    automationName: resolveMissionName(run, input.lookup || {}),
    status: run.status,
    failureKind,
    failureSummary: buildFailureSummary(failureKind, readinessBlock),
    blockerKeys: readinessBlock?.blockerKeys || [],
    startedAt: readTimestamp(run.startedAt),
    finishedAt: readTimestamp(run.finishedAt),
  };
}

export interface AdminRunSummary {
  runId: string;
  taskId: string;
  workspaceId: string;
  status: string;
  agentRole: string;
  modelTier: string;
  estimatedCredits: number | null;
  actualCredits: number | null;
  reviewRequired: boolean;
  readinessBlocked: boolean;
  failureKind: AdminFailureKind | null;
  failureSummary: string | null;
  startedAt: string | null;
  finishedAt: string | null;
}

/** Every run in a workspace detail view, metadata only. */
export function projectRunSummary(run: TaskRunRecord): AdminRunSummary {
  const metadata = readRecord(run.metadata);
  const readinessBlock = projectReadinessBlock(metadata);
  const failureKind = run.status === 'failed' ? classifyRunFailure(run) : null;

  return {
    runId: run.id,
    taskId: run.taskId,
    workspaceId: run.workspaceId,
    status: run.status,
    agentRole: run.agentRole,
    modelTier: run.modelTier,
    estimatedCredits: readFiniteNumber(run.estimatedCredits),
    actualCredits: readFiniteNumber(run.actualCredits),
    reviewRequired: metadata?.reviewRequired === true,
    readinessBlocked: Boolean(readinessBlock),
    failureKind,
    failureSummary: failureKind ? buildFailureSummary(failureKind, readinessBlock) : null,
    startedAt: readTimestamp(run.startedAt),
    finishedAt: readTimestamp(run.finishedAt),
  };
}

export interface AdminTaskSummary {
  taskId: string;
  workspaceId: string;
  /** Mission label. Not content — see the module header. */
  title: string;
  kind: string;
  status: string;
  priority: string;
  automationId: string | null;
  readinessBlocked: boolean;
  blockerKeys: string[];
  createdAt: string | null;
  updatedAt: string | null;
}

export function projectTaskSummary(task: TaskRecord): AdminTaskSummary {
  const metadata = readRecord(task.metadata);
  const readinessBlock = projectReadinessBlock(metadata);

  // `description`, `latestSummary`, `latestArtifacts`, `latestStepExecutions`,
  // `reviewReceipt`, and `reviewRequest` are the workspace's own content and are
  // deliberately not read.
  return {
    taskId: task.id,
    workspaceId: task.workspaceId,
    title: task.title,
    kind: task.kind,
    status: task.status,
    priority: task.priority,
    automationId: readAutomationId(metadata),
    readinessBlocked: Boolean(readinessBlock),
    blockerKeys: readinessBlock?.blockerKeys || [],
    createdAt: readTimestamp(task.createdAt),
    updatedAt: readTimestamp(task.updatedAt),
  };
}

export interface AdminLedgerSummary {
  id: string;
  workspaceId: string;
  direction: string;
  source: string;
  deltaCredits: number;
  balanceAfterCredits: number;
  referenceType: string | null;
  referenceId: string | null;
  createdAt: string | null;
}

/** `note` and `metadata` carry operator prose and provider payloads. Not read. */
export function projectLedgerEntry(entry: CreditLedgerEntry): AdminLedgerSummary {
  return {
    id: entry.id,
    workspaceId: entry.workspaceId,
    direction: entry.direction,
    source: entry.source,
    deltaCredits: readFiniteNumber(entry.deltaCredits) ?? 0,
    balanceAfterCredits: readFiniteNumber(entry.balanceAfterCredits) ?? 0,
    referenceType: readText(entry.referenceType),
    referenceId: readText(entry.referenceId),
    createdAt: readTimestamp(entry.createdAt),
  };
}

export interface AdminAutomationSummary {
  automationId: string;
  workspaceId: string;
  name: string;
  status: 'active' | 'paused';
  paused: boolean;
  schedule: string | null;
  lastRunAt: string | null;
  lastRunStatus: 'succeeded' | 'failed' | null;
  consecutiveFailures: number;
  nextRunAt: string | null;
  createdAt: string | null;
}

/**
 * `description`, `workflow_prompt`, `actions`, `steps`, `notify`, `condition`,
 * and `studio_state` are the tenant's authored workflow. Not read.
 */
export function projectAutomationSummary(
  automation: AutomationRecord,
  workspaceId: string,
): AdminAutomationSummary {
  return {
    automationId: automation.id,
    workspaceId,
    name: automation.name,
    status: automation.status === 'paused' ? 'paused' : 'active',
    paused: automation.status === 'paused',
    schedule: readText(automation.schedule),
    lastRunAt: readTimestamp(automation.last_run_at),
    lastRunStatus:
      automation.last_run_status === 'succeeded' || automation.last_run_status === 'failed'
        ? automation.last_run_status
        : null,
    consecutiveFailures: Math.max(0, readFiniteNumber(automation.consecutive_failures) ?? 0),
    nextRunAt: readTimestamp(automation.next_run_at),
    createdAt: readTimestamp(automation.created_at),
  };
}

export interface AdminWorkspaceIdentity {
  workspaceId: string;
  workspaceName: string;
  slug: string;
  ownerEmail: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

/** `metadata` can hold arbitrary workspace-authored keys. Not read. */
export function projectWorkspaceIdentity(workspace: WorkspaceProfile): AdminWorkspaceIdentity {
  return {
    workspaceId: workspace.id,
    workspaceName: workspace.name,
    slug: workspace.slug,
    ownerEmail: readText(workspace.ownerEmail),
    createdAt: readTimestamp(workspace.createdAt),
    updatedAt: readTimestamp(workspace.updatedAt),
  };
}

/** Empty bucket set, so a caller reports zeroes for every known kind. */
export function emptyFailureKindCounts(): Record<AdminFailureKind, number> {
  return { fabricated_evidence: 0, readiness_blocked: 0, connector: 0, other: 0 };
}

export function countByFailureKind(
  items: Array<{ failureKind: AdminFailureKind }>,
): Record<AdminFailureKind, number> {
  const counts = emptyFailureKindCounts();
  for (const item of items) counts[item.failureKind] += 1;
  return counts;
}
