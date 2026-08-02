/**
 * The admin dashboard's read model.
 *
 * Three rules govern everything in this file:
 *
 *   1. METADATA ONLY. Every record that leaves here goes through
 *      `adminProjection.ts`. The operator is not the tenant.
 *   2. HONEST NUMBERS. A metric that mixes estimates with actuals, counts our
 *      own demo workspaces as customers, or scores an unconnected tester as
 *      product unreliability is worse than no metric — it is a number the
 *      operator will act on. Where a number cannot be exact, the ambiguity is
 *      reported as its own field rather than folded in.
 *   3. ONE READ PER STORE. Builders take an optional `AdminDataset`; the routes
 *      load one per request and share it. See `adminDataset.ts`.
 */

import {
  isAccessRecordApprovalReadyGiven,
  listAdminAuditEvents,
} from './adminAccessStore';
import { getAuthUserDefaultWorkspaceId } from './auth';
import { CURRENT_BETA_TERMS_VERSION, PARTICIPANT_TYPES, type ParticipantType } from './betaProgram';
import { ACCOUNT_STAGES, type AccountStage } from './platform/accountStage';
import { composeBillingStatus, selectBillingConfigSnapshot } from './platform/billing';
import { summarizeCreditLedger } from './platform/ledger';
import { getDefaultWorkspaceProfile } from './platform/workspace';
import {
  isInternalWorkspaceIn,
  loadAdminDataset,
  scopeWorkspaces,
  type AdminDataset,
} from './adminDataset';
import {
  countByFailureKind,
  projectAutomationSummary,
  projectFailedRun,
  projectLedgerEntry,
  projectReadinessBlock,
  projectRunSummary,
  projectTaskSummary,
  projectWorkspaceIdentity,
  type AdminFailedRunSummary,
  type AdminFailureKind,
} from './adminProjection';
import type { CreditLedgerEntry, TaskRunRecord } from './platform/types';

/** Default trailing window for "what is broken right now" surfaces. */
export const DEFAULT_ADMIN_WINDOW_HOURS = 24;
const MAX_ADMIN_WINDOW_HOURS = 24 * 365;
const RECENT_FAILED_RUN_LIMIT = 8;
const DETAIL_RECORD_LIMIT = 100;

function pct(numerator: number, denominator: number) {
  if (denominator <= 0) return 0;
  return Math.round((numerator / denominator) * 100);
}

function lastActivity(values: Array<string | undefined>): string | null {
  const sorted = values.filter((value): value is string => Boolean(value)).sort();
  return sorted.length > 0 ? sorted[sorted.length - 1] : null;
}

export interface AdminScopeOptions {
  /** Include Violema's own default and demo workspaces in headline numbers. */
  includeInternal?: boolean;
  /** Trailing window, in hours, for the failure feed. */
  windowHours?: number;
  now?: Date;
  dataset?: AdminDataset;
}

export function normalizeWindowHours(value: number | undefined): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    return DEFAULT_ADMIN_WINDOW_HOURS;
  }
  return Math.min(MAX_ADMIN_WINDOW_HOURS, Math.max(1, Math.round(value)));
}

type TrialAttributionEntry = Pick<CreditLedgerEntry, 'deltaCredits' | 'createdAt'>;

export function attributeTrialFirstUsage(
  entries: TrialAttributionEntry[],
  trialEntry: TrialAttributionEntry,
) {
  const trialCredits = Math.max(0, trialEntry.deltaCredits);
  const trialGrantedAtMs = Date.parse(trialEntry.createdAt);
  const spentCredits = Math.min(
    trialCredits,
    entries.reduce((spent, entry) => {
      if (entry.deltaCredits >= 0 || Date.parse(entry.createdAt) < trialGrantedAtMs) return spent;
      return spent + Math.abs(entry.deltaCredits);
    }, 0),
  );
  return {
    trialCredits,
    spentCredits,
    remainingCredits: Math.max(0, trialCredits - spentCredits),
  };
}

// ────────────────────────────────────────────────────────────────── people ──

export function buildAdminUsers(dataset: AdminDataset = loadAdminDataset()) {
  const emails = new Set([
    ...dataset.authUsers.map((user) => user.email),
    ...dataset.accessRecords.map((record) => record.email),
  ]);

  return Array.from(emails).sort().map((email) => {
    const user = dataset.authUserByEmail.get(email) || null;
    const access = dataset.accessRecordByEmail.get(email) || null;
    const userParticipantType = (user as (typeof user & { participantType?: ParticipantType }) | null)?.participantType;
    const role = access?.status === 'requested' && user?.role === 'admin'
      ? 'admin'
      : access?.role || user?.role || 'user';
    // In-memory equivalent of `isEmailApprovedForAccess`, which otherwise reads
    // the access store once per account: approved wins, revoked loses, and the
    // env allowlist decides the rest.
    const approvedAccess = access?.status === 'approved'
      || (access?.status !== 'revoked' && dataset.envApprovedEmails.has(email));
    const accessStatus = access?.status || (approvedAccess ? 'approved' : 'requested');
    const hasCurrentConsent = dataset.currentConsentEmails.has(email);

    const ledgerEntries = user
      ? dataset.ledgerByWorkspace.get(getAuthUserDefaultWorkspaceId(user)) || []
      : [];
    const trialEntry = ledgerEntries.find((entry) => entry.source === 'trial_grant' && entry.deltaCredits > 0) || null;
    const trialUsage = trialEntry
      ? attributeTrialFirstUsage(ledgerEntries, trialEntry)
      : { trialCredits: 0, spentCredits: 0, remainingCredits: 0 };
    const stageRecord = dataset.accountStageByEmail.get(email) || null;

    return {
      email,
      name: user?.name || access?.name || email.split('@')[0],
      role,
      method: user?.method || access?.method || 'email',
      accessStatus,
      approvedAccess,
      hasAccessRecord: Boolean(access),
      participantType: access?.participantType || userParticipantType || 'founder_operator',
      // Axis 2: where they stand with us. Derived — see platform/accountStage.ts.
      // `reason` and `derivedFrom` travel with the stage so the admin UI can
      // show WHY a row says what it says instead of asking the operator to trust it.
      accountStage: stageRecord?.accountStage
        || {
          stage: 'applicant' as AccountStage,
          reason: 'No account record found for this email.',
          derivedFrom: [] as string[],
        },
      /** Has completed at least one successful run. */
      activated: stageRecord?.activated ?? false,
      stageOverride: stageRecord?.stageOverride ?? null,
      stageOverrideBy: stageRecord?.stageOverrideBy ?? null,
      stageOverrideAt: stageRecord?.stageOverrideAt ?? null,
      identityVerified: Boolean(access?.identityVerifiedAt),
      termsCurrent: access?.acceptedTermsVersion === CURRENT_BETA_TERMS_VERSION && hasCurrentConsent,
      termsVersion: access?.acceptedTermsVersion || null,
      approvalReady: access ? isAccessRecordApprovalReadyGiven(access, hasCurrentConsent) : false,
      trialStatus: trialEntry ? 'granted' : role === 'admin' ? 'not_applicable' : approvedAccess ? 'pending' : 'not_applicable',
      trialCredits: trialUsage.trialCredits,
      trialSpentCredits: trialUsage.spentCredits,
      trialRemainingCredits: trialUsage.remainingCredits,
      trialGrantedAt: trialEntry?.createdAt || null,
      slackConnected: Boolean(user?.slackWorkspace && user?.slackChannelId),
      slackDisplayTarget: user?.slackDisplayTarget || null,
      activeSessionCount: user ? dataset.sessionCountByUserId.get(user.id) || 0 : 0,
      createdAt: user?.createdAt || access?.createdAt || null,
      updatedAt: user?.updatedAt || access?.updatedAt || null,
    };
  });
}

export type AdminUserRow = ReturnType<typeof buildAdminUsers>[number];

export interface AdminUserFilters {
  stage?: AccountStage[];
  participantType?: ParticipantType[];
  activated?: boolean;
}

/**
 * Server-side filtering for the participants list. Every predicate is an
 * intersection, and an empty list for a facet means "no constraint" rather than
 * "match nothing" — an omitted filter must never silently empty the table.
 */
export function filterAdminUsers(rows: AdminUserRow[], filters: AdminUserFilters): AdminUserRow[] {
  const stages = filters.stage && filters.stage.length > 0 ? new Set<string>(filters.stage) : null;
  const participantTypes = filters.participantType && filters.participantType.length > 0
    ? new Set<string>(filters.participantType)
    : null;

  return rows.filter((row) => {
    if (stages && !stages.has(row.accountStage.stage)) return false;
    if (participantTypes && !participantTypes.has(row.participantType)) return false;
    if (filters.activated !== undefined && row.activated !== filters.activated) return false;
    return true;
  });
}

/**
 * Facet counts over the UNFILTERED set, so selecting a stage does not collapse
 * the other stages' counts to zero and hide where the rest of the base sits.
 */
export function summarizeAdminUserFacets(rows: AdminUserRow[]) {
  const byStage = Object.fromEntries(ACCOUNT_STAGES.map((stage) => [stage, 0])) as Record<AccountStage, number>;
  const byParticipantType = Object.fromEntries(
    PARTICIPANT_TYPES.map((participantType) => [participantType, 0]),
  ) as Record<ParticipantType, number>;
  let activated = 0;

  for (const row of rows) {
    byStage[row.accountStage.stage] = (byStage[row.accountStage.stage] || 0) + 1;
    byParticipantType[row.participantType] = (byParticipantType[row.participantType] || 0) + 1;
    if (row.activated) activated += 1;
  }

  return {
    total: rows.length,
    byStage,
    byParticipantType,
    activated,
    notActivated: rows.length - activated,
  };
}

/**
 * "Latest activity" ordering, by a real recency signal.
 *
 * The old `recentUsers` sliced an alphabetically sorted array and labeled the
 * result latest activity, so the dashboard's "recent" panel was really "users
 * whose email starts with A". Named for what it is so the UI cannot mislabel it.
 */
export function selectRecentlyUpdatedUsers(rows: AdminUserRow[], limit = RECENT_FAILED_RUN_LIMIT) {
  const recencyOf = (row: AdminUserRow) => {
    const parsed = Date.parse(row.updatedAt || row.createdAt || '');
    return Number.isFinite(parsed) ? parsed : Number.NEGATIVE_INFINITY;
  };
  return [...rows]
    .sort((left, right) => {
      const delta = recencyOf(right) - recencyOf(left);
      // Alphabetical only as a tiebreak, so the order is deterministic without
      // pretending alphabetical means recent.
      return delta !== 0 ? delta : left.email.localeCompare(right.email);
    })
    .slice(0, limit);
}

// ─────────────────────────────────────────────────────────── run performance ──

export interface AdminRunPerformance {
  totalRuns: number;
  succeededRuns: number;
  /** Genuine failures: the product did not work. */
  failedRuns: number;
  /** Readiness blocks: the workspace is not connected yet. Not our fault. */
  blockedRuns: number;
  /** succeeded / (succeeded + failed). Blocked runs are excluded from both. */
  runSuccessRate: number;
  /** Blended actual-or-estimate average. Kept for continuity; prefer the next two. */
  averageRunCredits: number;
  /** Average over runs that reported ACTUAL credits. */
  averageActualRunCredits: number;
  /** Runs whose only credit figure is an estimate. */
  estimatedOnlyRuns: number;
  creditsFromRuns: number;
  actualCreditsFromRuns: number;
  lastActivityAt: string | null;
}

/**
 * Run health over an already-loaded set of runs.
 *
 * Readiness-blocked runs are split out on purpose. They are recorded as
 * `status: 'failed'` because nothing was produced, but counting them as
 * failures makes ten unconnected testers look like a broken product on Monday
 * morning, and the operator's correct action ("help them connect") is the
 * opposite of the action a failure rate implies ("fix the bug").
 */
export function summarizeRunPerformance(runs: TaskRunRecord[]): AdminRunPerformance {
  let succeeded = 0;
  let failed = 0;
  let blocked = 0;
  let blendedCredits = 0;
  let actualCredits = 0;
  let actualCreditRuns = 0;
  let estimatedOnlyRuns = 0;

  for (const run of runs) {
    const readinessBlocked = Boolean(projectReadinessBlock(run.metadata));
    if (run.status === 'succeeded') succeeded += 1;
    else if (run.status === 'failed') {
      if (readinessBlocked) blocked += 1;
      else failed += 1;
    } else if (readinessBlocked) blocked += 1;

    const hasActual = typeof run.actualCredits === 'number' && Number.isFinite(run.actualCredits);
    if (hasActual) {
      actualCredits += Math.max(0, run.actualCredits as number);
      actualCreditRuns += 1;
    } else if (typeof run.estimatedCredits === 'number' && Number.isFinite(run.estimatedCredits)) {
      estimatedOnlyRuns += 1;
    }
    blendedCredits += Math.max(0, run.actualCredits ?? run.estimatedCredits ?? 0);
  }

  return {
    totalRuns: runs.length,
    succeededRuns: succeeded,
    failedRuns: failed,
    blockedRuns: blocked,
    runSuccessRate: pct(succeeded, succeeded + failed),
    averageRunCredits: runs.length > 0 ? Math.round(blendedCredits / runs.length) : 0,
    averageActualRunCredits: actualCreditRuns > 0 ? Math.round(actualCredits / actualCreditRuns) : 0,
    estimatedOnlyRuns,
    creditsFromRuns: blendedCredits,
    actualCreditsFromRuns: actualCredits,
    lastActivityAt: lastActivity(runs.map((run) => run.finishedAt || run.startedAt)),
  };
}

export function buildWorkspacePerformanceSummary(
  workspaceId: string,
  dataset: AdminDataset = loadAdminDataset(),
): AdminRunPerformance {
  return summarizeRunPerformance(dataset.taskRunsByWorkspace.get(workspaceId) || []);
}

// ────────────────────────────────────────────────────────────── workspaces ──

function buildWorkspaceRow(dataset: AdminDataset, workspace: { id: string; name: string; slug: string; ownerEmail?: string }) {
  const ledgerEntries = dataset.ledgerByWorkspace.get(workspace.id) || [];
  const billing = composeBillingStatus({
    config: selectBillingConfigSnapshot(dataset.billingConfigs, workspace.id),
    summary: summarizeCreditLedger(ledgerEntries),
    offers: dataset.topUpOffers,
  });
  const tasks = dataset.tasksByWorkspace.get(workspace.id) || [];
  const runs = dataset.taskRunsByWorkspace.get(workspace.id) || [];
  const performance = summarizeRunPerformance(runs);
  const automations = dataset.automationsByWorkspace.get(workspace.id) || [];

  const rowState =
    billing.summary.balanceCredits <= 0 ? 'billing_issue'
    : billing.summary.balanceCredits < 100 ? 'low_credits'
    : performance.failedRuns > 0 ? 'failed_runs'
    // Readiness blocks are their own state: the fix is a connection, not a bug.
    : performance.blockedRuns > 0 ? 'readiness_blocked'
    : performance.totalRuns === 0 ? 'no_activity'
    : 'healthy';

  return {
    workspaceId: workspace.id,
    workspaceName: workspace.name,
    slug: workspace.slug,
    ownerEmail: workspace.ownerEmail || null,
    internal: isInternalWorkspaceIn(dataset, workspace.id),
    planId: billing.config.planId,
    planName: billing.plan.name,
    subscriptionStatus: billing.config.subscriptionStatus || 'none',
    creditBalance: billing.summary.balanceCredits,
    creditsSpent: billing.summary.spentCredits,
    taskCount: tasks.length,
    runCount: runs.length,
    /** Automations attributed to THIS workspace. */
    automationCount: automations.length,
    automationScope: 'workspace' as const,
    /** Every automation on the instance, so the UI can show the row in context. */
    globalAutomationCount: dataset.automations.length,
    /**
     * Legacy records carrying no workspaceId. They are counted into the default
     * workspace (matching how they actually run), and reported here so the UI
     * can say so instead of implying clean attribution.
     */
    unattributedAutomationCount: dataset.unattributedAutomationCount,
    activeAutomationCount: automations.filter((automation) => automation.status === 'active').length,
    rowState,
    totalRuns: performance.totalRuns,
    succeededRuns: performance.succeededRuns,
    failedRuns: performance.failedRuns,
    blockedRuns: performance.blockedRuns,
    runSuccessRate: performance.runSuccessRate,
    averageRunCredits: performance.averageRunCredits,
    averageActualRunCredits: performance.averageActualRunCredits,
    estimatedOnlyRuns: performance.estimatedOnlyRuns,
    creditsFromRuns: performance.creditsFromRuns,
    actualCreditsFromRuns: performance.actualCreditsFromRuns,
    lastActivityAt: performance.lastActivityAt,
  };
}

export type AdminWorkspaceRow = ReturnType<typeof buildWorkspaceRow>;

export function buildAdminWorkspaces(options: AdminScopeOptions = {}): AdminWorkspaceRow[] {
  const dataset = options.dataset || loadAdminDataset();
  const scope = scopeWorkspaces(dataset, options);
  return scope.workspaces.map((workspace) => buildWorkspaceRow(dataset, workspace));
}

/**
 * The per-workspace drilldown. Metadata only, same discipline as the overview:
 * the operator sees which missions exist, which runs failed, and how credits
 * moved — never what any of it said.
 */
export function buildWorkspaceAdminDetail(
  workspaceId: string,
  options: AdminScopeOptions = {},
) {
  const dataset = options.dataset || loadAdminDataset();
  const workspace = dataset.workspaces.find((item) => item.id === workspaceId)
    || getDefaultWorkspaceProfile(workspaceId);
  const automations = dataset.automationsByWorkspace.get(workspaceId) || [];
  const ledgerEntries = dataset.ledgerByWorkspace.get(workspaceId) || [];
  const billing = composeBillingStatus({
    config: selectBillingConfigSnapshot(dataset.billingConfigs, workspaceId),
    summary: summarizeCreditLedger(ledgerEntries),
    offers: dataset.topUpOffers,
  });

  return {
    workspace: {
      ...projectWorkspaceIdentity(workspace),
      internal: isInternalWorkspaceIn(dataset, workspaceId),
    },
    // The full BillingStatus carries offer catalogs and prose hints that the
    // admin does not need; only the numbers that describe this tenant's account.
    billing: {
      planId: billing.config.planId,
      planName: billing.plan.name,
      subscriptionStatus: billing.config.subscriptionStatus || 'none',
      seatCount: billing.config.seatCount,
      balanceCredits: billing.summary.balanceCredits,
      grantedCredits: billing.summary.grantedCredits,
      spentCredits: billing.summary.spentCredits,
      updatedAt: billing.summary.updatedAt,
    },
    performance: summarizeRunPerformance(dataset.taskRunsByWorkspace.get(workspaceId) || []),
    automationCount: automations.length,
    unattributedAutomationCount: dataset.unattributedAutomationCount,
    automations: automations.map((automation) => projectAutomationSummary(automation, workspaceId)),
    tasks: (dataset.tasksByWorkspace.get(workspaceId) || [])
      .slice(0, DETAIL_RECORD_LIMIT)
      .map(projectTaskSummary),
    runs: (dataset.taskRunsByWorkspace.get(workspaceId) || [])
      .slice(0, DETAIL_RECORD_LIMIT)
      .map(projectRunSummary),
    ledger: ledgerEntries.slice(0, DETAIL_RECORD_LIMIT).map(projectLedgerEntry),
  };
}

// ──────────────────────────────────────────────────────────────── overview ──

export interface AdminFailureWindow {
  windowHours: number;
  from: string;
  to: string;
  items: AdminFailedRunSummary[];
  total: number;
  countsByKind: Record<AdminFailureKind, number>;
}

/**
 * Failed runs inside a trailing window, projected and classified.
 *
 * All-time was the old behavior and it is the wrong default for an operator
 * dashboard: a failure from six weeks ago that was already fixed reads exactly
 * like one from ten minutes ago.
 */
export function buildFailureWindow(input: {
  dataset: AdminDataset;
  workspaces: Array<{ id: string; name: string }>;
  windowHours: number;
  now: Date;
  limit?: number;
}): AdminFailureWindow {
  const toMs = input.now.getTime();
  const fromMs = toMs - input.windowHours * 60 * 60 * 1000;
  const taskById = new Map(input.dataset.tasks.map((task) => [task.id, task]));

  const projected = input.workspaces.flatMap((workspace) =>
    (input.dataset.taskRunsByWorkspace.get(workspace.id) || [])
      .filter((run) => {
        if (run.status !== 'failed') return false;
        const at = Date.parse(run.finishedAt || run.startedAt);
        return Number.isFinite(at) && at >= fromMs && at <= toMs;
      })
      .map((run) => ({
        at: Date.parse(run.finishedAt || run.startedAt),
        summary: projectFailedRun({
          run,
          workspaceName: workspace.name,
          lookup: { automationById: input.dataset.automationById, taskById },
        }),
      })),
  ).sort((left, right) => right.at - left.at);

  const items = projected.map((entry) => entry.summary);
  return {
    windowHours: input.windowHours,
    from: new Date(fromMs).toISOString(),
    to: new Date(toMs).toISOString(),
    items: items.slice(0, input.limit ?? RECENT_FAILED_RUN_LIMIT),
    total: items.length,
    countsByKind: countByFailureKind(items),
  };
}

export function buildAdminOverview(options: AdminScopeOptions = {}) {
  const dataset = options.dataset || loadAdminDataset();
  const now = options.now || new Date();
  const windowHours = normalizeWindowHours(options.windowHours);
  const scope = scopeWorkspaces(dataset, options);

  const users = buildAdminUsers(dataset);
  const workspaces = scope.workspaces.map((workspace) => buildWorkspaceRow(dataset, workspace));
  const facets = summarizeAdminUserFacets(users);

  const totalRuns = workspaces.reduce((sum, workspace) => sum + workspace.totalRuns, 0);
  const succeededRuns = workspaces.reduce((sum, workspace) => sum + workspace.succeededRuns, 0);
  const failedRuns = workspaces.reduce((sum, workspace) => sum + workspace.failedRuns, 0);
  const blockedRuns = workspaces.reduce((sum, workspace) => sum + workspace.blockedRuns, 0);
  const actualCredits = workspaces.reduce((sum, workspace) => sum + workspace.actualCreditsFromRuns, 0);
  const actualCreditRuns = workspaces.reduce(
    (sum, workspace) => sum + (workspace.totalRuns - workspace.estimatedOnlyRuns),
    0,
  );
  const estimatedOnlyRuns = workspaces.reduce((sum, workspace) => sum + workspace.estimatedOnlyRuns, 0);

  // Automations are counted through the same workspace scope as everything
  // else, so the headline cannot include our own seeded internal missions while
  // the workspace table excludes them.
  const scopedWorkspaceIds = new Set(scope.workspaces.map((workspace) => workspace.id));
  const scopedAutomations = dataset.automations.filter((automation) =>
    scopedWorkspaceIds.has(
      typeof automation.workspaceId === 'string' && automation.workspaceId.trim()
        ? automation.workspaceId.trim()
        : '',
    ),
  );

  return {
    generatedAt: now.toISOString(),
    windowHours,
    scope: {
      includeInternal: scope.includeInternal,
      excludedInternalWorkspaces: scope.excludedInternalWorkspaces,
    },
    // The closed sets the admin UI renders its selectors from, so a new
    // participant type or stage does not need a matching frontend release.
    catalog: {
      participantTypes: PARTICIPANT_TYPES,
      accountStages: ACCOUNT_STAGES,
    },
    metrics: {
      approvedUsers: users.filter((user) => user.approvedAccess).length,
      pendingUsers: users.filter((user) => user.accessStatus === 'requested' && !user.approvedAccess).length,
      accountsByStage: facets.byStage,
      accountsByParticipantType: facets.byParticipantType,
      activatedAccounts: facets.activated,
      workspaces: workspaces.length,
      excludedInternalWorkspaces: scope.excludedInternalWorkspaces,
      activeAutomations: scopedAutomations.filter((item) => item.status === 'active').length,
      totalAutomations: dataset.automations.length,
      unattributedAutomationCount: dataset.unattributedAutomationCount,
      totalRuns,
      succeededRuns,
      failedRuns,
      blockedRuns,
      runSuccessRate: pct(succeededRuns, succeededRuns + failedRuns),
      averageActualRunCredits: actualCreditRuns > 0 ? Math.round(actualCredits / actualCreditRuns) : 0,
      estimatedOnlyRuns,
      creditsSpent: workspaces.reduce((sum, workspace) => sum + workspace.creditsSpent, 0),
    },
    recentlyUpdatedUsers: selectRecentlyUpdatedUsers(users),
    workspacesNeedingAttention: workspaces.filter((workspace) => workspace.rowState !== 'healthy').slice(0, 8),
    recentFailedRuns: buildFailureWindow({
      dataset,
      workspaces: scope.workspaces,
      windowHours,
      now,
    }).items,
  };
}

export function buildAdminAudit(limit = 100) {
  return listAdminAuditEvents(limit);
}
