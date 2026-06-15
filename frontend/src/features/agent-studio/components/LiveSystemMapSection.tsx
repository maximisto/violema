import Layers3 from 'lucide-react/dist/esm/icons/layers-3.js';
import type { DashboardWorkerCard, DashboardWorkerTopology, StudioRoleDirective, WorkflowBlockKind } from '../types';

type WorkerMapNode = DashboardWorkerCard & { positionClass: string };

interface LiveSystemMapSectionProps {
  liveStatusLabel: string;
  topology: DashboardWorkerTopology;
  workerMapNodes: WorkerMapNode[];
  selectedWorkerRole?: string;
  roleDirectives?: Record<string, StudioRoleDirective>;
  optimizationBiasLabel: string;
  activeCoreCount: number;
  activeElasticCount: number;
  onSelectWorker: (role: string) => void;
  truncateText: (value: string, maxLength: number) => string;
  formatDirectivePhaseShort: (phase: WorkflowBlockKind) => string;
}

export function LiveSystemMapSection({
  liveStatusLabel,
  topology,
  workerMapNodes,
  selectedWorkerRole,
  roleDirectives,
  optimizationBiasLabel,
  activeCoreCount,
  activeElasticCount,
  onSelectWorker,
  truncateText,
  formatDirectivePhaseShort,
}: LiveSystemMapSectionProps) {
  const managerWorker = topology.workers.find((worker) => worker.role === 'nexus');

  return (
    <div className="rounded-[1.9rem] border border-cyan-500/15 bg-gradient-to-br from-cyan-500/8 via-navy-900/72 to-navy-950/92 p-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Layers3 className="h-4 w-4 text-cyan-300" />
          <div>
            <p className="text-[10px] uppercase tracking-[0.18em] text-cyan-300/80">Live system map</p>
            <h3 className="text-sm font-semibold text-white">Manager and worker lanes</h3>
          </div>
        </div>
        <span className="rounded-full border border-white/8 bg-white/[0.04] px-2.5 py-1 text-[10px] uppercase tracking-[0.16em] text-slate-300">
          {liveStatusLabel}
        </span>
      </div>
      <p className="mt-2 text-sm leading-relaxed text-slate-400">
        One manager in the center, resident specialists around it, and elastic lanes appearing only when the workflow math or live execution justify them.
      </p>
      <div className="relative mt-5 h-[30rem] overflow-hidden rounded-[1.8rem] border border-white/6 bg-[radial-gradient(circle_at_center,rgba(45,212,191,0.10),transparent_28%),linear-gradient(180deg,rgba(15,23,42,0.74),rgba(2,6,23,0.96))]">
        <div className="absolute inset-[14%] rounded-full border border-violet-500/10" />
        <div className="absolute inset-[25%] rounded-full border border-cyan-500/10" />
        <div className="absolute left-1/2 top-1/2 h-40 w-40 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgba(124,58,237,0.30),rgba(8,47,73,0.04))] blur-2xl" />
        {managerWorker ? (
          <button
            type="button"
            onClick={() => onSelectWorker('nexus')}
            className={`absolute left-1/2 top-1/2 z-10 w-[12rem] -translate-x-1/2 -translate-y-1/2 rounded-[1.6rem] border bg-navy-950/82 p-4 text-left shadow-[0_24px_80px_rgba(76,29,149,0.28)] transition-colors ${
              selectedWorkerRole === 'nexus' ? 'border-violet-300/34' : 'border-violet-400/24'
            }`}
          >
            <div>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.16em] text-violet-300/80">Manager</p>
                  <p className="mt-1 text-sm font-semibold text-white">{managerWorker.label}</p>
                </div>
                <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${managerWorker.status === 'active' ? 'border-violet-500/20 bg-violet-500/10 text-violet-200' : 'border-navy-700 bg-navy-900 text-slate-400'}`}>
                  {managerWorker.status}
                </span>
              </div>
              <p className="mt-3 text-[12px] leading-relaxed text-slate-300">{managerWorker.reason}</p>
              <div className="mt-3 flex flex-wrap gap-2 text-[10px] text-slate-400">
                <span className="ui-pill px-2 py-0.5 normal-case tracking-normal text-slate-300">{topology.primaryBand} band</span>
                <span className="ui-pill px-2 py-0.5 normal-case tracking-normal text-slate-300">{managerWorker.modelLabel}</span>
              </div>
            </div>
          </button>
        ) : null}
        {workerMapNodes.map((worker) => {
          const directive = roleDirectives?.[worker.role];
          const phases = directive?.phases || [];
          return (
            <button
              type="button"
              key={worker.role}
              onClick={() => onSelectWorker(worker.role)}
              className={`absolute z-[5] w-[10.5rem] rounded-[1.2rem] border p-3 shadow-[0_14px_40px_rgba(2,6,23,0.28)] ${worker.positionClass} ${
                worker.status === 'active'
                  ? worker.laneType === 'elastic'
                    ? 'border-cyan-500/25 bg-cyan-500/10'
                    : 'border-violet-500/25 bg-violet-500/10'
                  : 'border-navy-700/70 bg-navy-950/72'
              } ${selectedWorkerRole === worker.role ? 'ring-2 ring-violet-400/45' : ''}`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-white">{worker.label}</p>
                  <p className="mt-1 text-[10px] uppercase tracking-[0.14em] text-slate-500">{worker.band} band</p>
                </div>
                <span className={`mt-0.5 inline-flex h-2.5 w-2.5 rounded-full ${worker.status === 'active' ? 'animate-pulse bg-emerald-300' : 'bg-slate-600'}`} />
              </div>
              <p className="mt-2 text-[11px] leading-relaxed text-slate-400">{truncateText(worker.reason, 84)}</p>
              {directive ? (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <span className="inline-flex rounded-full border border-cyan-500/18 bg-cyan-500/8 px-2 py-0.5 text-[10px] font-medium text-cyan-200">
                    {directive.mode === 'cheaper' ? 'Cheaper' : directive.mode === 'review' ? 'Review' : 'Promoted'}
                  </span>
                  {phases.slice(0, 3).map((phase) => (
                    <span key={`${worker.role}-${phase}`} className="inline-flex rounded-full border border-white/8 bg-white/[0.04] px-1.5 py-0.5 text-[9px] font-medium text-slate-300">
                      {formatDirectivePhaseShort(phase)}
                    </span>
                  ))}
                  {phases.length > 3 ? (
                    <span className="inline-flex rounded-full border border-white/8 bg-white/[0.04] px-1.5 py-0.5 text-[9px] font-medium text-slate-300">
                      +{phases.length - 3}
                    </span>
                  ) : null}
                </div>
              ) : null}
            </button>
          );
        })}
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-navy-700/70 bg-navy-950/45 p-3">
          <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Active specialists</p>
          <p className="mt-1 text-lg font-semibold text-white">{activeCoreCount}</p>
        </div>
        <div className="rounded-2xl border border-navy-700/70 bg-navy-950/45 p-3">
          <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Elastic lanes open</p>
          <p className="mt-1 text-lg font-semibold text-white">{activeElasticCount}</p>
        </div>
        <div className="rounded-2xl border border-navy-700/70 bg-navy-950/45 p-3">
          <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Optimization bias</p>
          <p className="mt-1 text-lg font-semibold text-white">{optimizationBiasLabel}</p>
        </div>
      </div>
    </div>
  );
}
