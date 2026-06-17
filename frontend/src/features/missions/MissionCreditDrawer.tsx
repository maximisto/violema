import ArrowRight from 'lucide-react/dist/esm/icons/arrow-right.js';
import BarChart3 from 'lucide-react/dist/esm/icons/bar-chart-3.js';
import Clock3 from 'lucide-react/dist/esm/icons/clock-3.js';
import CreditCard from 'lucide-react/dist/esm/icons/credit-card.js';
import TrendingUp from 'lucide-react/dist/esm/icons/trending-up.js';
import X from 'lucide-react/dist/esm/icons/x.js';
import Zap from 'lucide-react/dist/esm/icons/zap.js';
import {
  formatCredits,
  formatRelativeTime,
  getCreditRecommendation,
  type CreditSnapshot,
  useRecentCreditUsage,
} from '../../lib/credits';
import { buildMissionDashboardSummary } from './missionDashboard';
import { buildMissionCreditAnalytics } from './missionDetail';
import type { MissionWorkspaceView } from './types';

interface MissionCreditDrawerProps {
  mission: MissionWorkspaceView;
  snapshot: CreditSnapshot;
  onClose: () => void;
  onTopUp: () => void;
  onUpgrade: () => void;
  onOpenAnalytics: () => void;
}

const recommendationClasses = {
  urgent: 'border-red-300/24 bg-red-300/10 text-red-100',
  watch: 'border-amber-300/24 bg-amber-300/10 text-amber-100',
  good: 'border-green-300/22 bg-green-300/10 text-green-100',
};

const usageToneClasses = {
  violet: 'border-violet-300/18 bg-violet-300/8 text-violet-100',
  cyan: 'border-cyan-300/18 bg-cyan-300/8 text-cyan-100',
  amber: 'border-amber-300/18 bg-amber-300/8 text-amber-100',
};

export function MissionCreditDrawer({
  mission,
  snapshot,
  onClose,
  onTopUp,
  onUpgrade,
  onOpenAnalytics,
}: MissionCreditDrawerProps) {
  const analytics = buildMissionCreditAnalytics(mission, snapshot);
  const summary = buildMissionDashboardSummary(mission);
  const recommendation = getCreditRecommendation(snapshot);
  const { items: recentUsage, isLoading } = useRecentCreditUsage();
  const remainingPercent = snapshot.creditsTotal > 0
    ? Math.min(100, Math.max(0, Math.round((snapshot.creditsRemaining / snapshot.creditsTotal) * 100)))
    : 0;

  return (
    <aside className="fixed inset-x-3 bottom-3 z-50 max-h-[calc(100dvh-1.5rem)] overflow-hidden rounded-2xl border border-violet-300/20 bg-[radial-gradient(circle_at_16%_0%,rgba(124,92,255,0.24),transparent_34%),linear-gradient(180deg,rgba(15,23,42,0.96),rgba(2,6,23,0.98))] shadow-[0_24px_80px_rgba(2,6,23,0.58)] backdrop-blur-xl sm:inset-x-auto sm:bottom-4 sm:right-4 sm:top-4 sm:w-[25rem]">
      <div className="flex items-start justify-between gap-3 border-b border-navy-800/80 px-4 py-4">
        <div className="min-w-0">
          <p className="inline-flex items-center gap-1.5 rounded-full border border-violet-300/22 bg-violet-300/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-violet-100">
            <CreditCard className="h-3 w-3" />
            Credits
          </p>
          <h2 className="mt-2 text-lg font-semibold tracking-[-0.02em] text-white">
            {analytics.balanceLabel}
          </h2>
          <p className="mt-1 text-[12px] leading-5 text-slate-500">{analytics.runwayLabel}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close credits"
          className="rounded-lg border border-navy-700/70 bg-navy-950/55 p-1.5 text-slate-400 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="panel-scroll max-h-[calc(100dvh-8rem)] space-y-4 overflow-y-auto px-4 py-4">
        <div className={`rounded-2xl border p-4 ${recommendationClasses[recommendation.tone]}`}>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] opacity-75">Recommendation</p>
              <h3 className="mt-1 text-base font-semibold text-white">{recommendation.title}</h3>
              <p className="mt-1 text-[12px] leading-5 opacity-80">{recommendation.detail}</p>
            </div>
            <TrendingUp className="h-4 w-4 flex-shrink-0" />
          </div>
        </div>

        <div className="rounded-2xl border border-navy-700/80 bg-navy-950/46 p-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">Workspace usage</p>
            <span className="text-[11px] font-semibold text-white">{analytics.utilizationPercent}% used</span>
          </div>
          <div className="mt-3 h-2 rounded-full bg-navy-800">
            <div
              className="h-full rounded-full bg-gradient-to-r from-violet-300 via-cyan-300 to-emerald-300"
              style={{ width: `${analytics.utilizationPercent}%` }}
            />
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <div className="rounded-xl border border-navy-700/70 bg-navy-900/60 px-3 py-2.5">
              <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-slate-600">Balance</p>
              <p className="mt-1 text-sm font-semibold text-white">{formatCredits(snapshot.creditsRemaining)} / {formatCredits(snapshot.creditsTotal)}</p>
              <p className="mt-0.5 text-[10px] text-slate-600">{remainingPercent}% remaining</p>
            </div>
            <div className="rounded-xl border border-navy-700/70 bg-navy-900/60 px-3 py-2.5">
              <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-slate-600">Monthly burn</p>
              <p className="mt-1 text-sm font-semibold text-white">{formatCredits(snapshot.automationBurnMonthly)} cr</p>
              <p className="mt-0.5 text-[10px] text-slate-600">Automations</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-2xl border border-violet-300/18 bg-violet-300/8 p-3">
            <Zap className="h-4 w-4 text-violet-100" />
            <p className="mt-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-violet-100/70">Mission run</p>
            <p className="mt-1 text-lg font-semibold text-white">{analytics.runCostLabel}</p>
            <p className="mt-1 line-clamp-2 text-[10px] leading-4 text-slate-500">{mission.title}</p>
          </div>
          <div className="rounded-2xl border border-green-300/18 bg-green-300/8 p-3">
            <BarChart3 className="h-4 w-4 text-green-100" />
            <p className="mt-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-green-100/70">Efficiency</p>
            <p className="mt-1 text-lg font-semibold text-white">{summary.efficiencyMetric?.value || 'Live'}</p>
            <p className="mt-1 line-clamp-2 text-[10px] leading-4 text-slate-500">{analytics.efficiencyLabel}</p>
          </div>
        </div>

        <div className="rounded-2xl border border-amber-300/18 bg-amber-300/8 p-4">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-100/70">Waste and risk</p>
          <p className="mt-2 text-sm font-semibold text-white">{analytics.wasteLabel}</p>
          <p className="mt-1 text-[12px] leading-5 text-slate-500">{analytics.burnLabel}</p>
        </div>

        <div className="rounded-2xl border border-navy-700/80 bg-navy-950/46 p-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">Recent usage</p>
            <span className="text-[10px] text-slate-600">{isLoading ? 'Loading' : `${recentUsage.length} events`}</span>
          </div>
          <div className="mt-3 space-y-2">
            {recentUsage.slice(0, 5).map((item) => (
              <div key={item.id} className={`rounded-xl border px-3 py-2.5 ${usageToneClasses[item.tone]}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-white">{item.title}</p>
                    <p className="mt-1 truncate text-[10px] text-current/70">{item.detail}</p>
                  </div>
                  <span className="flex-shrink-0 text-sm font-semibold text-white">{formatCredits(item.credits)} cr</span>
                </div>
                <p className="mt-1 flex items-center gap-1 text-[10px] text-slate-500">
                  <Clock3 className="h-3 w-3" />
                  {formatRelativeTime(item.timestamp)}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={onTopUp}
            className="rounded-xl border border-violet-300/24 bg-violet-300/12 px-3 py-2.5 text-sm font-semibold text-violet-50 transition-colors hover:bg-violet-300/18 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
          >
            Top up
          </button>
          <button
            type="button"
            onClick={onUpgrade}
            className="rounded-xl border border-cyan-300/22 bg-cyan-300/10 px-3 py-2.5 text-sm font-semibold text-cyan-50 transition-colors hover:bg-cyan-300/16 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500"
          >
            Upgrade
          </button>
        </div>

        <button
          type="button"
          onClick={onOpenAnalytics}
          className="flex w-full items-center justify-between gap-3 rounded-xl border border-navy-700/80 bg-navy-950/42 px-3 py-3 text-left transition-colors hover:border-violet-300/24 hover:bg-violet-300/8 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
        >
          <span>
            <span className="block text-sm font-semibold text-white">Open full analytics</span>
            <span className="mt-1 block text-[11px] text-slate-500">See run cost, efficiency, and step-level usage.</span>
          </span>
          <ArrowRight className="h-4 w-4 flex-shrink-0 text-slate-500" />
        </button>
      </div>
    </aside>
  );
}
