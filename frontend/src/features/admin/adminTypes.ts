/**
 * The admin API's response shapes, mirrored from the backend read model.
 *
 * Source of truth, in order:
 *   - `backend/src/adminProjection.ts`  — the privacy boundary's projections
 *   - `backend/src/adminDashboard.ts`   — overview, users, workspaces
 *   - `backend/src/adminOperations.ts`  — the operations snapshot
 *   - `backend/src/platform/accountStage.ts` — the account-stage axis
 *   - `backend/src/platform/platformTelemetry.ts` — the telemetry snapshot
 *
 * Fields are typed as the backend emits them: a value the backend always sends
 * is required here, so a rename shows up as a type error rather than as
 * `undefined` rendered into the operator's dashboard.
 */

import type { ParticipantType } from '../../lib/auth';

export type AdminRole = 'user' | 'admin';
export type AccessStatus = 'requested' | 'approved' | 'revoked';

// ───────────────────────────────────────────────────────────── account stage ──

export type AccountStage = 'internal' | 'applicant' | 'trial' | 'paying' | 'lapsed';

/**
 * A stage never travels alone. `lapsed` legitimately means EITHER "subscription
 * canceled" OR "beta access revoked", so a bare badge misleads — `reason` is the
 * only thing that disambiguates it, and it is required here for that reason.
 */
export interface AccountStageResolution {
  stage: AccountStage;
  reason: string;
  derivedFrom: string[];
}

export type AccountStageOverride = 'internal';

// ────────────────────────────────────────────────────────────────── failures ──

export type AdminFailureKind =
  | 'fabricated_evidence'
  | 'readiness_blocked'
  | 'connector'
  | 'other';

/**
 * Replaces the raw run record the overview used to return. There is deliberately
 * no `error` field: raw error text embeds tenant artifact titles and provider
 * payloads, so the backend classifies instead and emits a constant summary.
 */
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

export interface AdminFailureWindow {
  windowHours: number;
  from: string;
  to: string;
  items: AdminFailedRunSummary[];
  total: number;
  countsByKind: Record<AdminFailureKind, number>;
}

// ───────────────────────────────────────────────────────────────────── users ──

export interface AdminUserRow {
  email: string;
  name?: string;
  role: AdminRole;
  method?: string;
  accessStatus: AccessStatus;
  approvedAccess?: boolean;
  hasAccessRecord?: boolean;
  participantType: ParticipantType;
  accountStage: AccountStageResolution;
  /** Completed at least one successful run. */
  activated: boolean;
  stageOverride: AccountStageOverride | null;
  stageOverrideBy: string | null;
  stageOverrideAt: string | null;
  identityVerified: boolean;
  termsCurrent: boolean;
  termsVersion?: string | null;
  approvalReady: boolean;
  trialStatus: 'granted' | 'pending' | 'not_applicable';
  trialCredits: number;
  trialSpentCredits: number;
  trialRemainingCredits: number;
  trialGrantedAt?: string | null;
  slackConnected?: boolean;
  slackDisplayTarget?: string | null;
  activeSessionCount?: number;
  createdAt?: string | null;
  updatedAt?: string | null;
}

export interface AdminUserFacetCounts {
  total: number;
  byStage: Record<AccountStage, number>;
  byParticipantType: Record<string, number>;
  activated: number;
  notActivated: number;
}

export interface AdminCatalog {
  participantTypes: ParticipantType[];
  accountStages: AccountStage[];
}

export interface AdminUsersResponse {
  items: AdminUserRow[];
  matched: number;
  /** Counted over the UNFILTERED set, so narrowing never hides the base numbers. */
  counts: AdminUserFacetCounts;
  filters: {
    stage: AccountStage[] | null;
    participantType: ParticipantType[] | null;
    activated: boolean | null;
  };
  catalog: AdminCatalog;
}

export interface AdminUserFilterState {
  stage: AccountStage[];
  participantType: ParticipantType[];
  activated: boolean | null;
}

// ──────────────────────────────────────────────────────────────── workspaces ──

export type AdminWorkspaceRowState =
  | 'billing_issue'
  | 'low_credits'
  | 'failed_runs'
  | 'readiness_blocked'
  | 'no_activity'
  | 'healthy';

export interface AdminWorkspaceRow {
  workspaceId: string;
  workspaceName: string;
  slug?: string;
  ownerEmail: string | null;
  /** Violema's own default or demo workspace. */
  internal: boolean;
  planId?: string;
  planName?: string;
  subscriptionStatus?: string;
  creditBalance: number;
  creditsSpent: number;
  taskCount: number;
  runCount: number;
  /** Automations attributed to THIS workspace. */
  automationCount: number;
  automationScope: 'workspace';
  globalAutomationCount: number;
  /** Legacy records with no workspaceId, counted into the default workspace. */
  unattributedAutomationCount: number;
  activeAutomationCount: number;
  rowState: AdminWorkspaceRowState;
  totalRuns: number;
  succeededRuns: number;
  /** Genuine failures: the product did not work. */
  failedRuns: number;
  /** Readiness blocks: the workspace is not connected yet. Not a fault. */
  blockedRuns: number;
  runSuccessRate: number;
  averageRunCredits: number;
  averageActualRunCredits: number;
  estimatedOnlyRuns: number;
  creditsFromRuns: number;
  actualCreditsFromRuns: number;
  lastActivityAt: string | null;
}

export interface AdminWorkspacesResponse {
  items: AdminWorkspaceRow[];
  includeInternal: boolean;
  excludedInternalWorkspaces: number;
}

// ────────────────────────────────────────────────────────────────── overview ──

export interface AdminOverviewMetrics {
  approvedUsers: number;
  pendingUsers: number;
  accountsByStage: Record<AccountStage, number>;
  accountsByParticipantType: Record<string, number>;
  activatedAccounts: number;
  workspaces: number;
  excludedInternalWorkspaces: number;
  activeAutomations: number;
  totalAutomations: number;
  unattributedAutomationCount: number;
  totalRuns: number;
  succeededRuns: number;
  failedRuns: number;
  blockedRuns: number;
  runSuccessRate: number;
  /** Averaged over runs that reported ACTUAL credits, not estimates. */
  averageActualRunCredits: number;
  /** Runs whose only credit figure is an estimate. */
  estimatedOnlyRuns: number;
  creditsSpent: number;
}

export interface AdminOverviewPayload {
  generatedAt: string;
  windowHours: number;
  scope: {
    includeInternal: boolean;
    excludedInternalWorkspaces: number;
  };
  catalog: AdminCatalog;
  metrics: AdminOverviewMetrics;
  /** Sorted by a real recency signal. Replaces the alphabetical `recentUsers`. */
  recentlyUpdatedUsers: AdminUserRow[];
  workspacesNeedingAttention: AdminWorkspaceRow[];
  /** Inside `windowHours`, not all time. */
  recentFailedRuns: AdminFailedRunSummary[];
}

// ───────────────────────────────────────────────────────────────────── audit ──

export interface AdminAuditEvent {
  id: string;
  actorEmail?: string;
  action: string;
  targetEmail?: string;
  workspaceId?: string;
  metadata?: Record<string, unknown>;
  createdAt?: string;
}

// ──────────────────────────────────────────────────────────────── operations ──

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

export interface AdminAutomationHealth {
  automationId: string;
  workspaceId: string;
  workspaceName: string;
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

export interface AdminTermsStaleness {
  currentVersion: string;
  currentCount: number;
  staleCount: number;
  neverAcceptedCount: number;
  totalAccounts: number;
}

export interface AdminWorkspaceIntegrations {
  workspaceId: string;
  workspaceName: string;
  connectedToolkits: string[];
  workspaceConfiguredIntegrations: string[];
  /** The partner lookup could not answer — NOT "nothing connected". */
  degraded: boolean;
}

// ───────────────────────────────────────────────────────────────── telemetry ──

export interface TelemetryActivationFunnel {
  signedUp: number;
  connectedAtLeastOneSource: number;
  reachedFirstRun: number;
  reachedFirstDelivery: number;
  connectRatePct: number;
  firstRunRatePct: number;
  firstDeliveryRatePct: number;
  medianHoursToFirstDelivery: number | null;
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

export interface TelemetryBlockerCount {
  key: string;
  count: number;
  workspaces: number;
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

export interface TelemetryReviewOutcomes {
  approved: number;
  changesRequested: number;
  rejected: number;
  blockedFabricated: number;
  awaitingReview: number;
  correctionRatePct: number;
}

export interface TelemetryCreditBurn {
  chargedRuns: number;
  p50CreditsPerRun: number | null;
  p90CreditsPerRun: number | null;
  totalSpentCredits: number;
  byWorkflowId: Array<{
    workflowId: string;
    runs: number;
    p50Credits: number | null;
    p90Credits: number | null;
  }>;
}

export interface TelemetryStageFunnel {
  totalAccounts: number;
  byStage: Array<{
    stage: string;
    accounts: number;
    activated: number;
    activationRatePct: number;
  }>;
  byParticipantType: Array<{ participantType: string; accounts: number }>;
  trialGranted: number;
  trialConvertedToPaying: number;
  trialToPayingConversionPct: number;
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
  window: {
    trailingDays: number;
    from: string;
    to: string;
    priorFrom: string;
    priorTo: string;
  };
  workspaces: {
    total: number;
    createdInWindow: number;
    activeInWindow: number;
    activeCumulative: number;
    deliveredInWindow: number;
    deliveredCumulative: number;
  };
  activation: TelemetryActivationFunnel;
  stageFunnel: TelemetryStageFunnel;
  reliability: {
    byWorkflowId: TelemetryWorkflowReliability[];
    bySource: TelemetrySourceReliability[];
    byStepKind: Array<{
      kind: string;
      executions: number;
      succeeded: number;
      failed: number;
      skipped: number;
      liveDataSteps: number;
      simulatedDataSteps: number;
    }>;
    topBlockers: TelemetryBlockerCount[];
  };
  review: TelemetryReviewOutcomes;
  creditBurn: TelemetryCreditBurn;
  deltasVsPriorWeek: TelemetryDelta[];
  /** The snapshot's own caveats. Render them — they qualify every number above. */
  notes: string[];
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
  telemetry: PlatformTelemetrySnapshot;
}
