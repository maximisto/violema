import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Activity,
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  Clock3,
  Database,
  FileClock,
  Gauge,
  LayoutDashboard,
  Plug,
  RefreshCcw,
  Shield,
  ShieldOff,
  SlidersHorizontal,
  Users,
  WalletCards,
  XCircle,
} from 'lucide-react';
import ViolemaLogo from '../components/ViolemaLogo';
import {
  fetchBackendAuthSession,
  isAdminSession,
  participantTypeLabel,
  PARTICIPANT_TYPES,
  type ParticipantType,
} from '../lib/auth';
import AdminOperationsPanel from '../features/admin/AdminOperationsPanel';
import {
  accountStageClasses,
  accountStageLabel,
  approvalReadinessClasses,
  blockerKeyLabel,
  buildAdminUsersQuery,
  describeApprovalReadiness,
  EMPTY_USER_FILTERS,
  failureKindClasses,
  failureKindLabel,
  formatCredits,
  formatDate,
  formatNumber,
  formatRate,
  formatWindowLabel,
  hasActiveUserFilters,
  statusClasses,
  toggleFilterValue,
  workspaceRowStateClasses,
  workspaceRowStateLabel,
} from '../features/admin/adminFormat';
import type {
  AccessStatus,
  AccountStageResolution,
  AdminAuditEvent,
  AdminCatalog,
  AdminFailedRunSummary,
  AdminOperationsSnapshot,
  AdminOverviewPayload,
  AdminRole,
  AdminUserFacetCounts,
  AdminUserFilterState,
  AdminUserRow,
  AdminUsersResponse,
  AdminWorkspaceRow,
  AdminWorkspacesResponse,
} from '../features/admin/adminTypes';

type AdminTab = 'overview' | 'operations' | 'users' | 'clients' | 'audit';
type NoticeTone = 'success' | 'error';

/** Destructive actions that require a second, deliberate click. */
type ConfirmableAction = 'revoke' | 'promote' | 'demote';

interface PendingConfirm {
  email: string;
  action: ConfirmableAction;
}

interface AdminListResponse<T> {
  items: T[];
}

interface AdminAccessMutationResponse {
  users: AdminUserRow[];
}

interface Notice {
  tone: NoticeTone;
  message: string;
}

const TABS: Array<{ id: AdminTab; label: string; icon: typeof LayoutDashboard }> = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'operations', label: 'Operations', icon: Gauge },
  { id: 'users', label: 'Users', icon: Users },
  { id: 'clients', label: 'Clients', icon: Database },
  { id: 'audit', label: 'Audit', icon: FileClock },
];

/** What each confirmation must state before the operator commits to it. */
const CONFIRM_COPY: Record<ConfirmableAction, { title: string; consequence: string; verb: string }> = {
  revoke: {
    title: 'Revoke access?',
    consequence: 'Signs them out everywhere — every active session is cleared immediately.',
    verb: 'Revoke',
  },
  promote: {
    title: 'Promote to admin?',
    consequence: "Grants cross-workspace access to every tenant's operational metadata.",
    verb: 'Promote',
  },
  demote: {
    title: 'Demote to user?',
    consequence: 'Removes admin access to this dashboard and every workspace it spans.',
    verb: 'Demote',
  },
};

const CATALOG_FALLBACK: AdminCatalog = {
  participantTypes: PARTICIPANT_TYPES,
  accountStages: ['internal', 'applicant', 'trial', 'paying', 'lapsed'],
};

function getErrorMessage(payload: unknown, fallback: string) {
  if (payload && typeof payload === 'object') {
    const value = payload as { error?: unknown; message?: unknown };
    if (typeof value.error === 'string') return value.error;
    if (typeof value.message === 'string') return value.message;
  }
  return fallback;
}

async function fetchAdminJson<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(path, {
    ...init,
    credentials: 'same-origin',
    headers: {
      Accept: 'application/json',
      ...(init.headers || {}),
    },
  });
  const payload = await response.json().catch(() => null) as unknown;
  if (!response.ok) {
    throw new Error(getErrorMessage(payload, `Request failed: ${response.status}`));
  }
  return payload as T;
}

function patchAdminJson<T>(path: string, body: Record<string, unknown>): Promise<T> {
  return fetchAdminJson<T>(path, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
}

export function buildParticipantAccessPatch(participantType: ParticipantType) {
  return { participantType };
}

export function isAdminApprovalDisabled(input: {
  busy: boolean;
  isApproved: boolean;
  approvalReady: boolean;
  participantDirty: boolean;
}) {
  return input.busy || input.isApproved || !input.approvalReady || input.participantDirty;
}

export function formatTrialCreditUsage(spentCredits: number, remainingCredits: number) {
  return `Trial-first · Spent ${formatCredits(spentCredits)} · ${formatCredits(remainingCredits)} remaining`;
}

function Badge({ value }: { value?: string }) {
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-1 text-[11px] font-medium capitalize ${statusClasses(value)}`}>
      {value || 'unknown'}
    </span>
  );
}

/**
 * A derived account stage, never without the reason it was derived.
 *
 * `lapsed` legitimately means EITHER "subscription canceled" OR "beta access
 * revoked". A bare badge would let the operator guess wrong, so `reason` is a
 * required prop and is always reachable — as a tooltip at minimum, and inline
 * wherever the surface has vertical room.
 */
function StageBadge({ stage }: { stage: AccountStageResolution }) {
  const label = accountStageLabel(stage.stage);
  return (
    <span
      title={stage.reason}
      aria-label={`Account stage ${label}. ${stage.reason}`}
      className={`inline-flex items-center rounded-full border px-2 py-1 text-[11px] font-medium ${accountStageClasses(stage.stage)}`}
    >
      {label}
    </span>
  );
}

/** The badge plus its reason spelled out, for surfaces with vertical room. */
function StageCell({ stage, activated }: { stage: AccountStageResolution; activated: boolean }) {
  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap items-center gap-1.5">
        <StageBadge stage={stage} />
        <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium ${
          activated
            ? 'border-emerald-500/20 bg-emerald-500/[0.08] text-emerald-200'
            : 'border-slate-600/40 bg-slate-800/40 text-slate-400'
        }`}>
          {activated ? 'Activated' : 'Not activated'}
        </span>
      </div>
      <p className="max-w-[260px] text-[11px] leading-4 text-slate-500">{stage.reason}</p>
    </div>
  );
}

function effectiveAccessStatus(user: AdminUserRow): AccessStatus {
  return user.approvedAccess ? 'approved' : user.accessStatus;
}

function EmptyState({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-navy-700/80 bg-navy-950/40 px-5 py-10 text-center">
      <p className="text-sm font-semibold text-slate-200">{title}</p>
      <p className="mt-2 text-sm text-slate-500">{detail}</p>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="grid gap-4 lg:grid-cols-4">
      {Array.from({ length: 8 }).map((_, index) => (
        <div key={index} className="h-28 animate-pulse rounded-2xl border border-navy-800 bg-navy-900/60" />
      ))}
    </div>
  );
}

function SectionHeader({ title, detail }: { title: string; detail?: string }) {
  return (
    <div>
      <h2 className="text-base font-semibold text-white">{title}</h2>
      {detail ? <p className="mt-1 text-sm text-slate-500">{detail}</p> : null}
    </div>
  );
}

function MetricCard({
  label,
  value,
  detail,
  icon: Icon,
  tone = 'neutral',
}: {
  label: string;
  value: string;
  detail?: string;
  icon: typeof Activity;
  tone?: 'neutral' | 'good' | 'warn' | 'bad';
}) {
  const toneClass = {
    neutral: 'border-cyan-500/15 bg-cyan-500/10 text-cyan-200',
    good: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-200',
    warn: 'border-amber-500/20 bg-amber-500/10 text-amber-200',
    bad: 'border-red-500/20 bg-red-500/10 text-red-200',
  }[tone];

  return (
    <div className="rounded-2xl border border-navy-800 bg-navy-900/72 p-4 shadow-[0_14px_34px_rgba(2,6,23,0.18)]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-slate-500">{label}</p>
          <p className="mt-3 text-2xl font-semibold tracking-tight text-white">{value}</p>
        </div>
        <div className={`rounded-xl border p-2 ${toneClass}`}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
      {detail ? <p className="mt-3 text-xs text-slate-500">{detail}</p> : null}
    </div>
  );
}

/**
 * A failure the operator can act on, carrying no tenant content.
 *
 * `failureSummary` is a constant the backend chose from a closed set. The raw
 * `error` text it replaced embedded artifact titles and provider responses and
 * is deliberately no longer served — do not reintroduce a read of it.
 */
function FailedRunRow({ run }: { run: AdminFailedRunSummary }) {
  return (
    <div className="rounded-xl border border-navy-800 bg-navy-950/45 p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-white">
            {run.automationName || 'Untitled mission'}
          </p>
          <p className="truncate text-xs text-slate-500">{run.workspaceName || run.workspaceId}</p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1.5">
          <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${failureKindClasses(run.failureKind)}`}>
            {failureKindLabel(run.failureKind)}
          </span>
          <span className="text-[11px] text-slate-600">{formatDate(run.finishedAt || run.startedAt)}</span>
        </div>
      </div>
      <p className="mt-2 text-xs leading-5 text-slate-400">{run.failureSummary}</p>
      {run.blockerKeys.length > 0 ? (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {run.blockerKeys.map((key) => (
            <span
              key={key}
              className="inline-flex items-center rounded-full border border-amber-500/20 bg-amber-500/[0.08] px-2 py-0.5 text-[10px] font-medium text-amber-100"
            >
              {blockerKeyLabel(key)}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function OverviewPanel({ overview }: { overview: AdminOverviewPayload | null }) {
  const metrics = overview?.metrics;
  const windowLabel = formatWindowLabel(overview?.windowHours);
  const excludedInternal = overview?.scope?.excludedInternalWorkspaces || 0;
  const estimatedOnlyRuns = metrics?.estimatedOnlyRuns || 0;
  const unattributedAutomations = metrics?.unattributedAutomationCount || 0;

  const metricCards = [
    {
      label: 'Approved users',
      value: formatNumber(metrics?.approvedUsers),
      detail: `${formatNumber(metrics?.activatedAccounts)} have completed a successful run`,
      icon: CheckCircle2,
      tone: 'good' as const,
    },
    {
      label: 'Pending users',
      value: formatNumber(metrics?.pendingUsers),
      detail: 'Requests waiting for a decision',
      icon: Clock3,
      tone: 'warn' as const,
    },
    {
      label: 'Workspaces',
      value: formatNumber(metrics?.workspaces),
      detail: excludedInternal > 0
        ? `${formatNumber(excludedInternal)} internal Violema workspace(s) excluded`
        : 'All workspaces in scope',
      icon: Database,
    },
    {
      label: 'Active automations',
      value: formatNumber(metrics?.activeAutomations),
      detail: unattributedAutomations > 0
        ? `${formatNumber(metrics?.totalAutomations)} total · ${formatNumber(unattributedAutomations)} unattributed`
        : `${formatNumber(metrics?.totalAutomations)} configured in total`,
      icon: SlidersHorizontal,
    },
    {
      label: 'Runs',
      value: formatNumber(metrics?.totalRuns),
      detail: `${formatNumber(metrics?.succeededRuns)} succeeded`,
      icon: Activity,
    },
    {
      label: 'Success rate',
      value: formatRate(metrics?.runSuccessRate),
      detail: 'Succeeded / (succeeded + failed). Blocked runs are excluded from both.',
      icon: CheckCircle2,
      tone: 'good' as const,
    },
    {
      label: 'Failed runs',
      value: formatNumber(metrics?.failedRuns),
      detail: 'Genuine failures — the product did not work',
      icon: AlertTriangle,
      tone: 'bad' as const,
    },
    {
      label: 'Blocked runs',
      value: formatNumber(metrics?.blockedRuns),
      detail: 'Not connected yet — a setup gap, not a breakage',
      icon: Plug,
      tone: 'warn' as const,
    },
    {
      label: 'Avg credits / run',
      value: formatCredits(metrics?.averageActualRunCredits),
      detail: estimatedOnlyRuns > 0
        ? `Actuals only · ${formatNumber(estimatedOnlyRuns)} run(s) have an estimate but no actual`
        : 'Actuals only — estimates are never blended in',
      icon: WalletCards,
    },
    {
      label: 'Credits spent',
      value: formatCredits(metrics?.creditsSpent),
      detail: 'Aggregate platform consumption',
      icon: WalletCards,
    },
  ];

  return (
    <div className="space-y-5">
      {/* How fresh these numbers are, and what they do and do not count. */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-navy-800 bg-navy-900/55 px-4 py-3">
        <p className="text-xs text-slate-400">
          {overview?.scope?.includeInternal
            ? "Including Violema's own default and demo workspaces."
            : `Excluding ${formatNumber(excludedInternal)} internal Violema workspace(s).`}
        </p>
        <p className="text-xs text-slate-500">
          Snapshot taken {formatDate(overview?.generatedAt)}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {metricCards.map((item) => (
          <MetricCard key={item.label} {...item} />
        ))}
      </div>

      <div className="grid gap-5 xl:grid-cols-3">
        <div className="rounded-2xl border border-navy-800 bg-navy-900/70 p-4 xl:col-span-1">
          <SectionHeader
            title="Recently updated accounts"
            detail="Sorted by when the account record last changed — not by sign-up order."
          />
          <div className="mt-4 space-y-3">
            {overview?.recentlyUpdatedUsers?.length ? overview.recentlyUpdatedUsers.slice(0, 6).map((user) => (
              <div key={user.email} className="rounded-xl border border-navy-800 bg-navy-950/45 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-white">{user.name || user.email}</p>
                    <p className="truncate text-xs text-slate-500">{user.email}</p>
                  </div>
                  <StageBadge stage={user.accountStage} />
                </div>
                <p className="mt-2 text-[11px] leading-4 text-slate-500">{user.accountStage.reason}</p>
                <p className="mt-1.5 text-[11px] text-slate-600">
                  Updated {formatDate(user.updatedAt || user.createdAt)}
                </p>
              </div>
            )) : (
              <EmptyState title="No account activity" detail="Account changes will appear here." />
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-navy-800 bg-navy-900/70 p-4 xl:col-span-1">
          <SectionHeader title="Workspace attention" detail="Accounts in a state other than healthy." />
          <div className="mt-4 space-y-3">
            {overview?.workspacesNeedingAttention?.length ? overview.workspacesNeedingAttention.slice(0, 6).map((workspace) => (
              <div key={workspace.workspaceId} className="rounded-xl border border-navy-800 bg-navy-950/45 p-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="truncate text-sm font-medium text-white">{workspace.workspaceName || workspace.workspaceId}</p>
                  <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${workspaceRowStateClasses(workspace.rowState)}`}>
                    {workspaceRowStateLabel(workspace.rowState)}
                  </span>
                </div>
                <p className="mt-2 truncate text-xs text-slate-500">
                  {workspace.ownerEmail || 'No owner'} · {formatRate(workspace.runSuccessRate)} success
                </p>
                <p className="mt-1 text-[11px] text-slate-600">
                  {formatNumber(workspace.failedRuns)} failed · {formatNumber(workspace.blockedRuns)} blocked
                </p>
              </div>
            )) : (
              <EmptyState title="Nothing urgent" detail="No workspace currently needs attention." />
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-navy-800 bg-navy-900/70 p-4 xl:col-span-1">
          <SectionHeader
            title="Recent failures"
            detail={`Failed runs in the ${windowLabel}, classified by kind.`}
          />
          <div className="mt-4 space-y-3">
            {overview?.recentFailedRuns?.length ? overview.recentFailedRuns.slice(0, 6).map((run) => (
              <FailedRunRow key={run.runId} run={run} />
            )) : (
              <EmptyState title="No recent failures" detail={`No run failed in the ${windowLabel}.`} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Inline two-step confirmation for a destructive action.
 *
 * Deliberately not `window.confirm`: a native modal blocks automation, cannot
 * state a consequence in the product's own voice, and reads as cheap. Matches
 * the disconnect pattern in `IntegrationsPage.tsx`.
 */
function ConfirmStrip({
  action,
  busy,
  onConfirm,
  onCancel,
}: {
  action: ConfirmableAction;
  busy: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const copy = CONFIRM_COPY[action];
  return (
    <div className="w-full rounded-lg border border-amber-500/25 bg-amber-500/[0.08] px-3 py-2">
      <p className="text-[11px] font-semibold text-amber-100">{copy.title}</p>
      <p className="mt-1 text-[11px] leading-4 text-amber-200/80">{copy.consequence}</p>
      <div className="mt-2 flex items-center gap-3">
        <button
          type="button"
          disabled={busy}
          onClick={onConfirm}
          className="text-[11px] font-semibold uppercase tracking-[0.14em] text-red-300 transition-colors hover:text-red-200 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? 'Working...' : copy.verb}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500 transition-colors hover:text-slate-300"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

function UserActions({
  user,
  busy,
  participantDirty,
  pendingConfirm,
  onRequestConfirm,
  onCancelConfirm,
  onAccessChange,
  onRoleChange,
}: {
  user: AdminUserRow;
  busy: boolean;
  participantDirty: boolean;
  pendingConfirm: PendingConfirm | null;
  onRequestConfirm: (email: string, action: ConfirmableAction) => void;
  onCancelConfirm: () => void;
  onAccessChange: (user: AdminUserRow, status: Extract<AccessStatus, 'approved' | 'revoked'>) => void;
  onRoleChange: (user: AdminUserRow, role: AdminRole) => void;
}) {
  const isApproved = effectiveAccessStatus(user) === 'approved';
  const isAdmin = user.role === 'admin';
  const roleAction: ConfirmableAction = isAdmin ? 'demote' : 'promote';
  const roleActionDisabled = busy || user.hasAccessRecord === false;
  const roleActionTitle = user.hasAccessRecord === false
    ? 'Role changes require a persistent access record. Approve or record access first.'
    : isAdmin ? 'Demote to user' : 'Promote to admin';
  const approvalActionTitle = !user.approvalReady
    ? 'Verified OAuth identity and current beta confidentiality acceptance are required before approval.'
    : participantDirty ? 'Save participant type before approval.'
    : isApproved ? 'Access is already approved.' : 'Approve beta access';
  const approvalDisabled = isAdminApprovalDisabled({
    busy,
    isApproved,
    approvalReady: user.approvalReady,
    participantDirty,
  });

  const confirming = pendingConfirm && pendingConfirm.email === user.email ? pendingConfirm.action : null;

  // Every destructive path routes through here first. There is no branch that
  // calls the mutation straight from the first click.
  if (confirming) {
    return (
      <ConfirmStrip
        action={confirming}
        busy={busy}
        onCancel={onCancelConfirm}
        onConfirm={() => {
          if (confirming === 'revoke') onAccessChange(user, 'revoked');
          else onRoleChange(user, confirming === 'promote' ? 'admin' : 'user');
        }}
      />
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        disabled={approvalDisabled}
        title={approvalActionTitle}
        onClick={() => onAccessChange(user, 'approved')}
        className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1.5 text-xs font-medium text-emerald-100 transition-colors hover:bg-emerald-500/16 disabled:cursor-not-allowed disabled:opacity-40"
      >
        <CheckCircle2 className="h-3.5 w-3.5" />
        Approve
      </button>
      <button
        type="button"
        disabled={busy || user.accessStatus === 'revoked'}
        title="Revoke beta access and clear every active session."
        onClick={() => onRequestConfirm(user.email, 'revoke')}
        className="inline-flex items-center gap-1.5 rounded-lg border border-red-500/20 bg-red-500/10 px-2.5 py-1.5 text-xs font-medium text-red-100 transition-colors hover:bg-red-500/16 disabled:cursor-not-allowed disabled:opacity-40"
      >
        <XCircle className="h-3.5 w-3.5" />
        Revoke
      </button>
      <button
        type="button"
        disabled={roleActionDisabled}
        title={roleActionTitle}
        onClick={() => {
          if (user.hasAccessRecord === false) return;
          onRequestConfirm(user.email, roleAction);
        }}
        className="inline-flex items-center gap-1.5 rounded-lg border border-violet-500/20 bg-violet-500/10 px-2.5 py-1.5 text-xs font-medium text-violet-100 transition-colors hover:bg-violet-500/16 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {isAdmin ? <ArrowDown className="h-3.5 w-3.5" /> : <ArrowUp className="h-3.5 w-3.5" />}
        {isAdmin ? 'Demote' : 'Promote'}
      </button>
    </div>
  );
}

function ParticipantControl({
  user,
  participantTypes,
  draftParticipantType,
  disabled,
  onChange,
  onSave,
}: {
  user: AdminUserRow;
  /** The backend's catalog. Never a hardcoded list — it grows without a release. */
  participantTypes: ParticipantType[];
  draftParticipantType: ParticipantType;
  disabled: boolean;
  onChange: (participantType: ParticipantType) => void;
  onSave: () => void;
}) {
  const dirty = draftParticipantType !== user.participantType;
  const persistenceDisabled = disabled || user.hasAccessRecord === false;
  const persistenceTitle = user.hasAccessRecord === false
    ? 'Participant changes require a persistent access record.'
    : dirty ? 'Save participant type independently from access approval.' : 'Participant type is saved.';
  // A stored value this build does not recognize must stay selectable, or merely
  // opening the row would silently rewrite it to the first catalog entry.
  const options = participantTypes.includes(user.participantType)
    ? participantTypes
    : [...participantTypes, user.participantType];

  return (
    <div>
      <select
        aria-label={`Participant type for ${user.email}`}
        value={draftParticipantType}
        disabled={persistenceDisabled}
        onChange={(event) => onChange(event.target.value as ParticipantType)}
        className="w-full rounded-lg border border-navy-700 bg-navy-950 px-2 py-1.5 text-xs text-slate-200 outline-none transition-colors focus:border-violet-500 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {options.map((participantType) => (
          <option key={participantType} value={participantType}>
            {participantTypeLabel(participantType)}
          </option>
        ))}
      </select>
      <button
        type="button"
        disabled={persistenceDisabled || !dirty}
        title={persistenceTitle}
        onClick={onSave}
        className="mt-1.5 rounded-md border border-violet-500/20 bg-violet-500/10 px-2 py-1 text-[11px] font-medium text-violet-100 transition-colors hover:bg-violet-500/16 disabled:cursor-not-allowed disabled:opacity-40"
      >
        Save participant
      </button>
    </div>
  );
}

function TermsEvidence({ user }: { user: AdminUserRow }) {
  const readiness = describeApprovalReadiness(user);
  return (
    <div className="space-y-1 text-xs">
      <p className={user.identityVerified ? 'text-emerald-200' : 'text-amber-200'}>
        {user.identityVerified ? 'Identity verified' : 'Identity unverified'}
      </p>
      <p className={user.termsCurrent ? 'text-emerald-200' : 'text-amber-200'}>
        {user.termsCurrent ? 'Terms current' : 'Terms required'}
      </p>
      {user.termsVersion ? <p className="max-w-[160px] truncate text-slate-600">{user.termsVersion}</p> : null}
      <p className={`max-w-[210px] leading-4 ${approvalReadinessClasses(readiness.tone)}`}>
        {readiness.message}
      </p>
    </div>
  );
}

function TrialEvidence({ user }: { user: AdminUserRow }) {
  if (user.trialStatus === 'granted') {
    return (
      <div className="text-xs">
        <p className="font-medium text-emerald-200">Granted · {formatCredits(user.trialCredits)} credits</p>
        <p className="mt-1 text-slate-400">
          {formatTrialCreditUsage(user.trialSpentCredits, user.trialRemainingCredits)}
        </p>
        <p className="mt-1 max-w-[220px] text-slate-600">
          Post-grant debits are attributed to trial credits before later paid or manual grants.
        </p>
        <p className="mt-1 text-slate-500">{formatDate(user.trialGrantedAt || undefined)}</p>
      </div>
    );
  }
  if (user.trialStatus === 'pending') {
    return <p className="text-xs font-medium text-amber-200">Pending grant</p>;
  }
  return <p className="text-xs text-slate-500">Not applicable</p>;
}

function FilterChip({
  label,
  active,
  detail,
  onClick,
}: {
  label: string;
  active: boolean;
  detail?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors ${
        active
          ? 'border-violet-500/40 bg-violet-500/15 text-violet-100'
          : 'border-navy-700 bg-navy-950/60 text-slate-400 hover:border-navy-600 hover:text-slate-200'
      }`}
    >
      {label}
      {detail ? <span className="text-slate-500">{detail}</span> : null}
    </button>
  );
}

/**
 * Server-side facets, with the unfiltered counts always visible.
 *
 * Narrowing to one stage must never hide where the rest of the base sits, so
 * every chip carries its count from the UNFILTERED set — that is what the
 * backend's `counts` facet exists for.
 */
function UserFilterBar({
  catalog,
  filters,
  counts,
  matched,
  onChange,
  onReset,
}: {
  catalog: AdminCatalog;
  filters: AdminUserFilterState;
  counts: AdminUserFacetCounts | null;
  matched: number | null;
  onChange: (next: AdminUserFilterState) => void;
  onReset: () => void;
}) {
  const filtered = hasActiveUserFilters(filters);

  return (
    <div className="rounded-2xl border border-navy-800 bg-navy-900/55 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Filter accounts</p>
          <p className="mt-1 text-xs text-slate-500">
            {counts ? (
              <>
                {formatNumber(counts.total)} accounts total · {formatNumber(counts.activated)} activated ·{' '}
                {formatNumber(counts.notActivated)} not activated
                {filtered && matched !== null ? ` · showing ${formatNumber(matched)}` : ''}
              </>
            ) : 'Counts are computed over every account, not just the filtered view.'}
          </p>
        </div>
        {filtered ? (
          <button
            type="button"
            onClick={onReset}
            className="rounded-lg border border-navy-700 bg-navy-900/70 px-2.5 py-1.5 text-[11px] font-medium text-slate-300 transition-colors hover:border-violet-500/40 hover:text-white"
          >
            Clear filters
          </button>
        ) : null}
      </div>

      <div className="mt-4 space-y-3">
        <div>
          <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-600">Stage</p>
          <div className="flex flex-wrap gap-1.5">
            {catalog.accountStages.map((stage) => (
              <FilterChip
                key={stage}
                label={accountStageLabel(stage)}
                detail={counts ? formatNumber(counts.byStage?.[stage] || 0) : undefined}
                active={filters.stage.includes(stage)}
                onClick={() => onChange({ ...filters, stage: toggleFilterValue(filters.stage, stage) })}
              />
            ))}
          </div>
        </div>

        <div>
          <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-600">Participant</p>
          <div className="flex flex-wrap gap-1.5">
            {catalog.participantTypes.map((participantType) => (
              <FilterChip
                key={participantType}
                label={participantTypeLabel(participantType)}
                detail={counts ? formatNumber(counts.byParticipantType?.[participantType] || 0) : undefined}
                active={filters.participantType.includes(participantType)}
                onClick={() => onChange({
                  ...filters,
                  participantType: toggleFilterValue(filters.participantType, participantType),
                })}
              />
            ))}
          </div>
        </div>

        <div>
          <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-600">
            Activated (completed a successful run)
          </p>
          <div className="flex flex-wrap gap-1.5">
            <FilterChip
              label="Activated"
              detail={counts ? formatNumber(counts.activated) : undefined}
              active={filters.activated === true}
              onClick={() => onChange({ ...filters, activated: filters.activated === true ? null : true })}
            />
            <FilterChip
              label="Not activated"
              detail={counts ? formatNumber(counts.notActivated) : undefined}
              active={filters.activated === false}
              onClick={() => onChange({ ...filters, activated: filters.activated === false ? null : false })}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function UsersPanel({
  users,
  catalog,
  actionKey,
  pendingConfirm,
  onRequestConfirm,
  onCancelConfirm,
  onAccessChange,
  onRoleChange,
  participantDrafts,
  onParticipantChange,
  onParticipantSave,
}: {
  users: AdminUserRow[];
  catalog: AdminCatalog;
  actionKey: string | null;
  pendingConfirm: PendingConfirm | null;
  onRequestConfirm: (email: string, action: ConfirmableAction) => void;
  onCancelConfirm: () => void;
  onAccessChange: (user: AdminUserRow, status: Extract<AccessStatus, 'approved' | 'revoked'>) => void;
  onRoleChange: (user: AdminUserRow, role: AdminRole) => void;
  participantDrafts: Record<string, ParticipantType>;
  onParticipantChange: (email: string, participantType: ParticipantType) => void;
  onParticipantSave: (user: AdminUserRow, participantType: ParticipantType) => void;
}) {
  if (!users.length) {
    return <EmptyState title="No users found" detail="No account matches the current filters." />;
  }

  return (
    <div className="space-y-4">
      <div className="hidden overflow-x-auto rounded-2xl border border-navy-800 bg-navy-900/70 md:block">
        <table className="min-w-[1420px] w-full text-left text-sm">
          <thead className="border-b border-navy-800 bg-navy-950/60 text-xs uppercase tracking-[0.14em] text-slate-500">
            <tr>
              <th className="px-4 py-3 font-semibold">User</th>
              <th className="px-4 py-3 font-semibold">Access</th>
              <th className="px-4 py-3 font-semibold">Stage</th>
              <th className="px-4 py-3 font-semibold">Participant</th>
              <th className="px-4 py-3 font-semibold">Terms</th>
              <th className="px-4 py-3 font-semibold">Trial</th>
              <th className="px-4 py-3 font-semibold">Role</th>
              <th className="px-4 py-3 font-semibold">Slack</th>
              <th className="px-4 py-3 font-semibold">Sessions</th>
              <th className="px-4 py-3 font-semibold">Updated</th>
              <th className="px-4 py-3 font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-navy-800/80">
            {users.map((user) => {
              const busy = actionKey === user.email;
              const accessStatus = effectiveAccessStatus(user);
              const draftParticipantType = participantDrafts[user.email] || user.participantType;
              const participantDirty = draftParticipantType !== user.participantType;
              return (
                <tr key={user.email} className="align-top">
                  <td className="px-4 py-4">
                    <p className="font-medium text-white">{user.name || user.email}</p>
                    <p className="mt-1 text-xs text-slate-500">{user.email}</p>
                    {user.method ? <p className="mt-1 text-xs text-slate-600">{user.method}</p> : null}
                  </td>
                  <td className="px-4 py-4"><Badge value={accessStatus} /></td>
                  <td className="px-4 py-4">
                    <StageCell stage={user.accountStage} activated={user.activated} />
                    {user.stageOverride ? (
                      <p className="mt-1.5 max-w-[240px] text-[10px] leading-4 text-violet-300/80">
                        Overridden to {accountStageLabel(user.stageOverride)}
                        {user.stageOverrideBy ? ` by ${user.stageOverrideBy}` : ''}
                        {user.stageOverrideAt ? ` on ${formatDate(user.stageOverrideAt)}` : ''}
                      </p>
                    ) : null}
                  </td>
                  <td className="px-4 py-4">
                    <ParticipantControl
                      user={user}
                      participantTypes={catalog.participantTypes}
                      draftParticipantType={draftParticipantType}
                      disabled={busy}
                      onChange={(participantType) => onParticipantChange(user.email, participantType)}
                      onSave={() => onParticipantSave(user, draftParticipantType)}
                    />
                  </td>
                  <td className="px-4 py-4"><TermsEvidence user={user} /></td>
                  <td className="px-4 py-4"><TrialEvidence user={user} /></td>
                  <td className="px-4 py-4"><Badge value={user.role} /></td>
                  <td className="px-4 py-4">
                    <p className={user.slackConnected ? 'text-emerald-200' : 'text-slate-500'}>
                      {user.slackConnected ? 'Connected' : 'Not connected'}
                    </p>
                    {user.slackDisplayTarget ? <p className="mt-1 max-w-[180px] truncate text-xs text-slate-500">{user.slackDisplayTarget}</p> : null}
                  </td>
                  <td className="px-4 py-4 text-slate-300">{formatNumber(user.activeSessionCount)}</td>
                  <td className="px-4 py-4 text-slate-500">{formatDate(user.updatedAt || user.createdAt)}</td>
                  <td className="min-w-[240px] px-4 py-4">
                    <UserActions
                      user={user}
                      busy={busy}
                      participantDirty={participantDirty}
                      pendingConfirm={pendingConfirm}
                      onRequestConfirm={onRequestConfirm}
                      onCancelConfirm={onCancelConfirm}
                      onAccessChange={onAccessChange}
                      onRoleChange={onRoleChange}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="grid gap-3 md:hidden">
        {users.map((user) => {
          const busy = actionKey === user.email;
          const accessStatus = effectiveAccessStatus(user);
          const draftParticipantType = participantDrafts[user.email] || user.participantType;
          const participantDirty = draftParticipantType !== user.participantType;
          return (
            <div key={user.email} className="rounded-2xl border border-navy-800 bg-navy-900/72 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-white">{user.name || user.email}</p>
                  <p className="truncate text-xs text-slate-500">{user.email}</p>
                </div>
                <Badge value={accessStatus} />
              </div>
              <div className="mt-3">
                <StageCell stage={user.accountStage} activated={user.activated} />
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
                <div className="col-span-2">
                  <p className="text-slate-500">Participant</p>
                  <div className="mt-1">
                    <ParticipantControl
                      user={user}
                      participantTypes={catalog.participantTypes}
                      draftParticipantType={draftParticipantType}
                      disabled={busy}
                      onChange={(participantType) => onParticipantChange(user.email, participantType)}
                      onSave={() => onParticipantSave(user, draftParticipantType)}
                    />
                  </div>
                </div>
                <div>
                  <p className="text-slate-500">Terms</p>
                  <div className="mt-1"><TermsEvidence user={user} /></div>
                </div>
                <div>
                  <p className="text-slate-500">Trial</p>
                  <div className="mt-1"><TrialEvidence user={user} /></div>
                </div>
                <div>
                  <p className="text-slate-500">Role</p>
                  <p className="mt-1 text-slate-200">{user.role}</p>
                </div>
                <div>
                  <p className="text-slate-500">Sessions</p>
                  <p className="mt-1 text-slate-200">{formatNumber(user.activeSessionCount)}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-slate-500">Slack</p>
                  <p className="mt-1 truncate text-slate-200">{user.slackConnected ? user.slackDisplayTarget || 'Connected' : 'Not connected'}</p>
                </div>
              </div>
              <div className="mt-4">
                <UserActions
                  user={user}
                  busy={busy}
                  participantDirty={participantDirty}
                  pendingConfirm={pendingConfirm}
                  onRequestConfirm={onRequestConfirm}
                  onCancelConfirm={onCancelConfirm}
                  onAccessChange={onAccessChange}
                  onRoleChange={onRoleChange}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** "12 · +3 unattributed" — legacy records that carry no workspace of their own. */
function AutomationCountCell({ workspace }: { workspace: AdminWorkspaceRow }) {
  return (
    <>
      <p className="text-slate-200">
        {formatNumber(workspace.automationCount)}
        {workspace.unattributedAutomationCount > 0 ? (
          <span
            title="Legacy automations stored with no workspaceId. They run against the default workspace and are reported separately rather than folded into this workspace's count."
            className="ml-1.5 cursor-help rounded-full border border-amber-500/25 bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-medium text-amber-200"
          >
            +{formatNumber(workspace.unattributedAutomationCount)} unattributed
          </span>
        ) : null}
      </p>
      <p className="mt-1 text-xs text-slate-500">
        {formatNumber(workspace.activeAutomationCount)} active · this workspace only
      </p>
    </>
  );
}

function ClientsPanel({
  workspaces,
  includeInternal,
  excludedInternalWorkspaces,
}: {
  workspaces: AdminWorkspaceRow[];
  includeInternal: boolean;
  excludedInternalWorkspaces: number;
}) {
  if (!workspaces.length) {
    return <EmptyState title="No clients found" detail="Workspace records will appear here once clients exist." />;
  }

  return (
    <div className="space-y-4">
      {!includeInternal && excludedInternalWorkspaces > 0 ? (
        <p className="rounded-xl border border-navy-800 bg-navy-900/55 px-4 py-2.5 text-xs text-slate-400">
          {formatNumber(excludedInternalWorkspaces)} internal Violema workspace(s) are excluded from
          this table and from every headline number. Toggle &ldquo;Include internal&rdquo; to show them.
        </p>
      ) : null}

      <div className="hidden overflow-x-auto rounded-2xl border border-navy-800 bg-navy-900/70 lg:block">
        <table className="min-w-[1320px] w-full text-left text-sm">
          <thead className="border-b border-navy-800 bg-navy-950/60 text-xs uppercase tracking-[0.14em] text-slate-500">
            <tr>
              <th className="px-4 py-3 font-semibold">Workspace</th>
              <th className="px-4 py-3 font-semibold">Plan</th>
              <th className="px-4 py-3 font-semibold">Credits</th>
              <th className="px-4 py-3 font-semibold">Runs</th>
              <th className="px-4 py-3 font-semibold">Avg credits (actuals)</th>
              <th className="px-4 py-3 font-semibold">Automations</th>
              <th className="px-4 py-3 font-semibold">State</th>
              <th className="px-4 py-3 font-semibold">Owner</th>
              <th className="px-4 py-3 font-semibold">Activity</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-navy-800/80">
            {workspaces.map((workspace) => (
              <tr key={workspace.workspaceId} className="align-top">
                <td className="px-4 py-4">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-white">{workspace.workspaceName || workspace.workspaceId}</p>
                    {workspace.internal ? (
                      <span className="rounded-full border border-violet-500/25 bg-violet-500/10 px-1.5 py-0.5 text-[10px] font-medium text-violet-200">
                        Internal
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-1 text-xs text-slate-500">{workspace.workspaceId}</p>
                </td>
                <td className="px-4 py-4">
                  <p className="text-slate-200">{workspace.planName || workspace.planId || 'Unassigned'}</p>
                  <p className="mt-1 text-xs text-slate-500">{workspace.subscriptionStatus || 'no subscription'}</p>
                </td>
                <td className="px-4 py-4">
                  <p className="text-slate-200">{formatCredits(workspace.creditBalance)} balance</p>
                  <p className="mt-1 text-xs text-slate-500">{formatCredits(workspace.creditsSpent)} spent</p>
                </td>
                <td className="px-4 py-4">
                  <p className="text-slate-200">{formatNumber(workspace.totalRuns)} runs</p>
                  <p className="mt-1 text-xs text-slate-500">
                    {formatRate(workspace.runSuccessRate)} success · {formatNumber(workspace.succeededRuns)} ok
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    <span className="text-red-200/80">{formatNumber(workspace.failedRuns)} failed</span>
                    {' · '}
                    <span className="text-amber-200/80">{formatNumber(workspace.blockedRuns)} blocked</span>
                  </p>
                </td>
                <td className="px-4 py-4">
                  <p className="text-slate-200">{formatCredits(workspace.averageActualRunCredits)}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    {workspace.estimatedOnlyRuns > 0
                      ? `${formatNumber(workspace.estimatedOnlyRuns)} run(s) estimate-only`
                      : 'All runs reported actuals'}
                  </p>
                </td>
                <td className="px-4 py-4"><AutomationCountCell workspace={workspace} /></td>
                <td className="px-4 py-4">
                  <span className={`inline-flex items-center rounded-full border px-2 py-1 text-[11px] font-medium ${workspaceRowStateClasses(workspace.rowState)}`}>
                    {workspaceRowStateLabel(workspace.rowState)}
                  </span>
                </td>
                <td className="px-4 py-4 text-slate-300">{workspace.ownerEmail || 'No owner'}</td>
                <td className="px-4 py-4 text-slate-500">{formatDate(workspace.lastActivityAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid gap-3 lg:hidden">
        {workspaces.map((workspace) => (
          <div key={workspace.workspaceId} className="rounded-2xl border border-navy-800 bg-navy-900/72 p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-white">{workspace.workspaceName || workspace.workspaceId}</p>
                <p className="truncate text-xs text-slate-500">{workspace.ownerEmail || 'No owner'}</p>
              </div>
              <span className={`shrink-0 rounded-full border px-2 py-1 text-[11px] font-medium ${workspaceRowStateClasses(workspace.rowState)}`}>
                {workspaceRowStateLabel(workspace.rowState)}
              </span>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
              <div>
                <p className="text-slate-500">Plan</p>
                <p className="mt-1 text-slate-200">{workspace.planName || workspace.planId || 'Unassigned'}</p>
              </div>
              <div>
                <p className="text-slate-500">Credits</p>
                <p className="mt-1 text-slate-200">{formatCredits(workspace.creditBalance)} / {formatCredits(workspace.creditsSpent)}</p>
              </div>
              <div>
                <p className="text-slate-500">Runs</p>
                <p className="mt-1 text-slate-200">{formatNumber(workspace.totalRuns)} · {formatRate(workspace.runSuccessRate)}</p>
              </div>
              <div>
                <p className="text-slate-500">Failed / blocked</p>
                <p className="mt-1 text-slate-200">
                  {formatNumber(workspace.failedRuns)} / {formatNumber(workspace.blockedRuns)}
                </p>
              </div>
              <div>
                <p className="text-slate-500">Avg credits (actuals)</p>
                <p className="mt-1 text-slate-200">{formatCredits(workspace.averageActualRunCredits)}</p>
              </div>
              <div>
                <p className="text-slate-500">Automations</p>
                <div className="mt-1"><AutomationCountCell workspace={workspace} /></div>
              </div>
              <div className="col-span-2">
                <p className="text-slate-500">Activity</p>
                <p className="mt-1 text-slate-200">{formatDate(workspace.lastActivityAt)}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function AuditPanel({ events }: { events: AdminAuditEvent[] }) {
  if (!events.length) {
    return <EmptyState title="No audit events" detail="Admin actions will be recorded here." />;
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-navy-800 bg-navy-900/70">
      <div className="divide-y divide-navy-800/80">
        {events.map((event) => (
          <div key={event.id} className="grid gap-3 p-4 md:grid-cols-[1.2fr_1fr_1fr_auto] md:items-center">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-white">{event.action}</p>
              <p className="mt-1 truncate text-xs text-slate-500">Actor: {event.actorEmail || 'system'}</p>
            </div>
            <div className="min-w-0 text-xs text-slate-400">
              <p className="truncate">Target: {event.targetEmail || 'none'}</p>
              <p className="mt-1 truncate">Workspace: {event.workspaceId || 'none'}</p>
            </div>
            <div className="min-w-0 text-xs text-slate-500">
              <span className="block max-h-20 overflow-hidden break-words font-mono text-[11px] leading-relaxed text-slate-500">
                {event.metadata && Object.keys(event.metadata).length ? JSON.stringify(event.metadata) : 'No metadata'}
              </span>
            </div>
            <p className="text-xs text-slate-500 md:text-right">{formatDate(event.createdAt)}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [authState, setAuthState] = useState<'checking' | 'allowed' | 'denied'>('checking');
  const [activeTab, setActiveTab] = useState<AdminTab>('overview');
  const [includeInternal, setIncludeInternal] = useState(false);
  const [overview, setOverview] = useState<AdminOverviewPayload | null>(null);
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [userCounts, setUserCounts] = useState<AdminUserFacetCounts | null>(null);
  const [userMatched, setUserMatched] = useState<number | null>(null);
  const [catalog, setCatalog] = useState<AdminCatalog>(CATALOG_FALLBACK);
  const [userFilters, setUserFilters] = useState<AdminUserFilterState>(EMPTY_USER_FILTERS);
  const [workspaces, setWorkspaces] = useState<AdminWorkspaceRow[]>([]);
  const [excludedInternalWorkspaces, setExcludedInternalWorkspaces] = useState(0);
  const [auditEvents, setAuditEvents] = useState<AdminAuditEvent[]>([]);
  const [operations, setOperations] = useState<AdminOperationsSnapshot | null>(null);
  const [operationsLoading, setOperationsLoading] = useState(false);
  const [operationsError, setOperationsError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [actionKey, setActionKey] = useState<string | null>(null);
  const [pendingConfirm, setPendingConfirm] = useState<PendingConfirm | null>(null);
  const [participantDrafts, setParticipantDrafts] = useState<Record<string, ParticipantType>>({});

  const applyUsersResponse = useCallback((payload: AdminUsersResponse) => {
    setUsers(payload.items || []);
    setUserCounts(payload.counts || null);
    setUserMatched(typeof payload.matched === 'number' ? payload.matched : null);
    if (payload.catalog?.participantTypes?.length) setCatalog(payload.catalog);
  }, []);

  const loadUsers = useCallback(async (filters: AdminUserFilterState) => {
    const payload = await fetchAdminJson<AdminUsersResponse>(
      `/api/admin/users${buildAdminUsersQuery(filters)}`,
    );
    applyUsersResponse(payload);
  }, [applyUsersResponse]);

  /**
   * The always-on surfaces. Operations is deliberately absent from this fan-out:
   * it makes one partner-connection lookup per workspace, so it loads only when
   * its tab is actually opened.
   */
  const loadDashboard = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    const scopeQuery = includeInternal ? '?includeInternal=true' : '';
    try {
      const [overviewPayload, usersPayload, workspacesPayload, auditPayload] = await Promise.all([
        fetchAdminJson<AdminOverviewPayload>(`/api/admin/overview${scopeQuery}`),
        fetchAdminJson<AdminUsersResponse>(`/api/admin/users${buildAdminUsersQuery(userFilters)}`),
        fetchAdminJson<AdminWorkspacesResponse>(`/api/admin/workspaces${scopeQuery}`),
        fetchAdminJson<AdminListResponse<AdminAuditEvent>>('/api/admin/audit'),
      ]);
      setOverview(overviewPayload);
      if (overviewPayload.catalog?.participantTypes?.length) setCatalog(overviewPayload.catalog);
      applyUsersResponse(usersPayload);
      setWorkspaces(workspacesPayload.items || []);
      setExcludedInternalWorkspaces(workspacesPayload.excludedInternalWorkspaces || 0);
      setAuditEvents(auditPayload.items || []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Could not load admin dashboard.');
    } finally {
      if (!silent) setLoading(false);
    }
  }, [applyUsersResponse, includeInternal, userFilters]);

  const loadOperations = useCallback(async () => {
    setOperationsLoading(true);
    setOperationsError(null);
    try {
      const snapshot = await fetchAdminJson<AdminOperationsSnapshot>(
        `/api/admin/operations${includeInternal ? '?includeInternal=true' : ''}`,
      );
      setOperations(snapshot);
    } catch (operationsLoadError) {
      setOperationsError(
        operationsLoadError instanceof Error
          ? operationsLoadError.message
          : 'Could not load the operations snapshot.',
      );
    } finally {
      setOperationsLoading(false);
    }
  }, [includeInternal]);

  useEffect(() => {
    let active = true;

    const checkSession = async () => {
      const session = await fetchBackendAuthSession().catch(() => null);
      if (!active) return;

      if (!session) {
        navigate('/login?next=%2Fadmin', { replace: true });
        return;
      }

      if (!isAdminSession(session)) {
        setAuthState('denied');
        setLoading(false);
        return;
      }

      setAuthState('allowed');
      void loadDashboard();
    };

    void checkSession();

    return () => {
      active = false;
    };
    // Mount-only on purpose: `loadDashboard` changes identity whenever scope or
    // filters change, and those paths already refetch. Depending on it here
    // would re-run the session check and double every load.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigate]);

  /** Lazy: the operations snapshot is fetched the first time its tab is opened. */
  useEffect(() => {
    if (authState !== 'allowed') return;
    if (activeTab !== 'operations') return;
    if (operations || operationsLoading || operationsError) return;
    void loadOperations();
  }, [activeTab, authState, loadOperations, operations, operationsError, operationsLoading]);

  useEffect(() => {
    if (!notice) return;
    const timeout = window.setTimeout(() => setNotice(null), 5200);
    return () => window.clearTimeout(timeout);
  }, [notice]);

  const counts = useMemo(() => ({
    requested: users.filter((user) => effectiveAccessStatus(user) === 'requested').length,
    approved: users.filter((user) => effectiveAccessStatus(user) === 'approved').length,
    revoked: users.filter((user) => effectiveAccessStatus(user) === 'revoked').length,
  }), [users]);

  const handleParticipantChange = useCallback((email: string, participantType: ParticipantType) => {
    setParticipantDrafts((currentDrafts) => ({ ...currentDrafts, [email]: participantType }));
  }, []);

  const handleFiltersChange = useCallback((next: AdminUserFilterState) => {
    setUserFilters(next);
    void loadUsers(next).catch((filterError) => {
      setNotice({
        tone: 'error',
        message: filterError instanceof Error ? filterError.message : 'Could not apply filters.',
      });
    });
  }, [loadUsers]);

  const handleScopeToggle = useCallback((next: boolean) => {
    setIncludeInternal(next);
    // The operations snapshot is scoped too, so it must be refetched rather than
    // reused against a scope it was not built for.
    setOperations(null);
    setOperationsError(null);
  }, []);

  useEffect(() => {
    if (authState !== 'allowed') return;
    void loadDashboard(true);
    // Scope changes re-read every scoped surface. Depending on `includeInternal`
    // alone is deliberate: `loadDashboard` also changes with filters, which have
    // their own narrower refetch path.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [includeInternal]);

  const handleAccessChange = useCallback(async (user: AdminUserRow, status: Extract<AccessStatus, 'approved' | 'revoked'>) => {
    setActionKey(user.email);
    try {
      await patchAdminJson(`/api/admin/users/${encodeURIComponent(user.email)}/access`, {
        status,
        note: status === 'approved' ? 'Approved from admin dashboard' : 'Revoked from admin dashboard',
      });
      setPendingConfirm(null);
      setNotice({ tone: 'success', message: `${status === 'approved' ? 'Approved' : 'Revoked'} ${user.email}.` });
      await loadDashboard(true);
    } catch (actionError) {
      // The backend refuses self-revocation with a specific, actionable message.
      // Surfacing it verbatim is the point: a generic failure would send the
      // operator hunting for a bug that is really a guardrail.
      setNotice({ tone: 'error', message: actionError instanceof Error ? actionError.message : 'Could not update access.' });
    } finally {
      setActionKey(null);
    }
  }, [loadDashboard]);

  const handleParticipantSave = useCallback(async (user: AdminUserRow, participantType: ParticipantType) => {
    setActionKey(user.email);
    try {
      const payload = await patchAdminJson<AdminAccessMutationResponse>(
        `/api/admin/users/${encodeURIComponent(user.email)}/access`,
        buildParticipantAccessPatch(participantType),
      );
      setUsers(payload.users || []);
      setParticipantDrafts((currentDrafts) => {
        const nextDrafts = { ...currentDrafts };
        delete nextDrafts[user.email];
        return nextDrafts;
      });
      setNotice({ tone: 'success', message: `Saved participant type for ${user.email}.` });
    } catch (actionError) {
      setNotice({ tone: 'error', message: actionError instanceof Error ? actionError.message : 'Could not save participant type.' });
    } finally {
      setActionKey(null);
    }
  }, []);

  const handleRoleChange = useCallback(async (user: AdminUserRow, role: AdminRole) => {
    setActionKey(user.email);
    try {
      await patchAdminJson(`/api/admin/users/${encodeURIComponent(user.email)}/role`, {
        role,
        note: role === 'admin' ? 'Promoted from admin dashboard' : 'Demoted from admin dashboard',
      });
      setPendingConfirm(null);
      setNotice({ tone: 'success', message: `${role === 'admin' ? 'Promoted' : 'Demoted'} ${user.email}.` });
      await loadDashboard(true);
    } catch (actionError) {
      // Self-demotion is a 400 that explains how to recover. Show it verbatim.
      setNotice({ tone: 'error', message: actionError instanceof Error ? actionError.message : 'Could not update role.' });
    } finally {
      setActionKey(null);
    }
  }, [loadDashboard]);

  if (authState === 'checking') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-navy-950 px-6 text-sm text-slate-400">
        Checking admin access...
      </div>
    );
  }

  if (authState === 'denied') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-navy-950 px-6">
        <div className="max-w-md rounded-2xl border border-red-500/20 bg-red-500/10 p-6 text-center shadow-card">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-red-500/20 bg-red-500/10 text-red-100">
            <ShieldOff className="h-5 w-5" />
          </div>
          <h1 className="mt-4 text-lg font-semibold text-white">Admin access required</h1>
          <p className="mt-2 text-sm text-slate-400">This dashboard is limited to Violema administrators.</p>
          <button
            type="button"
            onClick={() => navigate('/dashboard')}
            className="mt-5 rounded-xl border border-navy-700 bg-navy-900 px-4 py-2 text-sm font-medium text-slate-200 transition-colors hover:border-violet-500/50 hover:text-white"
          >
            Back to dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-navy-950 text-white">
      {notice ? (
        <div className="pointer-events-none fixed inset-x-3 top-3 z-50 flex justify-center">
          <div className={`pointer-events-auto max-w-md rounded-2xl border px-4 py-3 shadow-[0_18px_50px_rgba(2,6,23,0.42)] backdrop-blur-md ${
            notice.tone === 'success'
              ? 'border-emerald-500/20 bg-emerald-500/12 text-emerald-100'
              : 'border-red-500/20 bg-red-500/12 text-red-100'
          }`}>
            <p className="text-sm font-medium leading-5">{notice.message}</p>
          </div>
        </div>
      ) : null}

      <header className="sticky top-0 z-30 border-b border-navy-800/80 bg-gradient-to-r from-navy-950/96 via-navy-900/92 to-navy-950/96 backdrop-blur-md">
        <div className="mx-auto flex max-w-[1440px] flex-col gap-4 px-4 py-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-violet-500/20 bg-violet-500/10 text-violet-100">
              <Shield className="h-5 w-5" />
            </div>
            <ViolemaLogo className="hidden h-10 w-[12rem] sm:flex" />
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-[0.22em] text-slate-500">Internal operations</p>
              <h1 className="truncate text-lg font-semibold tracking-tight text-white">Admin dashboard</h1>
              <p className="mt-1 text-sm text-slate-400">Access, client health, and audit trail for Violema/NEXUS.</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2 rounded-xl border border-navy-800 bg-navy-900/70 px-3 py-2 text-xs text-slate-400">
              <span className="text-emerald-200">{formatNumber(counts.approved)}</span> approved
              <span className="text-amber-200">{formatNumber(counts.requested)}</span> pending
              <span className="text-red-200">{formatNumber(counts.revoked)}</span> revoked
            </div>
            <label
              title="Count Violema's own default and demo workspaces in every headline number."
              className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-navy-700 bg-navy-900/72 px-3 py-2 text-xs font-medium text-slate-300 transition-colors hover:border-violet-600/50 hover:text-white"
            >
              <input
                type="checkbox"
                checked={includeInternal}
                onChange={(event) => handleScopeToggle(event.target.checked)}
                className="h-3.5 w-3.5 accent-violet-500"
              />
              Include internal
            </label>
            <button
              type="button"
              onClick={() => {
                void loadDashboard(true);
                if (activeTab === 'operations') void loadOperations();
              }}
              className="inline-flex items-center gap-2 rounded-xl border border-navy-700 bg-navy-900/72 px-3 py-2 text-xs font-medium text-slate-300 transition-colors hover:border-violet-600/50 hover:text-white"
            >
              <RefreshCcw className="h-3.5 w-3.5" />
              Refresh
            </button>
          </div>
        </div>

        <div className="mx-auto max-w-[1440px] overflow-x-auto px-4 pb-3 sm:px-6">
          <div className="flex min-w-max gap-2">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium transition-colors ${
                    active
                      ? 'border-violet-500/30 bg-violet-500/12 text-violet-100'
                      : 'border-navy-800 bg-navy-900/50 text-slate-400 hover:border-navy-700 hover:text-white'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1440px] px-4 py-6 sm:px-6">
        {error ? (
          <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-red-100">Could not load admin data</p>
                <p className="mt-2 text-sm text-red-100/70">{error}</p>
              </div>
              <button
                type="button"
                onClick={() => void loadDashboard()}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm font-medium text-red-100 transition-colors hover:bg-red-500/16"
              >
                <RefreshCcw className="h-4 w-4" />
                Retry
              </button>
            </div>
          </div>
        ) : loading ? (
          <LoadingState />
        ) : (
          <div className="space-y-5">
            {activeTab === 'overview' ? (
              <OverviewPanel overview={overview} />
            ) : null}

            {activeTab === 'operations' ? (
              <section className="space-y-4">
                <SectionHeader
                  title="Operations"
                  detail="What needs a human right now, what broke, and what is quietly degrading."
                />
                {operationsError ? (
                  <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-5">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="text-sm font-semibold text-red-100">Could not load operations</p>
                        <p className="mt-2 text-sm text-red-100/70">{operationsError}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setOperationsError(null);
                          void loadOperations();
                        }}
                        className="inline-flex items-center justify-center gap-2 rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm font-medium text-red-100 transition-colors hover:bg-red-500/16"
                      >
                        <RefreshCcw className="h-4 w-4" />
                        Retry
                      </button>
                    </div>
                  </div>
                ) : operationsLoading || !operations ? (
                  <LoadingState />
                ) : (
                  <AdminOperationsPanel snapshot={operations} />
                )}
              </section>
            ) : null}

            {activeTab === 'users' ? (
              <section className="space-y-4">
                <SectionHeader title="Users" detail="Approve access, revoke access, and manage admin role separately." />
                <UserFilterBar
                  catalog={catalog}
                  filters={userFilters}
                  counts={userCounts}
                  matched={userMatched}
                  onChange={handleFiltersChange}
                  onReset={() => handleFiltersChange(EMPTY_USER_FILTERS)}
                />
                <UsersPanel
                  users={users}
                  catalog={catalog}
                  actionKey={actionKey}
                  pendingConfirm={pendingConfirm}
                  onRequestConfirm={(email, action) => setPendingConfirm({ email, action })}
                  onCancelConfirm={() => setPendingConfirm(null)}
                  onAccessChange={handleAccessChange}
                  onRoleChange={handleRoleChange}
                  participantDrafts={participantDrafts}
                  onParticipantChange={handleParticipantChange}
                  onParticipantSave={handleParticipantSave}
                />
              </section>
            ) : null}

            {activeTab === 'clients' ? (
              <section className="space-y-4">
                <SectionHeader
                  title="Clients"
                  detail="Workspace health, credits, subscriptions, automations, and run reliability. Automation counts are per workspace."
                />
                <ClientsPanel
                  workspaces={workspaces}
                  includeInternal={includeInternal}
                  excludedInternalWorkspaces={excludedInternalWorkspaces}
                />
              </section>
            ) : null}

            {activeTab === 'audit' ? (
              <section className="space-y-4">
                <SectionHeader title="Audit log" detail="Admin actions and system events in reverse chronological order." />
                <AuditPanel events={auditEvents} />
              </section>
            ) : null}
          </div>
        )}
      </main>
    </div>
  );
}
