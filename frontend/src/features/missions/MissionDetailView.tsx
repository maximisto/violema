import ArrowRight from 'lucide-react/dist/esm/icons/arrow-right.js';
import type React from 'react';
import BarChart3 from 'lucide-react/dist/esm/icons/bar-chart-3.js';
import Bot from 'lucide-react/dist/esm/icons/bot.js';
import CalendarDays from 'lucide-react/dist/esm/icons/calendar-days.js';
import CreditCard from 'lucide-react/dist/esm/icons/credit-card.js';
import Eye from 'lucide-react/dist/esm/icons/eye.js';
import FileText from 'lucide-react/dist/esm/icons/file-text.js';
import MessageSquare from 'lucide-react/dist/esm/icons/message-square.js';
import Network from 'lucide-react/dist/esm/icons/network.js';
import Play from 'lucide-react/dist/esm/icons/play.js';
import ShieldCheck from 'lucide-react/dist/esm/icons/shield-check.js';
import Zap from 'lucide-react/dist/esm/icons/zap.js';
import BrandIcon from '../../components/BrandIcon';
import { buildMissionDashboardSummary } from './missionDashboard';
import {
  buildMissionDetailModel,
  type MissionSelection,
} from './missionDetail';
import { MissionProgressRail } from './MissionProgressRail';
import type {
  MissionAgentView,
  MissionEvidenceItem,
  MissionMetricView,
  MissionStepView,
  MissionWorkspaceTab,
  MissionWorkspaceView,
} from './types';
import type { WorkspaceAreaId, WorkspaceTabId } from './workspaceShell';

interface MissionDetailViewProps {
  mission: MissionWorkspaceView;
  selection: MissionSelection;
  onSelect: (selection: MissionSelection) => void;
  onOpenInspector: (tab: MissionWorkspaceTab) => void;
  onOpenArea: (area: WorkspaceAreaId, tab?: WorkspaceTabId) => void;
  onOpenCredits: () => void;
  onRunNow: () => void;
  onPauseToggle: () => void;
  disabled?: boolean;
}

const detailToneClasses: Record<ReturnType<typeof buildMissionDetailModel>['tone'], {
  border: string;
  chip: string;
  glow: string;
  text: string;
}> = {
  violet: {
    border: 'border-violet-400/28',
    chip: 'border-violet-300/26 bg-violet-300/12 text-violet-100',
    glow: 'from-violet-500/18',
    text: 'text-violet-100',
  },
  cyan: {
    border: 'border-cyan-300/25',
    chip: 'border-cyan-300/24 bg-cyan-300/10 text-cyan-100',
    glow: 'from-cyan-400/18',
    text: 'text-cyan-100',
  },
  green: {
    border: 'border-green-300/24',
    chip: 'border-green-300/22 bg-green-300/10 text-green-100',
    glow: 'from-green-400/16',
    text: 'text-green-100',
  },
  amber: {
    border: 'border-amber-300/28',
    chip: 'border-amber-300/24 bg-amber-300/12 text-amber-100',
    glow: 'from-amber-400/18',
    text: 'text-amber-100',
  },
  red: {
    border: 'border-red-300/28',
    chip: 'border-red-300/24 bg-red-300/12 text-red-100',
    glow: 'from-red-400/18',
    text: 'text-red-100',
  },
  slate: {
    border: 'border-navy-700/80',
    chip: 'border-navy-700/80 bg-navy-950/50 text-slate-300',
    glow: 'from-slate-400/10',
    text: 'text-slate-200',
  },
};

const metricToneClasses: Record<MissionMetricView['tone'], string> = {
  violet: 'border-violet-400/22 bg-violet-400/10 text-violet-100',
  cyan: 'border-cyan-400/20 bg-cyan-400/10 text-cyan-100',
  green: 'border-green-400/20 bg-green-400/10 text-green-100',
  amber: 'border-amber-400/20 bg-amber-400/10 text-amber-100',
  slate: 'border-slate-500/20 bg-slate-500/10 text-slate-200',
};

const stepStatusClasses: Record<MissionStepView['status'], string> = {
  planned: 'border-slate-500/20 bg-slate-500/8 text-slate-300',
  running: 'border-cyan-300/26 bg-cyan-300/12 text-cyan-100',
  waiting_review: 'border-amber-300/26 bg-amber-300/12 text-amber-100',
  failed: 'border-red-300/26 bg-red-300/12 text-red-100',
  completed: 'border-green-300/24 bg-green-300/10 text-green-100',
  paused: 'border-slate-500/24 bg-slate-500/10 text-slate-300',
};

function displayMetricLabel(metric: MissionMetricView) {
  return metric.label.toLowerCase() === 'waste' ? 'Run risk' : metric.label;
}

function SelectionButton({
  active,
  children,
  onClick,
  className = '',
}: {
  active: boolean;
  children: React.ReactNode;
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`w-full rounded-xl border px-3 py-3 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 ${
        active
          ? 'border-violet-300/46 bg-violet-400/12 shadow-[0_0_30px_rgba(124,92,255,0.14),inset_0_1px_0_rgba(255,255,255,0.04)]'
          : 'border-navy-700/72 bg-navy-950/42 hover:border-violet-400/24 hover:bg-navy-900/62'
      } ${className}`}
    >
      {children}
    </button>
  );
}

function StepItem({
  step,
  active,
  onSelect,
}: {
  step: MissionStepView;
  active: boolean;
  onSelect: (selection: MissionSelection) => void;
}) {
  return (
    <SelectionButton active={active} onClick={() => onSelect({ kind: 'step', id: step.id })}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-white">{step.title}</p>
          <p className="mt-1 line-clamp-2 text-[11px] leading-5 text-slate-500">{step.objective}</p>
        </div>
        <span className={`flex-shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${stepStatusClasses[step.status]}`}>
          {step.status.replace('_', ' ')}
        </span>
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        <span className="rounded-full border border-violet-300/18 bg-violet-300/8 px-2 py-0.5 text-[10px] font-medium text-violet-100">
          {step.agentLabel}
        </span>
        {step.toolLabel ? (
          <span className="rounded-full border border-cyan-300/18 bg-cyan-300/8 px-2 py-0.5 text-[10px] font-medium text-cyan-100">
            {step.toolLabel}
          </span>
        ) : null}
      </div>
    </SelectionButton>
  );
}

function AgentItem({
  agent,
  active,
  onSelect,
}: {
  agent: MissionAgentView;
  active: boolean;
  onSelect: (selection: MissionSelection) => void;
}) {
  return (
    <SelectionButton active={active} onClick={() => onSelect({ kind: 'agent', id: agent.id })}>
      <div className="flex items-center gap-3">
        <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl border border-cyan-300/24 bg-cyan-300/10 text-[11px] font-black text-cyan-100">
          {agent.avatarLabel}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <p className="truncate text-sm font-semibold text-white">{agent.label}</p>
            <span className="rounded-full border border-navy-700/80 bg-navy-900/80 px-2 py-0.5 text-[10px] font-medium text-slate-400">
              {agent.status}
            </span>
          </div>
          <p className="mt-1 line-clamp-2 text-[11px] leading-5 text-slate-500">{agent.detail}</p>
        </div>
      </div>
    </SelectionButton>
  );
}

function EvidenceItem({
  item,
  active,
  onSelect,
}: {
  item: MissionEvidenceItem;
  active: boolean;
  onSelect: (selection: MissionSelection) => void;
}) {
  return (
    <SelectionButton active={active} onClick={() => onSelect({ kind: 'evidence', id: item.id })}>
      <div className="flex items-start gap-3">
        <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg border border-cyan-300/20 bg-cyan-300/10 text-cyan-100">
          <FileText className="h-3.5 w-3.5" />
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-white">{item.label}</p>
          <p className="mt-1 truncate text-[10px] text-cyan-100/80">{item.source}</p>
          <p className="mt-1 line-clamp-2 text-[11px] leading-5 text-slate-500">{item.detail}</p>
        </div>
      </div>
    </SelectionButton>
  );
}

export function MissionDetailView({
  mission,
  selection,
  onSelect,
  onOpenInspector,
  onOpenArea,
  onOpenCredits,
  onRunNow,
  onPauseToggle,
  disabled = false,
}: MissionDetailViewProps) {
  const detail = buildMissionDetailModel(mission, selection);
  const tone = detailToneClasses[detail.tone];
  const summary = buildMissionDashboardSummary(mission);

  return (
    <section className="space-y-4">
      <div className={`relative overflow-hidden rounded-2xl border ${tone.border} bg-[linear-gradient(135deg,rgba(15,23,42,0.82),rgba(2,6,23,0.94))] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] sm:p-5`}>
        <div className={`pointer-events-none absolute inset-y-0 left-0 w-40 bg-gradient-to-r ${tone.glow} to-transparent`} />
        <div className="relative flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${tone.chip}`}>
                <Zap className="h-3 w-3" />
                {detail.eyebrow}
              </span>
              <span className="rounded-full border border-green-300/20 bg-green-300/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-green-100">
                {mission.statusLabel}
              </span>
            </div>
            <h2 className="mt-3 max-w-4xl text-2xl font-semibold tracking-[-0.03em] text-white sm:text-3xl">
              {detail.title}
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
              {detail.detail}
            </p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${tone.chip}`}>
                {detail.statusLabel}
              </span>
              {detail.meta.map((item) => (
                <span key={item} className="rounded-full border border-navy-700/75 bg-navy-950/48 px-2 py-0.5 text-[10px] font-medium text-slate-300">
                  {item}
                </span>
              ))}
            </div>
          </div>

          <div className="grid min-w-0 grid-cols-2 gap-2 sm:min-w-[24rem]">
            <button
              type="button"
              onClick={() => onOpenInspector('mission')}
              className="rounded-xl border border-violet-300/22 bg-violet-300/10 px-3 py-3 text-left text-violet-100 transition-colors hover:bg-violet-300/16 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
            >
              <Eye className="h-4 w-4" />
              <p className="mt-2 text-sm font-semibold">Inspector</p>
              <p className="mt-0.5 truncate text-[10px] text-violet-100/70">Fold-in workspace</p>
            </button>
            <button
              type="button"
              onClick={onOpenCredits}
              className="rounded-xl border border-amber-300/22 bg-amber-300/10 px-3 py-3 text-left text-amber-100 transition-colors hover:bg-amber-300/16 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
            >
              <CreditCard className="h-4 w-4" />
              <p className="mt-2 text-sm font-semibold">{summary.creditMetric?.value || '-' } cr</p>
              <p className="mt-0.5 truncate text-[10px] text-amber-100/70">Run cost</p>
            </button>
            <button
              type="button"
              onClick={onRunNow}
              disabled={disabled}
              className="rounded-xl border border-cyan-300/22 bg-cyan-300/10 px-3 py-3 text-left text-cyan-100 transition-colors hover:bg-cyan-300/16 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500"
            >
              <Play className="h-4 w-4" />
              <p className="mt-2 text-sm font-semibold">Run now</p>
              <p className="mt-0.5 truncate text-[10px] text-cyan-100/70">{mission.nextRunLabel}</p>
            </button>
            <button
              type="button"
              onClick={onPauseToggle}
              disabled={disabled}
              className="rounded-xl border border-navy-700/75 bg-navy-950/46 px-3 py-3 text-left text-slate-200 transition-colors hover:border-slate-500/50 hover:bg-navy-900/70 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
            >
              <ShieldCheck className="h-4 w-4" />
              <p className="mt-2 text-sm font-semibold">{mission.status === 'paused' ? 'Resume' : 'Pause'}</p>
              <p className="mt-0.5 truncate text-[10px] text-slate-500">Cadence control</p>
            </button>
          </div>
        </div>

        <MissionProgressRail mission={mission} className="relative mt-5" />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(18rem,0.85fr)]">
        <div className="space-y-4">
          <div className="rounded-2xl border border-navy-800/80 bg-navy-900/45 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-violet-300/80">Mission steps</p>
                <h3 className="mt-1 text-base font-semibold text-white">Track the work</h3>
              </div>
              <button
                type="button"
                onClick={() => onOpenArea('board', 'active')}
                className="inline-flex items-center gap-1.5 rounded-lg border border-navy-700/80 bg-navy-950/55 px-3 py-1.5 text-[11px] font-medium text-slate-300 transition-colors hover:border-violet-500/30 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
              >
                Board
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="mt-3 grid gap-2">
              {mission.steps.map((step) => (
                <StepItem
                  key={step.id}
                  step={step}
                  active={selection.kind === 'step' && selection.id === step.id}
                  onSelect={onSelect}
                />
              ))}
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-2xl border border-navy-800/80 bg-navy-900/45 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-300/80">Agents</p>
                  <h3 className="mt-1 text-base font-semibold text-white">Assigned operators</h3>
                </div>
                <MessageSquare className="h-4 w-4 text-cyan-100" />
              </div>
              <div className="mt-3 space-y-2">
                {mission.agents.map((agent) => (
                  <AgentItem
                    key={agent.id}
                    agent={agent}
                    active={selection.kind === 'agent' && selection.id === agent.id}
                    onSelect={onSelect}
                  />
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-navy-800/80 bg-navy-900/45 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-300/80">Evidence</p>
                  <h3 className="mt-1 text-base font-semibold text-white">Sources and outputs</h3>
                </div>
                <button
                  type="button"
                  onClick={() => onOpenArea('reviews', 'evidence')}
                  className="rounded-lg border border-navy-700/80 bg-navy-950/55 p-1.5 text-slate-400 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
                  aria-label="Open evidence"
                >
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="mt-3 space-y-2">
                {mission.evidence.slice(0, 4).map((item) => (
                  <EvidenceItem
                    key={item.id}
                    item={item}
                    active={selection.kind === 'evidence' && selection.id === item.id}
                    onSelect={onSelect}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className={`rounded-2xl border ${tone.border} bg-navy-900/52 p-4`}>
            <p className={`text-[10px] font-semibold uppercase tracking-[0.18em] ${tone.text}`}>Selected focus</p>
            <h3 className="mt-2 text-lg font-semibold leading-snug text-white">{detail.title}</h3>
            <p className="mt-2 text-sm leading-6 text-slate-400">{detail.detail}</p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {detail.meta.map((item) => (
                <span key={item} className="rounded-full border border-navy-700/75 bg-navy-950/48 px-2 py-0.5 text-[10px] font-medium text-slate-300">
                  {item}
                </span>
              ))}
            </div>
            <button
              type="button"
              onClick={() => {
                if (selection.kind === 'agent') onOpenInspector('agents');
                else if (selection.kind === 'evidence') onOpenArea('reviews', 'evidence');
                else if (selection.kind === 'metric') onOpenCredits();
                else onOpenInspector('mission');
              }}
              className={`mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 ${tone.chip}`}
            >
              {detail.primaryActionLabel}
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>

          <div className="rounded-2xl border border-navy-800/80 bg-navy-900/45 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-violet-300/80">Metrics</p>
                <h3 className="mt-1 text-base font-semibold text-white">Cost and quality</h3>
              </div>
              <BarChart3 className="h-4 w-4 text-violet-100" />
            </div>
            <div className="mt-3 grid gap-2">
              {mission.metrics.map((metric) => (
                <button
                  key={metric.label}
                  type="button"
                  onClick={() => onSelect({ kind: 'metric', id: metric.label })}
                  aria-pressed={selection.kind === 'metric' && selection.id === metric.label}
                  className={`rounded-xl border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 ${
                    selection.kind === 'metric' && selection.id === metric.label
                      ? 'border-violet-300/46 bg-violet-400/12'
                      : metricToneClasses[metric.tone]
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-[10px] font-semibold uppercase tracking-[0.16em] opacity-75">{displayMetricLabel(metric)}</span>
                    <span className="text-base font-semibold text-white">{metric.value}</span>
                  </div>
                  <p className="mt-1 line-clamp-2 text-[11px] leading-5 text-slate-500">{metric.detail}</p>
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-navy-800/80 bg-navy-900/45 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-300/80">Connected stack</p>
                <h3 className="mt-1 text-base font-semibold text-white">Mission context</h3>
              </div>
              <Network className="h-4 w-4 text-cyan-100" />
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {mission.integrations.map((integration) => (
                <span
                  key={integration.id}
                  title={integration.category}
                  className="inline-flex h-9 items-center gap-2 rounded-lg border border-navy-700/70 bg-navy-950/45 px-2.5 text-[11px] font-medium text-slate-200"
                >
                  <BrandIcon name={integration.label} className="h-4 w-4 text-slate-200" />
                  {integration.label}
                </span>
              ))}
            </div>
          </div>

          <button
            type="button"
            onClick={() => onSelect({ kind: 'calendar', id: `${mission.id}_primary` })}
            className="flex w-full items-center justify-between gap-3 rounded-2xl border border-navy-800/80 bg-navy-900/45 px-4 py-3 text-left transition-colors hover:border-amber-300/24 hover:bg-amber-300/8 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
          >
            <span>
              <span className="block text-sm font-semibold text-white">Calendar cadence</span>
              <span className="mt-1 block text-[11px] text-slate-500">{mission.scheduleLabel}. {mission.deliveryLabel}</span>
            </span>
            <CalendarDays className="h-4 w-4 flex-shrink-0 text-amber-100" />
          </button>
        </div>
      </div>
    </section>
  );
}
