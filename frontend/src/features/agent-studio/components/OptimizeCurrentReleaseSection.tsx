import { Gauge } from 'lucide-react';

interface OptimizeCurrentReleaseSectionProps {
  scorecard: {
    spendPressure: number;
    riskPressure: number;
    leverageScore: number;
    verdict: string;
    nextMove: string;
  };
}

export function OptimizeCurrentReleaseSection({ scorecard }: OptimizeCurrentReleaseSectionProps) {
  return (
    <div className="rounded-[1.8rem] border border-navy-800/80 bg-gradient-to-b from-navy-900/72 via-navy-900/56 to-navy-950/88 p-5">
      <div className="flex items-center gap-2">
        <Gauge className="h-4 w-4 text-emerald-300" />
        <div>
          <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Current release</p>
          <h3 className="text-sm font-semibold text-white">How healthy the live setup is</h3>
        </div>
      </div>
      <p className="mt-2 text-sm leading-relaxed text-slate-400">Start from the live release, not from knobs. This is the compact read on whether the current operating setup is earning its complexity.</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        {[
          { label: 'Spend pressure', value: scorecard.spendPressure, tone: 'text-amber-300' },
          { label: 'Risk pressure', value: scorecard.riskPressure, tone: 'text-rose-300' },
          { label: 'Leverage score', value: scorecard.leverageScore, tone: 'text-emerald-300' },
        ].map((item) => (
          <div key={item.label} className="rounded-2xl border border-navy-700/70 bg-navy-950/45 p-3">
            <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">{item.label}</p>
            <p className={`mt-1 text-xl font-semibold ${item.tone}`}>{item.value}</p>
          </div>
        ))}
      </div>
      <div className="mt-4 rounded-2xl border border-emerald-500/16 bg-emerald-500/8 p-4">
        <p className="text-[10px] uppercase tracking-[0.18em] text-emerald-100/80">Verdict</p>
        <p className="mt-1 text-sm font-semibold text-white">{scorecard.verdict}</p>
        <p className="mt-2 text-sm leading-relaxed text-slate-300">{scorecard.nextMove}</p>
      </div>
      <p className="mt-4 text-[11px] leading-relaxed text-slate-500">
        Detailed risk and waste diagnostics live in the advanced optimize controls so the release path stays readable.
      </p>
    </div>
  );
}
