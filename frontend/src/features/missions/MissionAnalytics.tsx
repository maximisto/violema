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

export function MissionAnalytics({ mission }: MissionAnalyticsProps) {
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
    </section>
  );
}
