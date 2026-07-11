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
  LayoutDashboard,
  RefreshCcw,
  Shield,
  ShieldOff,
  SlidersHorizontal,
  Users,
  WalletCards,
  XCircle,
} from 'lucide-react';
import ViolemaLogo from '../components/ViolemaLogo';
import { fetchBackendAuthSession, isAdminSession, type ParticipantType } from '../lib/auth';

type AdminTab = 'overview' | 'users' | 'clients' | 'audit';
type AccessStatus = 'requested' | 'approved' | 'revoked';
type AdminRole = 'user' | 'admin';
type NoticeTone = 'success' | 'error';

interface AdminOverviewMetrics {
  approvedUsers?: number;
  approvedUserCount?: number;
  pendingUsers?: number;
  pendingUserCount?: number;
  requestedUsers?: number;
  workspaces?: number;
  workspaceCount?: number;
  activeAutomations?: number;
  automations?: number;
  automationCount?: number;
  totalRuns?: number;
  runs?: number;
  runCount?: number;
  successRate?: number;
  runSuccessRate?: number;
  failedRuns?: number;
  failedRunCount?: number;
  creditsSpent?: number;
  [key: string]: number | string | null | undefined;
}

interface AdminUserRow {
  email: string;
  name?: string;
  role: AdminRole;
  method?: string;
  accessStatus: AccessStatus;
  approvedAccess?: boolean;
  hasAccessRecord?: boolean;
  participantType: ParticipantType;
  identityVerified: boolean;
  termsCurrent: boolean;
  termsVersion?: string | null;
  approvalReady: boolean;
  trialStatus: 'granted' | 'pending' | 'not_applicable';
  trialCredits: number;
  trialGrantedAt?: string | null;
  slackConnected?: boolean;
  slackDisplayTarget?: string;
  activeSessionCount?: number;
  createdAt?: string;
  updatedAt?: string;
}

interface AdminWorkspaceRow {
  workspaceId: string;
  workspaceName?: string;
  ownerEmail?: string;
  planId?: string;
  planName?: string;
  subscriptionStatus?: string;
  creditBalance?: number;
  creditsSpent?: number;
  taskCount?: number;
  runCount?: number;
  automationCount?: number;
  globalAutomationCount?: number;
  automationScope?: string;
  rowState?: string;
  runSuccessRate?: number;
  failedRuns?: number;
  lastActivityAt?: string;
}

interface AdminAuditEvent {
  id: string;
  actorEmail?: string;
  action: string;
  targetEmail?: string;
  workspaceId?: string;
  metadata?: Record<string, unknown>;
  createdAt?: string;
}

interface AdminOverviewPayload {
  metrics?: AdminOverviewMetrics;
  recentUsers?: AdminUserRow[];
  workspacesNeedingAttention?: AdminWorkspaceRow[];
  recentFailedRuns?: Array<{
    id?: string;
    workspaceId?: string;
    workspaceName?: string;
    status?: string;
    error?: string;
    startedAt?: string;
    finishedAt?: string;
  }>;
}

interface AdminListResponse<T> {
  items: T[];
}

interface Notice {
  tone: NoticeTone;
  message: string;
}

const TABS: Array<{ id: AdminTab; label: string; icon: typeof LayoutDashboard }> = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'users', label: 'Users', icon: Users },
  { id: 'clients', label: 'Clients', icon: Database },
  { id: 'audit', label: 'Audit', icon: FileClock },
];

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

function firstMetric(metrics: AdminOverviewMetrics | undefined, keys: string[]) {
  for (const key of keys) {
    const value = metrics?.[key];
    if (typeof value === 'number' && Number.isFinite(value)) return value;
  }
  return 0;
}

function formatNumber(value: number | undefined) {
  return new Intl.NumberFormat('en-US').format(value || 0);
}

function formatCredits(value: number | undefined) {
  return formatNumber(Math.round(value || 0));
}

function formatRate(value: number | undefined) {
  if (!value || !Number.isFinite(value)) return '0%';
  const normalized = value <= 1 ? value * 100 : value;
  return `${Math.round(normalized)}%`;
}

function formatDate(value?: string) {
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

function statusClasses(status?: string) {
  if (status === 'approved' || status === 'active' || status === 'ok') {
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

function Badge({ value }: { value?: string }) {
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-1 text-[11px] font-medium capitalize ${statusClasses(value)}`}>
      {value || 'unknown'}
    </span>
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

function OverviewPanel({
  overview,
}: {
  overview: AdminOverviewPayload | null;
}) {
  const metrics = overview?.metrics;
  const metricCards = [
    {
      label: 'Approved users',
      value: formatNumber(firstMetric(metrics, ['approvedUsers', 'approvedUserCount'])),
      detail: 'Users with active platform access',
      icon: CheckCircle2,
      tone: 'good' as const,
    },
    {
      label: 'Pending users',
      value: formatNumber(firstMetric(metrics, ['pendingUsers', 'pendingUserCount', 'requestedUsers'])),
      detail: 'Requests waiting for a decision',
      icon: Clock3,
      tone: 'warn' as const,
    },
    {
      label: 'Workspaces',
      value: formatNumber(firstMetric(metrics, ['workspaces', 'workspaceCount'])),
      detail: 'Client control surfaces',
      icon: Database,
    },
    {
      label: 'Automations',
      value: formatNumber(firstMetric(metrics, ['activeAutomations', 'automations', 'automationCount'])),
      detail: 'Configured recurring work',
      icon: SlidersHorizontal,
    },
    {
      label: 'Runs',
      value: formatNumber(firstMetric(metrics, ['totalRuns', 'runs', 'runCount'])),
      detail: 'Total execution volume',
      icon: Activity,
    },
    {
      label: 'Success rate',
      value: formatRate(firstMetric(metrics, ['successRate', 'runSuccessRate'])),
      detail: 'Run reliability across workspaces',
      icon: CheckCircle2,
      tone: 'good' as const,
    },
    {
      label: 'Failed runs',
      value: formatNumber(firstMetric(metrics, ['failedRuns', 'failedRunCount'])),
      detail: 'Needs operator attention',
      icon: AlertTriangle,
      tone: 'bad' as const,
    },
    {
      label: 'Credits spent',
      value: formatCredits(firstMetric(metrics, ['creditsSpent'])),
      detail: 'Aggregate platform consumption',
      icon: WalletCards,
    },
  ];

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {metricCards.map((item) => (
          <MetricCard key={item.label} {...item} />
        ))}
      </div>

      <div className="grid gap-5 xl:grid-cols-3">
        <div className="rounded-2xl border border-navy-800 bg-navy-900/70 p-4 xl:col-span-1">
          <SectionHeader title="Recent users" detail="Latest account activity." />
          <div className="mt-4 space-y-3">
            {overview?.recentUsers?.length ? overview.recentUsers.slice(0, 6).map((user) => (
              <div key={user.email} className="flex items-center justify-between gap-3 rounded-xl border border-navy-800 bg-navy-950/45 p-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-white">{user.name || user.email}</p>
                  <p className="truncate text-xs text-slate-500">{user.email}</p>
                </div>
                <Badge value={effectiveAccessStatus(user)} />
              </div>
            )) : (
              <EmptyState title="No recent users" detail="New account activity will appear here." />
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-navy-800 bg-navy-900/70 p-4 xl:col-span-1">
          <SectionHeader title="Workspace attention" detail="Accounts with degraded or unusual state." />
          <div className="mt-4 space-y-3">
            {overview?.workspacesNeedingAttention?.length ? overview.workspacesNeedingAttention.slice(0, 6).map((workspace) => (
              <div key={workspace.workspaceId} className="rounded-xl border border-navy-800 bg-navy-950/45 p-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="truncate text-sm font-medium text-white">{workspace.workspaceName || workspace.workspaceId}</p>
                  <Badge value={workspace.rowState || workspace.subscriptionStatus} />
                </div>
                <p className="mt-2 truncate text-xs text-slate-500">{workspace.ownerEmail || 'No owner'} | {formatRate(workspace.runSuccessRate)} success</p>
              </div>
            )) : (
              <EmptyState title="Nothing urgent" detail="No workspace currently needs attention." />
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-navy-800 bg-navy-900/70 p-4 xl:col-span-1">
          <SectionHeader title="Recent failed runs" detail="Newest failures across client workspaces." />
          <div className="mt-4 space-y-3">
            {overview?.recentFailedRuns?.length ? overview.recentFailedRuns.slice(0, 6).map((run, index) => (
              <div key={run.id || `${run.workspaceId}-${index}`} className="rounded-xl border border-red-500/15 bg-red-500/5 p-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="truncate text-sm font-medium text-red-100">{run.workspaceName || run.workspaceId || 'Unknown workspace'}</p>
                  <span className="text-xs text-red-200">{formatDate(run.finishedAt || run.startedAt)}</span>
                </div>
                <p className="mt-2 line-clamp-2 text-xs text-red-100/70">{run.error || run.status || 'Run failed'}</p>
              </div>
            )) : (
              <EmptyState title="No recent failures" detail="Failed runs will appear here when they occur." />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function UserActions({
  user,
  busy,
  onAccessChange,
  onRoleChange,
}: {
  user: AdminUserRow;
  busy: boolean;
  onAccessChange: (user: AdminUserRow, status: Extract<AccessStatus, 'approved' | 'revoked'>) => void;
  onRoleChange: (user: AdminUserRow, role: AdminRole) => void;
}) {
  const isApproved = effectiveAccessStatus(user) === 'approved';
  const isAdmin = user.role === 'admin';
  const roleActionDisabled = busy || user.hasAccessRecord === false;
  const roleActionTitle = user.hasAccessRecord === false
    ? 'Role changes require a persistent access record. Approve or record access first.'
    : isAdmin ? 'Demote to user' : 'Promote to admin';
  const approvalActionTitle = !user.approvalReady
    ? 'Verified OAuth identity and current beta confidentiality acceptance are required before approval.'
    : isApproved ? 'Access is already approved.' : 'Approve beta access';

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        disabled={busy || isApproved || !user.approvalReady}
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
        onClick={() => onAccessChange(user, 'revoked')}
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
          onRoleChange(user, isAdmin ? 'user' : 'admin');
        }}
        className="inline-flex items-center gap-1.5 rounded-lg border border-violet-500/20 bg-violet-500/10 px-2.5 py-1.5 text-xs font-medium text-violet-100 transition-colors hover:bg-violet-500/16 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {isAdmin ? <ArrowDown className="h-3.5 w-3.5" /> : <ArrowUp className="h-3.5 w-3.5" />}
        {isAdmin ? 'Demote' : 'Promote'}
      </button>
    </div>
  );
}

function ParticipantSelect({
  user,
  disabled,
  onChange,
}: {
  user: AdminUserRow;
  disabled: boolean;
  onChange: (user: AdminUserRow, participantType: ParticipantType) => void;
}) {
  return (
    <div>
      <select
        aria-label={`Participant type for ${user.email}`}
        value={user.participantType}
        disabled={disabled || effectiveAccessStatus(user) === 'approved'}
        onChange={(event) => onChange(user, event.target.value as ParticipantType)}
        className="w-full rounded-lg border border-navy-700 bg-navy-950 px-2 py-1.5 text-xs text-slate-200 outline-none transition-colors focus:border-violet-500 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <option value="founder_operator">Founder / operator</option>
        <option value="investor">Investor</option>
        <option value="partner">Partner</option>
      </select>
      {effectiveAccessStatus(user) !== 'approved' ? (
        <p className="mt-1 text-[11px] text-slate-600">Applied with approval</p>
      ) : null}
    </div>
  );
}

function TermsEvidence({ user }: { user: AdminUserRow }) {
  return (
    <div className="space-y-1 text-xs">
      <p className={user.identityVerified ? 'text-emerald-200' : 'text-amber-200'}>
        {user.identityVerified ? 'Identity verified' : 'Identity unverified'}
      </p>
      <p className={user.termsCurrent ? 'text-emerald-200' : 'text-amber-200'}>
        {user.termsCurrent ? 'Terms current' : 'Terms required'}
      </p>
      {user.termsVersion ? <p className="max-w-[160px] truncate text-slate-600">{user.termsVersion}</p> : null}
    </div>
  );
}

function TrialEvidence({ user }: { user: AdminUserRow }) {
  if (user.trialStatus === 'granted') {
    return (
      <div className="text-xs">
        <p className="font-medium text-emerald-200">Granted · {formatCredits(user.trialCredits)} credits</p>
        <p className="mt-1 text-slate-500">{formatDate(user.trialGrantedAt || undefined)}</p>
      </div>
    );
  }
  if (user.trialStatus === 'pending') {
    return <p className="text-xs font-medium text-amber-200">Pending grant</p>;
  }
  return <p className="text-xs text-slate-500">Not applicable</p>;
}

function UsersPanel({
  users,
  actionKey,
  onAccessChange,
  onRoleChange,
  onParticipantChange,
}: {
  users: AdminUserRow[];
  actionKey: string | null;
  onAccessChange: (user: AdminUserRow, status: Extract<AccessStatus, 'approved' | 'revoked'>) => void;
  onRoleChange: (user: AdminUserRow, role: AdminRole) => void;
  onParticipantChange: (user: AdminUserRow, participantType: ParticipantType) => void;
}) {
  if (!users.length) {
    return <EmptyState title="No users found" detail="User requests and approved accounts will appear here." />;
  }

  return (
    <div className="space-y-4">
      <div className="hidden overflow-x-auto rounded-2xl border border-navy-800 bg-navy-900/70 md:block">
        <table className="min-w-[1280px] w-full text-left text-sm">
          <thead className="border-b border-navy-800 bg-navy-950/60 text-xs uppercase tracking-[0.14em] text-slate-500">
            <tr>
              <th className="px-4 py-3 font-semibold">User</th>
              <th className="px-4 py-3 font-semibold">Access</th>
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
              return (
                <tr key={user.email} className="align-top">
                  <td className="px-4 py-4">
                    <p className="font-medium text-white">{user.name || user.email}</p>
                    <p className="mt-1 text-xs text-slate-500">{user.email}</p>
                    {user.method ? <p className="mt-1 text-xs text-slate-600">{user.method}</p> : null}
                  </td>
                  <td className="px-4 py-4"><Badge value={accessStatus} /></td>
                  <td className="px-4 py-4">
                    <ParticipantSelect user={user} disabled={busy} onChange={onParticipantChange} />
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
                  <td className="px-4 py-4">
                    <UserActions user={user} busy={busy} onAccessChange={onAccessChange} onRoleChange={onRoleChange} />
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
          return (
            <div key={user.email} className="rounded-2xl border border-navy-800 bg-navy-900/72 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-white">{user.name || user.email}</p>
                  <p className="truncate text-xs text-slate-500">{user.email}</p>
                </div>
                <Badge value={accessStatus} />
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
                <div className="col-span-2">
                  <p className="text-slate-500">Participant</p>
                  <div className="mt-1">
                    <ParticipantSelect user={user} disabled={busy} onChange={onParticipantChange} />
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
                <UserActions user={user} busy={busy} onAccessChange={onAccessChange} onRoleChange={onRoleChange} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ClientsPanel({ workspaces }: { workspaces: AdminWorkspaceRow[] }) {
  if (!workspaces.length) {
    return <EmptyState title="No clients found" detail="Workspace records will appear here once clients exist." />;
  }

  return (
    <div className="space-y-4">
      <div className="hidden overflow-x-auto rounded-2xl border border-navy-800 bg-navy-900/70 lg:block">
        <table className="min-w-[1120px] w-full text-left text-sm">
          <thead className="border-b border-navy-800 bg-navy-950/60 text-xs uppercase tracking-[0.14em] text-slate-500">
            <tr>
              <th className="px-4 py-3 font-semibold">Workspace</th>
              <th className="px-4 py-3 font-semibold">Plan</th>
              <th className="px-4 py-3 font-semibold">Credits</th>
              <th className="px-4 py-3 font-semibold">Runs</th>
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
                  <p className="font-medium text-white">{workspace.workspaceName || workspace.workspaceId}</p>
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
                  <p className="text-slate-200">{formatNumber(workspace.runCount)} runs</p>
                  <p className="mt-1 text-xs text-slate-500">{formatRate(workspace.runSuccessRate)} success | {formatNumber(workspace.failedRuns)} failed</p>
                </td>
                <td className="px-4 py-4">
                  <p className="text-slate-200">{formatNumber(workspace.automationCount)}</p>
                  <p className="mt-1 text-xs text-slate-500">{workspace.automationScope || `${formatNumber(workspace.globalAutomationCount)} global`}</p>
                </td>
                <td className="px-4 py-4"><Badge value={workspace.rowState || workspace.subscriptionStatus} /></td>
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
              <Badge value={workspace.rowState || workspace.subscriptionStatus} />
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
                <p className="mt-1 text-slate-200">{formatNumber(workspace.runCount)} | {formatRate(workspace.runSuccessRate)}</p>
              </div>
              <div>
                <p className="text-slate-500">Failed</p>
                <p className="mt-1 text-slate-200">{formatNumber(workspace.failedRuns)}</p>
              </div>
              <div>
                <p className="text-slate-500">Automations</p>
                <p className="mt-1 text-slate-200">{formatNumber(workspace.automationCount)}</p>
              </div>
              <div>
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
  const [overview, setOverview] = useState<AdminOverviewPayload | null>(null);
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [workspaces, setWorkspaces] = useState<AdminWorkspaceRow[]>([]);
  const [auditEvents, setAuditEvents] = useState<AdminAuditEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [actionKey, setActionKey] = useState<string | null>(null);

  const loadDashboard = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      const [overviewPayload, usersPayload, workspacesPayload, auditPayload] = await Promise.all([
        fetchAdminJson<AdminOverviewPayload>('/api/admin/overview'),
        fetchAdminJson<AdminListResponse<AdminUserRow>>('/api/admin/users'),
        fetchAdminJson<AdminListResponse<AdminWorkspaceRow>>('/api/admin/workspaces'),
        fetchAdminJson<AdminListResponse<AdminAuditEvent>>('/api/admin/audit'),
      ]);
      setOverview(overviewPayload);
      setUsers(usersPayload.items || []);
      setWorkspaces(workspacesPayload.items || []);
      setAuditEvents(auditPayload.items || []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Could not load admin dashboard.');
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

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
  }, [loadDashboard, navigate]);

  useEffect(() => {
    if (!notice) return;
    const timeout = window.setTimeout(() => setNotice(null), 3600);
    return () => window.clearTimeout(timeout);
  }, [notice]);

  const counts = useMemo(() => ({
    requested: users.filter((user) => effectiveAccessStatus(user) === 'requested').length,
    approved: users.filter((user) => effectiveAccessStatus(user) === 'approved').length,
    revoked: users.filter((user) => effectiveAccessStatus(user) === 'revoked').length,
  }), [users]);

  const handleAccessChange = useCallback(async (user: AdminUserRow, status: Extract<AccessStatus, 'approved' | 'revoked'>) => {
    setActionKey(user.email);
    try {
      await patchAdminJson(`/api/admin/users/${encodeURIComponent(user.email)}/access`, {
        status,
        participantType: user.participantType,
        note: status === 'approved' ? 'Approved from admin dashboard' : 'Revoked from admin dashboard',
      });
      setNotice({ tone: 'success', message: `${status === 'approved' ? 'Approved' : 'Revoked'} ${user.email}.` });
      await loadDashboard(true);
    } catch (actionError) {
      setNotice({ tone: 'error', message: actionError instanceof Error ? actionError.message : 'Could not update access.' });
    } finally {
      setActionKey(null);
    }
  }, [loadDashboard]);

  const handleParticipantChange = useCallback((user: AdminUserRow, participantType: ParticipantType) => {
    setUsers((currentUsers) => currentUsers.map((currentUser) => (
      currentUser.email === user.email ? { ...currentUser, participantType } : currentUser
    )));
  }, []);

  const handleRoleChange = useCallback(async (user: AdminUserRow, role: AdminRole) => {
    setActionKey(user.email);
    try {
      await patchAdminJson(`/api/admin/users/${encodeURIComponent(user.email)}/role`, {
        role,
        note: role === 'admin' ? 'Promoted from admin dashboard' : 'Demoted from admin dashboard',
      });
      setNotice({ tone: 'success', message: `${role === 'admin' ? 'Promoted' : 'Demoted'} ${user.email}.` });
      await loadDashboard(true);
    } catch (actionError) {
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
            <p className="text-sm font-medium">{notice.message}</p>
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
            <button
              type="button"
              onClick={() => void loadDashboard(true)}
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

            {activeTab === 'users' ? (
              <section className="space-y-4">
                <SectionHeader title="Users" detail="Approve access, revoke access, and manage admin role separately." />
                <UsersPanel
                  users={users}
                  actionKey={actionKey}
                  onAccessChange={handleAccessChange}
                  onRoleChange={handleRoleChange}
                  onParticipantChange={handleParticipantChange}
                />
              </section>
            ) : null}

            {activeTab === 'clients' ? (
              <section className="space-y-4">
                <SectionHeader title="Clients" detail="Workspace health, credits, subscriptions, automations, and run reliability." />
                <ClientsPanel workspaces={workspaces} />
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
