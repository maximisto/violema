import { useState } from 'react';
import { ArrowUpRight, CreditCard, Gift, Sparkles } from 'lucide-react';
import TopUpChooser from './TopUpChooser';
import {
  buildReferralMessage,
  buildTopUpRequest,
  getSuggestedTopUpOfferId,
  getSuggestedUpgradePlanId,
  formatCredits,
  getCreditRecommendation,
  openBillingCheckout,
  useCreditSnapshot,
} from '../lib/credits';

export default function BillingGateBar({ compact = false }: { compact?: boolean }) {
  const { snapshot } = useCreditSnapshot();
  const [status, setStatus] = useState<string | null>(null);
  const [topUpChooserOpen, setTopUpChooserOpen] = useState(false);
  const [topUpBusyOfferId, setTopUpBusyOfferId] = useState<ReturnType<typeof getSuggestedTopUpOfferId> | null>(null);
  const recommendation = getCreditRecommendation(snapshot);

  if (compact && recommendation.tone === 'good' && !status) {
    return null;
  }

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
    const nextPlanId = getSuggestedUpgradePlanId(snapshot.planName);
    if (!nextPlanId) {
      window.location.assign('mailto:sales@purpleorange.io?subject=Nexus%20Enterprise');
      return;
    }
    try {
      const upgraded = await openBillingCheckout({
        kind: 'subscription',
        planId: nextPlanId,
      });
      if (upgraded) return;
    } catch {
      // fall through to pricing
    }
    window.location.assign('/#pricing');
  }

  async function handleTopUpSelect(offerId: ReturnType<typeof getSuggestedTopUpOfferId>) {
    setTopUpBusyOfferId(offerId);
    try {
      const started = await openBillingCheckout({
        kind: 'top-up',
        offerId,
      });
      if (started) return;
    } catch {
      // fall through to copy
    } finally {
      setTopUpBusyOfferId(null);
      setTopUpChooserOpen(false);
    }
    void copy(buildTopUpRequest(snapshot), 'Top-up request');
  }

  if (compact) {
    return (
      <div className={`rounded-2xl border ${runwayClass} px-3 py-2.5 shadow-[0_12px_30px_rgba(2,6,23,0.14)]`}>
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-[11px] font-semibold text-white">{recommendation.title}</p>
              <span className="rounded-full border border-current/20 bg-current/10 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.18em]">
                {formatCredits(snapshot.creditsRemaining)} left
              </span>
            </div>
            <p className="mt-1 text-[11px] text-slate-300">{status || recommendation.detail}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setTopUpChooserOpen(true)}
              className="text-[11px] font-medium text-cyan-300 transition-colors hover:text-cyan-200"
            >
              Top up
            </button>
            <button
              type="button"
              onClick={() => { void handleUpgrade(); }}
              className="text-[11px] font-medium text-violet-300 transition-colors hover:text-violet-200"
            >
              Upgrade
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`ui-panel border px-3.5 py-3 sm:px-4 ${runwayClass}`}>
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
              onClick={() => setTopUpChooserOpen(true)}
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
      <TopUpChooser
        open={topUpChooserOpen}
        recommendedOfferId={getSuggestedTopUpOfferId(snapshot)}
        busyOfferId={topUpBusyOfferId}
        onClose={() => {
          if (!topUpBusyOfferId) setTopUpChooserOpen(false);
        }}
        onSelect={(offerId) => { void handleTopUpSelect(offerId); }}
      />
    </div>
  );
}
