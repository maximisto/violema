import AlertTriangle from 'lucide-react/dist/esm/icons/alert-triangle.js';
import ArrowRight from 'lucide-react/dist/esm/icons/arrow-right.js';
import CheckCircle2 from 'lucide-react/dist/esm/icons/check-circle-2.js';
import Lightbulb from 'lucide-react/dist/esm/icons/lightbulb.js';
import ShieldCheck from 'lucide-react/dist/esm/icons/shield-check.js';
import { selectDimaStudioAdvice } from '../agentStudioDimaAdvisor';
import type { AgentStudioOperationalContext } from '../contract';
import type { AgentStudioRow, AutomationApiRecord, PlatformTaskRunRecord, StudioRoom } from '../types';
import { getDimaSpritePath } from '../../guardian/dashboardGuardian';

interface DimaStudioAdvisorPanelProps {
  activeRoom: StudioRoom;
  row?: AgentStudioRow | null;
  workflow?: AutomationApiRecord | null;
  selectedRun?: PlatformTaskRunRecord | null;
  operationalContext?: AgentStudioOperationalContext | null;
}

const toneStyles = {
  neutral: {
    border: 'border-cyan-500/16',
    background: 'from-cyan-500/8 via-navy-900/68 to-navy-950/90',
    badge: 'border-cyan-400/20 bg-cyan-400/8 text-cyan-100',
    icon: ShieldCheck,
  },
  warning: {
    border: 'border-amber-400/22',
    background: 'from-amber-400/10 via-navy-900/72 to-navy-950/92',
    badge: 'border-amber-300/24 bg-amber-300/10 text-amber-100',
    icon: AlertTriangle,
  },
  action: {
    border: 'border-violet-400/22',
    background: 'from-violet-500/12 via-navy-900/72 to-navy-950/92',
    badge: 'border-violet-300/24 bg-violet-300/10 text-violet-100',
    icon: Lightbulb,
  },
  success: {
    border: 'border-emerald-400/22',
    background: 'from-emerald-400/10 via-navy-900/72 to-navy-950/92',
    badge: 'border-emerald-300/24 bg-emerald-300/10 text-emerald-100',
    icon: CheckCircle2,
  },
};

const toneLabels = {
  neutral: 'Advisor',
  warning: 'Check first',
  action: 'Suggested move',
  success: 'Ready signal',
};

export function DimaStudioAdvisorPanel({
  activeRoom,
  row,
  workflow,
  selectedRun,
  operationalContext,
}: DimaStudioAdvisorPanelProps) {
  const advice = selectDimaStudioAdvice({ activeRoom, row, workflow, selectedRun, operationalContext });
  const style = toneStyles[advice.tone];
  const Icon = style.icon;
  const evidence = advice.evidence.slice(0, 3);

  return (
    <section
      aria-label="Dima Agent Studio advisor"
      className={`rounded-[1.6rem] border ${style.border} bg-gradient-to-br ${style.background} p-4 shadow-[0_18px_48px_rgba(2,6,23,0.24)]`}
    >
      <div className="flex flex-col gap-4 md:flex-row md:items-start">
        <div className="relative h-[5.25rem] w-full shrink-0 overflow-hidden rounded-[1.2rem] border border-white/8 bg-navy-950/70 md:w-[8.5rem]">
          <div className="absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-navy-950/90 to-transparent" />
          <img
            src={getDimaSpritePath(advice.sprite)}
            alt="Dima advisor"
            className="absolute bottom-0 right-1 h-20 w-[8.5rem] max-w-none object-contain object-right opacity-95"
            decoding="async"
            loading="lazy"
          />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] ${style.badge}`}>
              <Icon className="h-3.5 w-3.5" />
              {toneLabels[advice.tone]}
            </span>
            <span className="rounded-full border border-white/8 bg-white/[0.03] px-2 py-1 text-[10px] uppercase tracking-[0.14em] text-slate-500">
              Dima
            </span>
          </div>

          <h3 className="mt-3 text-base font-semibold text-white">{advice.title}</h3>
          <p className="mt-2 text-sm leading-relaxed text-slate-300">{advice.message}</p>

          {evidence.length > 0 ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {evidence.map((item) => (
                <span key={item} className="rounded-full border border-white/8 bg-white/[0.03] px-2.5 py-1 text-[11px] text-slate-300">
                  {item}
                </span>
              ))}
            </div>
          ) : null}

          <div className="mt-4 flex items-start gap-2 rounded-xl border border-white/8 bg-navy-950/44 px-3 py-2.5">
            <ArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
            <div>
              <p className="text-[10px] uppercase tracking-[0.14em] text-slate-500">Next move</p>
              <p className="mt-1 text-sm leading-relaxed text-slate-300">{advice.nextAction}</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
