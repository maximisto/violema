import { useState } from 'react';
import { ArrowUpRight, CreditCard, Gift, Sparkles } from 'lucide-react';
import {
  buildReferralMessage,
  buildTopUpRequest,
  formatCredits,
  getCreditRecommendation,
  useCreditSnapshot,
} from '../lib/credits';

export default function BillingGateBar() {
  const { snapshot } = useCreditSnapshot();
  const [status, setStatus] = useState<string | null>(null);
  const recommendation = getCreditRecommendation(snapshot);
  const runwayClass =
    recommendation.tone === 'urgent'
      ? 'border-amber-500/30 bg-amber-500/8 text-amber-200'
      : recommendation.tone === 'watch'
        ? 'border-cyan-500/25 bg-cyan-500/8 text-cyan-200'
        : 'border-violet-500/20 bg-violet-500/8 text-violet-200';

  async function copy(text: string, label: string) {
    try {
      await navigator.clipboard.writeText(text);
      setStatus(`${label} copied`);
      window.setTimeout(() => setStatus(null), 1800);
    } catch {
      setStatus(`Could not copy ${label.toLowerCase()}`);
      window.setTimeout(() => setStatus(null), 1800);
    }
  }

  return (
    <div className={`rounded-2xl border px-4 py-3 ${runwayClass}`}>
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl border border-current/20 bg-current/10">
          <Sparkles className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-semibold text-white">Billing {snapshot.planName}</p>
            <span className="rounded-full border border-current/20 bg-current/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em]">
              {formatCredits(snapshot.creditsRemaining)} left
            </span>
          </div>
          <p className="mt-1 text-[11px] text-slate-300">
            {recommendation.title}. {recommendation.detail}
          </p>
          <p className="mt-1 text-[10px] text-slate-400">
            Workspace: {snapshot.workspaceName}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => copy(buildTopUpRequest(snapshot), 'Top-up request')}
              className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-navy-950/50 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/85 transition-colors hover:border-white/20 hover:text-white"
            >
              <CreditCard className="h-3 w-3" />
              Top up
            </button>
            <button
              type="button"
              onClick={() => window.location.assign('/#pricing')}
              className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-navy-950/50 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/85 transition-colors hover:border-white/20 hover:text-white"
            >
              <ArrowUpRight className="h-3 w-3" />
              Upgrade
            </button>
            <button
              type="button"
              onClick={() => copy(buildReferralMessage(snapshot), 'Referral message')}
              className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-navy-950/50 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/85 transition-colors hover:border-white/20 hover:text-white"
            >
              <Gift className="h-3 w-3" />
              Refer
            </button>
          </div>
          <p className="mt-2 text-[10px] text-slate-500">
            {status || `Estimated task cost: ${formatCredits(snapshot.estimatedTaskCost)} credits`}
          </p>
        </div>
      </div>
    </div>
  );
}
