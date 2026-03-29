import { useState } from 'react';
import { ArrowUpRight, CreditCard, Gift, Sparkles } from 'lucide-react';
import {
  buildReferralMessage,
  buildTopUpRequest,
  getSuggestedTopUpOfferId,
  formatCredits,
  getCreditRecommendation,
  openBillingCheckout,
  useCreditSnapshot,
} from '../lib/credits';

export default function BillingGateBar({ compact = false }: { compact?: boolean }) {
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

  async function handleUpgrade() {
    try {
      const upgraded = await openBillingCheckout({
        kind: 'subscription',
        planId: snapshot.planName === 'Starter' ? 'pro' : 'team',
      });
      if (upgraded) return;
    } catch {
      // fall through to pricing
    }
    window.location.assign('/#pricing');
  }

  async function handleTopUp() {
    try {
      const started = await openBillingCheckout({
        kind: 'top-up',
        offerId: getSuggestedTopUpOfferId(snapshot),
      });
      if (started) return;
    } catch {
      // fall through to copy
    }
    void copy(buildTopUpRequest(snapshot), 'Top-up request');
  }

  return (
    <div className={`ui-panel border ${compact ? 'px-3 py-2.5 sm:px-3.5' : 'px-3.5 py-3 sm:px-4'} ${runwayClass}`}>
      <div className={`flex items-start gap-2.5 ${compact ? 'sm:gap-3' : 'sm:gap-3'}`}>
        <div className={`mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-xl border border-current/20 bg-current/10 ${compact ? '' : 'sm:h-8 sm:w-8'}`}>
          <Sparkles className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <p className={`${compact ? 'text-[12px]' : 'text-[13px] sm:text-sm'} font-semibold text-white`}>Billing {snapshot.planName}</p>
            <span className="rounded-full border border-current/20 bg-current/10 px-2 py-0.5 text-[9px] sm:text-[10px] font-semibold uppercase tracking-[0.18em]">
              {formatCredits(snapshot.creditsRemaining)} left
            </span>
          </div>
          <p className={`mt-1 ${compact ? 'text-[10px]' : 'text-[10px] sm:text-[11px]'} text-slate-300`}>
            {recommendation.title}. {recommendation.detail}
          </p>
          <p className={`mt-1 ${compact ? 'text-[9px]' : 'text-[9px] sm:text-[10px]'} text-slate-400`}>
            Workspace: {snapshot.workspaceName}
          </p>
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => { void handleTopUp(); }}
              className="ui-pill text-[9px] sm:text-[10px]"
            >
              <CreditCard className="h-3 w-3" />
              Top up
            </button>
            <button
              type="button"
              onClick={() => { void handleUpgrade(); }}
              className="ui-pill text-[9px] sm:text-[10px]"
            >
              <ArrowUpRight className="h-3 w-3" />
              Upgrade
            </button>
            {!compact && (
              <button
                type="button"
                onClick={() => copy(buildReferralMessage(snapshot), 'Referral message')}
                className="ui-pill text-[9px] sm:text-[10px]"
              >
                <Gift className="h-3 w-3" />
                Refer
              </button>
            )}
          </div>
          <p className={`mt-2 ${compact ? 'text-[9px]' : 'text-[9px] sm:text-[10px]'} text-slate-500`}>
            {status || `Estimated task cost: ${formatCredits(snapshot.estimatedTaskCost)} credits`}
          </p>
        </div>
      </div>
    </div>
  );
}
