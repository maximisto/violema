import Activity from 'lucide-react/dist/esm/icons/activity.js';
import Clock3 from 'lucide-react/dist/esm/icons/clock-3.js';
import Sparkles from 'lucide-react/dist/esm/icons/sparkles.js';
import type { AgentStudioOperationalContext } from '../contract';
import type { WorkflowBlockKind } from '../types';

interface OperationalContextMapSectionProps {
  context: AgentStudioOperationalContext | null;
  loading: boolean;
  onOpenRun: (runId: string) => void;
  onFocusPhase: (phase: WorkflowBlockKind) => void;
  formatCredits: (value: number) => string;
  formatCompactDuration: (value?: number) => string;
  formatRelativeTimeFromIso: (value?: string) => string;
  formatDirectivePhaseScope: (phases: WorkflowBlockKind[]) => string;
  formatSignedDelta: (value: number) => string;
  getStatusTone: (status: string) => string;
}

export function OperationalContextMapSection({
  context,
  loading,
  onOpenRun,
  onFocusPhase,
  formatCredits,
  formatCompactDuration,
  formatRelativeTimeFromIso,
  formatDirectivePhaseScope,
  formatSignedDelta,
  getStatusTone,
}: OperationalContextMapSectionProps) {
  return (
    <div className="rounded-[1.8rem] border border-navy-800/80 bg-gradient-to-b from-navy-900/72 via-navy-900/56 to-navy-950/88 p-5">
      <div className="flex items-center gap-2">
        <Activity className="h-4 w-4 text-cyan-300" />
        <div>
          <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Operational context map</p>
          <h3 className="text-sm font-semibold text-white">What history says about this run</h3>
        </div>
      </div>
      <p className="mt-2 text-sm leading-relaxed text-slate-400">
        Use this to answer three questions quickly: have we seen this shape before, what changed since the last healthy state, and why Studio is recommending the next move.
      </p>

      {loading ? (
        <div className="mt-4 rounded-2xl border border-dashed border-navy-700/70 bg-navy-950/35 p-4 text-sm text-slate-500">
          Loading historical evidence…
        </div>
      ) : !context ? (
        <div className="mt-4 rounded-2xl border border-dashed border-navy-700/70 bg-navy-950/35 p-4 text-sm text-slate-500">
          No historical context yet. Once this workflow has a few completed runs, Studio will start connecting current replay to earlier evidence.
        </div>
      ) : (
        <div className="mt-4 grid gap-4 xl:grid-cols-3 xl:items-start">
          <div className="rounded-2xl border border-white/6 bg-white/[0.03] p-4">
            <div className="flex items-center gap-2">
              <Clock3 className="h-4 w-4 text-cyan-300" />
              <div>
                <p className="text-[10px] uppercase tracking-[0.16em] text-slate-500">Similar runs</p>
                <p className="mt-1 text-sm font-medium text-white">Have we seen this before?</p>
              </div>
            </div>
            <div className="mt-4 space-y-3">
              {context.similarRuns.length > 0 ? context.similarRuns.map((run) => (
                <button
                  key={`context-run-${run.runId}`}
                  type="button"
                  onClick={() => onOpenRun(run.runId)}
                  className="block w-full rounded-2xl border border-navy-700/70 bg-navy-950/45 p-4 text-left transition-colors hover:border-cyan-500/18 hover:bg-navy-900/55"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-white">{run.label}</p>
                      <p className="mt-1 text-[11px] text-slate-500">{formatRelativeTimeFromIso(run.finishedAt || run.startedAt)}</p>
                    </div>
                    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${getStatusTone(run.status)}`}>
                      {run.status}
                    </span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2 text-[10px] text-slate-300">
                    <span className="ui-pill px-2 py-0.5 normal-case tracking-normal text-slate-300">{run.similarityScore} similarity</span>
                    {typeof run.actualCredits === 'number' ? (
                      <span className="ui-pill px-2 py-0.5 normal-case tracking-normal text-slate-300">
                        {formatCredits(run.actualCredits)} cr
                      </span>
                    ) : null}
                    {typeof run.durationMs === 'number' ? (
                      <span className="ui-pill px-2 py-0.5 normal-case tracking-normal text-slate-300">
                        {formatCompactDuration(run.durationMs)}
                      </span>
                    ) : null}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {run.matchedSignals.map((signal) => (
                      <span key={`${run.runId}-${signal}`} className="ui-pill px-2 py-0.5 normal-case tracking-normal text-cyan-200">
                        {signal}
                      </span>
                    ))}
                  </div>
                </button>
              )) : (
                <div className="rounded-xl border border-dashed border-navy-700/70 bg-navy-950/35 p-3 text-sm text-slate-500">
                  No similar runs surfaced yet.
                </div>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-white/6 bg-white/[0.03] p-4">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-emerald-300" />
              <div>
                <p className="text-[10px] uppercase tracking-[0.16em] text-slate-500">Last healthy baseline</p>
                <p className="mt-1 text-sm font-medium text-white">What changed since things were healthy?</p>
              </div>
            </div>
            {context.lastHealthyComparison ? (
              <div className="mt-4">
                <button
                  type="button"
                  onClick={() => onOpenRun(context.lastHealthyComparison!.runId)}
                  className="text-left"
                >
                  <p className="text-sm font-medium text-white">{context.lastHealthyComparison.label}</p>
                  <p className="mt-1 text-[11px] text-slate-500">{formatRelativeTimeFromIso(context.lastHealthyComparison.finishedAt || context.lastHealthyComparison.startedAt)}</p>
                </button>
                <p className="mt-3 text-sm leading-relaxed text-slate-300">{context.lastHealthyComparison.summary}</p>
                <div className="mt-3 flex flex-wrap gap-2 text-[10px] text-slate-300">
                  {typeof context.lastHealthyComparison.creditsDelta === 'number' ? (
                    <span className={`ui-pill px-2 py-0.5 normal-case tracking-normal ${context.lastHealthyComparison.creditsDelta <= 0 ? 'text-emerald-200' : 'text-amber-200'}`}>
                      {formatSignedDelta(context.lastHealthyComparison.creditsDelta)} cr
                    </span>
                  ) : null}
                  {typeof context.lastHealthyComparison.durationDelta === 'number' ? (
                    <span className={`ui-pill px-2 py-0.5 normal-case tracking-normal ${context.lastHealthyComparison.durationDelta <= 0 ? 'text-emerald-200' : 'text-amber-200'}`}>
                      {formatSignedDelta(context.lastHealthyComparison.durationDelta)}s
                    </span>
                  ) : null}
                </div>
                <div className="mt-4 space-y-2">
                  {context.lastHealthyComparison.changedSignals.length > 0 ? context.lastHealthyComparison.changedSignals.map((signal) => (
                    <div key={`healthy-change-${signal}`} className="rounded-xl border border-white/6 bg-white/[0.02] px-3 py-2 text-[11px] text-slate-300">
                      {signal}
                    </div>
                  )) : (
                    <div className="rounded-xl border border-white/6 bg-white/[0.02] px-3 py-2 text-[11px] text-slate-500">
                      No major phase-level drift surfaced against the last healthy run.
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="mt-4 rounded-xl border border-dashed border-navy-700/70 bg-navy-950/35 p-3 text-sm text-slate-500">
                Studio has not found an earlier healthy baseline for this run yet.
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-white/6 bg-white/[0.03] p-4">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-violet-300" />
              <div>
                <p className="text-[10px] uppercase tracking-[0.16em] text-slate-500">Why this recommendation</p>
                <p className="mt-1 text-sm font-medium text-white">What evidence is pushing the next move?</p>
              </div>
            </div>
            <div className="mt-4 space-y-3">
              {context.recommendationEvidence.length > 0 ? context.recommendationEvidence.map((item) => (
                <div key={item.evidenceId} className="rounded-2xl border border-violet-500/14 bg-violet-500/6 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-white">{item.title}</p>
                      <p className="mt-1 text-[11px] uppercase tracking-[0.16em] text-slate-500">{item.sourceLabel}</p>
                    </div>
                    {item.phase ? (
                      <button
                        type="button"
                        onClick={() => onFocusPhase(item.phase as WorkflowBlockKind)}
                        className="ui-pill px-2 py-0.5 text-[10px] normal-case tracking-normal text-violet-200"
                      >
                        {formatDirectivePhaseScope([item.phase as WorkflowBlockKind])}
                      </button>
                    ) : null}
                  </div>
                  <p className="mt-3 text-sm leading-relaxed text-slate-300">{item.body}</p>
                </div>
              )) : (
                <div className="rounded-xl border border-dashed border-navy-700/70 bg-navy-950/35 p-3 text-sm text-slate-500">
                  No recommendation evidence surfaced yet.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
