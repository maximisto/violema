import Brain from 'lucide-react/dist/esm/icons/brain.js';
import CheckCircle2 from 'lucide-react/dist/esm/icons/check-circle-2.js';
import Clock3 from 'lucide-react/dist/esm/icons/clock-3.js';
import type { StudioExperimentRecord, StudioPromotionRecord, WorkflowBlockKind } from '../types';

interface RollbackSuggestion {
  title: string;
  body: string;
  restoreExperiment?: StudioExperimentRecord;
}

interface PromotionAuditEntry {
  id: string;
  mode: StudioPromotionRecord['mode'];
  summary: string;
  outcome: string;
  subsequentRuns: unknown[];
  stats: {
    successRate: number;
    averageCredits?: number;
  };
}

interface RoleHeatmapEntry {
  role: string;
  steps: number;
  credits: number;
  failureRate: number;
  tokens: number;
  activityWidth: string;
}

interface WorkflowBenchmarkEntry {
  id: string;
  name: string;
  stepCount: number;
  successRate: number;
  averageCredits?: number;
  costWidth: string;
  isSelected: boolean;
  lastStatus: string;
}

interface ReplayGovernanceSectionProps {
  rollbackSuggestion: RollbackSuggestion | null;
  promotionAudit: PromotionAuditEntry[];
  promotionHistory: StudioPromotionRecord[];
  roleHeatmap: RoleHeatmapEntry[];
  workflowBenchmarks: WorkflowBenchmarkEntry[];
  actionBusy: boolean;
  formatCredits: (value: number) => string;
  formatTokenCount: (value?: number) => string;
  formatRelativeTimeFromIso: (value?: string) => string;
  formatDirectivePhaseScope: (phases: WorkflowBlockKind[]) => string;
  getPromotionModeLabel: (mode: StudioPromotionRecord['mode']) => string;
  getPromotionModeTone: (mode: StudioPromotionRecord['mode']) => string;
  getStatusTone: (status: string) => string;
  onRestorePreset: (experiment: StudioExperimentRecord) => void;
  onRestoreSteering: (experiment: StudioExperimentRecord) => void;
  onRestoreFull: (experiment: StudioExperimentRecord) => void;
  onReviewRestoreTarget: (experiment: StudioExperimentRecord) => void;
  onSelectBenchmarkWorkflow: (workflowId: string) => void;
}

export function ReplayGovernanceSection({
  rollbackSuggestion,
  promotionAudit,
  promotionHistory,
  roleHeatmap,
  workflowBenchmarks,
  actionBusy,
  formatCredits,
  formatTokenCount,
  formatRelativeTimeFromIso,
  formatDirectivePhaseScope,
  getPromotionModeLabel,
  getPromotionModeTone,
  getStatusTone,
  onRestorePreset,
  onRestoreSteering,
  onRestoreFull,
  onReviewRestoreTarget,
  onSelectBenchmarkWorkflow,
}: ReplayGovernanceSectionProps) {
  return (
    <>
      <div className="rounded-[1.8rem] border border-navy-800/80 bg-gradient-to-b from-navy-900/72 via-navy-900/56 to-navy-950/88 p-5">
        <div className="flex items-center gap-2">
          <Clock3 className="h-4 w-4 text-amber-300" />
          <div>
            <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Promotion history</p>
            <h3 className="text-sm font-semibold text-white">How the live policy got here</h3>
          </div>
        </div>
        {rollbackSuggestion ? (
          <div className="mt-4 rounded-2xl border border-amber-500/18 bg-amber-500/8 p-4">
            <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Rollback suggestion</p>
            <p className="mt-2 text-sm font-medium text-white">{rollbackSuggestion.title}</p>
            <p className="mt-2 text-sm leading-relaxed text-slate-300">{rollbackSuggestion.body}</p>
            {rollbackSuggestion.restoreExperiment ? (
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={actionBusy}
                  onClick={() => onRestorePreset(rollbackSuggestion.restoreExperiment!)}
                  className="ui-pill px-3 py-1.5 text-[11px] normal-case tracking-normal text-emerald-200 disabled:opacity-60"
                >
                  Restore preset only
                </button>
                <button
                  type="button"
                  disabled={actionBusy}
                  onClick={() => onRestoreSteering(rollbackSuggestion.restoreExperiment!)}
                  className="ui-pill px-3 py-1.5 text-[11px] normal-case tracking-normal text-cyan-200 disabled:opacity-60"
                >
                  Restore steering only
                </button>
                <button
                  type="button"
                  disabled={actionBusy}
                  onClick={() => onRestoreFull(rollbackSuggestion.restoreExperiment!)}
                  className="rounded-xl border border-amber-500/24 bg-amber-500/10 px-4 py-2 text-sm font-medium text-amber-100 transition-colors hover:bg-amber-500/14 disabled:opacity-60"
                >
                  Restore recommended setup
                </button>
                <button
                  type="button"
                  onClick={() => onReviewRestoreTarget(rollbackSuggestion.restoreExperiment!)}
                  className="ui-pill px-3 py-1.5 text-[11px] normal-case tracking-normal text-slate-300"
                >
                  Review target
                </button>
              </div>
            ) : null}
          </div>
        ) : null}
        {promotionAudit.length > 0 ? (
          <div className="mt-4 rounded-2xl border border-white/6 bg-white/[0.03] p-4">
            <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Promotion audit</p>
            <div className="mt-3 space-y-3">
              {promotionAudit.slice(0, 4).map((entry) => (
                <div key={`audit-${entry.id}`} className="rounded-xl border border-white/6 bg-white/[0.02] px-3 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-white">{getPromotionModeLabel(entry.mode)}</p>
                      <p className="mt-1 text-[11px] text-slate-500">{entry.summary}</p>
                    </div>
                    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${entry.outcome === 'Positive' ? 'border-emerald-500/25 bg-emerald-500/10 text-emerald-200' : entry.outcome === 'Mixed' ? 'border-amber-500/25 bg-amber-500/10 text-amber-200' : 'border-slate-600 bg-slate-800/60 text-slate-300'}`}>
                      {entry.outcome}
                    </span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2 text-[10px] text-slate-300">
                    <span className="ui-pill px-2 py-0.5 normal-case tracking-normal text-slate-300">{entry.subsequentRuns.length} subsequent runs</span>
                    <span className="ui-pill px-2 py-0.5 normal-case tracking-normal text-slate-300">{Math.round(entry.stats.successRate * 100)}% success</span>
                    <span className="ui-pill px-2 py-0.5 normal-case tracking-normal text-slate-300">{entry.stats.averageCredits ? `${formatCredits(entry.stats.averageCredits)} cr avg` : '—'}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}
        <div className="mt-4 space-y-3">
          {promotionHistory.length ? promotionHistory.map((entry) => (
            <div key={entry.id} className="rounded-2xl border border-navy-700/70 bg-navy-950/45 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${getPromotionModeTone(entry.mode)}`}>
                      {getPromotionModeLabel(entry.mode)}
                    </span>
                    {entry.phase ? (
                      <span className="ui-pill px-2 py-0.5 text-[10px] normal-case tracking-normal text-slate-300">
                        {formatDirectivePhaseScope([entry.phase])}
                      </span>
                    ) : null}
                    {entry.sourceExperimentLabel ? (
                      <span className="ui-pill px-2 py-0.5 text-[10px] normal-case tracking-normal text-slate-300">
                        {entry.sourceExperimentLabel}
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-3 text-sm leading-relaxed text-slate-300">{entry.summary}</p>
                </div>
                <span className="text-[11px] text-slate-500">{formatRelativeTimeFromIso(entry.appliedAt)}</span>
              </div>
            </div>
          )) : (
            <div className="rounded-2xl border border-dashed border-navy-700/70 bg-navy-950/35 p-4 text-sm text-slate-500">
              No promotions yet. Once you start promoting winners, steering phases, or branching live policy, the decision trail will show up here.
            </div>
          )}
        </div>
      </div>

      <div className="rounded-[1.8rem] border border-navy-800/80 bg-gradient-to-b from-navy-900/72 via-navy-900/56 to-navy-950/88 p-5">
        <div className="flex items-center gap-2">
          <Brain className="h-4 w-4 text-violet-300" />
          <div>
            <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Role heatmap</p>
            <h3 className="text-sm font-semibold text-white">Which specialists are earning their keep</h3>
          </div>
        </div>
        <div className="mt-4 space-y-3">
          {roleHeatmap.length > 0 ? roleHeatmap.map((role) => (
            <div key={role.role} className="rounded-2xl border border-navy-700/70 bg-navy-950/45 p-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium capitalize text-white">{role.role}</p>
                  <p className="mt-1 text-[11px] text-slate-500">{role.steps} handoffs · {formatCredits(role.credits)} cr</p>
                </div>
                <div className="text-right text-[11px] text-slate-400">
                  <p>{role.failureRate}% fail rate</p>
                  <p className="mt-1">{formatTokenCount(role.tokens)} tokens</p>
                </div>
              </div>
              <div className="mt-3 h-2 rounded-full bg-navy-950/70">
                <div className="h-full rounded-full bg-gradient-to-r from-violet-400 to-cyan-300" style={{ width: role.activityWidth }} />
              </div>
            </div>
          )) : (
            <div className="rounded-2xl border border-dashed border-navy-700/70 bg-navy-950/35 p-4 text-sm text-slate-500">
              No role performance data yet.
            </div>
          )}
        </div>
      </div>

      <div className="rounded-[1.8rem] border border-navy-800/80 bg-gradient-to-b from-navy-900/72 via-navy-900/56 to-navy-950/88 p-5">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-emerald-300" />
          <div>
            <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Workflow benchmarks</p>
            <h3 className="text-sm font-semibold text-white">How this workflow compares</h3>
          </div>
        </div>
        <div className="mt-4 space-y-3">
          {workflowBenchmarks.map((row) => (
            <button
              key={row.id}
              type="button"
              onClick={() => onSelectBenchmarkWorkflow(row.id)}
              className={`w-full rounded-2xl border p-3 text-left transition-colors ${row.isSelected ? 'border-violet-500/25 bg-violet-500/8' : 'border-navy-700/70 bg-navy-950/40 hover:border-violet-500/18 hover:bg-navy-900/55'}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-white">{row.name}</p>
                  <p className="mt-1 text-[11px] text-slate-500">{row.stepCount} steps</p>
                </div>
                <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${getStatusTone(row.lastStatus)}`}>
                  {row.lastStatus}
                </span>
              </div>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <div>
                  <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.16em] text-slate-500">
                    <span>Success</span>
                    <span>{row.successRate}%</span>
                  </div>
                  <div className="mt-1 h-2 rounded-full bg-navy-950/70">
                    <div className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-cyan-300" style={{ width: `${Math.max(10, row.successRate)}%` }} />
                  </div>
                </div>
                <div>
                  <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.16em] text-slate-500">
                    <span>Spend</span>
                    <span>{row.averageCredits ? `${formatCredits(row.averageCredits)} cr` : '—'}</span>
                  </div>
                  <div className="mt-1 h-2 rounded-full bg-navy-950/70">
                    <div className="h-full rounded-full bg-gradient-to-r from-amber-300 to-violet-400" style={{ width: row.costWidth }} />
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </>
  );
}
