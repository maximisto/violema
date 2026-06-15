import type { ReactNode } from 'react';
import BarChart3 from 'lucide-react/dist/esm/icons/bar-chart-3.js';
import ChevronRight from 'lucide-react/dist/esm/icons/chevron-right.js';
import Orbit from 'lucide-react/dist/esm/icons/orbit.js';
import Radar from 'lucide-react/dist/esm/icons/radar.js';
import Target from 'lucide-react/dist/esm/icons/target.js';
import type { AutomationExecutionPolicyDraft } from '../types';

interface CandidatePreset {
  id: string;
  label: string;
  summary: string;
  isActive: boolean;
  math: {
    activeElasticLanes: number;
    estimatedBands: string;
  };
  policy: AutomationExecutionPolicyDraft;
  scenarioSpend: number;
  scenarioAssurance: number;
  scenarioFit: number;
}

interface OptimizeReleaseCandidateSectionProps {
  candidatePresets: CandidatePreset[];
  decisionBrief?: ReactNode;
  selectedPresetId: string;
  previewPresetLabel: string;
  activePresetLabel: string;
  previewScenarioComparison?: {
    scenarioSpend: number;
    scenarioAssurance: number;
    scenarioFit: number;
  };
  currentIndices: {
    spend: number;
    assurance: number;
    fit: number;
  };
  policyDiffRows: Array<{
    label: string;
    current: string;
    next: string;
  }>;
  policyRadarMetrics: Array<{
    label: string;
    live: number;
    preview: number;
  }>;
  frontierPoints: Array<{
    id: string;
    label: string;
    isActive: boolean;
    x: number;
    y: number;
    size: number;
  }>;
  actionBusy: boolean;
  onSelectPreset: (id: string) => void;
  onApplyPreviewPreset: () => void;
  formatSignedDelta: (value: number) => string;
  buildRadarPolygon: (values: number[], radius: number, cx: number, cy: number) => string;
}

export function OptimizeReleaseCandidateSection({
  candidatePresets,
  decisionBrief,
  selectedPresetId,
  previewPresetLabel,
  activePresetLabel,
  previewScenarioComparison,
  currentIndices,
  policyDiffRows,
  policyRadarMetrics,
  frontierPoints,
  actionBusy,
  onSelectPreset,
  onApplyPreviewPreset,
  formatSignedDelta,
  buildRadarPolygon,
}: OptimizeReleaseCandidateSectionProps) {
  return (
    <div className="grid gap-6">
      <div className="rounded-[1.8rem] border border-navy-800/80 bg-gradient-to-b from-navy-900/72 via-navy-900/56 to-navy-950/88 p-5">
        <div className="flex items-center gap-2">
          <Target className="h-4 w-4 text-cyan-300" />
          <div>
            <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Release candidate</p>
            <h3 className="text-sm font-semibold text-white">Choose the candidate before you apply it</h3>
          </div>
        </div>
        <p className="mt-2 text-sm leading-relaxed text-slate-400">
          Compare presets against this workflow first. The goal is to make cost-quality tradeoffs obvious before you commit the system to a new posture.
        </p>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {candidatePresets.map((preset) => (
            <button
              key={preset.id}
              type="button"
              onClick={() => onSelectPreset(preset.id)}
              className={`rounded-[1.5rem] border p-4 text-left transition-all ${
                selectedPresetId === preset.id
                  ? 'border-violet-500/30 bg-violet-500/10 shadow-[0_18px_44px_rgba(76,29,149,0.16)]'
                  : 'border-navy-700/70 bg-navy-950/42 hover:border-violet-500/20 hover:bg-navy-900/55'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-white">{preset.label}</p>
                  <p className="mt-2 text-[12px] leading-relaxed text-slate-400">{preset.summary}</p>
                </div>
                <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${preset.isActive ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-200' : 'border-navy-700 bg-navy-900 text-slate-400'}`}>
                  {preset.isActive ? 'Live' : 'Preview'}
                </span>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2 text-[10px]">
                <div>
                  <p className="text-slate-500">Lanes</p>
                  <p className="mt-1 text-white">{preset.math.activeElasticLanes}</p>
                </div>
                <div>
                  <p className="text-slate-500">Review</p>
                  <p className="mt-1 text-white">{preset.policy.reviewPolicy}</p>
                </div>
                <div>
                  <p className="text-slate-500">Bias</p>
                  <p className="mt-1 text-white">{preset.math.estimatedBands}</p>
                </div>
              </div>
              <div className="mt-3 space-y-2">
                {[
                  { label: 'Spend', value: preset.scenarioSpend, color: 'from-amber-300 to-violet-400' },
                  { label: 'Assurance', value: preset.scenarioAssurance, color: 'from-cyan-300 to-emerald-400' },
                  { label: 'Fit', value: preset.scenarioFit, color: 'from-violet-300 to-fuchsia-400' },
                ].map((metric) => (
                  <div key={metric.label}>
                    <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.16em] text-slate-500">
                      <span>{metric.label}</span>
                      <span>{metric.value}</span>
                    </div>
                    <div className="mt-1 h-1.5 rounded-full bg-navy-950/70">
                      <div className={`h-full rounded-full bg-gradient-to-r ${metric.color}`} style={{ width: `${metric.value}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </button>
          ))}
        </div>
        {decisionBrief ? (
          <div className="mt-4">
            {decisionBrief}
          </div>
        ) : null}
      </div>

      <div className="space-y-6">
        <div className="rounded-[1.8rem] border border-navy-800/80 bg-gradient-to-b from-navy-900/72 via-navy-900/56 to-navy-950/88 p-5">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-amber-300" />
            <div>
              <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Candidate diff</p>
              <h3 className="text-sm font-semibold text-white">What changes if you release this setup</h3>
            </div>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-navy-700/70 bg-navy-950/45 p-3">
              <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Preview preset</p>
              <p className="mt-1 text-sm font-medium text-white">{previewPresetLabel}</p>
            </div>
            <div className="rounded-2xl border border-navy-700/70 bg-navy-950/45 p-3">
              <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Active preset</p>
              <p className="mt-1 text-sm font-medium text-white">{activePresetLabel}</p>
            </div>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {[
              { label: 'Spend', current: currentIndices.spend, next: previewScenarioComparison?.scenarioSpend ?? currentIndices.spend },
              { label: 'Assurance', current: currentIndices.assurance, next: previewScenarioComparison?.scenarioAssurance ?? currentIndices.assurance },
              { label: 'Fit', current: currentIndices.fit, next: previewScenarioComparison?.scenarioFit ?? currentIndices.fit },
            ].map((metric) => (
              <div key={metric.label} className="rounded-2xl border border-navy-700/70 bg-navy-950/45 p-3">
                <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">{metric.label}</p>
                <p className="mt-1 text-lg font-semibold text-white">{metric.next}</p>
                <p className={`mt-1 text-[11px] ${metric.next === metric.current ? 'text-slate-500' : metric.next > metric.current ? 'text-emerald-300' : 'text-amber-300'}`}>
                  {formatSignedDelta(metric.next - metric.current)} vs live
                </p>
              </div>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              type="button"
              disabled={actionBusy || selectedPresetId === candidatePresets.find((preset) => preset.isActive)?.id}
              onClick={onApplyPreviewPreset}
              className="rounded-xl border border-violet-500/24 bg-violet-500/10 px-4 py-2 text-sm font-medium text-violet-100 transition-colors hover:bg-violet-500/14 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {selectedPresetId === candidatePresets.find((preset) => preset.isActive)?.id ? 'Already applied' : `Apply ${previewPresetLabel}`}
            </button>
            <p className="text-[11px] leading-relaxed text-slate-500">Use presets first. Only drop into advanced overrides if you have a real reason to outsmart the system math.</p>
          </div>
          <div className="mt-4 rounded-2xl border border-white/6 bg-white/[0.03] p-4">
            <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Before / after policy diff</p>
            <div className="mt-3 space-y-2">
              {policyDiffRows.length > 0 ? policyDiffRows.map((row) => (
                <div key={row.label} className="flex items-center justify-between gap-3 rounded-xl border border-navy-700/70 bg-navy-950/45 px-3 py-2 text-sm">
                  <span className="text-slate-400">{row.label}</span>
                  <div className="flex items-center gap-2 text-white">
                    <span className="text-slate-500">{row.current}</span>
                    <ChevronRight className="h-3.5 w-3.5 text-slate-500" />
                    <span>{row.next}</span>
                  </div>
                </div>
              )) : (
                <div className="rounded-xl border border-dashed border-navy-700/70 bg-navy-950/35 px-3 py-2 text-sm text-slate-500">
                  This preview matches the active policy.
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="rounded-[1.8rem] border border-navy-800/80 bg-gradient-to-b from-navy-900/72 via-navy-900/56 to-navy-950/88 p-5">
          <div className="flex items-center gap-2">
            <Orbit className="h-4 w-4 text-violet-300" />
            <div>
              <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Live vs candidate</p>
              <h3 className="text-sm font-semibold text-white">Release radar</h3>
            </div>
          </div>
          <p className="mt-2 text-sm leading-relaxed text-slate-400">
            The preview should earn its extra cost. This chart makes the tradeoff visible before you apply the policy.
          </p>
          <div className="mt-4 grid gap-4 lg:grid-cols-[13rem,minmax(0,1fr)]">
            <div className="flex items-center justify-center rounded-[1.6rem] border border-white/6 bg-white/[0.03] p-4">
              <svg viewBox="0 0 220 220" className="h-48 w-48" aria-hidden="true">
                {[1, 2, 3, 4].map((ring) => (
                  <polygon
                    key={ring}
                    points={buildRadarPolygon([25 * ring, 25 * ring, 25 * ring], 72, 110, 110)}
                    fill="none"
                    stroke="rgba(148,163,184,0.14)"
                    strokeWidth="1"
                  />
                ))}
                {policyRadarMetrics.map((metric, index) => {
                  const angle = (-Math.PI / 2) + (index / policyRadarMetrics.length) * Math.PI * 2;
                  const x = 110 + Math.cos(angle) * 84;
                  const y = 110 + Math.sin(angle) * 84;
                  return (
                    <g key={metric.label}>
                      <line x1="110" y1="110" x2={x} y2={y} stroke="rgba(148,163,184,0.16)" strokeWidth="1" />
                      <text x={x} y={y} fill="rgba(226,232,240,0.88)" fontSize="11" textAnchor="middle" dominantBaseline="middle">
                        {metric.label}
                      </text>
                    </g>
                  );
                })}
                <polygon
                  points={buildRadarPolygon(policyRadarMetrics.map((metric) => metric.live), 72, 110, 110)}
                  fill="rgba(56,189,248,0.16)"
                  stroke="rgba(34,211,238,0.9)"
                  strokeWidth="2"
                />
                <polygon
                  points={buildRadarPolygon(policyRadarMetrics.map((metric) => metric.preview), 72, 110, 110)}
                  fill="rgba(168,85,247,0.16)"
                  stroke="rgba(192,132,252,0.92)"
                  strokeWidth="2"
                />
              </svg>
            </div>
            <div className="space-y-3">
              {policyRadarMetrics.map((metric) => (
                <div key={metric.label} className="rounded-2xl border border-navy-700/70 bg-navy-950/45 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-medium text-white">{metric.label}</p>
                    <p className={`text-[11px] ${metric.preview === metric.live ? 'text-slate-500' : metric.preview > metric.live ? 'text-emerald-300' : 'text-amber-300'}`}>
                      {formatSignedDelta(metric.preview - metric.live)}
                    </p>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-3 text-[11px]">
                    <div className="rounded-xl border border-cyan-500/18 bg-cyan-500/8 px-3 py-2">
                      <p className="text-slate-400">Live</p>
                      <p className="mt-1 text-white">{metric.live}</p>
                    </div>
                    <div className="rounded-xl border border-violet-500/18 bg-violet-500/8 px-3 py-2">
                      <p className="text-slate-400">Preview</p>
                      <p className="mt-1 text-white">{metric.preview}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="rounded-[1.8rem] border border-navy-800/80 bg-gradient-to-b from-navy-900/72 via-navy-900/56 to-navy-950/88 p-5">
          <div className="flex items-center gap-2">
            <Radar className="h-4 w-4 text-cyan-300" />
            <div>
              <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Cost-quality frontier</p>
              <h3 className="text-sm font-semibold text-white">See the tradeoff, don’t guess it</h3>
            </div>
          </div>
          <div className="relative mt-4 h-72 rounded-[1.6rem] border border-white/6 bg-[linear-gradient(180deg,rgba(15,23,42,0.72),rgba(2,6,23,0.96))]">
            <div className="absolute inset-x-4 bottom-4 top-4">
              <div className="absolute inset-0 rounded-[1.2rem] border border-dashed border-white/8" />
              <div className="absolute inset-x-0 top-1/2 border-t border-dashed border-white/6" />
              <div className="absolute left-1/2 inset-y-0 border-l border-dashed border-white/6" />
              {frontierPoints.map((point) => (
                <button
                  key={point.id}
                  type="button"
                  onClick={() => onSelectPreset(point.id)}
                  className={`absolute -translate-x-1/2 translate-y-1/2 rounded-full border text-[10px] font-medium text-white transition-transform hover:scale-105 ${
                    point.id === selectedPresetId
                      ? 'border-violet-200 bg-violet-500/80 shadow-[0_0_30px_rgba(139,92,246,0.45)]'
                      : point.isActive
                        ? 'border-emerald-200 bg-emerald-500/70'
                        : 'border-cyan-200 bg-cyan-500/70'
                  }`}
                  style={{ left: `${point.x}%`, bottom: `${point.y}%`, width: `${point.size}px`, height: `${point.size}px` }}
                  aria-label={point.label}
                />
              ))}
              <div className="absolute -bottom-2 left-0 text-[10px] uppercase tracking-[0.16em] text-slate-500">Lower spend</div>
              <div className="absolute -bottom-2 right-0 text-[10px] uppercase tracking-[0.16em] text-slate-500">Higher spend</div>
              <div className="absolute left-0 top-0 text-[10px] uppercase tracking-[0.16em] text-slate-500">Higher assurance</div>
              <div className="absolute left-0 bottom-2 text-[10px] uppercase tracking-[0.16em] text-slate-500">Lower assurance</div>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2 text-[10px] text-slate-400">
            {frontierPoints.map((point) => (
              <span key={`${point.id}-legend`} className={`rounded-full border px-2 py-0.5 ${
                point.id === selectedPresetId
                  ? 'border-violet-500/20 bg-violet-500/10 text-violet-200'
                  : point.isActive
                    ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-200'
                    : 'border-navy-700 bg-navy-900 text-slate-300'
              }`}>
                {point.label}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
