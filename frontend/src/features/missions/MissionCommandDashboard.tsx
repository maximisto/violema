import ArrowRight from 'lucide-react/dist/esm/icons/arrow-right.js';
import BarChart3 from 'lucide-react/dist/esm/icons/bar-chart-3.js';
import Bot from 'lucide-react/dist/esm/icons/bot.js';
import CalendarDays from 'lucide-react/dist/esm/icons/calendar-days.js';
import CheckCircle2 from 'lucide-react/dist/esm/icons/check-circle-2.js';
import Clock from 'lucide-react/dist/esm/icons/clock.js';
import CreditCard from 'lucide-react/dist/esm/icons/credit-card.js';
import Eye from 'lucide-react/dist/esm/icons/eye.js';
import Kanban from 'lucide-react/dist/esm/icons/kanban.js';
import Network from 'lucide-react/dist/esm/icons/network.js';
import ShieldCheck from 'lucide-react/dist/esm/icons/shield-check.js';
import Zap from 'lucide-react/dist/esm/icons/zap.js';
import BrandIcon from '../../components/BrandIcon';
import type { WorkspaceAreaId, WorkspaceTabId } from './workspaceShell';
import type { MissionStatus, MissionStepView, MissionWorkspaceView } from './types';
import { buildMissionDashboardSummary } from './missionDashboard';
import { MissionProgressRail } from './MissionProgressRail';

interface MissionCommandDashboardProps {
  mission: MissionWorkspaceView;
  creditBalanceLabel: string;
  creditRunwayLabel: string;
  lowCreditRunway?: boolean;
  onOpenWorkspace: () => void;
  onOpenSchedule: () => void;
  onOpenArea: (area: WorkspaceAreaId, tab?: WorkspaceTabId) => void;
  onOpenCredits?: () => void;
}

const stepStatusClasses: Record<MissionStatus, string> = {
  planned: 'border-slate-500/18 bg-slate-500/8 text-slate-300',
  running: 'border-violet-400/35 bg-violet-400/12 text-violet-100',
  waiting_review: 'border-amber-400/30 bg-amber-400/10 text-amber-100',
  failed: 'border-red-400/30 bg-red-400/10 text-red-100',
  completed: 'border-green-400/30 bg-green-400/10 text-green-100',
  paused: 'border-slate-500/22 bg-slate-500/10 text-slate-300',
};

function StepRow({ step }: { step: MissionStepView }) {
  return (
    <div className="rounded-lg border border-navy-800/80 bg-navy-950/42 px-3 py-2.5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-[13px] font-semibold text-white">{step.title}</p>
          <p className="mt-1 line-clamp-2 text-[11px] leading-5 text-slate-500">{step.objective}</p>
        </div>
        <span className={`flex-shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-medium ${stepStatusClasses[step.status]}`}>
          {step.status.replace('_', ' ')}
        </span>
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5 text-[10px] text-slate-500">
        <span className="rounded-full border border-navy-700/70 bg-navy-900/60 px-2 py-0.5">{step.agentLabel}</span>
        {step.toolLabel ? (
          <span className="rounded-full border border-navy-700/70 bg-navy-900/60 px-2 py-0.5">{step.toolLabel}</span>
        ) : null}
      </div>
    </div>
  );
}

export function MissionCommandDashboard({
  mission,
  creditBalanceLabel,
  creditRunwayLabel,
  lowCreditRunway = false,
  onOpenWorkspace,
  onOpenSchedule,
  onOpenArea,
  onOpenCredits,
}: MissionCommandDashboardProps) {
  const summary = buildMissionDashboardSummary(mission);
  const visibleSteps = mission.steps.slice(0, 4);
  const countCards = [
    { label: 'Active', value: summary.stepCounts.active, Icon: Zap, tone: 'text-violet-200 border-violet-500/18 bg-violet-500/8' },
    { label: 'Waiting', value: summary.stepCounts.waiting, Icon: Clock, tone: 'text-slate-200 border-navy-700/80 bg-navy-950/42' },
    { label: 'Review', value: summary.stepCounts.review, Icon: Eye, tone: 'text-amber-100 border-amber-500/18 bg-amber-500/8' },
    { label: 'Done', value: summary.stepCounts.done, Icon: CheckCircle2, tone: 'text-green-100 border-green-500/18 bg-green-500/8' },
  ];

  const quickLinks = [
    { label: 'Board', detail: 'Status lanes', area: 'board' as const, tab: 'active' as const, Icon: Kanban },
    { label: 'Map', detail: 'Steps and tools', area: 'map' as const, tab: 'workflow' as const, Icon: Network },
    { label: 'Reviews', detail: 'Approvals', area: 'reviews' as const, tab: 'approvals' as const, Icon: ShieldCheck },
    { label: 'Analytics', detail: 'Credits and waste', area: 'analytics' as const, tab: 'credits' as const, Icon: BarChart3 },
  ];

  return (
    <section className="space-y-4">
      <div className="rounded-lg border border-navy-700/80 bg-[radial-gradient(circle_at_10%_10%,rgba(139,92,246,0.16),transparent_32%),linear-gradient(135deg,rgba(15,23,42,0.86),rgba(2,6,23,0.94))] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] sm:p-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-violet-400/25 bg-violet-400/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-violet-100">
                <Bot className="h-3.5 w-3.5" />
                Mission cockpit
              </span>
              <span className="rounded-full border border-green-400/20 bg-green-400/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-green-100">
                {mission.statusLabel}
              </span>
            </div>
            <h2 className="mt-3 max-w-3xl text-2xl font-semibold tracking-[-0.03em] text-white sm:text-3xl">
              {mission.title}
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
              {mission.description}
            </p>
          </div>

          <div className="grid min-w-0 grid-cols-2 gap-2 sm:min-w-[22rem]">
            {countCards.map(({ label, value, Icon, tone }) => (
              <button
                key={label}
                type="button"
                onClick={() => onOpenArea(label === 'Review' ? 'reviews' : 'board')}
                className={`rounded-lg border px-3 py-3 text-left transition-colors hover:bg-white/[0.05] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 ${tone}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <Icon className="h-3.5 w-3.5" />
                  <span className="text-lg font-semibold text-white">{value}</span>
                </div>
                <p className="mt-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-current/70">{label}</p>
              </button>
            ))}
          </div>
        </div>

        <MissionProgressRail mission={mission} className="mt-4" />

        <div className="mt-4 grid gap-2 md:grid-cols-3">
          <div className="rounded-lg border border-navy-700/70 bg-navy-950/42 px-3 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-600">Current agent</p>
            <div className="mt-2 flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-cyan-300/25 bg-cyan-300/10 text-[11px] font-semibold text-cyan-100">
                {summary.activeAgent?.avatarLabel || 'V'}
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-white">{summary.activeAgent?.label || 'Violema'}</p>
                <p className="truncate text-[11px] text-slate-500">{summary.activeAgent?.detail || 'Ready to plan the next mission.'}</p>
              </div>
            </div>
          </div>
          <div className="rounded-lg border border-navy-700/70 bg-navy-950/42 px-3 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-600">Next run</p>
            <div className="mt-2 flex items-center gap-2 text-sm font-semibold text-white">
              <CalendarDays className="h-4 w-4 text-violet-200" />
              <span className="truncate">{mission.nextRunLabel}</span>
            </div>
            <p className="mt-1 truncate text-[11px] text-slate-500">{mission.deliveryLabel}</p>
          </div>
          <button
            type="button"
            onClick={onOpenCredits || (() => onOpenArea('analytics', 'credits'))}
            className={`rounded-lg border px-3 py-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 ${
              lowCreditRunway
                ? 'border-amber-400/24 bg-amber-400/10 hover:bg-amber-400/14'
                : 'border-navy-700/70 bg-navy-950/42 hover:border-violet-400/24 hover:bg-violet-400/8'
            }`}
          >
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-600">Credits</p>
            <div className="mt-2 flex items-center gap-2 text-sm font-semibold text-white">
              <CreditCard className={`h-4 w-4 ${lowCreditRunway ? 'text-amber-200' : 'text-violet-200'}`} />
              <span>{creditBalanceLabel}</span>
            </div>
            <p className={`mt-1 truncate text-[11px] ${lowCreditRunway ? 'text-amber-200/80' : 'text-slate-500'}`}>
              {creditRunwayLabel}
            </p>
          </button>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.25fr)_minmax(18rem,0.75fr)]">
        <div className="space-y-4">
          <div className="rounded-lg border border-navy-800/80 bg-navy-900/45 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-violet-300/80">Mission steps</p>
                <h3 className="mt-1 text-base font-semibold text-white">What is happening now</h3>
              </div>
              <button
                type="button"
                onClick={() => onOpenArea('missions', 'steps')}
                className="inline-flex items-center gap-1.5 rounded-lg border border-navy-700/80 bg-navy-950/55 px-3 py-1.5 text-[11px] font-medium text-slate-300 transition-colors hover:border-violet-500/30 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
              >
                Steps
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="mt-3 space-y-2">
              {visibleSteps.length > 0 ? visibleSteps.map((step) => (
                <StepRow key={step.id} step={step} />
              )) : (
                <div className="rounded-lg border border-dashed border-navy-800/80 bg-navy-950/35 px-3 py-4 text-sm leading-6 text-slate-500">
                  Create a scheduled workflow and Violema will turn it into visible steps, assigned agents, review gates, and cost signals.
                </div>
              )}
            </div>
          </div>

          <div className="rounded-lg border border-navy-800/80 bg-navy-900/45 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-300/80">Founder stack</p>
                <h3 className="mt-1 text-base font-semibold text-white">Connected context</h3>
              </div>
              <button
                type="button"
                onClick={() => onOpenArea('integrations', 'core')}
                className="inline-flex items-center gap-1.5 rounded-lg border border-navy-700/80 bg-navy-950/55 px-3 py-1.5 text-[11px] font-medium text-slate-300 transition-colors hover:border-cyan-500/30 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500"
              >
                Manage
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
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
        </div>

        <div className="space-y-4">
          <div className="rounded-lg border border-navy-800/80 bg-navy-900/45 p-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-300/80">Review and cost</p>
            <h3 className="mt-1 text-base font-semibold text-white">Control center</h3>
            <div className="mt-3 space-y-2">
              <button
                type="button"
                onClick={() => onOpenArea('reviews', 'approvals')}
                className="flex w-full items-center justify-between gap-3 rounded-lg border border-navy-800/80 bg-navy-950/42 px-3 py-3 text-left transition-colors hover:border-amber-400/25 hover:bg-amber-400/8 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
              >
                <span>
                  <span className="block text-sm font-semibold text-white">Approval gate</span>
                  <span className="mt-1 line-clamp-2 block text-[11px] leading-5 text-slate-500">{mission.reviewSummary}</span>
                </span>
                <ShieldCheck className="h-4 w-4 flex-shrink-0 text-amber-200" />
              </button>
              <button
                type="button"
                onClick={onOpenCredits || (() => onOpenArea('analytics', 'credits'))}
                className="flex w-full items-center justify-between gap-3 rounded-lg border border-navy-800/80 bg-navy-950/42 px-3 py-3 text-left transition-colors hover:border-violet-400/25 hover:bg-violet-400/8 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
              >
                <span>
                  <span className="block text-sm font-semibold text-white">{summary.creditMetric?.value || '-'} credits</span>
                  <span className="mt-1 block text-[11px] leading-5 text-slate-500">{summary.efficiencyMetric?.detail || mission.analyticsSummary}</span>
                </span>
                <BarChart3 className="h-4 w-4 flex-shrink-0 text-violet-200" />
              </button>
              <button
                type="button"
                onClick={onOpenSchedule}
                className="flex w-full items-center justify-between gap-3 rounded-lg border border-navy-800/80 bg-navy-950/42 px-3 py-3 text-left transition-colors hover:border-cyan-400/25 hover:bg-cyan-400/8 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500"
              >
                <span>
                  <span className="block text-sm font-semibold text-white">Schedule controls</span>
                  <span className="mt-1 block text-[11px] leading-5 text-slate-500">{mission.scheduleLabel}</span>
                </span>
                <CalendarDays className="h-4 w-4 flex-shrink-0 text-cyan-200" />
              </button>
            </div>
          </div>

          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
            {quickLinks.map(({ label, detail, area, tab, Icon }) => (
              <button
                key={label}
                type="button"
                onClick={() => onOpenArea(area, tab)}
                className="flex items-center justify-between gap-3 rounded-lg border border-navy-800/80 bg-navy-900/45 px-3 py-3 text-left transition-colors hover:border-violet-500/24 hover:bg-navy-800/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
              >
                <span className="flex min-w-0 items-center gap-2.5">
                  <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] text-slate-200">
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-white">{label}</span>
                    <span className="block truncate text-[11px] text-slate-500">{detail}</span>
                  </span>
                </span>
                <ArrowRight className="h-3.5 w-3.5 flex-shrink-0 text-slate-500" />
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={onOpenWorkspace}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-violet-400/30 bg-violet-500/14 px-3 py-3 text-sm font-semibold text-violet-50 transition-colors hover:bg-violet-500/22 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
          >
            Open fold-in workspace
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </section>
  );
}
