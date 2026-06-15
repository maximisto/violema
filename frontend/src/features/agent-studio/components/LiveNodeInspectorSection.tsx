import Bot from 'lucide-react/dist/esm/icons/bot.js';
import type {
  DashboardTaskStepExecution,
  DashboardWorkerCard,
  StudioRoleDirective,
  WorkflowBlockKind,
} from '../types';

interface WorkerPerformance {
  steps: number;
  failureRate: number;
  credits: number;
  tokens: number;
}

interface WorkerPhaseActivityEntry {
  id: string;
  label: string;
  phases: Array<{
    phase: WorkflowBlockKind;
    count: number;
    credits?: number;
    failed?: boolean;
    succeeded?: boolean;
  }>;
}

interface PhaseEvidenceEntry {
  phase: WorkflowBlockKind;
}

interface LiveNodeInspectorSectionProps {
  worker?: DashboardWorkerCard;
  performance?: WorkerPerformance;
  recentSteps: DashboardTaskStepExecution[];
  selectedRoleDirective?: StudioRoleDirective;
  actionBusy: boolean;
  workerPhaseActivity: WorkerPhaseActivityEntry[];
  selectedDirectivePhase: 'all' | WorkflowBlockKind;
  directivePhaseOptions: Array<{ value: 'all' | WorkflowBlockKind; label: string }>;
  phaseEvidence: PhaseEvidenceEntry[];
  onClearRoleDirective: () => void;
  onSelectDirectivePhase: (phase: 'all' | WorkflowBlockKind) => void;
  onFocusPhase: (phase: WorkflowBlockKind) => void;
  onRouteCheaper: () => void;
  onIncreaseReview: () => void;
  onPromoteLane: () => void;
  formatCredits: (value: number) => string;
  formatTokenCount: (value: number) => string;
  formatRelativeTimeFromIso: (value?: string) => string;
  formatDirectivePhaseScope: (phases?: WorkflowBlockKind[]) => string;
}

export function LiveNodeInspectorSection({
  worker,
  performance,
  recentSteps,
  selectedRoleDirective,
  actionBusy,
  workerPhaseActivity,
  selectedDirectivePhase,
  directivePhaseOptions,
  phaseEvidence,
  onClearRoleDirective,
  onSelectDirectivePhase,
  onFocusPhase,
  onRouteCheaper,
  onIncreaseReview,
  onPromoteLane,
  formatCredits,
  formatTokenCount,
  formatRelativeTimeFromIso,
  formatDirectivePhaseScope,
}: LiveNodeInspectorSectionProps) {
  return (
    <div className="rounded-[1.8rem] border border-navy-800/80 bg-gradient-to-b from-navy-900/72 via-navy-900/56 to-navy-950/88 p-5">
      <div className="flex items-center gap-2">
        <Bot className="h-4 w-4 text-violet-300" />
        <div>
          <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Selected worker</p>
          <h3 className="text-sm font-semibold text-white">Node inspector</h3>
        </div>
      </div>
      {worker ? (
        <>
          <div className="mt-4 flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-white">{worker.label}</p>
              <p className="mt-1 text-[11px] uppercase tracking-[0.14em] text-slate-500">{worker.modelLabel}</p>
            </div>
            <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${worker.status === 'active' ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-200' : 'border-navy-700 bg-navy-900 text-slate-400'}`}>
              {worker.status}
            </span>
          </div>
          <p className="mt-3 text-sm leading-relaxed text-slate-400">{worker.reason}</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-navy-700/70 bg-navy-950/45 p-3">
              <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Steps handled</p>
              <p className="mt-1 text-lg font-semibold text-white">{performance?.steps || 0}</p>
            </div>
            <div className="rounded-2xl border border-navy-700/70 bg-navy-950/45 p-3">
              <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Failure rate</p>
              <p className="mt-1 text-lg font-semibold text-white">{performance?.failureRate || 0}%</p>
            </div>
            <div className="rounded-2xl border border-navy-700/70 bg-navy-950/45 p-3">
              <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Credits</p>
              <p className="mt-1 text-lg font-semibold text-white">{formatCredits(performance?.credits || 0)}</p>
            </div>
            <div className="rounded-2xl border border-navy-700/70 bg-navy-950/45 p-3">
              <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Tokens</p>
              <p className="mt-1 text-lg font-semibold text-white">{formatTokenCount(performance?.tokens || 0)}</p>
            </div>
          </div>
          {selectedRoleDirective ? (
            <div className="mt-4 rounded-2xl border border-cyan-500/16 bg-cyan-500/8 p-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.18em] text-cyan-200/80">Active directive</p>
                  <p className="mt-1 text-sm font-medium text-white">
                    {selectedRoleDirective.mode === 'cheaper'
                      ? 'Favor cheaper routing'
                      : selectedRoleDirective.mode === 'review'
                        ? 'Escalate review'
                        : 'Promote stronger lane'}
                  </p>
                  <p className="mt-1 text-[12px] text-slate-400">Set {formatRelativeTimeFromIso(selectedRoleDirective.updatedAt)} for {formatDirectivePhaseScope(selectedRoleDirective.phases)}.</p>
                </div>
                <button
                  type="button"
                  disabled={actionBusy}
                  onClick={onClearRoleDirective}
                  className="ui-pill px-3 py-1.5 text-[11px] normal-case tracking-normal text-slate-300 disabled:opacity-60"
                >
                  Clear
                </button>
              </div>
            </div>
          ) : null}
          <div className="mt-4 rounded-2xl border border-white/6 bg-white/[0.03] p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Phase drilldown</p>
              <span className="text-[11px] text-slate-500">Last {workerPhaseActivity.length} runs</span>
            </div>
            <div className="mt-3 space-y-3">
              {workerPhaseActivity.length > 0 ? workerPhaseActivity.map((run) => (
                <div key={run.id} className="rounded-2xl border border-navy-700/70 bg-navy-950/45 p-3">
                  <p className="text-[11px] uppercase tracking-[0.14em] text-slate-500">{run.label}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {run.phases.map((phase) => (
                      <span key={`${run.id}-${phase.phase}`} className={`ui-pill px-2 py-0.5 normal-case tracking-normal ${phase.failed ? 'text-red-200' : phase.succeeded ? 'text-emerald-200' : 'text-slate-300'}`}>
                        {formatDirectivePhaseScope([phase.phase])} · {phase.count} · {phase.credits ? `${formatCredits(phase.credits)} cr` : '—'}
                      </span>
                    ))}
                  </div>
                </div>
              )) : (
                <div className="rounded-2xl border border-dashed border-navy-700/70 bg-navy-950/35 p-3 text-sm text-slate-500">
                  No phase-specific run history for this worker yet.
                </div>
              )}
            </div>
          </div>
          <div className="mt-4">
            <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Recent work</p>
            <div className="mt-2 space-y-2">
              {recentSteps.length > 0 ? recentSteps.map((step) => (
                <div key={step.stepId} className="rounded-2xl border border-navy-700/70 bg-navy-950/45 p-3">
                  <p className="text-sm font-medium text-white">{step.title}</p>
                  <p className="mt-1 text-[11px] text-slate-500">{step.modelSource || step.modelTier || 'Auto route'}</p>
                </div>
              )) : (
                <div className="rounded-2xl border border-dashed border-navy-700/70 bg-navy-950/35 p-3 text-sm text-slate-500">
                  No recent step history for this worker yet.
                </div>
              )}
            </div>
          </div>
          <div className="mt-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Steer this role</p>
              <span className="text-[11px] text-slate-500">Scope: {formatDirectivePhaseScope(selectedDirectivePhase === 'all' ? undefined : [selectedDirectivePhase])}</span>
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              {directivePhaseOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => onSelectDirectivePhase(option.value)}
                  className={`ui-pill px-3 py-1.5 text-[11px] normal-case tracking-normal ${selectedDirectivePhase === option.value ? 'border-cyan-500/30 bg-cyan-500/12 text-cyan-200' : 'text-slate-300'}`}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {phaseEvidence.slice(0, 3).map((phase) => (
                <button
                  key={`focus-${phase.phase}`}
                  type="button"
                  onClick={() => onFocusPhase(phase.phase)}
                  className="ui-pill px-3 py-1.5 text-[11px] normal-case tracking-normal text-slate-300"
                >
                  Focus {formatDirectivePhaseScope([phase.phase])}
                </button>
              ))}
            </div>
            <div className="mt-3 grid gap-2">
              <button
                type="button"
                disabled={actionBusy}
                onClick={onRouteCheaper}
                className="rounded-2xl border border-cyan-500/18 bg-cyan-500/8 px-4 py-3 text-left transition-colors hover:bg-cyan-500/12 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <p className="text-sm font-medium text-white">Route this role cheaper</p>
                <p className="mt-1 text-[12px] leading-relaxed text-slate-400">Bias the workflow toward lower-cost lanes and trim excess elastic capacity where the math allows it.</p>
              </button>
              <button
                type="button"
                disabled={actionBusy}
                onClick={onIncreaseReview}
                className="rounded-2xl border border-violet-500/18 bg-violet-500/8 px-4 py-3 text-left transition-colors hover:bg-violet-500/12 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <p className="text-sm font-medium text-white">Increase review here</p>
                <p className="mt-1 text-[12px] leading-relaxed text-slate-400">Raise review pressure when this role is touching higher-risk reasoning, outputs, or decision steps.</p>
              </button>
              <button
                type="button"
                disabled={actionBusy}
                onClick={onPromoteLane}
                className="rounded-2xl border border-amber-500/18 bg-amber-500/8 px-4 py-3 text-left transition-colors hover:bg-amber-500/12 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <p className="text-sm font-medium text-white">Promote this lane</p>
                <p className="mt-1 text-[12px] leading-relaxed text-slate-400">Give the workflow more headroom when this role should stay active longer or escalate into stronger reasoning.</p>
              </button>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
