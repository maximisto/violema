/**
 * The cross-workspace operational picture: `GET /api/admin/operations`.
 *
 * The dashboard could already tell the operator how many runs happened. It
 * could not tell him what to DO on Monday morning — who is stuck behind a
 * missing connection, which reviews nobody has approved, which scheduled
 * mission has been failing quietly for three days, who is on stale terms, and
 * which workspaces have nothing connected at all. Every one of those answers
 * already existed in a store; none of them had a reader.
 *
 * Two constraints shape this module:
 *
 *   - METADATA ONLY. Every record goes through `adminProjection.ts`. See that
 *     module's header for what is and is not admissible.
 *   - BOUNDED I/O. The dataset is read once and passed in. The one unbounded
 *     cost is the partner-connection lookup, which is one upstream call per
 *     workspace: it runs through the existing short-lived status cache, with
 *     capped concurrency, and a workspace whose lookup fails is reported as
 *     `degraded` rather than taking the endpoint down with it.
 */

import { isComposioEnabled, listConnectedAppsDetailed } from './composioBridge';
import { getWorkspaceSettingsView } from './settingsStore';
import { readAllWorkflowLedgerEvents } from './integrationGateway/auditLog';
import { CURRENT_BETA_TERMS_VERSION } from './betaProgram';
import {
  composePlatformTelemetrySnapshot,
  type PlatformTelemetrySnapshot,
} from './platform/platformTelemetry';
import {
  buildFailureWindow,
  normalizeWindowHours,
  type AdminFailureWindow,
} from './adminDashboard';
import { loadAdminDataset, scopeWorkspaces, type AdminDataset } from './adminDataset';
import {
  projectAutomationSummary,
  projectReadinessBlock,
  resolveMissionName,
  type AdminAutomationSummary,
} from './adminProjection';
import type { TaskRunRecord, WorkspaceProfile } from './platform/types';

/** How many partner-connection lookups may be in flight at once. */
const PARTNER_LOOKUP_CONCURRENCY = 4;
const MAX_LISTED_ROWS = 100;

// ───────────────────────────────────────────────────────────── output shape ──

export interface AdminBlockedWorkspace {
  workspaceId: string;
  workspaceName: string;
  automationName: string | null;
  taskId: string;
  runId: string | null;
  blockerKeys: string[];
  blockerLabels: string[];
  blockedAt: string | null;
}

export interface AdminWaitingReview {
  workspaceId: string;
  workspaceName: string;
  missionName: string | null;
  taskId: string;
  runId: string;
  waitingSince: string;
  waitingHours: number;
}

export interface AdminAutomationHealth extends AdminAutomationSummary {
  workspaceName: string;
}

export interface AdminTermsStaleness {
  currentVersion: string;
  /** Accepted today's version AND holds a consent receipt for it. */
  currentCount: number;
  /** Accepted an older version. */
  staleCount: number;
  /** Never accepted anything. */
  neverAcceptedCount: number;
  totalAccounts: number;
}

export interface AdminWorkspaceIntegrations {
  workspaceId: string;
  workspaceName: string;
  /** Composio toolkit slugs with a live connection. */
  connectedToolkits: string[];
  /** Native integrations configured with THIS workspace's own credentials. */
  workspaceConfiguredIntegrations: string[];
  /** True when the partner lookup could not answer — not "nothing connected". */
  degraded: boolean;
}

export interface AdminOperationsSnapshot {
  generatedAt: string;
  windowHours: number;
  scope: {
    includeInternal: boolean;
    excludedInternalWorkspaces: number;
    workspaceCount: number;
  };
  blockedNow: AdminBlockedWorkspace[];
  waitingReviews: AdminWaitingReview[];
  recentFailures: AdminFailureWindow;
  automationHealth: AdminAutomationHealth[];
  termsStaleness: AdminTermsStaleness;
  integrations: {
    partnerEnabled: boolean;
    degradedWorkspaces: number;
    byWorkspace: AdminWorkspaceIntegrations[];
  };
  /**
   * Already privacy-projected by construction — see `platform/platformTelemetry.ts`.
   * Deliberately unscoped: platform self-observation covers every workspace,
   * including our own, because that is what it is for.
   */
  telemetry: PlatformTelemetrySnapshot;
}

// ───────────────────────────────────────────────────────────────── sections ──

/**
 * Workspaces sitting behind a readiness block right now.
 *
 * "Right now" means the TASK is still `blocked`; a run that was blocked last
 * week and rerun successfully must not keep showing up as an open problem.
 */
export function collectBlockedNow(
  dataset: AdminDataset,
  workspaces: WorkspaceProfile[],
): AdminBlockedWorkspace[] {
  const rows: AdminBlockedWorkspace[] = [];

  for (const workspace of workspaces) {
    const runsByTaskId = new Map<string, TaskRunRecord[]>();
    for (const run of dataset.taskRunsByWorkspace.get(workspace.id) || []) {
      const bucket = runsByTaskId.get(run.taskId);
      if (bucket) bucket.push(run);
      else runsByTaskId.set(run.taskId, [run]);
    }

    for (const task of dataset.tasksByWorkspace.get(workspace.id) || []) {
      if (task.status !== 'blocked') continue;
      const latestRun = (runsByTaskId.get(task.id) || [])
        .slice()
        .sort((left, right) => Date.parse(right.startedAt) - Date.parse(left.startedAt))[0];
      // The block is written onto both records; the task is authoritative for
      // "still blocked", the run for when it happened.
      const block = projectReadinessBlock(task.metadata)
        || (latestRun ? projectReadinessBlock(latestRun.metadata) : null);
      if (!block) continue;

      rows.push({
        workspaceId: workspace.id,
        workspaceName: workspace.name,
        automationName: latestRun
          ? resolveMissionName(latestRun, {
              automationById: dataset.automationById,
              taskById: new Map([[task.id, task]]),
            })
          : task.title,
        taskId: task.id,
        runId: latestRun?.id || null,
        blockerKeys: block.blockerKeys,
        blockerLabels: block.blockerLabels,
        blockedAt: block.blockedAt || task.updatedAt || null,
      });
    }
  }

  return rows
    .sort((left, right) => Date.parse(right.blockedAt || '') - Date.parse(left.blockedAt || ''))
    .slice(0, MAX_LISTED_ROWS);
}

/**
 * The review queue, across every workspace.
 *
 * Derived the same way `slack/operatorConsole.ts` derives it — tasks in
 * `waiting_review` paired with their newest run — but that helper returns whole
 * task and run records for a single workspace, which is exactly what must not
 * cross the admin boundary. The rule is shared; the payload is not.
 */
export function collectWaitingReviews(
  dataset: AdminDataset,
  workspaces: WorkspaceProfile[],
  now: Date,
): AdminWaitingReview[] {
  const rows: AdminWaitingReview[] = [];

  for (const workspace of workspaces) {
    const runs = dataset.taskRunsByWorkspace.get(workspace.id) || [];
    for (const task of dataset.tasksByWorkspace.get(workspace.id) || []) {
      if (task.status !== 'waiting_review') continue;
      const latestRun = runs
        .filter((run) => run.taskId === task.id)
        .sort((left, right) => Date.parse(right.startedAt) - Date.parse(left.startedAt))[0];
      if (!latestRun) continue;

      const waitingSince = latestRun.finishedAt || task.updatedAt || latestRun.startedAt;
      const waitingSinceMs = Date.parse(waitingSince);
      rows.push({
        workspaceId: workspace.id,
        workspaceName: workspace.name,
        missionName: resolveMissionName(latestRun, {
          automationById: dataset.automationById,
          taskById: new Map([[task.id, task]]),
        }),
        taskId: task.id,
        runId: latestRun.id,
        waitingSince,
        waitingHours: Number.isFinite(waitingSinceMs)
          ? Math.max(0, Math.round(((now.getTime() - waitingSinceMs) / 3_600_000) * 10) / 10)
          : 0,
      });
    }
  }

  // Oldest first: the review that has been waiting longest is the one to do.
  return rows
    .sort((left, right) => Date.parse(left.waitingSince) - Date.parse(right.waitingSince))
    .slice(0, MAX_LISTED_ROWS);
}

/** Automations that are failing repeatedly or have been paused. */
export function collectAutomationHealth(
  dataset: AdminDataset,
  workspaces: WorkspaceProfile[],
): AdminAutomationHealth[] {
  return workspaces
    .flatMap((workspace) => (dataset.automationsByWorkspace.get(workspace.id) || [])
      .filter((automation) =>
        (automation.consecutive_failures || 0) > 0 || automation.status === 'paused')
      .map((automation) => ({
        ...projectAutomationSummary(automation, workspace.id),
        workspaceName: workspace.name,
      })))
    .sort((left, right) => right.consecutiveFailures - left.consecutiveFailures)
    .slice(0, MAX_LISTED_ROWS);
}

/**
 * How much of the base is on current beta terms.
 *
 * An account counts as current only when BOTH the access record names today's
 * version and a consent receipt exists for it — the record alone is a claim,
 * the receipt is the evidence.
 */
export function summarizeTermsStaleness(dataset: AdminDataset): AdminTermsStaleness {
  let currentCount = 0;
  let staleCount = 0;
  let neverAcceptedCount = 0;

  const emails = new Set([
    ...dataset.accessRecords.map((record) => record.email),
    ...dataset.authUsers.map((user) => user.email),
  ]);

  for (const email of emails) {
    const accepted = dataset.accessRecordByEmail.get(email)?.acceptedTermsVersion;
    if (!accepted) {
      neverAcceptedCount += 1;
      continue;
    }
    if (accepted === CURRENT_BETA_TERMS_VERSION && dataset.currentConsentEmails.has(email)) {
      currentCount += 1;
    } else {
      staleCount += 1;
    }
  }

  return {
    currentVersion: CURRENT_BETA_TERMS_VERSION,
    currentCount,
    staleCount,
    neverAcceptedCount,
    totalAccounts: emails.size,
  };
}

/** One workspace's partner-connection lookup. Injected in tests. */
export type PartnerConnectionReader = (
  workspaceId: string,
) => Promise<{ apps: string[]; ok: boolean }>;

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;

  async function pump(): Promise<void> {
    for (;;) {
      const index = cursor;
      cursor += 1;
      if (index >= items.length) return;
      results[index] = await worker(items[index], index);
    }
  }

  await Promise.all(
    Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, () => pump()),
  );
  return results;
}

/**
 * Native integrations this workspace configured with its OWN credentials.
 *
 * Server-configured credentials are deliberately excluded: they are Violema's,
 * and counting them would tell the operator a tenant is connected when the
 * readiness gate will refuse the run.
 */
function readWorkspaceConfiguredIntegrations(workspaceId: string): string[] {
  try {
    const view = getWorkspaceSettingsView(workspaceId);
    return Object.entries(view.integrations)
      .filter(([, status]) => status.workspaceConfigured)
      .map(([provider]) => provider)
      .sort();
  } catch {
    // A settings store that cannot be decrypted must not take down the whole
    // operations view; the workspace simply reports nothing configured.
    return [];
  }
}

export async function collectIntegrationsByWorkspace(input: {
  workspaces: WorkspaceProfile[];
  partnerEnabled: boolean;
  readPartnerConnections: PartnerConnectionReader;
}): Promise<AdminWorkspaceIntegrations[]> {
  return await mapWithConcurrency(
    input.workspaces,
    PARTNER_LOOKUP_CONCURRENCY,
    async (workspace) => {
      let apps: string[] = [];
      let ok = true;
      if (input.partnerEnabled) {
        try {
          const result = await input.readPartnerConnections(workspace.id);
          apps = result.apps;
          ok = result.ok;
        } catch {
          // Degrade this workspace, not the endpoint.
          ok = false;
        }
      }

      return {
        workspaceId: workspace.id,
        workspaceName: workspace.name,
        connectedToolkits: [...apps].sort(),
        workspaceConfiguredIntegrations: readWorkspaceConfiguredIntegrations(workspace.id),
        degraded: !ok,
      };
    },
  );
}

// ──────────────────────────────────────────────────────────────── composer ──

export interface AdminOperationsOptions {
  includeInternal?: boolean;
  windowHours?: number;
  now?: Date;
  dataset?: AdminDataset;
  /** Injected in tests so the operations view never reaches a live API. */
  readPartnerConnections?: PartnerConnectionReader;
  partnerEnabled?: boolean;
}

export async function buildAdminOperations(
  options: AdminOperationsOptions = {},
): Promise<AdminOperationsSnapshot> {
  const dataset = options.dataset || loadAdminDataset();
  const now = options.now || new Date();
  const windowHours = normalizeWindowHours(options.windowHours);
  const scope = scopeWorkspaces(dataset, options);
  const partnerEnabled = options.partnerEnabled ?? isComposioEnabled();
  const readPartnerConnections: PartnerConnectionReader = options.readPartnerConnections
    // The shared per-workspace memo (`COMPOSIO_STATUS_CACHE_MS`) lives inside
    // `listConnectedAppsDetailed`, so this path costs at most one upstream call
    // per workspace per TTL even with the dashboard open and refreshing.
    || ((workspaceId: string) => listConnectedAppsDetailed({ entityId: workspaceId }));

  const integrationsByWorkspace = await collectIntegrationsByWorkspace({
    workspaces: scope.workspaces,
    partnerEnabled,
    readPartnerConnections,
  });

  return {
    generatedAt: now.toISOString(),
    windowHours,
    scope: {
      includeInternal: scope.includeInternal,
      excludedInternalWorkspaces: scope.excludedInternalWorkspaces,
      workspaceCount: scope.workspaces.length,
    },
    blockedNow: collectBlockedNow(dataset, scope.workspaces),
    waitingReviews: collectWaitingReviews(dataset, scope.workspaces, now),
    recentFailures: buildFailureWindow({
      dataset,
      workspaces: scope.workspaces,
      windowHours,
      now,
      limit: MAX_LISTED_ROWS,
    }),
    automationHealth: collectAutomationHealth(dataset, scope.workspaces),
    termsStaleness: summarizeTermsStaleness(dataset),
    integrations: {
      partnerEnabled,
      degradedWorkspaces: integrationsByWorkspace.filter((row) => row.degraded).length,
      byWorkspace: integrationsByWorkspace,
    },
    telemetry: composePlatformTelemetrySnapshot({
      workspaces: dataset.workspaces,
      tasks: dataset.tasks,
      taskRuns: dataset.taskRuns,
      ledger: dataset.ledger,
      ledgerEvents: readAllWorkflowLedgerEvents(),
      accounts: dataset.accountStageRecords,
      now,
    }),
  };
}
