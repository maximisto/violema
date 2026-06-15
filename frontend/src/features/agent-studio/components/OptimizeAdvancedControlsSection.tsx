import Brain from 'lucide-react/dist/esm/icons/brain.js';
import Gauge from 'lucide-react/dist/esm/icons/gauge.js';
import type {
  AutomationExecutionPolicyDraft,
  ExecutionMode,
  OptimizationGoal,
  ReviewPolicy,
} from '../types';

type RecommendationAction = 'lean_ops' | 'raise_review' | 'match_lanes' | 'trim_lanes' | 'none';

interface OptimizeAdvancedControlsSectionProps {
  workflowFingerprint: {
    stepCount: number;
    toolCalls: number;
    reasoningLoad: string;
    recommendedElasticLanes: number;
    activeElasticLanes: number;
  };
  optimizationRecommendations: Array<{
    title: string;
    body: string;
    action: RecommendationAction;
  }>;
  selectedPolicy: AutomationExecutionPolicyDraft;
  actionBusy: boolean;
  onApplyRecommendationAction: (action: RecommendationAction) => void;
  onSetMode: (mode: ExecutionMode) => void;
  onSetOptimizationGoal: (goal: OptimizationGoal) => void;
  onSetReviewPolicy: (policy: ReviewPolicy) => void;
  onSetMaxElasticLanes: (count: number) => void;
  getExecutionModeLabel: (value: ExecutionMode) => string;
  getOptimizationGoalLabel: (value: OptimizationGoal) => string;
  getReviewPolicyLabel: (value: ReviewPolicy) => string;
}

export function OptimizeAdvancedControlsSection({
  workflowFingerprint,
  optimizationRecommendations,
  selectedPolicy,
  actionBusy,
  onApplyRecommendationAction,
  onSetMode,
  onSetOptimizationGoal,
  onSetReviewPolicy,
  onSetMaxElasticLanes,
  getExecutionModeLabel,
  getOptimizationGoalLabel,
  getReviewPolicyLabel,
}: OptimizeAdvancedControlsSectionProps) {
  return (
    <div className="grid gap-6">
      <div className="rounded-[1.8rem] border border-navy-800/80 bg-gradient-to-b from-navy-900/72 via-navy-900/56 to-navy-950/88 p-5">
        <div className="flex items-center gap-2">
          <Gauge className="h-4 w-4 text-amber-300" />
          <div>
            <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Workflow fingerprint</p>
            <h3 className="text-sm font-semibold text-white">Why the system recommends what it does</h3>
          </div>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-navy-700/70 bg-navy-950/45 p-3">
            <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Workflow steps</p>
            <p className="mt-1 text-lg font-semibold text-white">{workflowFingerprint.stepCount}</p>
          </div>
          <div className="rounded-2xl border border-navy-700/70 bg-navy-950/45 p-3">
            <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Tool calls</p>
            <p className="mt-1 text-lg font-semibold text-white">{workflowFingerprint.toolCalls}</p>
          </div>
          <div className="rounded-2xl border border-navy-700/70 bg-navy-950/45 p-3">
            <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Reasoning load</p>
            <p className="mt-1 text-lg font-semibold text-white">{workflowFingerprint.reasoningLoad}</p>
          </div>
          <div className="rounded-2xl border border-navy-700/70 bg-navy-950/45 p-3">
            <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Recommended lanes</p>
            <p className="mt-1 text-lg font-semibold text-white">{workflowFingerprint.recommendedElasticLanes}</p>
          </div>
        </div>
        <p className="mt-4 text-sm leading-relaxed text-slate-400">
          Harder reasoning should only climb to stronger lanes when workflow complexity and failure risk justify it. Everything else should stay cheap, fast, and operational.
        </p>
        <div className="mt-4 space-y-3">
          {optimizationRecommendations.map((item) => (
            <div key={item.title} className="rounded-2xl border border-violet-500/14 bg-violet-500/6 p-4">
              <p className="text-sm font-medium text-white">{item.title}</p>
              <p className="mt-2 text-sm leading-relaxed text-slate-400">{item.body}</p>
              {item.action !== 'none' ? (
                <button
                  type="button"
                  disabled={actionBusy}
                  onClick={() => onApplyRecommendationAction(item.action)}
                  className="mt-3 ui-pill px-3 py-1.5 text-[11px] normal-case tracking-normal text-violet-100 disabled:opacity-60"
                >
                  Apply recommendation
                </button>
              ) : null}
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-[1.8rem] border border-navy-800/80 bg-gradient-to-b from-navy-900/72 via-navy-900/56 to-navy-950/88 p-5">
        <div className="flex items-center gap-2">
          <Brain className="h-4 w-4 text-violet-300" />
          <div>
            <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Advanced overrides</p>
            <h3 className="text-sm font-semibold text-white">Use only when the preset isn’t enough</h3>
          </div>
        </div>

        <div className="mt-4 space-y-4">
          <div>
            <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Mode</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {[{ value: 'recommended' as const, label: 'System recommended' }, { value: 'custom' as const, label: 'Custom policy' }].map((option) => (
                <button
                  key={option.value}
                  type="button"
                  disabled={actionBusy}
                  onClick={() => onSetMode(option.value)}
                  className={`ui-pill px-3 py-1.5 text-[11px] normal-case tracking-normal ${selectedPolicy.mode === option.value ? 'border-violet-500/30 bg-violet-500/12 text-violet-200' : 'text-slate-300'} disabled:opacity-60`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Optimization goal</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {[{ value: 'balanced' as const, label: 'Balanced' }, { value: 'cost_saver' as const, label: 'Cost Saver' }, { value: 'quality_first' as const, label: 'Quality First' }].map((option) => (
                <button
                  key={option.value}
                  type="button"
                  disabled={actionBusy}
                  onClick={() => onSetOptimizationGoal(option.value)}
                  className={`ui-pill px-3 py-1.5 text-[11px] normal-case tracking-normal ${selectedPolicy.optimizationGoal === option.value ? 'border-cyan-500/30 bg-cyan-500/12 text-cyan-200' : 'text-slate-300'} disabled:opacity-60`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Review policy</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {[{ value: 'lean' as const, label: 'Lean' }, { value: 'standard' as const, label: 'Standard' }, { value: 'strict' as const, label: 'Strict' }].map((option) => (
                <button
                  key={option.value}
                  type="button"
                  disabled={actionBusy}
                  onClick={() => onSetReviewPolicy(option.value)}
                  className={`ui-pill px-3 py-1.5 text-[11px] normal-case tracking-normal ${selectedPolicy.reviewPolicy === option.value ? 'border-violet-500/30 bg-violet-500/12 text-violet-200' : 'text-slate-300'} disabled:opacity-60`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Elastic lane cap</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {[0, 1, 2, 3, 4].map((count) => (
                <button
                  key={count}
                  type="button"
                  disabled={actionBusy}
                  onClick={() => onSetMaxElasticLanes(count)}
                  className={`ui-pill px-3 py-1.5 text-[11px] normal-case tracking-normal ${selectedPolicy.maxElasticLanes === count ? 'border-cyan-500/30 bg-cyan-500/12 text-cyan-200' : 'text-slate-300'} disabled:opacity-60`}
                >
                  {count}
                </button>
              ))}
            </div>
          </div>
          <div className="rounded-2xl border border-white/6 bg-white/[0.03] p-4">
            <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Policy snapshot</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div>
                <p className="text-sm text-slate-400">Mode</p>
                <p className="mt-1 text-sm font-medium text-white">{getExecutionModeLabel(selectedPolicy.mode)}</p>
              </div>
              <div>
                <p className="text-sm text-slate-400">Optimization</p>
                <p className="mt-1 text-sm font-medium text-white">{getOptimizationGoalLabel(selectedPolicy.optimizationGoal)}</p>
              </div>
              <div>
                <p className="text-sm text-slate-400">Review</p>
                <p className="mt-1 text-sm font-medium text-white">{getReviewPolicyLabel(selectedPolicy.reviewPolicy)}</p>
              </div>
              <div>
                <p className="text-sm text-slate-400">Active lanes</p>
                <p className="mt-1 text-sm font-medium text-white">
                  {workflowFingerprint.activeElasticLanes} / {selectedPolicy.maxElasticLanes}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
