import { Brain, Sparkles } from 'lucide-react';
import type { StudioExperimentRecord } from '../types';

interface ReplayCausalReportItem {
  title: string;
  body: string;
  tone: string;
}

interface ReplayExperimentPerformanceEntry {
  experiment: StudioExperimentRecord;
  latestAt?: string;
  stats: {
    count: number;
    successRate: number;
    averageCredits?: number;
  };
  score: number;
  confidence: number;
  recencyBoost: number;
}

interface ReplayDecisionSupportSectionProps {
  winnerCausalReport: ReplayCausalReportItem[];
  experimentPerformance: ReplayExperimentPerformanceEntry[];
  selectedComparisonExperimentId?: string;
  winningExperimentId?: string;
  actionBusy: boolean;
  formatCredits: (value: number) => string;
  formatRelativeTimeFromIso: (value?: string) => string;
  getExperimentDisplayLabel: (experiment: StudioExperimentRecord) => string;
  getExperimentTags: (
    experiment: StudioExperimentRecord,
    stats?: { count: number; successRate: number; averageCredits: number },
    isWinning?: boolean,
  ) => string[];
  onCompareExperiment: (experiment: StudioExperimentRecord) => void;
  onPromotePreset: (experiment: StudioExperimentRecord) => void;
  onPromoteSteering: (experiment: StudioExperimentRecord) => void;
  onPromoteFull: (experiment: StudioExperimentRecord) => void;
}

export function ReplayDecisionSupportSection({
  winnerCausalReport,
  experimentPerformance,
  selectedComparisonExperimentId,
  winningExperimentId,
  actionBusy,
  formatCredits,
  formatRelativeTimeFromIso,
  getExperimentDisplayLabel,
  getExperimentTags,
  onCompareExperiment,
  onPromotePreset,
  onPromoteSteering,
  onPromoteFull,
}: ReplayDecisionSupportSectionProps) {
  return (
    <>
      <div className="rounded-[1.8rem] border border-navy-800/80 bg-gradient-to-b from-navy-900/72 via-navy-900/56 to-navy-950/88 p-5">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-violet-300" />
          <div>
            <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Causal report</p>
            <h3 className="text-sm font-semibold text-white">Why the current winner is winning</h3>
          </div>
        </div>
        <div className="mt-4 space-y-3">
          {winnerCausalReport.map((item) => (
            <div key={item.title} className={`rounded-2xl border p-4 ${item.tone}`}>
              <p className="text-sm font-medium text-white">{item.title}</p>
              <p className="mt-2 text-sm leading-relaxed text-slate-200/90">{item.body}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-[1.8rem] border border-navy-800/80 bg-gradient-to-b from-navy-900/72 via-navy-900/56 to-navy-950/88 p-5">
        <div className="flex items-center gap-2">
          <Brain className="h-4 w-4 text-violet-300" />
          <div>
            <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Experiment scorecards</p>
            <h3 className="text-sm font-semibold text-white">How saved setups perform over time</h3>
          </div>
        </div>
        <div className="mt-4 space-y-3">
          {experimentPerformance.length > 0 ? experimentPerformance.map((entry) => (
            <div
              key={entry.experiment.id}
              className={`rounded-2xl border p-3 ${selectedComparisonExperimentId === entry.experiment.id ? 'border-cyan-500/24 bg-cyan-500/8' : 'border-navy-700/70 bg-navy-950/45'}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-white">{getExperimentDisplayLabel(entry.experiment)}</p>
                  <p className="mt-1 text-[11px] text-slate-500">
                    Saved {formatRelativeTimeFromIso(entry.experiment.createdAt)}
                    {entry.latestAt ? ` · observed ${formatRelativeTimeFromIso(entry.latestAt)}` : ''}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2 text-[10px] text-slate-300">
                    {getExperimentTags(
                      entry.experiment,
                      {
                        count: entry.stats.count,
                        successRate: entry.stats.successRate,
                        averageCredits: entry.stats.averageCredits ?? 0,
                      },
                      winningExperimentId === entry.experiment.id,
                    ).map((tag) => (
                      <span key={`${entry.experiment.id}-${tag}`} className="ui-pill px-2 py-0.5 normal-case tracking-normal text-slate-300">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
                <span className="ui-pill px-2 py-0.5 normal-case tracking-normal text-slate-300">score {entry.score}</span>
              </div>
              <div className="mt-3 grid gap-2 sm:grid-cols-4 text-[11px]">
                <div className="rounded-xl border border-navy-700/70 bg-navy-950/55 px-3 py-2"><p className="text-slate-500">Runs</p><p className="mt-1 text-white">{entry.stats.count}</p></div>
                <div className="rounded-xl border border-navy-700/70 bg-navy-950/55 px-3 py-2"><p className="text-slate-500">Success</p><p className="mt-1 text-white">{Math.round(entry.stats.successRate * 100)}%</p></div>
                <div className="rounded-xl border border-navy-700/70 bg-navy-950/55 px-3 py-2"><p className="text-slate-500">Avg credits</p><p className="mt-1 text-white">{entry.stats.averageCredits ? `${formatCredits(entry.stats.averageCredits)} cr` : '—'}</p></div>
                <div className="rounded-xl border border-navy-700/70 bg-navy-950/55 px-3 py-2"><p className="text-slate-500">Confidence</p><p className="mt-1 text-white">{entry.confidence}%</p></div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2 text-[10px] text-slate-300">
                <span className="ui-pill px-2 py-0.5 normal-case tracking-normal text-slate-300">recency +{entry.recencyBoost}</span>
                <span className="ui-pill px-2 py-0.5 normal-case tracking-normal text-slate-300">{entry.stats.count >= 4 ? 'Deep evidence' : entry.stats.count >= 2 ? 'Moderate evidence' : 'Thin evidence'}</span>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <button type="button" onClick={() => onCompareExperiment(entry.experiment)} className="ui-pill px-3 py-1.5 text-[11px] normal-case tracking-normal text-slate-300">Compare</button>
                <button type="button" disabled={actionBusy} onClick={() => onPromotePreset(entry.experiment)} className="ui-pill px-3 py-1.5 text-[11px] normal-case tracking-normal text-emerald-200">Preset</button>
                <button type="button" disabled={actionBusy} onClick={() => onPromoteSteering(entry.experiment)} className="ui-pill px-3 py-1.5 text-[11px] normal-case tracking-normal text-cyan-200">Steering</button>
                <button type="button" disabled={actionBusy} onClick={() => onPromoteFull(entry.experiment)} className="ui-pill px-3 py-1.5 text-[11px] normal-case tracking-normal text-slate-300">Full</button>
              </div>
            </div>
          )) : (
            <div className="rounded-2xl border border-dashed border-navy-700/70 bg-navy-950/35 p-4 text-sm text-slate-500">
              No saved experiment performance yet.
            </div>
          )}
        </div>
      </div>
    </>
  );
}
