import { ArrowRightLeft, CheckCircle2, Clock3 } from 'lucide-react';

interface OptimizeDecisionBriefSectionProps {
  scenarioLabel: string;
  previewPresetLabel: string;
  activePresetLabel: string;
  changedPolicyCount: number;
  decision: {
    tone: 'positive' | 'warning' | 'neutral';
    headline: string;
    body: string;
    nextStep: string;
    deltas: {
      spend: number;
      assurance: number;
      fit: number;
    };
  };
  formatSignedDelta: (value: number) => string;
}

export function OptimizeDecisionBriefSection({
  scenarioLabel,
  previewPresetLabel,
  activePresetLabel,
  changedPolicyCount,
  decision,
  formatSignedDelta,
}: OptimizeDecisionBriefSectionProps) {
  const toneClasses = decision.tone === 'positive'
    ? {
        icon: 'text-emerald-300',
        box: 'border-emerald-500/18 bg-emerald-500/8',
        deltaPositive: 'text-emerald-200',
        deltaNegative: 'text-amber-200',
      }
    : decision.tone === 'warning'
      ? {
          icon: 'text-amber-300',
          box: 'border-amber-500/18 bg-amber-500/8',
          deltaPositive: 'text-emerald-200',
          deltaNegative: 'text-amber-200',
        }
      : {
          icon: 'text-cyan-300',
          box: 'border-cyan-500/18 bg-cyan-500/8',
          deltaPositive: 'text-emerald-200',
          deltaNegative: 'text-amber-200',
        };

  return (
    <div className="rounded-[1.8rem] border border-navy-800/80 bg-gradient-to-b from-navy-900/72 via-navy-900/56 to-navy-950/88 p-5">
      <div className="flex items-center gap-2">
        <CheckCircle2 className={`h-4 w-4 ${toneClasses.icon}`} />
        <div>
          <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Release decision brief</p>
          <h3 className="text-sm font-semibold text-white">Should this candidate ship?</h3>
        </div>
      </div>
      <p className="mt-2 text-sm leading-relaxed text-slate-400">
        This is the point of Optimize: turn a scenario plus candidate into one release call before you get lost in diagnostics.
      </p>

      <div className={`mt-4 rounded-[1.5rem] border p-4 ${toneClasses.box}`}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Recommended decision</p>
            <h4 className="mt-1 text-base font-semibold text-white">{decision.headline}</h4>
          </div>
          <div className="flex flex-wrap gap-2 text-[10px]">
            <span className="ui-pill px-2 py-0.5 normal-case tracking-normal text-slate-200">{scenarioLabel}</span>
            <span className="ui-pill px-2 py-0.5 normal-case tracking-normal text-slate-200">
              {changedPolicyCount > 0 ? `${changedPolicyCount} policy shifts` : 'No policy shifts'}
            </span>
          </div>
        </div>
        <p className="mt-3 text-sm leading-relaxed text-slate-300">{decision.body}</p>
        <p className="mt-3 text-[12px] leading-relaxed text-slate-400">{decision.nextStep}</p>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)] xl:items-start">
        <div className="rounded-[1.35rem] border border-white/6 bg-white/[0.03] p-4">
          <div className="flex items-center gap-2">
            <ArrowRightLeft className="h-4 w-4 text-violet-300" />
            <div>
              <p className="text-[10px] uppercase tracking-[0.16em] text-slate-500">Release move</p>
              <p className="mt-1 text-sm font-medium text-white">{activePresetLabel} to {previewPresetLabel}</p>
            </div>
          </div>
          <p className="mt-3 text-[12px] leading-relaxed text-slate-400">
            Studio is comparing the current live posture against the selected candidate under the same scenario pressure.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          {[
            { label: 'Spend', value: decision.deltas.spend, preferLower: true },
            { label: 'Assurance', value: decision.deltas.assurance, preferLower: false },
            { label: 'Fit', value: decision.deltas.fit, preferLower: false },
          ].map((metric) => {
            const isPositive = metric.preferLower ? metric.value <= 0 : metric.value >= 0;
            return (
              <div key={metric.label} className="rounded-[1.35rem] border border-white/6 bg-white/[0.03] p-4">
                <div className="flex items-center gap-2">
                  <Clock3 className="h-4 w-4 text-slate-400" />
                  <p className="text-[10px] uppercase tracking-[0.16em] text-slate-500">{metric.label} delta</p>
                </div>
                <p className={`mt-2 text-lg font-semibold ${isPositive ? toneClasses.deltaPositive : toneClasses.deltaNegative}`}>
                  {formatSignedDelta(metric.value)}
                </p>
                <p className="mt-1 text-[11px] text-slate-500">
                  {metric.preferLower ? 'Lower is better here' : 'Higher is better here'}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
