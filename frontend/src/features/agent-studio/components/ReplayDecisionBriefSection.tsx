import CheckCircle2 from 'lucide-react/dist/esm/icons/check-circle-2.js';
import FlaskConical from 'lucide-react/dist/esm/icons/flask-conical.js';
import Sparkles from 'lucide-react/dist/esm/icons/sparkles.js';

interface ReplayDecisionBriefSectionProps {
  brief: {
    headline: string;
    rationale: string;
    nextStep: string;
    promotionReadiness: string;
    focusLabel: string;
    fixModeLabel: string;
    deltas: Array<{
      label: string;
      value: string;
      tone: 'positive' | 'negative' | 'neutral';
    }>;
  };
  onSimulateFix: () => void;
  onOpenInLive: () => void;
}

export function ReplayDecisionBriefSection({
  brief,
  onSimulateFix,
  onOpenInLive,
}: ReplayDecisionBriefSectionProps) {
  return (
    <div className="rounded-[1.8rem] border border-navy-800/80 bg-gradient-to-b from-navy-900/72 via-navy-900/56 to-navy-950/88 p-5">
      <div className="flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-cyan-300" />
        <div>
          <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Replay decision brief</p>
          <h3 className="text-sm font-semibold text-white">What changed and what to test next</h3>
        </div>
      </div>
      <p className="mt-2 text-sm leading-relaxed text-slate-400">
        Replay should not end at diagnosis. It should tell you what likely moved outcome, which fix to test next, and whether that fix is close to promotion-worthy.
      </p>

      <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)] xl:items-start">
        <div className="rounded-[1.45rem] border border-cyan-500/16 bg-cyan-500/6 p-4">
          <p className="text-[10px] uppercase tracking-[0.18em] text-cyan-100/80">Current read</p>
          <h4 className="mt-1 text-base font-semibold text-white">{brief.headline}</h4>
          <p className="mt-3 text-sm leading-relaxed text-slate-300">{brief.rationale}</p>
          <p className="mt-3 text-[12px] leading-relaxed text-slate-400">{brief.nextStep}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onSimulateFix}
              className="rounded-xl border border-cyan-500/24 bg-cyan-500/10 px-4 py-2 text-sm font-medium text-cyan-100 transition-colors hover:bg-cyan-500/14"
            >
              Simulate {brief.fixModeLabel}
            </button>
            <button
              type="button"
              onClick={onOpenInLive}
              className="ui-pill px-3 py-1.5 text-[11px] normal-case tracking-normal text-slate-300"
            >
              Open {brief.focusLabel} in Live
            </button>
          </div>
        </div>

        <div className="space-y-3">
          <div className="rounded-[1.35rem] border border-white/6 bg-white/[0.03] p-4">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-300" />
              <div>
                <p className="text-[10px] uppercase tracking-[0.16em] text-slate-500">Promotion read</p>
                <p className="mt-1 text-sm font-medium text-white">{brief.promotionReadiness}</p>
              </div>
            </div>
          </div>

          <div className="rounded-[1.35rem] border border-white/6 bg-white/[0.03] p-4">
            <div className="flex items-center gap-2">
              <FlaskConical className="h-4 w-4 text-violet-300" />
              <div>
                <p className="text-[10px] uppercase tracking-[0.16em] text-slate-500">Targeted fix</p>
                <p className="mt-1 text-sm font-medium text-white">{brief.focusLabel} to {brief.fixModeLabel}</p>
              </div>
            </div>
            <div className="mt-3 grid gap-2">
              {brief.deltas.map((delta) => (
                <div key={delta.label} className="flex items-center justify-between gap-3 rounded-xl border border-white/6 bg-white/[0.02] px-3 py-2 text-[11px]">
                  <span className="text-slate-400">{delta.label}</span>
                  <span className={delta.tone === 'positive' ? 'text-emerald-200' : delta.tone === 'negative' ? 'text-amber-200' : 'text-slate-300'}>
                    {delta.value}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
