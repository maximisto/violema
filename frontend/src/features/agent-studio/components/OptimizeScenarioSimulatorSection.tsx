import { Sparkles } from 'lucide-react';
import type { ScenarioPresetId } from '../types';

interface OptimizeScenarioSimulatorSectionProps {
  scenarios: Array<{
    id: ScenarioPresetId;
    label: string;
    summary: string;
  }>;
  selectedScenarioId: string;
  selectedScenarioLabel: string;
  selectedScenarioSummary: string;
  previewPresetLabel: string;
  scenarioSnapshot: {
    stepCount: number;
    toolCalls: number;
    reasoningLoad: number | string;
    recommendedElasticLanes: number;
  };
  actionBusy: boolean;
  experimentSaveBusy: boolean;
  onSelectScenario: (id: ScenarioPresetId) => void;
  onSaveExperiment: () => void;
}

export function OptimizeScenarioSimulatorSection({
  scenarios,
  selectedScenarioId,
  selectedScenarioLabel,
  selectedScenarioSummary,
  previewPresetLabel,
  scenarioSnapshot,
  actionBusy,
  experimentSaveBusy,
  onSelectScenario,
  onSaveExperiment,
}: OptimizeScenarioSimulatorSectionProps) {
  return (
    <div className="rounded-[1.8rem] border border-navy-800/80 bg-gradient-to-b from-navy-900/72 via-navy-900/56 to-navy-950/88 p-5">
      <div className="flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-cyan-300" />
        <div>
          <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Scenario simulator</p>
          <h3 className="text-sm font-semibold text-white">Stress-test the policy before you change it</h3>
        </div>
      </div>
      <p className="mt-2 text-sm leading-relaxed text-slate-400">
        Simulate the same workflow under different operating conditions. This gives users a reason for the configuration, not just a list of knobs.
      </p>
      <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,0.95fr),minmax(0,1.05fr)]">
        <div className="grid gap-3 md:grid-cols-2">
          {scenarios.map((scenario) => (
            <button
              key={scenario.id}
              type="button"
              onClick={() => onSelectScenario(scenario.id)}
              className={`rounded-2xl border p-4 text-left transition-all ${
                selectedScenarioId === scenario.id
                  ? 'border-cyan-500/28 bg-cyan-500/10 shadow-[0_18px_44px_rgba(8,145,178,0.16)]'
                  : 'border-navy-700/70 bg-navy-950/42 hover:border-cyan-500/18 hover:bg-navy-900/55'
              }`}
            >
              <p className="text-sm font-semibold text-white">{scenario.label}</p>
              <p className="mt-2 text-[12px] leading-relaxed text-slate-400">{scenario.summary}</p>
            </button>
          ))}
        </div>
        <div className="rounded-[1.6rem] border border-white/6 bg-white/[0.03] p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Saved experiment</p>
              <p className="mt-1 text-sm font-medium text-white">{selectedScenarioLabel}</p>
            </div>
            <span className="rounded-full border border-cyan-500/20 bg-cyan-500/10 px-2 py-0.5 text-[10px] font-medium text-cyan-200">
              {previewPresetLabel}
            </span>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-navy-700/70 bg-navy-950/45 p-3">
              <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Scenario steps</p>
              <p className="mt-1 text-lg font-semibold text-white">{scenarioSnapshot.stepCount}</p>
            </div>
            <div className="rounded-2xl border border-navy-700/70 bg-navy-950/45 p-3">
              <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Scenario tools</p>
              <p className="mt-1 text-lg font-semibold text-white">{scenarioSnapshot.toolCalls}</p>
            </div>
            <div className="rounded-2xl border border-navy-700/70 bg-navy-950/45 p-3">
              <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Reasoning load</p>
              <p className="mt-1 text-lg font-semibold text-white">{scenarioSnapshot.reasoningLoad}</p>
            </div>
            <div className="rounded-2xl border border-navy-700/70 bg-navy-950/45 p-3">
              <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Suggested lanes</p>
              <p className="mt-1 text-lg font-semibold text-white">{scenarioSnapshot.recommendedElasticLanes}</p>
            </div>
          </div>
          <p className="mt-4 text-sm leading-relaxed text-slate-400">{selectedScenarioSummary}</p>
          <p className="mt-2 text-[12px] leading-relaxed text-slate-500">
            This scenario is remembered per workflow, so when you come back to this automation the same test setup is waiting for you.
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              type="button"
              disabled={actionBusy || experimentSaveBusy}
              onClick={onSaveExperiment}
              className="rounded-xl border border-cyan-500/24 bg-cyan-500/10 px-4 py-2 text-sm font-medium text-cyan-100 transition-colors hover:bg-cyan-500/14 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {experimentSaveBusy ? 'Saving…' : 'Save experiment snapshot'}
            </button>
            <p className="text-[11px] leading-relaxed text-slate-500">Save strong scenario and preset pairings so the workflow can be compared and restored later.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
