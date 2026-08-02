/**
 * Presentation helpers shared by the admin surfaces.
 *
 * Everything here is pure so the contract suite can assert on it directly. The
 * rule the module exists to enforce: a number or a badge never appears without
 * the qualifier that makes it honest — a window, a "these are actuals" note, or
 * the reason a derived stage says what it says.
 */

import type {
  AccountStage,
  AdminFailureKind,
  AdminUserFilterState,
  AdminUserRow,
  AdminWorkspaceRowState,
} from './adminTypes';

// ─────────────────────────────────────────────────────────────── formatting ──

export function formatNumber(value: number | undefined) {
  return new Intl.NumberFormat('en-US').format(value || 0);
}

export function formatCredits(value: number | undefined) {
  return formatNumber(Math.round(value || 0));
}

/** Percentages arrive 0-100 from the backend; a 0-1 ratio is scaled up. */
export function formatRate(value: number | undefined) {
  if (!value || !Number.isFinite(value)) return '0%';
  const normalized = value <= 1 ? value * 100 : value;
  return `${Math.round(normalized)}%`;
}

export function formatDate(value?: string | null) {
  if (!value) return 'No activity';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

/** "3d 4h" / "6h" / "40m" — how long something has been sitting. */
export function formatWaitingFor(hours: number) {
  if (!Number.isFinite(hours) || hours <= 0) return 'just now';
  if (hours < 1) return `${Math.max(1, Math.round(hours * 60))}m`;
  if (hours < 24) return `${Math.round(hours)}h`;
  const days = Math.floor(hours / 24);
  const remainder = Math.round(hours - days * 24);
  return remainder > 0 ? `${days}d ${remainder}h` : `${days}d`;
}

/** "last 24h" / "last 7d" — the window a panel is actually showing. */
export function formatWindowLabel(windowHours: number | undefined) {
  const hours = Number.isFinite(windowHours) && (windowHours as number) > 0
    ? Math.round(windowHours as number)
    : 24;
  if (hours % 24 === 0 && hours >= 48) return `last ${hours / 24}d`;
  return `last ${hours}h`;
}

// ──────────────────────────────────────────────────────────────────── tones ──

export function statusClasses(status?: string) {
  if (status === 'approved' || status === 'active' || status === 'ok' || status === 'healthy') {
    return 'border-emerald-500/25 bg-emerald-500/10 text-emerald-200';
  }
  if (status === 'requested' || status === 'pending' || status === 'trialing') {
    return 'border-amber-500/25 bg-amber-500/10 text-amber-200';
  }
  if (status === 'revoked' || status === 'failed' || status === 'blocked' || status === 'past_due') {
    return 'border-red-500/25 bg-red-500/10 text-red-200';
  }
  return 'border-slate-600/50 bg-slate-800/50 text-slate-300';
}

/**
 * Stage tones, mapped onto the existing status palette.
 *
 * `paying` reads as the healthy tone, `trial` as trialing, `lapsed` as the
 * blocked tone, `applicant` as pending, and `internal` stays its own violet —
 * an internal account is neither pipeline nor a problem.
 */
export function accountStageClasses(stage: AccountStage | string) {
  switch (stage) {
    case 'paying':
      return statusClasses('active');
    case 'trial':
      return statusClasses('trialing');
    case 'lapsed':
      return statusClasses('blocked');
    case 'applicant':
      return statusClasses('pending');
    case 'internal':
      return 'border-violet-500/25 bg-violet-500/10 text-violet-200';
    default:
      return statusClasses(undefined);
  }
}

export const ACCOUNT_STAGE_LABELS: Record<AccountStage, string> = {
  internal: 'Internal',
  applicant: 'Applicant',
  trial: 'Trial',
  paying: 'Paying',
  lapsed: 'Lapsed',
};

export function accountStageLabel(stage: AccountStage | string) {
  return ACCOUNT_STAGE_LABELS[stage as AccountStage] || stage;
}

export const FAILURE_KIND_LABELS: Record<AdminFailureKind, string> = {
  fabricated_evidence: 'Simulated evidence',
  readiness_blocked: 'Not connected',
  connector: 'Connector',
  other: 'Unclassified',
};

export function failureKindLabel(kind: AdminFailureKind | string) {
  return FAILURE_KIND_LABELS[kind as AdminFailureKind] || String(kind);
}

/**
 * `readiness_blocked` is deliberately amber, not red: the workspace is not
 * connected yet, which is a setup task rather than a product fault.
 */
export function failureKindClasses(kind: AdminFailureKind | string) {
  switch (kind) {
    case 'fabricated_evidence':
      return 'border-violet-500/30 bg-violet-500/10 text-violet-200';
    case 'readiness_blocked':
      return 'border-amber-500/25 bg-amber-500/10 text-amber-200';
    case 'connector':
      return 'border-red-500/25 bg-red-500/10 text-red-200';
    default:
      return 'border-slate-600/50 bg-slate-800/50 text-slate-300';
  }
}

export const WORKSPACE_ROW_STATE_LABELS: Record<AdminWorkspaceRowState, string> = {
  billing_issue: 'Billing issue',
  low_credits: 'Low credits',
  failed_runs: 'Failed runs',
  readiness_blocked: 'Not connected',
  no_activity: 'No activity',
  healthy: 'Healthy',
};

export function workspaceRowStateLabel(state: AdminWorkspaceRowState | string) {
  return WORKSPACE_ROW_STATE_LABELS[state as AdminWorkspaceRowState] || String(state);
}

export function workspaceRowStateClasses(state: AdminWorkspaceRowState | string) {
  switch (state) {
    case 'billing_issue':
    case 'failed_runs':
      return statusClasses('failed');
    case 'low_credits':
    case 'readiness_blocked':
      return statusClasses('pending');
    case 'healthy':
      return statusClasses('healthy');
    default:
      return statusClasses(undefined);
  }
}

/** `gmail` → `Gmail`, `slack_target` → `Slack Target`. Keys are allowlisted upstream. */
export function blockerKeyLabel(key: string) {
  return key.replace(/[_-]+/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

// ──────────────────────────────────────────────────────── applicant clarity ──

export type ApprovalReadinessTone = 'ready' | 'waiting' | 'done' | 'none';

export interface ApprovalReadiness {
  tone: ApprovalReadinessTone;
  message: string;
}

/**
 * Why the Approve button looks the way it does, in words.
 *
 * Found in the founder's own onboarding test: a row whose evidence was complete
 * showed an enabled button and a row missing evidence showed a disabled one, and
 * nothing on either said which piece was outstanding. A disabled control that
 * does not explain itself is a support ticket.
 */
export function describeApprovalReadiness(user: Pick<
  AdminUserRow,
  'approvalReady' | 'identityVerified' | 'termsCurrent' | 'accessStatus' | 'approvedAccess' | 'hasAccessRecord'
>): ApprovalReadiness {
  if (user.approvedAccess || user.accessStatus === 'approved') {
    return { tone: 'done', message: 'Access approved.' };
  }
  if (user.accessStatus === 'revoked') {
    return { tone: 'none', message: 'Access revoked — re-approve to restore.' };
  }
  if (user.hasAccessRecord === false) {
    return { tone: 'waiting', message: 'Waiting on applicant sign-in — no access record yet.' };
  }
  if (user.approvalReady) {
    return { tone: 'ready', message: 'Ready to approve — identity and terms verified.' };
  }
  if (!user.identityVerified && !user.termsCurrent) {
    return { tone: 'waiting', message: 'Waiting on applicant sign-in and beta terms acceptance.' };
  }
  if (!user.identityVerified) {
    return { tone: 'waiting', message: 'Waiting on applicant sign-in — identity not verified yet.' };
  }
  return { tone: 'waiting', message: 'Waiting on current beta terms acceptance.' };
}

export function approvalReadinessClasses(tone: ApprovalReadinessTone) {
  switch (tone) {
    case 'ready':
      return 'text-emerald-200';
    case 'done':
      return 'text-slate-500';
    case 'none':
      return 'text-red-200';
    default:
      return 'text-amber-200';
  }
}

// ───────────────────────────────────────────────────────────────── querying ──

/**
 * Server-side user filters. An empty facet is omitted entirely rather than sent
 * as an empty value — the backend 400s on an unrecognized enum, and "no
 * constraint" must not be spelled as one.
 */
export function buildAdminUsersQuery(filters: AdminUserFilterState): string {
  const params = new URLSearchParams();
  if (filters.stage.length > 0) params.set('stage', filters.stage.join(','));
  if (filters.participantType.length > 0) {
    params.set('participantType', filters.participantType.join(','));
  }
  if (filters.activated !== null) params.set('activated', String(filters.activated));
  const query = params.toString();
  return query ? `?${query}` : '';
}

export function toggleFilterValue<T extends string>(values: T[], value: T): T[] {
  return values.includes(value) ? values.filter((item) => item !== value) : [...values, value];
}

export const EMPTY_USER_FILTERS: AdminUserFilterState = {
  stage: [],
  participantType: [],
  activated: null,
};

export function hasActiveUserFilters(filters: AdminUserFilterState): boolean {
  return filters.stage.length > 0 || filters.participantType.length > 0 || filters.activated !== null;
}
