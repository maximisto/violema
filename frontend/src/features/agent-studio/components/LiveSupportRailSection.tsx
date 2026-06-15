import Cpu from 'lucide-react/dist/esm/icons/cpu.js';
import Sparkles from 'lucide-react/dist/esm/icons/sparkles.js';
import type { DashboardWorkerCard, WorkflowBlockKind } from '../types';

export interface NextExperimentQueueItem {
  id: string;
  title: string;
  body: string;
  sourceLabel: string;
  phase?: WorkflowBlockKind;
  mode?: 'cheaper' | 'review' | 'promote';
  action?: 'simulate_phase' | 'focus_phase' | 'apply_policy';
  policyAction?: 'lean_ops' | 'raise_review' | 'match_lanes' | 'trim_lanes' | 'none';
}

interface LiveSupportRailSectionProps {
  workers: DashboardWorkerCard[];
  nextExperimentQueue: NextExperimentQueueItem[];
  onExecuteNextExperiment: (item: NextExperimentQueueItem) => void;
  onViewExperimentEvidence: (phase: WorkflowBlockKind) => void;
  onSavePlan: (namePrefix: string) => void;
}

export function LiveSupportRailSection({
  workers,
  nextExperimentQueue,
  onExecuteNextExperiment,
  onViewExperimentEvidence,
  onSavePlan,
}: LiveSupportRailSectionProps) {
  return (
    <div className="space-y-6">
      <div className="rounded-[1.8rem] border border-navy-800/80 bg-gradient-to-b from-navy-900/72 via-navy-900/56 to-navy-950/88 p-5">
        <div className="flex items-center gap-2">
          <Cpu className="h-4 w-4 text-violet-300" />
          <div>
            <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Lane roster</p>
            <h3 className="text-sm font-semibold text-white">Who is resident vs elastic</h3>
          </div>
        </div>
        <div className="mt-4 space-y-3">
          {(['core', 'elastic'] as const).map((laneType) => (
            <div key={laneType}>
              <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">{laneType === 'core' ? 'Resident specialists' : 'Elastic lanes'}</p>
              <div className="mt-2 space-y-2">
                {workers
                  .filter((worker) => worker.laneType === laneType && worker.role !== 'nexus')
                  .map((worker) => (
                    <div key={worker.role} className="rounded-2xl border border-navy-700/70 bg-navy-950/45 p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-medium text-white">{worker.label}</p>
                          <p className="mt-1 text-[11px] text-slate-500">{worker.modelLabel}</p>
                        </div>
                        <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${worker.status === 'active' ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-200' : 'border-navy-700 bg-navy-900 text-slate-400'}`}>
                          {worker.status}
                        </span>
                      </div>
                      <p className="mt-2 text-[12px] leading-relaxed text-slate-400">{worker.reason}</p>
                    </div>
                  ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-[1.8rem] border border-navy-800/80 bg-gradient-to-b from-navy-900/72 via-navy-900/56 to-navy-950/88 p-5">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-emerald-300" />
          <div>
            <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Next experiments</p>
            <h3 className="text-sm font-semibold text-white">Best next moves from live evidence</h3>
          </div>
        </div>
        <div className="mt-4 space-y-3">
          {nextExperimentQueue.map((item) => (
            <div key={item.id} className="rounded-2xl border border-white/6 bg-white/[0.03] p-4">
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm font-medium text-white">{item.title}</p>
                <span className="ui-pill px-2 py-0.5 normal-case tracking-normal text-slate-300">{item.sourceLabel}</span>
              </div>
              <p className="mt-2 text-sm leading-relaxed text-slate-400">{item.body}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => onExecuteNextExperiment(item)}
                  className="ui-pill px-3 py-1.5 text-[11px] normal-case tracking-normal text-cyan-200"
                >
                  {item.action === 'simulate_phase'
                    ? 'Simulate first'
                    : item.action === 'focus_phase'
                      ? 'Open in node inspector'
                      : 'Apply now'}
                </button>
                {item.phase ? (
                  <button
                    type="button"
                    onClick={() => onViewExperimentEvidence(item.phase!)}
                    className="ui-pill px-3 py-1.5 text-[11px] normal-case tracking-normal text-slate-300"
                  >
                    View evidence
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => onSavePlan(item.sourceLabel)}
                  className="ui-pill px-3 py-1.5 text-[11px] normal-case tracking-normal text-slate-300"
                >
                  Save as plan
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
