import Activity from 'lucide-react/dist/esm/icons/activity.js';
import Gauge from 'lucide-react/dist/esm/icons/gauge.js';
import Layers3 from 'lucide-react/dist/esm/icons/layers-3.js';

interface LiveAdvancedSupportSectionProps {
  livePulse: {
    status: string;
    modelSource: string;
    currentCost: string;
    elapsed: string;
    summary: string;
  };
  scenario: {
    scenarioLabel: string;
    presetLabel: string;
    complexity: string;
    directedRoleCount: number;
    workflowStepCount: number;
    estimatedToolCalls: number;
    matchedSavedExperiment: boolean;
  };
  selectedRun?: {
    label: string;
    timestamp: string;
    status: string;
    credits: string;
    duration: string;
    trendLabel: string;
    trendValue: string;
    matchedPlans: Array<{
      id: string;
      name: string;
      score: number;
      active: boolean;
      onSelect: () => void;
    }>;
    deltas?: Array<{
      id: string;
      label: string;
      value: string;
      tone: 'positive' | 'warning';
    }>;
    onOpenReplay: () => void;
    onSyncComparison: () => void;
  };
  phaseRows: Array<{
    phase: string;
    directiveCount: number;
    directives: string[];
  }>;
  getStatusTone: (status: string) => string;
}

export function LiveAdvancedSupportSection({
  livePulse,
  scenario,
  selectedRun,
  phaseRows,
  getStatusTone,
}: LiveAdvancedSupportSectionProps) {
  return (
    <div className="grid gap-6 xl:grid-cols-2 xl:items-start">
      <div className="space-y-6">
        <div className="rounded-[1.8rem] border border-navy-800/80 bg-gradient-to-b from-navy-900/72 via-navy-900/56 to-navy-950/88 p-5">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-emerald-300" />
            <div>
              <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Live pulse</p>
              <h3 className="text-sm font-semibold text-white">What the system is doing now</h3>
            </div>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-navy-700/70 bg-navy-950/45 p-3">
              <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Status</p>
              <p className="mt-1 text-sm font-medium text-white">{livePulse.status}</p>
            </div>
            <div className="rounded-2xl border border-navy-700/70 bg-navy-950/45 p-3">
              <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Model source</p>
              <p className="mt-1 text-sm font-medium text-white">{livePulse.modelSource}</p>
            </div>
            <div className="rounded-2xl border border-navy-700/70 bg-navy-950/45 p-3">
              <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Current cost</p>
              <p className="mt-1 text-sm font-medium text-white">{livePulse.currentCost}</p>
            </div>
            <div className="rounded-2xl border border-navy-700/70 bg-navy-950/45 p-3">
              <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Elapsed</p>
              <p className="mt-1 text-sm font-medium text-white">{livePulse.elapsed}</p>
            </div>
          </div>
          <p className="mt-4 text-sm leading-relaxed text-slate-400">{livePulse.summary}</p>
        </div>

        <div className="rounded-[1.8rem] border border-navy-800/80 bg-gradient-to-b from-navy-900/72 via-navy-900/56 to-navy-950/88 p-5">
          <div className="flex items-center gap-2">
            <Gauge className="h-4 w-4 text-cyan-300" />
            <div>
              <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Active scenario</p>
              <h3 className="text-sm font-semibold text-white">What policy is live right now</h3>
            </div>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-2xl border border-navy-700/70 bg-navy-950/45 p-3">
              <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Scenario</p>
              <p className="mt-1 text-sm font-medium text-white">{scenario.scenarioLabel}</p>
            </div>
            <div className="rounded-2xl border border-navy-700/70 bg-navy-950/45 p-3">
              <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Preset</p>
              <p className="mt-1 text-sm font-medium text-white">{scenario.presetLabel}</p>
            </div>
            <div className="rounded-2xl border border-navy-700/70 bg-navy-950/45 p-3">
              <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Complexity</p>
              <p className="mt-1 text-sm font-medium capitalize text-white">{scenario.complexity}</p>
            </div>
            <div className="rounded-2xl border border-navy-700/70 bg-navy-950/45 p-3">
              <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Directed roles</p>
              <p className="mt-1 text-sm font-medium text-white">{scenario.directedRoleCount}</p>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2 text-[10px] text-slate-400">
            <span className="ui-pill px-2 py-0.5 normal-case tracking-normal text-slate-300">{scenario.workflowStepCount} steps</span>
            <span className="ui-pill px-2 py-0.5 normal-case tracking-normal text-slate-300">{scenario.estimatedToolCalls} tool calls</span>
            <span className={`ui-pill px-2 py-0.5 normal-case tracking-normal ${scenario.matchedSavedExperiment ? 'text-cyan-200' : 'text-slate-300'}`}>
              {scenario.matchedSavedExperiment ? 'Matched saved experiment' : 'Ad hoc live posture'}
            </span>
          </div>
          {selectedRun ? (
            <div className="mt-4 rounded-2xl border border-white/6 bg-white/[0.03] p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Selected run</p>
                  <p className="mt-1 text-sm font-medium text-white">{selectedRun.label}</p>
                  <p className="mt-1 text-[11px] text-slate-500">{selectedRun.timestamp}</p>
                </div>
                <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${getStatusTone(selectedRun.status)}`}>{selectedRun.status}</span>
              </div>
              <div className="mt-3 flex flex-wrap gap-2 text-[10px] text-slate-300">
                <span className="ui-pill px-2 py-0.5 normal-case tracking-normal text-slate-300">{selectedRun.credits}</span>
                <span className="ui-pill px-2 py-0.5 normal-case tracking-normal text-slate-300">{selectedRun.duration}</span>
                <span className="ui-pill px-2 py-0.5 normal-case tracking-normal text-slate-300">{selectedRun.trendLabel}: {selectedRun.trendValue}</span>
              </div>
              {selectedRun.matchedPlans.length > 0 ? (
                <div className="mt-3">
                  <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Attributed plans</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {selectedRun.matchedPlans.map((entry) => (
                      <button
                        key={entry.id}
                        type="button"
                        onClick={entry.onSelect}
                        className={`ui-pill px-2 py-0.5 normal-case tracking-normal ${entry.active ? 'border-cyan-500/30 bg-cyan-500/12 text-cyan-200' : 'text-slate-300'}`}
                      >
                        {entry.name} <span className="ml-1 text-[10px] text-slate-500">({entry.score})</span>
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
              {selectedRun.deltas?.length ? (
                <div className="mt-3 grid gap-2 sm:grid-cols-3 text-[11px]">
                  {selectedRun.deltas.map((delta) => (
                    <div key={delta.id} className="rounded-xl border border-navy-700/70 bg-navy-950/55 px-3 py-2">
                      <p className="text-slate-500">{delta.label}</p>
                      <p className={`mt-1 ${delta.tone === 'positive' ? 'text-emerald-200' : 'text-amber-200'}`}>{delta.value}</p>
                    </div>
                  ))}
                </div>
              ) : null}
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={selectedRun.onOpenReplay}
                  className="ui-pill px-3 py-1.5 text-[11px] normal-case tracking-normal text-slate-300"
                >
                  Open in replay
                </button>
                <button
                  type="button"
                  onClick={selectedRun.onSyncComparison}
                  className="ui-pill px-3 py-1.5 text-[11px] normal-case tracking-normal text-slate-300"
                >
                  Sync comparison target
                </button>
              </div>
            </div>
          ) : null}
        </div>

        <div className="rounded-[1.8rem] border border-navy-800/80 bg-gradient-to-b from-navy-900/72 via-navy-900/56 to-navy-950/88 p-5">
          <div className="flex items-center gap-2">
            <Layers3 className="h-4 w-4 text-violet-300" />
            <div>
              <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Phase steering</p>
              <h3 className="text-sm font-semibold text-white">Where directives are applied</h3>
            </div>
          </div>
          <div className="mt-4 grid gap-2">
            {phaseRows.map((row) => (
              <div key={row.phase} className="rounded-2xl border border-navy-700/70 bg-navy-950/45 p-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-medium text-white">{row.phase}</p>
                  <span className="text-[11px] text-slate-500">{row.directiveCount} directive{row.directiveCount === 1 ? '' : 's'}</span>
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {row.directives.length > 0 ? row.directives.map((directive) => (
                    <span key={`${row.phase}-${directive}`} className="ui-pill px-2 py-0.5 normal-case tracking-normal text-slate-300">
                      {directive}
                    </span>
                  )) : <span className="text-[12px] text-slate-500">No steering on this phase.</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
