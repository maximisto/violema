import type { MissionWorkspaceView } from './types';

interface MissionReviewsProps {
  mission: MissionWorkspaceView;
  preflight?: {
    ready: boolean;
    summary: string;
    blockers: Array<{ key: string; label: string; detail: string }>;
    warnings?: Array<{ key: string; label: string; detail: string }>;
  };
  busyAction?: 'approve' | 'changes' | 'rerun' | null;
  onApproveDelivery?: () => void;
  onRequestChanges?: () => void;
  onRerunFailedStep?: () => void;
}

export function MissionReviews({
  mission,
  preflight,
  busyAction = null,
  onApproveDelivery,
  onRequestChanges,
  onRerunFailedStep,
}: MissionReviewsProps) {
  const canAct = mission.status === 'waiting_review';
  const hasBlockers = Boolean(preflight && !preflight.ready && preflight.blockers.length > 0);
  const warnings = preflight?.warnings || [];
  const canApprove = canAct && !hasBlockers;
  const deliveryTarget = mission.deliveryLabel || 'configured target';

  return (
    <section className="space-y-4">
      {hasBlockers ? (
        <div className="rounded-lg border border-red-400/25 bg-red-500/10 p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-red-200/80">Preflight blocked</p>
              <h3 className="mt-1 text-sm font-semibold text-white">{preflight?.summary}</h3>
            </div>
            <span className="rounded-full border border-red-300/20 bg-red-300/10 px-2 py-0.5 text-[10px] font-semibold text-red-100">
              Fix before run
            </span>
          </div>
          <div className="mt-3 space-y-2">
            {preflight?.blockers.map((item) => (
              <div key={item.key} className="rounded-md border border-red-300/15 bg-navy-950/45 p-3">
                <p className="text-[11px] font-semibold text-red-100">{item.label}</p>
                <p className="mt-1 text-[10px] leading-4 text-slate-400">{item.detail}</p>
                <p className="mt-2 font-mono text-[10px] text-red-200/80">{item.key}</p>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {!hasBlockers && warnings.length > 0 ? (
        <div className="rounded-lg border border-amber-400/20 bg-amber-400/8 p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-amber-200/80">Preflight watch</p>
              <h3 className="mt-1 text-sm font-semibold text-white">{preflight?.summary}</h3>
            </div>
            <span className="rounded-full border border-amber-300/20 bg-amber-300/10 px-2 py-0.5 text-[10px] font-semibold text-amber-100">
              Check on send
            </span>
          </div>
          <div className="mt-3 space-y-2">
            {warnings.map((item) => (
              <div key={item.key} className="rounded-md border border-amber-300/15 bg-navy-950/45 p-3">
                <p className="text-[11px] font-semibold text-amber-100">{item.label}</p>
                <p className="mt-1 text-[10px] leading-4 text-slate-400">{item.detail}</p>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div className="rounded-lg border border-signal-400/30 bg-signal-400/10 p-4">
        <p className="text-[10px] font-medium text-signal-300">Review gate</p>
        <h3 className="mt-1 text-base font-semibold leading-snug text-white">{mission.title}</h3>
        <p className="mt-2 text-sm leading-6 text-slate-300">{mission.reviewSummary}</p>
        <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3 lg:grid-cols-1 2xl:grid-cols-3">
          {[
            { label: 'Run', value: canAct ? 'Complete' : mission.statusLabel, detail: mission.lastRunLabel },
            { label: 'Delivery', value: canAct ? 'Not sent' : deliveryTarget, detail: canAct ? `Held for ${deliveryTarget}` : 'Uses mission policy' },
            { label: 'Next', value: canAct ? 'Approve or revise' : 'No action', detail: canAct ? 'Approval sends the Slack message.' : 'No review gate is open.' },
          ].map((item) => (
            <div key={item.label} className="rounded-lg border border-white/10 bg-navy-950/42 px-3 py-2.5">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">{item.label}</p>
              <p className="mt-1 text-[12px] font-semibold text-white">{item.value}</p>
              <p className="mt-1 truncate text-[10px] text-slate-500" title={item.detail}>{item.detail}</p>
            </div>
          ))}
        </div>
        <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3 lg:grid-cols-1 2xl:grid-cols-3">
          <button
            type="button"
            disabled={!canApprove || !onApproveDelivery || busyAction !== null}
            title={hasBlockers ? 'Resolve preflight blockers before approving delivery.' : canAct ? 'Approve and deliver the prepared output.' : 'Approval is available when a mission is waiting for review.'}
            onClick={onApproveDelivery}
            className="rounded-lg border border-green-400/25 bg-green-400/10 px-3 py-2 text-[11px] font-semibold text-green-100 transition hover:border-green-300/45 hover:bg-green-400/15 disabled:cursor-not-allowed disabled:text-green-200/45 disabled:opacity-60"
          >
            {busyAction === 'approve' ? 'Approving...' : 'Approve delivery'}
          </button>
          <button
            type="button"
            disabled={!canAct || !onRequestChanges || busyAction !== null}
            title={canAct ? 'Hold delivery and send instructions back to the mission.' : 'Change requests are available when a mission is waiting for review.'}
            onClick={onRequestChanges}
            className="rounded-lg border border-amber-400/25 bg-amber-400/10 px-3 py-2 text-[11px] font-semibold text-amber-100 transition hover:border-amber-300/45 hover:bg-amber-400/15 disabled:cursor-not-allowed disabled:text-amber-200/45 disabled:opacity-60"
          >
            {busyAction === 'changes' ? 'Saving...' : 'Request changes'}
          </button>
          <button
            type="button"
            disabled={!onRerunFailedStep || busyAction !== null}
            title="Start a fresh mission run from this workflow."
            onClick={onRerunFailedStep}
            className="rounded-lg border border-cyan-400/25 bg-cyan-400/10 px-3 py-2 text-[11px] font-semibold text-cyan-100 transition hover:border-cyan-300/45 hover:bg-cyan-400/15 disabled:cursor-not-allowed disabled:text-cyan-200/45 disabled:opacity-60"
          >
            {busyAction === 'rerun' ? 'Requesting...' : 'Rerun mission'}
          </button>
        </div>
        <p className="mt-3 text-[10px] leading-4 text-slate-500">
          Review actions create a run receipt with reviewer, delivery target, and delivery proof.
        </p>
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between gap-3">
          <h4 className="text-[12px] font-semibold text-slate-100">Evidence</h4>
          <span className="text-[11px] text-slate-600">{mission.evidence.length} items</span>
        </div>
        {mission.evidence.length > 0 ? (
          <div className="space-y-2">
            {mission.evidence.map((item) => (
              <article key={item.id} className="rounded-lg border border-navy-700/70 bg-navy-950/50 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-semibold text-white" title={item.label}>
                      {item.label}
                    </p>
                    <p className="mt-1 truncate text-[10px] text-cyan-200/80" title={item.source}>
                      Source: {item.source}
                    </p>
                  </div>
                  <span className="flex-shrink-0 rounded-full border border-cyan-400/20 bg-cyan-400/10 px-2 py-0.5 text-[10px] font-medium text-cyan-200">
                    Reviewable
                  </span>
                </div>
                <p className="mt-2 text-[11px] leading-5 text-slate-500">{item.detail}</p>
              </article>
            ))}
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-navy-700/70 bg-navy-950/40 p-4 text-sm leading-6 text-slate-500">
            No evidence is attached yet. Approval should wait until the mission stores proof or a reviewer adds context.
          </div>
        )}
      </div>
    </section>
  );
}
