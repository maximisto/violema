import type { MissionWorkspaceView } from './types';

interface MissionReviewsProps {
  mission: MissionWorkspaceView;
}

export function MissionReviews({ mission }: MissionReviewsProps) {
  return (
    <section className="space-y-4">
      <div className="rounded-lg border border-signal-400/30 bg-signal-400/10 p-4">
        <p className="text-[10px] font-medium text-signal-300">Review gate</p>
        <h3 className="mt-1 text-base font-semibold leading-snug text-white">{mission.title}</h3>
        <p className="mt-2 text-sm leading-6 text-slate-300">{mission.reviewSummary}</p>
        <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3 lg:grid-cols-1 2xl:grid-cols-3">
          <button
            type="button"
            disabled
            title="Approval actions will be enabled when review workflows are wired."
            className="cursor-not-allowed rounded-lg border border-green-400/20 bg-green-400/10 px-3 py-2 text-[11px] font-semibold text-green-200/70 opacity-70"
          >
            Approve delivery
          </button>
          <button
            type="button"
            disabled
            title="Change requests will be enabled when review workflows are wired."
            className="cursor-not-allowed rounded-lg border border-amber-400/20 bg-amber-400/10 px-3 py-2 text-[11px] font-semibold text-amber-200/70 opacity-70"
          >
            Request changes
          </button>
          <button
            type="button"
            disabled
            title="Step reruns will be enabled when review workflows are wired."
            className="cursor-not-allowed rounded-lg border border-cyan-400/20 bg-cyan-400/10 px-3 py-2 text-[11px] font-semibold text-cyan-200/70 opacity-70"
          >
            Rerun failed step
          </button>
        </div>
        <p className="mt-3 text-[10px] leading-4 text-slate-500">
          Approval controls are shown here as the review surface; execution wiring comes next.
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
