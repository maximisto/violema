import { useState } from 'react';
import { ArrowUpRight, CreditCard, Gift, Sparkles, ChevronRight, History, ExternalLink } from 'lucide-react';
import {
  buildReferralMessage,
  createBillingCheckout,
  buildTopUpRequest,
  formatCredits,
  formatRelativeTime,
  getCreditRecommendation,
  getSuggestedTopUpOfferId,
  useCreditSnapshot,
  useRecentCreditUsage,
} from '../lib/credits';

function Stat({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-navy-700/60 bg-navy-950/50 px-3 py-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
      <p className="text-[10px] uppercase tracking-[0.18em] text-slate-600">{label}</p>
      <p className="text-sm font-semibold text-white tabular-nums">{value}</p>
    </div>
  );
}

export default function CreditSurface({ compact = false }: { compact?: boolean }) {
  const { snapshot, isLoading } = useCreditSnapshot();
  const { items: recentUsage, isLoading: usageLoading } = useRecentCreditUsage();
  const [actionState, setActionState] = useState<string | null>(null);
  const progress = Math.max(0, Math.min(100, (snapshot.creditsRemaining / snapshot.creditsTotal) * 100));
  const lowBalance = progress < 25;
  const burnRate = snapshot.automationBurnMonthly / 30;
  const recommendation = getCreditRecommendation(snapshot);

  async function copyToClipboard(text: string, label: string) {
    try {
      await navigator.clipboard.writeText(text);
      setActionState(`${label} copied`);
      window.setTimeout(() => setActionState(null), 2200);
    } catch {
      setActionState(`Could not copy ${label.toLowerCase()}`);
      window.setTimeout(() => setActionState(null), 2200);
    }
  }

  async function openPricing() {
    try {
      const session = await createBillingCheckout({ kind: 'subscription', planId: snapshot.planName === 'Starter' ? 'pro' : 'team' });
      if (session.session?.checkoutUrl) {
        window.location.assign(session.session.checkoutUrl);
        return;
      }
    } catch {
      // fall back to pricing section below
    }
    window.location.assign('/#pricing');
    setActionState('Opening pricing');
  }

  async function handleTopUp() {
    try {
      const session = await createBillingCheckout({ kind: 'top-up', offerId: getSuggestedTopUpOfferId(snapshot) });
      if (session.session?.checkoutUrl) {
        window.location.assign(session.session.checkoutUrl);
        return;
      }
    } catch {
      // fall back to copy flow below
    }
    copyToClipboard(buildTopUpRequest(snapshot), 'Top-up request');
  }

  function handleReferral() {
    copyToClipboard(buildReferralMessage(snapshot), 'Referral message');
  }

  const topUpLabel = compact ? 'Top up' : 'Top up now';
  const referralLabel = compact ? 'Refer' : 'Refer for 2k';

  return (
    <section
      className={`ui-panel overflow-hidden border-violet-500/15 ${
        compact ? 'p-2.5' : 'p-3.5 sm:p-4'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div
            className={`inline-flex items-center gap-2 rounded-full border border-violet-500/15 bg-violet-500/8 ${
              compact ? 'px-2 py-0.5' : 'px-2.5 py-1'
            } text-[10px] font-semibold uppercase tracking-[0.22em] text-violet-300`}
          >
            <Sparkles className="h-3 w-3" />
            Credits
          </div>
          <h3 className={`mt-2 ${compact ? 'text-[13px]' : 'text-sm'} font-semibold text-white`}>Nexus Credits</h3>
          <p className={`mt-0.5 ${compact ? 'text-[10px]' : 'text-[11px]'} text-slate-500`}>
            {snapshot.workspaceName} · {snapshot.planName} plan · {isLoading ? 'syncing…' : snapshot.source === 'api' ? 'live' : 'preview'}
          </p>
        </div>
        <div className={`rounded-xl border border-navy-700/60 bg-navy-950/60 ${compact ? 'px-2.5 py-1.5' : 'px-3 py-2'} text-right shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]`}>
          <p className="text-[10px] uppercase tracking-[0.18em] text-slate-600">Remaining</p>
          <p className={`mt-1 ${compact ? 'text-[1.05rem]' : 'text-lg'} font-extrabold ${lowBalance ? 'text-amber-300' : 'text-white'}`}>
            {formatCredits(snapshot.creditsRemaining)}
          </p>
          <p className="text-[10px] text-slate-600">of {formatCredits(snapshot.creditsTotal)}</p>
        </div>
      </div>

      <div className="mt-4">
        <div className="flex items-center justify-between text-[10px] text-slate-600">
          <span>Usage</span>
          <span>{Math.round(progress)}%</span>
        </div>
        <div className="mt-1.5 h-2 overflow-hidden rounded-full border border-navy-800/60 bg-navy-950/80">
          <div
            className={`h-full rounded-full transition-all duration-700 ${
              lowBalance
                ? 'bg-gradient-to-r from-amber-500 to-orange-400'
                : 'bg-gradient-to-r from-violet-500 via-fuchsia-500 to-cyan-400'
            }`}
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      <div className={`mt-4 grid grid-cols-1 ${compact ? 'gap-1' : 'gap-2'}`}>
        <Stat label="Task cost" value={`${formatCredits(snapshot.estimatedTaskCost)} credits`} />
        <Stat label="Auto burn" value={`${formatCredits(snapshot.automationBurnMonthly)}/mo`} />
        {!compact && <Stat label="Top up" value={`+${formatCredits(snapshot.topUpSuggestion)} credits`} />}
      </div>

      {compact ? (
        <div className="mt-3 rounded-2xl border border-violet-500/15 bg-violet-500/6 p-2.5">
          <p className="text-[10px] uppercase tracking-[0.2em] text-violet-300/80">Billing insight</p>
          <p className="mt-1 text-[13px] leading-snug text-white">
            Burn is roughly {formatCredits(Math.round(burnRate))} credits/day.
          </p>
          <p className="mt-0.5 text-[11px] text-slate-500">
            {snapshot.projectedDaysLeft} days left · Referral grant +{formatCredits(snapshot.referralBonus)} credits.
          </p>
        </div>
      ) : (
        <div className="mt-3 rounded-2xl border border-violet-500/15 bg-violet-500/6 p-3">
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="text-[10px] uppercase tracking-[0.2em] text-violet-300/80">Billing insight</p>
              <p className="mt-1 text-sm leading-snug text-white">
                Burn is roughly {formatCredits(Math.round(burnRate))} credits/day.
              </p>
              <p className="mt-0.5 text-[11px] text-slate-500">
                At this rate, you have about {snapshot.projectedDaysLeft} days left on the current plan.
              </p>
              <p
                className={`mt-2 text-[11px] font-medium ${
                  recommendation.tone === 'urgent'
                    ? 'text-amber-300'
                    : recommendation.tone === 'watch'
                      ? 'text-cyan-300'
                      : 'text-violet-300'
                }`}
              >
                {recommendation.title}: {recommendation.detail}
              </p>
              <p className="mt-2 text-[11px] text-violet-300/80">
                Referral grant: +{formatCredits(snapshot.referralBonus)} credits.
              </p>
            </div>
            <ChevronRight className="h-4 w-4 flex-shrink-0 text-violet-300/70" />
          </div>
        </div>
      )}

      {!compact && (
        <div className="mt-3 rounded-2xl border border-navy-700/60 bg-navy-950/45 p-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
              <History className="h-3 w-3" />
              <span>Recent usage</span>
            </div>
            <span className="text-[10px] font-medium uppercase tracking-[0.18em] text-slate-600">
              {usageLoading ? 'loading' : 'live preview'}
            </span>
          </div>
          <div className="mt-2 space-y-2">
            {recentUsage.slice(0, 3).map((item) => (
              <div
                key={item.id}
                className="flex items-start justify-between gap-3 rounded-xl border border-navy-700/60 bg-navy-900/45 px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium leading-snug text-white">{item.title}</p>
                  <p className="text-[10px] text-slate-500 sm:text-[11px]">{item.detail}</p>
                </div>
                <div className="flex-shrink-0 text-right">
                  <p
                    className={`text-[11px] font-semibold ${
                      item.tone === 'amber'
                        ? 'text-amber-300'
                        : item.tone === 'cyan'
                          ? 'text-cyan-300'
                          : 'text-violet-300'
                    }`}
                  >
                    -{formatCredits(item.credits)}
                  </p>
                  <p className="text-[10px] text-slate-600">{formatRelativeTime(item.timestamp)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className={`mt-3 grid ${compact ? 'grid-cols-2 gap-1' : 'grid-cols-1 gap-1.5 sm:grid-cols-3 sm:gap-2'}`}>
        <button
          type="button"
          onClick={handleTopUp}
          className="ui-pill rounded-xl text-[9px] sm:text-[10px]"
        >
          <CreditCard className="h-3 w-3" />
          {topUpLabel}
        </button>
        <button
          type="button"
          onClick={openPricing}
          className="ui-pill rounded-xl border-cyan-500/20 bg-cyan-500/8 text-[9px] text-cyan-300 sm:text-[10px]"
        >
          <ArrowUpRight className="h-3 w-3" />
          Upgrade plan
        </button>
        {!compact && (
          <button
            type="button"
            onClick={handleReferral}
            className="ui-pill rounded-xl border-amber-500/20 bg-amber-500/8 text-[9px] text-amber-300 sm:text-[10px]"
          >
            <Gift className="h-3 w-3" />
            {referralLabel}
          </button>
        )}
      </div>

      <div className={`mt-2 flex items-center justify-between gap-3 ${compact ? 'px-0.5' : 'px-1'}`}>
        <p className="text-[10px] text-slate-600">
          {snapshot.source === 'api' ? 'Live usage' : 'Preview data'} · workspace-aware billing is ready for a live API.
        </p>
        <button
          type="button"
          onClick={() => copyToClipboard(`Nexus workspace ${snapshot.planName}`, 'Workspace summary')}
          className="inline-flex items-center gap-1 text-[10px] font-medium text-slate-500 transition-colors hover:text-slate-300"
        >
          <ExternalLink className="h-3 w-3" />
          {actionState || 'Copy summary'}
        </button>
      </div>
    </section>
  );
}
