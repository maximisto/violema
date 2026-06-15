import Compass from 'lucide-react/dist/esm/icons/compass.js';
import History from 'lucide-react/dist/esm/icons/history.js';
import Sparkles from 'lucide-react/dist/esm/icons/sparkles.js';
import type { AgentStudioOperationalContext } from '../contract';
import type { WorkflowBlockKind } from '../types';

interface LiveOperatorBriefSectionProps {
  context: AgentStudioOperationalContext | null;
  loading: boolean;
  referenceLabel: string;
  onOpenRun: (runId: string) => void;
  onFocusPhase: (phase: WorkflowBlockKind) => void;
  formatDirectivePhaseScope: (phases: WorkflowBlockKind[]) => string;
  formatRelativeTimeFromIso: (value?: string) => string;
  getStatusTone: (status: string) => string;
}

export function LiveOperatorBriefSection({
  context,
  loading,
  referenceLabel,
  onOpenRun,
  onFocusPhase,
  formatDirectivePhaseScope,
  formatRelativeTimeFromIso,
  getStatusTone,
}: LiveOperatorBriefSectionProps) {
  const primaryEvidence = context?.recommendationEvidence[0];
  const strongestMatch = context?.similarRuns[0];
  const baseline = context?.lastHealthyComparison;
  const relatedRunId = primaryEvidence?.relatedRunIds?.find((runId) => runId !== context?.runId)
    || strongestMatch?.runId
    || baseline?.runId;
  const primaryActionLabel = relatedRunId === baseline?.runId
    ? 'Compare to last healthy run'
    : relatedRunId === strongestMatch?.runId
      ? 'Open closest match in Replay'
      : 'Open supporting run in Replay';

  return (
    <div className="rounded-[1.75rem] border border-violet-500/18 bg-gradient-to-br from-violet-500/8 via-navy-900/72 to-navy-950/92 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <Compass className="h-4 w-4 text-violet-200" />
          <div>
            <p className="text-[10px] uppercase tracking-[0.18em] text-violet-200/80">Operator brief</p>
            <h3 className="text-sm font-semibold text-white">What Studio thinks matters right now</h3>
          </div>
        </div>
        <span className="rounded-full border border-white/8 bg-white/[0.04] px-2.5 py-1 text-[10px] uppercase tracking-[0.16em] text-slate-300">
          {referenceLabel}
        </span>
      </div>
      <p className="mt-2 text-[13px] leading-relaxed text-slate-400">
        Start here. Studio narrows the room to one next move, one useful comparison, and one place to focus.
      </p>

      {loading ? (
        <div className="mt-4 rounded-2xl border border-dashed border-navy-700/70 bg-navy-950/35 p-4 text-sm text-slate-500">
          Loading the strongest historical signal for this workflow…
        </div>
      ) : !context ? (
        <div className="mt-4 rounded-2xl border border-dashed border-navy-700/70 bg-navy-950/35 p-4 text-sm text-slate-500">
          Not enough completed history yet. Once this workflow has more finished runs, Studio will start surfacing the best analogue, the last healthy anchor, and the likely next move here.
        </div>
      ) : (
        <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)] xl:items-start">
          <div className="rounded-[1.45rem] border border-violet-400/16 bg-violet-500/5 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] uppercase tracking-[0.18em] text-violet-200/80">Best next move</p>
                <h4 className="mt-1 text-base font-semibold text-white">
                  {primaryEvidence?.title || 'No strong historical warning surfaced'}
                </h4>
              </div>
              {primaryEvidence?.phase ? (
                <button
                  type="button"
                  onClick={() => onFocusPhase(primaryEvidence.phase as WorkflowBlockKind)}
                  className="ui-pill px-3 py-1.5 text-[11px] normal-case tracking-normal text-violet-200"
                >
                  Focus {formatDirectivePhaseScope([primaryEvidence.phase as WorkflowBlockKind])}
                </button>
              ) : null}
            </div>
            <p className="mt-3 text-sm leading-relaxed text-slate-300">
              {primaryEvidence?.body || 'Studio does not yet have enough evidence to recommend a stronger move. Keep the next change small and confirm it with the next run.'}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {relatedRunId ? (
                <button
                  type="button"
                  onClick={() => onOpenRun(relatedRunId)}
                  className="rounded-2xl border border-violet-400/18 bg-violet-500/10 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-violet-500/14"
                >
                  {primaryActionLabel}
                </button>
              ) : null}
              {strongestMatch?.runId && strongestMatch.runId !== relatedRunId ? (
                <button
                  type="button"
                  onClick={() => onOpenRun(strongestMatch.runId)}
                  className="ui-pill px-3 py-1.5 text-[11px] normal-case tracking-normal text-slate-300"
                >
                  Inspect closest match
                </button>
              ) : null}
            </div>
          </div>

          <div className="space-y-3">
            <div className="rounded-[1.35rem] border border-white/6 bg-white/[0.03] p-4">
              <div className="flex items-center gap-2">
                <History className="h-4 w-4 text-cyan-300" />
                <div>
                  <p className="text-[10px] uppercase tracking-[0.16em] text-slate-500">Closest earlier run</p>
                  <p className="mt-1 text-sm font-medium text-white">
                    {strongestMatch ? strongestMatch.label : 'No strong analogue yet'}
                  </p>
                </div>
              </div>
              {strongestMatch ? (
                <>
                  <div className="mt-3 flex items-center justify-between gap-3">
                    <p className="text-[11px] text-slate-500">{formatRelativeTimeFromIso(strongestMatch.finishedAt || strongestMatch.startedAt)}</p>
                    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${getStatusTone(strongestMatch.status)}`}>
                      {strongestMatch.status}
                    </span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {strongestMatch.matchedSignals.slice(0, 2).map((signal) => (
                      <span key={`${strongestMatch.runId}-${signal}`} className="ui-pill px-2 py-0.5 normal-case tracking-normal text-cyan-200">
                        {signal}
                      </span>
                    ))}
                  </div>
                </>
              ) : (
                <p className="mt-3 text-sm leading-relaxed text-slate-500">
                  This workflow has not accumulated a clear historical analogue yet.
                </p>
              )}
            </div>

            <div className="rounded-[1.35rem] border border-white/6 bg-white/[0.03] p-4">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-emerald-300" />
                <div>
                  <p className="text-[10px] uppercase tracking-[0.16em] text-slate-500">Last healthy anchor</p>
                  <p className="mt-1 text-sm font-medium text-white">
                    {baseline ? baseline.label : 'No earlier healthy anchor'}
                  </p>
                </div>
              </div>
              {baseline ? (
                <>
                  <p className="mt-3 text-sm leading-relaxed text-slate-300">{baseline.summary}</p>
                  <p className="mt-2 text-[11px] text-slate-500">{formatRelativeTimeFromIso(baseline.finishedAt || baseline.startedAt)}</p>
                </>
              ) : (
                <p className="mt-3 text-sm leading-relaxed text-slate-500">
                  Studio has not found a stronger healthy baseline for this workflow yet.
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
