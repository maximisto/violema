import type { MissionMetricView, MissionWorkspaceView } from './types';

interface MissionAnalyticsProps {
  mission: MissionWorkspaceView;
}

const metricToneClasses: Record<MissionMetricView['tone'], string> = {
  violet: 'border-violet-400/20 bg-violet-400/10 text-violet-100',
  cyan: 'border-cyan-400/20 bg-cyan-400/10 text-cyan-100',
  green: 'border-green-400/20 bg-green-400/10 text-green-100',
  amber: 'border-amber-400/20 bg-amber-400/10 text-amber-100',
  slate: 'border-slate-500/20 bg-slate-500/10 text-slate-200',
};

const metricValueClasses: Record<MissionMetricView['tone'], string> = {
  violet: 'text-violet-100',
  cyan: 'text-cyan-100',
  green: 'text-green-100',
  amber: 'text-amber-100',
  slate: 'text-slate-100',
};

function displayMetricLabel(metric: MissionMetricView) {
  return metric.label.toLowerCase() === 'waste' ? 'Run risk' : metric.label;
}

function parseCreditValue(value: string) {
  const match = value.replace(/,/g, '').match(/(\d+(?:\.\d+)?)/);
  return match ? Number(match[1]) : 0;
}

export function MissionAnalytics({ mission }: MissionAnalyticsProps) {
  const stepCosts = mission.steps
    .map((step) => ({
      id: step.id,
      title: step.title,
      credits: step.actualCredits || step.estimatedCredits || 0,
      status: step.status,
    }))
    .filter((step) => step.credits > 0);
  const maxStepCredits = Math.max(1, ...stepCosts.map((step) => step.credits));
  const runCredits = parseCreditValue(mission.metrics.find((metric) => metric.label.toLowerCase().includes('credit'))?.value || '');
  const proPackRunway = runCredits > 0 ? Math.max(1, Math.floor(2000 / runCredits)) : null;

  return (
    <section className="space-y-4">
      <div>
        <p className="text-[10px] font-medium text-violet-300/80">Credit analytics</p>
        <h3 className="mt-1 text-base font-semibold leading-snug text-white">{mission.title}</h3>
        <p className="mt-2 text-sm leading-6 text-slate-500">{mission.analyticsSummary}</p>
      </div>

      {mission.metrics.length > 0 ? (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-1 2xl:grid-cols-2">
          {mission.metrics.map((metric) => (
            <article
              key={metric.label}
              className={`rounded-lg border p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.025)] ${metricToneClasses[metric.tone]}`}
            >
              <div className="flex items-start justify-between gap-3">
                <p className="text-[10px] font-medium text-slate-400">{displayMetricLabel(metric)}</p>
                <span className="mt-1 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-current opacity-80" />
              </div>
              <p className={`mt-2 text-lg font-semibold leading-none ${metricValueClasses[metric.tone]}`}>
                {metric.value}
              </p>
              <p className="mt-2 text-[11px] leading-5 text-slate-500">{metric.detail}</p>
            </article>
          ))}
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-navy-700/70 bg-navy-950/40 p-4 text-sm leading-6 text-slate-500">
          Credit metrics will appear after this mission has enough run data.
        </div>
      )}

      <div className="rounded-lg border border-navy-700/70 bg-navy-950/45 p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-cyan-200/80">Credit waterfall</p>
            <h4 className="mt-1 text-[13px] font-semibold text-white">Cost by mission step</h4>
          </div>
          <span className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-2 py-0.5 text-[10px] font-semibold text-cyan-100">
            {stepCosts.length || 0} priced
          </span>
        </div>
        {stepCosts.length > 0 ? (
          <div className="mt-4 space-y-3">
            {stepCosts.map((step) => (
              <div key={step.id}>
                <div className="mb-1 flex items-center justify-between gap-3">
                  <p className="truncate text-[11px] font-medium text-slate-200" title={step.title}>{step.title}</p>
                  <span className="font-mono text-[10px] text-slate-400">{step.credits} cr</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-navy-900">
                  <div
                    className={`h-full rounded-full ${step.status === 'failed' ? 'bg-red-300' : step.status === 'waiting_review' ? 'bg-amber-300' : 'bg-gradient-to-r from-violet-400 to-cyan-300'}`}
                    style={{ width: `${Math.max(8, Math.round((step.credits / maxStepCredits) * 100))}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-3 text-sm leading-6 text-slate-500">Step-level cost appears after Violema stores actual or estimated credits for each run step.</p>
        )}
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-1 2xl:grid-cols-2">
        <article className="rounded-lg border border-amber-400/20 bg-amber-400/10 p-3">
          <p className="text-[10px] font-medium text-amber-200/80">Runway forecast</p>
          <p className="mt-2 text-lg font-semibold text-amber-100">{proPackRunway ? `${proPackRunway} runs` : 'Needs data'}</p>
          <p className="mt-2 text-[11px] leading-5 text-slate-500">
            Forecast uses the current run cost against a 2,000-credit Pro pack. Live balance history can replace this once per-workspace trend APIs are available.
          </p>
        </article>
        <article className="rounded-lg border border-green-400/20 bg-green-400/10 p-3">
          <p className="text-[10px] font-medium text-green-200/80">Optimization cue</p>
          <p className="mt-2 text-lg font-semibold text-green-100">{stepCosts.length > 0 ? 'Tune largest step' : 'Awaiting run'}</p>
          <p className="mt-2 text-[11px] leading-5 text-slate-500">
            Route high-cost research or analysis steps through Advanced only after the mission proves its weekly value.
          </p>
        </article>
      </div>
    </section>
  );
}
