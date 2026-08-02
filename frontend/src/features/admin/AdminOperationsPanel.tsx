/**
 * The operator's morning read: `GET /api/admin/operations`.
 *
 * Ordered by what a human does with it, not by what is easiest to compute:
 *
 *   1. NEEDS A HUMAN NOW — missions blocked behind a named missing connection,
 *      and reviews nobody has approved, oldest first.
 *   2. WHAT BROKE — failures in the window, bucketed by kind.
 *   3. WHAT IS DEGRADING — automations failing repeatedly or paused.
 *   4. THE FUNNEL AND RELIABILITY — the slower-moving numbers, last.
 *
 * `telemetry.notes` are rendered up front rather than buried: they are the
 * snapshot's own caveats and they qualify every number below them.
 */

import type { ReactNode } from 'react';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock3,
  FileClock,
  Gauge,
  Info,
  Link2,
  ListChecks,
  Minus,
  PauseCircle,
  Plug,
  TrendingDown,
  TrendingUp,
  Users,
  WalletCards,
} from 'lucide-react';
import { participantTypeLabel } from '../../lib/auth';
import {
  accountStageLabel,
  blockerKeyLabel,
  failureKindClasses,
  failureKindLabel,
  formatCredits,
  formatDate,
  formatNumber,
  formatRate,
  formatWaitingFor,
  formatWindowLabel,
} from './adminFormat';
import type { AdminFailureKind, AdminOperationsSnapshot } from './adminTypes';

const FAILURE_KIND_ORDER: AdminFailureKind[] = [
  'connector',
  'fabricated_evidence',
  'readiness_blocked',
  'other',
];

function OpsSection({
  title,
  detail,
  icon: Icon,
  tone = 'neutral',
  count,
  children,
}: {
  title: string;
  detail: string;
  icon: typeof Activity;
  tone?: 'neutral' | 'urgent' | 'warn' | 'good';
  count?: number;
  children: ReactNode;
}) {
  const toneClass = {
    neutral: 'border-cyan-500/15 bg-cyan-500/10 text-cyan-200',
    urgent: 'border-red-500/20 bg-red-500/10 text-red-200',
    warn: 'border-amber-500/20 bg-amber-500/10 text-amber-200',
    good: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-200',
  }[tone];

  return (
    <section className="rounded-2xl border border-navy-800 bg-navy-900/70 p-4 shadow-[0_14px_34px_rgba(2,6,23,0.18)]">
      <div className="flex items-start gap-3">
        <div className={`rounded-xl border p-2 ${toneClass}`}>
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <h3 className="text-base font-semibold text-white">{title}</h3>
            {typeof count === 'number' ? (
              <span className="text-sm font-medium text-slate-400">{formatNumber(count)}</span>
            ) : null}
          </div>
          <p className="mt-1 text-sm text-slate-500">{detail}</p>
        </div>
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function OpsEmpty({ message }: { message: string }) {
  return (
    <p className="rounded-xl border border-dashed border-navy-700/80 bg-navy-950/40 px-4 py-6 text-center text-sm text-slate-500">
      {message}
    </p>
  );
}

function StatTile({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <div className="rounded-xl border border-navy-800 bg-navy-950/45 px-3 py-2.5">
      <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-slate-500">{label}</p>
      <p className="mt-1.5 text-lg font-semibold tracking-tight text-white">{value}</p>
      {detail ? <p className="mt-1 text-[11px] leading-4 text-slate-500">{detail}</p> : null}
    </div>
  );
}

function DeltaRow({ metric, current, prior, delta }: {
  metric: string;
  current: number;
  prior: number;
  delta: number;
}) {
  const Icon = delta > 0 ? TrendingUp : delta < 0 ? TrendingDown : Minus;
  const toneClass = delta > 0 ? 'text-emerald-200' : delta < 0 ? 'text-red-200' : 'text-slate-500';
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-navy-800 bg-navy-950/40 px-3 py-2">
      <p className="min-w-0 truncate text-xs text-slate-300">{metric}</p>
      <div className="flex shrink-0 items-center gap-2 text-xs">
        <span className="text-slate-500">{formatNumber(prior)}</span>
        <span className="text-slate-600">&rarr;</span>
        <span className="font-semibold text-white">{formatNumber(current)}</span>
        <span className={`inline-flex items-center gap-1 ${toneClass}`}>
          <Icon className="h-3 w-3" />
          {delta > 0 ? `+${formatNumber(delta)}` : formatNumber(delta)}
        </span>
      </div>
    </div>
  );
}

export function AdminOperationsPanel({ snapshot }: { snapshot: AdminOperationsSnapshot }) {
  const windowLabel = formatWindowLabel(snapshot.windowHours);
  const { telemetry } = snapshot;
  const failureCounts = snapshot.recentFailures.countsByKind;
  const scopeNote = snapshot.scope.includeInternal
    ? "Including Violema's own default and demo workspaces."
    : `Excluding ${formatNumber(snapshot.scope.excludedInternalWorkspaces)} internal Violema workspace(s).`;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-navy-800 bg-navy-900/55 px-4 py-3">
        <div>
          <p className="text-sm font-semibold text-white">
            {formatNumber(snapshot.scope.workspaceCount)} workspaces in scope
          </p>
          <p className="mt-1 text-xs text-slate-500">{scopeNote}</p>
        </div>
        <p className="text-xs text-slate-500">Snapshot taken {formatDate(snapshot.generatedAt)}</p>
      </div>

      {/* The snapshot's own caveats, before the numbers they qualify. */}
      {telemetry.notes.length > 0 ? (
        <div className="rounded-2xl border border-cyan-500/15 bg-cyan-500/[0.06] p-4">
          <div className="flex items-center gap-2">
            <Info className="h-4 w-4 text-cyan-200" />
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-200">
              How to read these numbers
            </p>
          </div>
          <ul className="mt-3 space-y-1.5">
            {telemetry.notes.map((note) => (
              <li key={note} className="text-xs leading-5 text-slate-400">&bull; {note}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {/* ── 1. Needs a human now ─────────────────────────────────────────── */}
      <div className="grid gap-5 xl:grid-cols-2">
        <OpsSection
          title="Blocked right now"
          detail="Missions held because a connection is missing. The fix is the named connection, not a code change."
          icon={Plug}
          tone={snapshot.blockedNow.length > 0 ? 'warn' : 'good'}
          count={snapshot.blockedNow.length}
        >
          {snapshot.blockedNow.length === 0 ? (
            <OpsEmpty message="Nothing is blocked. Every scheduled mission has what it needs." />
          ) : (
            <div className="space-y-2.5">
              {snapshot.blockedNow.map((row) => (
                <div key={`${row.workspaceId}-${row.taskId}`} className="rounded-xl border border-amber-500/15 bg-amber-500/[0.06] p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-white">
                        {row.automationName || 'Untitled mission'}
                      </p>
                      <p className="truncate text-xs text-slate-500">{row.workspaceName}</p>
                    </div>
                    <span className="shrink-0 text-[11px] text-slate-500">{formatDate(row.blockedAt)}</span>
                  </div>
                  <div className="mt-2.5 flex flex-wrap gap-1.5">
                    {(row.blockerLabels.length > 0
                      ? row.blockerLabels
                      : row.blockerKeys.map(blockerKeyLabel)
                    ).map((label) => (
                      <span
                        key={label}
                        className="inline-flex items-center rounded-full border border-amber-500/25 bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-100"
                      >
                        Connect {label}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </OpsSection>

        <OpsSection
          title="Reviews waiting"
          detail="Approvals nobody has acted on. Oldest first — the longest wait is the one to clear."
          icon={ListChecks}
          tone={snapshot.waitingReviews.length > 0 ? 'urgent' : 'good'}
          count={snapshot.waitingReviews.length}
        >
          {snapshot.waitingReviews.length === 0 ? (
            <OpsEmpty message="No review is waiting. The approval queue is clear." />
          ) : (
            <div className="space-y-2.5">
              {snapshot.waitingReviews.map((row) => (
                <div key={row.runId} className="rounded-xl border border-navy-800 bg-navy-950/45 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-white">
                        {row.missionName || 'Untitled mission'}
                      </p>
                      <p className="truncate text-xs text-slate-500">{row.workspaceName}</p>
                    </div>
                    <span className="shrink-0 rounded-full border border-amber-500/25 bg-amber-500/10 px-2 py-0.5 text-[11px] font-semibold text-amber-100">
                      {formatWaitingFor(row.waitingHours)}
                    </span>
                  </div>
                  <p className="mt-2 text-[11px] text-slate-600">Waiting since {formatDate(row.waitingSince)}</p>
                </div>
              ))}
            </div>
          )}
        </OpsSection>
      </div>

      {/* ── 2. What broke ────────────────────────────────────────────────── */}
      <OpsSection
        title="What broke"
        detail={`Failed runs in the ${windowLabel}. "Not connected" is a setup gap, not a product fault — it is counted separately from the rest.`}
        icon={AlertTriangle}
        tone={snapshot.recentFailures.total > 0 ? 'urgent' : 'good'}
        count={snapshot.recentFailures.total}
      >
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          {FAILURE_KIND_ORDER.map((kind) => (
            <div key={kind} className={`rounded-xl border px-3 py-2.5 ${failureKindClasses(kind)}`}>
              <p className="text-[10px] font-medium uppercase tracking-[0.16em] opacity-80">
                {failureKindLabel(kind)}
              </p>
              <p className="mt-1.5 text-lg font-semibold tracking-tight">
                {formatNumber(failureCounts[kind] || 0)}
              </p>
            </div>
          ))}
        </div>

        {snapshot.recentFailures.items.length === 0 ? (
          <div className="mt-4">
            <OpsEmpty message={`No run failed in the ${windowLabel}.`} />
          </div>
        ) : (
          <div className="mt-4 space-y-2.5">
            {snapshot.recentFailures.items.slice(0, 12).map((run) => (
              <div key={run.runId} className="rounded-xl border border-navy-800 bg-navy-950/45 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-white">
                      {run.automationName || 'Untitled mission'}
                    </p>
                    <p className="truncate text-xs text-slate-500">{run.workspaceName}</p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1.5">
                    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${failureKindClasses(run.failureKind)}`}>
                      {failureKindLabel(run.failureKind)}
                    </span>
                    <span className="text-[11px] text-slate-600">
                      {formatDate(run.finishedAt || run.startedAt)}
                    </span>
                  </div>
                </div>
                <p className="mt-2 text-xs leading-5 text-slate-400">{run.failureSummary}</p>
              </div>
            ))}
            {snapshot.recentFailures.total > snapshot.recentFailures.items.length ? (
              <p className="text-[11px] text-slate-600">
                Showing {formatNumber(snapshot.recentFailures.items.length)} of{' '}
                {formatNumber(snapshot.recentFailures.total)} failures in the {windowLabel}.
              </p>
            ) : null}
          </div>
        )}
      </OpsSection>

      {/* ── 3. What is degrading ─────────────────────────────────────────── */}
      <OpsSection
        title="Degrading automations"
        detail="Scheduled missions failing repeatedly or paused. These fail quietly — nobody is watching them but this panel."
        icon={PauseCircle}
        tone={snapshot.automationHealth.length > 0 ? 'warn' : 'good'}
        count={snapshot.automationHealth.length}
      >
        {snapshot.automationHealth.length === 0 ? (
          <OpsEmpty message="Every scheduled automation is active and its last run held." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="border-b border-navy-800 text-[11px] uppercase tracking-[0.14em] text-slate-500">
                <tr>
                  <th className="px-3 py-2 font-semibold">Automation</th>
                  <th className="px-3 py-2 font-semibold">Workspace</th>
                  <th className="px-3 py-2 font-semibold">State</th>
                  <th className="px-3 py-2 font-semibold">Consecutive failures</th>
                  <th className="px-3 py-2 font-semibold">Last run</th>
                  <th className="px-3 py-2 font-semibold">Next run</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-navy-800/80">
                {snapshot.automationHealth.map((automation) => (
                  <tr key={automation.automationId}>
                    <td className="px-3 py-2.5 font-medium text-white">{automation.name}</td>
                    <td className="px-3 py-2.5 text-slate-400">{automation.workspaceName}</td>
                    <td className="px-3 py-2.5">
                      <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${
                        automation.paused
                          ? 'border-slate-600/50 bg-slate-800/50 text-slate-300'
                          : 'border-amber-500/25 bg-amber-500/10 text-amber-200'
                      }`}>
                        {automation.paused ? 'Paused' : 'Active'}
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className={automation.consecutiveFailures > 0 ? 'font-semibold text-red-200' : 'text-slate-400'}>
                        {formatNumber(automation.consecutiveFailures)}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-slate-500">
                      {formatDate(automation.lastRunAt)}
                      {automation.lastRunStatus ? ` · ${automation.lastRunStatus}` : ''}
                    </td>
                    <td className="px-3 py-2.5 text-slate-500">
                      {automation.paused ? 'Not scheduled' : formatDate(automation.nextRunAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </OpsSection>

      {/* ── 4. Funnel ────────────────────────────────────────────────────── */}
      <div className="grid gap-5 xl:grid-cols-2">
        <OpsSection
          title="Activation funnel"
          detail={`Trailing ${telemetry.window.trailingDays} days. Activated means a run actually succeeded, not merely started.`}
          icon={Gauge}
        >
          <div className="grid gap-2 sm:grid-cols-2">
            <StatTile label="Signed up" value={formatNumber(telemetry.activation.signedUp)} />
            <StatTile
              label="Connected a source"
              value={formatNumber(telemetry.activation.connectedAtLeastOneSource)}
              detail={`${formatRate(telemetry.activation.connectRatePct)} of signups`}
            />
            <StatTile
              label="Reached first run"
              value={formatNumber(telemetry.activation.reachedFirstRun)}
              detail={`${formatRate(telemetry.activation.firstRunRatePct)} of signups`}
            />
            <StatTile
              label="Reached first delivery"
              value={formatNumber(telemetry.activation.reachedFirstDelivery)}
              detail={`${formatRate(telemetry.activation.firstDeliveryRatePct)} of signups`}
            />
          </div>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            <StatTile
              label="Median time to delivery"
              value={
                telemetry.activation.medianHoursToFirstDelivery === null
                  ? 'No data'
                  : formatWaitingFor(telemetry.activation.medianHoursToFirstDelivery)
              }
              detail="From signup to a first approved delivery"
            />
            <StatTile
              label="Stalled workspaces"
              value={formatNumber(telemetry.activation.stalledWorkspaceCount)}
              detail="Signed up, never delivered — the actionable end"
            />
          </div>
        </OpsSection>

        <OpsSection
          title="Stage funnel"
          detail="Where the base stands with us. Stages are derived from billing, access, and ledger truth."
          icon={Users}
        >
          <div className="space-y-2">
            {telemetry.stageFunnel.byStage.map((bucket) => (
              <div key={bucket.stage} className="flex items-center justify-between gap-3 rounded-lg border border-navy-800 bg-navy-950/40 px-3 py-2">
                <p className="text-xs font-medium text-slate-200">{accountStageLabel(bucket.stage)}</p>
                <p className="text-xs text-slate-400">
                  <span className="font-semibold text-white">{formatNumber(bucket.accounts)}</span>
                  {' · '}
                  {formatNumber(bucket.activated)} activated ({formatRate(bucket.activationRatePct)})
                </p>
              </div>
            ))}
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <StatTile label="Trial grants issued" value={formatNumber(telemetry.stageFunnel.trialGranted)} />
            <StatTile
              label="Trial to paying"
              value={formatRate(telemetry.stageFunnel.trialToPayingConversionPct)}
              detail={`${formatNumber(telemetry.stageFunnel.trialConvertedToPaying)} converted`}
            />
          </div>
          {telemetry.stageFunnel.byParticipantType.length > 0 ? (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {telemetry.stageFunnel.byParticipantType.map((bucket) => (
                <span
                  key={bucket.participantType}
                  className="inline-flex items-center gap-1.5 rounded-full border border-navy-700 bg-navy-950/60 px-2.5 py-1 text-[11px] text-slate-400"
                >
                  {participantTypeLabel(bucket.participantType)}
                  <span className="font-semibold text-slate-200">{formatNumber(bucket.accounts)}</span>
                </span>
              ))}
            </div>
          ) : null}
        </OpsSection>
      </div>

      {/* ── 5. Reliability ───────────────────────────────────────────────── */}
      <div className="grid gap-5 xl:grid-cols-2">
        <OpsSection
          title="Reliability by workflow"
          detail="Blocked runs are reported beside the success rate, never folded into it."
          icon={Activity}
        >
          {telemetry.reliability.byWorkflowId.length === 0 ? (
            <OpsEmpty message="No runs recorded in the telemetry window." />
          ) : (
            <div className="space-y-2">
              {telemetry.reliability.byWorkflowId.map((workflow) => (
                <div key={workflow.workflowId} className="rounded-lg border border-navy-800 bg-navy-950/40 px-3 py-2.5">
                  <div className="flex items-center justify-between gap-3">
                    <p className="min-w-0 truncate text-xs font-medium text-slate-200">{workflow.workflowId}</p>
                    <p className="shrink-0 text-xs font-semibold text-white">
                      {formatRate(workflow.successRatePct)}
                    </p>
                  </div>
                  <p className="mt-1 text-[11px] text-slate-500">
                    {formatNumber(workflow.runs)} runs · {formatNumber(workflow.succeeded)} ok ·{' '}
                    {formatNumber(workflow.failed)} failed · {formatNumber(workflow.blocked)} blocked
                  </p>
                </div>
              ))}
            </div>
          )}

          {telemetry.reliability.topBlockers.length > 0 ? (
            <div className="mt-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                Most common blockers
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {telemetry.reliability.topBlockers.map((blocker) => (
                  <span
                    key={blocker.key}
                    className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/20 bg-amber-500/[0.08] px-2.5 py-1 text-[11px] text-amber-100"
                  >
                    {blockerKeyLabel(blocker.key)}
                    <span className="font-semibold">{formatNumber(blocker.count)}</span>
                    <span className="text-amber-200/60">/ {formatNumber(blocker.workspaces)} ws</span>
                  </span>
                ))}
              </div>
            </div>
          ) : null}
        </OpsSection>

        <OpsSection
          title="Review outcomes and burn"
          detail="What reviewers decided, and what a run actually costs."
          icon={WalletCards}
        >
          <div className="grid gap-2 sm:grid-cols-2">
            <StatTile label="Approved" value={formatNumber(telemetry.review.approved)} />
            <StatTile
              label="Changes requested"
              value={formatNumber(telemetry.review.changesRequested)}
              detail={`${formatRate(telemetry.review.correctionRatePct)} correction rate`}
            />
            <StatTile label="Rejected" value={formatNumber(telemetry.review.rejected)} />
            <StatTile
              label="Blocked as fabricated"
              value={formatNumber(telemetry.review.blockedFabricated)}
              detail="Delivery refused for simulated evidence"
            />
          </div>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            <StatTile
              label="Credits per run (p50)"
              value={
                telemetry.creditBurn.p50CreditsPerRun === null
                  ? 'No data'
                  : formatCredits(telemetry.creditBurn.p50CreditsPerRun)
              }
              detail={`${formatNumber(telemetry.creditBurn.chargedRuns)} charged runs`}
            />
            <StatTile
              label="Credits per run (p90)"
              value={
                telemetry.creditBurn.p90CreditsPerRun === null
                  ? 'No data'
                  : formatCredits(telemetry.creditBurn.p90CreditsPerRun)
              }
              detail={`${formatCredits(telemetry.creditBurn.totalSpentCredits)} spent total`}
            />
          </div>
        </OpsSection>
      </div>

      {/* ── 6. Week over week ────────────────────────────────────────────── */}
      {telemetry.deltasVsPriorWeek.length > 0 ? (
        <OpsSection
          title="Versus the prior week"
          detail={`This window (${telemetry.window.from.slice(0, 10)} to ${telemetry.window.to.slice(0, 10)}) against the one before it.`}
          icon={TrendingUp}
        >
          <div className="grid gap-2 lg:grid-cols-2">
            {telemetry.deltasVsPriorWeek.map((delta) => (
              <DeltaRow key={delta.metric} {...delta} />
            ))}
          </div>
        </OpsSection>
      ) : null}

      {/* ── 7. Connections and terms ─────────────────────────────────────── */}
      <div className="grid gap-5 xl:grid-cols-2">
        <OpsSection
          title="Connections by workspace"
          detail={
            snapshot.integrations.partnerEnabled
              ? 'A degraded row means the lookup could not answer — not that nothing is connected.'
              : 'The partner connection bridge is off, so only workspace-configured native integrations are listed.'
          }
          icon={Link2}
          tone={snapshot.integrations.degradedWorkspaces > 0 ? 'warn' : 'neutral'}
        >
          {snapshot.integrations.degradedWorkspaces > 0 ? (
            <p className="mb-3 rounded-lg border border-amber-500/20 bg-amber-500/[0.08] px-3 py-2 text-xs text-amber-100">
              {formatNumber(snapshot.integrations.degradedWorkspaces)} workspace(s) could not be
              checked. Treat those rows as unknown, not empty.
            </p>
          ) : null}
          {snapshot.integrations.byWorkspace.length === 0 ? (
            <OpsEmpty message="No workspace is in scope." />
          ) : (
            <div className="space-y-2">
              {snapshot.integrations.byWorkspace.map((row) => {
                const connections = [
                  ...row.connectedToolkits,
                  ...row.workspaceConfiguredIntegrations,
                ];
                return (
                  <div key={row.workspaceId} className="rounded-lg border border-navy-800 bg-navy-950/40 px-3 py-2.5">
                    <div className="flex items-center justify-between gap-3">
                      <p className="min-w-0 truncate text-xs font-medium text-slate-200">{row.workspaceName}</p>
                      {row.degraded ? (
                        <span className="shrink-0 rounded-full border border-amber-500/25 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-100">
                          Lookup degraded
                        </span>
                      ) : (
                        <span className="shrink-0 text-[11px] text-slate-500">
                          {formatNumber(connections.length)} connected
                        </span>
                      )}
                    </div>
                    {connections.length > 0 ? (
                      <p className="mt-1.5 truncate text-[11px] text-slate-500">
                        {connections.map(blockerKeyLabel).join(', ')}
                      </p>
                    ) : !row.degraded ? (
                      <p className="mt-1.5 text-[11px] text-slate-600">Nothing connected yet.</p>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
        </OpsSection>

        <OpsSection
          title="Beta terms coverage"
          detail="An account counts as current only when the record names today's version AND a consent receipt exists for it."
          icon={FileClock}
          tone={snapshot.termsStaleness.staleCount > 0 ? 'warn' : 'good'}
        >
          <div className="grid gap-2 sm:grid-cols-3">
            <StatTile label="Current" value={formatNumber(snapshot.termsStaleness.currentCount)} />
            <StatTile
              label="Stale"
              value={formatNumber(snapshot.termsStaleness.staleCount)}
              detail="Accepted an older version"
            />
            <StatTile
              label="Never accepted"
              value={formatNumber(snapshot.termsStaleness.neverAcceptedCount)}
            />
          </div>
          <p className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
            {snapshot.termsStaleness.staleCount === 0
              ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-300" />
              : <Clock3 className="h-3.5 w-3.5 text-amber-300" />}
            Current version
            <span className="font-mono text-slate-400">{snapshot.termsStaleness.currentVersion}</span>
            · {formatNumber(snapshot.termsStaleness.totalAccounts)} accounts
          </p>
        </OpsSection>
      </div>
    </div>
  );
}

export default AdminOperationsPanel;
