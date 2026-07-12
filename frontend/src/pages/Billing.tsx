import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import ArrowRight from 'lucide-react/dist/esm/icons/arrow-right.js';
import CalendarCheck from 'lucide-react/dist/esm/icons/calendar-check.js';
import Check from 'lucide-react/dist/esm/icons/check.js';
import CreditCard from 'lucide-react/dist/esm/icons/credit-card.js';
import Layers3 from 'lucide-react/dist/esm/icons/layers-3.js';
import MessageSquare from 'lucide-react/dist/esm/icons/message-square.js';
import Shield from 'lucide-react/dist/esm/icons/shield.js';
import Sparkles from 'lucide-react/dist/esm/icons/sparkles.js';
import Users from 'lucide-react/dist/esm/icons/users.js';
import { TOP_UP_OPTIONS, createBillingCheckout, formatCredits, useCreditSnapshot } from '../lib/credits';
import { fetchBackendAuthSession, getAuthSession } from '../lib/auth';
import PublicHeader from '../components/PublicHeader';
import { persistWorkspaceContext } from '../lib/workspace';
import { useTheme } from '../lib/useTheme';
import {
  SAMPLE_RUNS,
  formatSampleUsd,
  getCreditValueUsd,
  getMonthlyCredits,
  getSampleRunById,
  getSampleRunPath,
} from '../content/sampleRuns';
import { openCalendlyConsultation } from '../lib/calendly';

const PLANS = [
  {
    id: 'pro' as const,
    name: 'Start',
    priceUsd: 79,
    description: 'The first real plan for a founder who wants one reliable reviewed workflow.',
    credits: 2000,
    automations: 20,
    missions: '1-3 live missions',
    features: ['First hero integration', 'Run review pages', 'Slack/email delivery', 'Budget caps', 'Analytics dashboard'],
    proofRunId: 'pricing-proof-founder-brief',
    featured: true,
  },
  {
    id: 'team' as const,
    name: 'Pro',
    priceUsd: 249,
    description: 'The production tier for recurring missions, approvals, and real operating cadence.',
    credits: 7500,
    automations: 100,
    missions: '5-10 live missions',
    features: ['Approval gates', 'More integrations', 'Slack operating surface', 'Admin visibility', 'Priority setup support'],
    proofRunId: 'pricing-proof-operating-cadence',
  },
];

function getProofRunById(id: string) {
  return getSampleRunById(id) || SAMPLE_RUNS[0];
}

export default function Billing() {
  const location = useLocation();
  const navigate = useNavigate();
  const { scopeClass } = useTheme();
  const [session, setSession] = useState(() => getAuthSession());
  const { snapshot, refresh } = useCreditSnapshot();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [redirecting, setRedirecting] = useState(false);
  const [hoveredPlanId, setHoveredPlanId] = useState<'pro' | 'team' | null>(null);
  const search = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const section = search.get('section') === 'topups' ? 'topups' : 'plans';
  const requestedPlan = search.get('plan');
  const checkoutState = search.get('checkout');
  const sessionId = search.get('session_id');
  const hasAccess = Boolean(session?.acceptedTerms && session?.acceptedEducation);
  const slackReady = Boolean(session?.slackWorkspace && session?.slackChannelId);
  const billingBasePath = location.pathname.startsWith('/pricing') ? '/pricing' : '/plans';

  useEffect(() => {
    persistWorkspaceContext();
    void fetchBackendAuthSession().then((next) => {
      if (next) setSession(next);
    }).catch(() => undefined);
  }, []);

  useEffect(() => {
    if (checkoutState !== 'success') return;
    void refresh();
  }, [checkoutState, refresh]);

  async function handleSubscription(planId: 'pro' | 'team') {
    if (!hasAccess) {
      navigate(`/signup?next=${encodeURIComponent(`${billingBasePath}?plan=${planId}`)}`);
      return;
    }
    setBusyId(planId);
    try {
      const result = await createBillingCheckout({ kind: 'subscription', planId });
      if (result.session?.checkoutUrl) {
        setRedirecting(true);
        window.location.assign(result.session.checkoutUrl);
        return;
      }
    } finally {
      setBusyId(null);
    }
  }

  async function handleTopUp(offerId: 'topup_500' | 'topup_1500' | 'topup_5000') {
    if (!hasAccess) {
      navigate(`/signup?next=${encodeURIComponent(`${billingBasePath}?section=topups`)}`);
      return;
    }
    setBusyId(offerId);
    try {
      const result = await createBillingCheckout({ kind: 'top-up', offerId });
      if (result.session?.checkoutUrl) {
        setRedirecting(true);
        window.location.assign(result.session.checkoutUrl);
        return;
      }
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className={`min-h-screen bg-hero-gradient ${scopeClass}`}>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(168,85,247,0.12),transparent_35%),radial-gradient(circle_at_bottom_right,rgba(34,211,238,0.06),transparent_28%)]" />
        <PublicHeader
        backHref="/"
        backLabel="Home"
        actionHref={hasAccess ? '/dashboard' : '/signup?next=%2Fdashboard'}
        actionLabel={hasAccess ? 'Open workspace' : 'Start free'}
      />
      <div className="relative mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="rounded-[2rem] border border-navy-700/60 bg-navy-950/40 px-5 py-6 shadow-[0_24px_80px_rgba(3,8,24,0.3)] sm:px-7 lg:px-8">
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1.55fr)_22rem] lg:items-start">
            <div className="max-w-4xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-violet-500/20 bg-violet-500/10 px-4 py-1.5 text-sm font-medium text-violet-300">
              <Sparkles className="h-3.5 w-3.5" />
              Billing and access
              </div>
              <h1 className="mt-5 max-w-5xl text-4xl font-extrabold leading-[0.95] text-white sm:text-5xl lg:text-[4rem]">
                Pick the right runway
                <span className="gradient-text"> before Violema starts executing.</span>
              </h1>
              <p className="mt-4 max-w-3xl text-base leading-7 text-slate-400 sm:text-lg">
                Start with a workflow audit, then choose the monthly tier that matches the first real mission. Top-ups are one-time add-ons for extra work without changing your plan.
              </p>
              <div className="mt-5 space-y-1.5">
                <p className="text-sm text-slate-300">
                  Credits map to actual agent work. The public ladder starts at $79 because Violema is selling reviewed operating loops, not cheap task volume.
                </p>
                <p className="text-sm text-slate-500">
                  Existing Stripe prices are reused: Start checks out through the current $79 plan, Pro through the current $249 plan, and Enterprise is custom.
                </p>
              </div>
              <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                <button
                  type="button"
                  onClick={(event) => { void openCalendlyConsultation(event, 'pricing-hero-workflow-audit'); }}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-violet-600 px-5 py-3 text-sm font-semibold text-white shadow-glow-violet transition-colors hover:bg-violet-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300"
                >
                  <CalendarCheck className="h-4 w-4" />
                  Book workflow audit
                </button>
                <Link
                  to={hasAccess ? '/dashboard' : '/signup?next=%2Fdashboard'}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border border-navy-700/80 bg-navy-900/55 px-5 py-3 text-sm font-semibold text-slate-200 transition-colors hover:border-violet-500/35 hover:text-white"
                >
                  {hasAccess ? 'Open workspace' : 'Start free preview'}
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>

            <div className="ui-panel rounded-[1.7rem] px-5 py-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-600">Account</p>
                  <p className="mt-2 text-base font-semibold text-white">{session?.name || 'Guest access'}</p>
                  <p className="mt-1 text-sm text-slate-500">{session?.email || 'Finish access setup to unlock checkout'}</p>
                </div>
                <div className="rounded-full border border-emerald-500/25 bg-emerald-500/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-300">
                  {hasAccess ? 'Ready' : 'Setup required'}
                </div>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
                <div className="rounded-2xl border border-navy-700/60 bg-navy-950/45 px-4 py-3">
                  <p className="text-[10px] uppercase tracking-[0.18em] text-slate-600">Current path</p>
                  <p className="mt-2 text-sm font-semibold text-white">
                    {section === 'topups' ? 'One-time credits' : requestedPlan ? `Plan: ${requestedPlan}` : 'Plan selection'}
                  </p>
                  <p className="mt-1 text-sm text-slate-500">
                    {section === 'topups'
                      ? 'Add credits without changing the monthly tier.'
                      : 'Choose the monthly operating tier that fits your workload.'}
                  </p>
                </div>
                <div className="rounded-2xl border border-navy-700/60 bg-navy-950/45 px-4 py-3">
                  <p className="text-[10px] uppercase tracking-[0.18em] text-slate-600">What happens next</p>
                  <p className="mt-2 text-sm text-slate-400">
                    You’ll review the selected package in Stripe, complete checkout, and return with billing attached to this workspace.
                  </p>
                </div>
                <div className="rounded-2xl border border-navy-700/60 bg-navy-950/45 px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[10px] uppercase tracking-[0.18em] text-slate-600">Slack setup</p>
                      <p className="mt-2 text-sm text-slate-400">
                        {slackReady
                          ? 'Slack destination saved for this workspace.'
                          : 'Save one Slack channel ID before you turn on automations.'}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => navigate(`/connect/slack?next=${encodeURIComponent(billingBasePath)}`)}
                      className="ui-button-ghost px-3 py-2 text-xs"
                    >
                      {slackReady ? 'Edit' : 'Connect'}
                    </button>
                  </div>
                </div>
              </div>
          </div>
        </div>

        {redirecting ? (
          <div className="mt-6 rounded-2xl border border-violet-500/25 bg-violet-500/10 px-4 py-3 text-violet-100">
            <div className="flex items-center gap-3">
              <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-violet-500/15">
                <ArrowRight className="h-3.5 w-3.5 animate-pulse text-violet-300" />
              </div>
              <p className="text-sm font-medium">Redirecting to Stripe checkout…</p>
            </div>
          </div>
        ) : checkoutState ? (
          <div
            className={`mt-6 rounded-2xl border px-4 py-3 ${
              checkoutState === 'success'
                ? 'border-emerald-500/25 bg-emerald-500/10 text-emerald-100'
                : 'border-amber-500/25 bg-amber-500/10 text-amber-100'
            }`}
          >
            <div className="flex items-start gap-3">
              <div
                className={`mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full ${
                  checkoutState === 'success' ? 'bg-emerald-500/15 text-emerald-300' : 'bg-amber-500/15 text-amber-300'
                }`}
              >
                <Check className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">
                  {checkoutState === 'success' ? 'Checkout complete' : 'Checkout canceled'}
                </p>
                <p className="mt-1 text-sm text-current/80">
                  {checkoutState === 'success'
                    ? `Stripe returned successfully${sessionId ? ` for session ${sessionId}` : ''}. Credits should update as soon as the webhook lands.`
                    : 'No charge was made. You can retry the same plan whenever you are ready.'}
                </p>
                {checkoutState === 'success' ? (
                  <p className="mt-2 text-xs text-current/70">
                    Current balance: {formatCredits(snapshot.creditsRemaining)} credits
                  </p>
                ) : (
                  <button
                    type="button"
                    onClick={() => navigate(billingBasePath)}
                    className="mt-3 inline-flex items-center gap-1.5 rounded-xl border border-amber-500/30 bg-amber-500/15 px-3 py-1.5 text-xs font-medium text-amber-200 transition-colors hover:bg-amber-500/22"
                  >
                    <ArrowRight className="h-3.5 w-3.5" />
                    View plans and retry
                  </button>
                )}
              </div>
            </div>
          </div>
        ) : null}

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-white/6 pt-5">
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => navigate(billingBasePath)}
                className={`ui-pill px-4 py-2 ${section === 'plans' ? 'border-violet-500/35 bg-violet-500/12 text-violet-200' : ''}`}
              >
                <Layers3 className="h-3.5 w-3.5" />
                Plans
              </button>
              <button
                type="button"
                onClick={() => navigate(`${billingBasePath}?section=topups`)}
                className={`ui-pill px-4 py-2 ${section === 'topups' ? 'border-violet-500/35 bg-violet-500/12 text-violet-200' : ''}`}
              >
                <CreditCard className="h-3.5 w-3.5" />
                Top-ups
              </button>
            </div>
            <div className="text-sm text-slate-500">
              {section === 'topups'
                ? 'Top-ups add credits only. They do not change your monthly plan.'
                : 'Pick the monthly tier first. Add top-ups later if Violema needs more room to run.'}
            </div>
          </div>

          {section === 'plans' ? (
            <div className="mt-5 grid gap-3 border-t border-white/6 pt-5 md:grid-cols-3">
              {[
                {
                  title: 'Design first',
                  body: 'Most buyers should start with a workflow audit so the first mission is narrow, connected, and reviewable.',
                },
                {
                  title: 'Start at $79',
                  body: 'Start is for one founder workflow with real sources, visible costs, and reviewed delivery.',
                },
                {
                  title: 'Pro at $249',
                  body: 'Pro is the production tier for recurring missions, approval gates, Slack operations, and team visibility.',
                },
              ].map((item) => (
                <div key={item.title} className="rounded-2xl border border-navy-700/60 bg-navy-950/45 px-4 py-3">
                  <p className="text-[10px] uppercase tracking-[0.18em] text-slate-600">{item.title}</p>
                  <p className="mt-2 text-sm leading-relaxed text-slate-400">{item.body}</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-5 grid gap-3 border-t border-white/6 pt-5 md:grid-cols-3">
              {[
                'Top-ups are for bursts of extra work, not a plan replacement.',
                'The credits land in the same workspace and burn down before you need to upgrade.',
                'Choose the pack that matches the extra execution you need right now.',
              ].map((body, index) => (
                <div key={index} className="rounded-2xl border border-navy-700/60 bg-navy-950/45 px-4 py-3 text-sm leading-relaxed text-slate-400">
                  {body}
                </div>
              ))}
            </div>
          )}
        </div>

        {section === 'plans' ? (
          <>
            <section id="sample-runs" className="mt-7 rounded-[1.9rem] border border-navy-700/70 bg-navy-900/45 p-5 sm:p-6">
              <div className="grid gap-5 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:items-start">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-600">Pricing proof</p>
                  <h2 className="mt-2 text-2xl font-semibold tracking-[-0.02em] text-white">Every plan needs a visible run ledger.</h2>
                  <p className="mt-3 text-sm leading-6 text-slate-400">
                    These are sample estimates for the buying conversation: what Violema reads, where approval happens, how many credits a run uses, and what that means monthly.
                  </p>
                  <div className="mt-5 rounded-2xl border border-violet-500/20 bg-violet-500/8 px-4 py-3">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-violet-200/80">Cost visibility</p>
                    <p className="mt-2 text-sm leading-6 text-slate-300">
                      A $79 Start workspace can support a focused weekly mission. Pro is where recurring cadence, review gates, and multi-source operating work start to compound.
                    </p>
                  </div>
                </div>

                <div className="grid gap-3">
                  {SAMPLE_RUNS.map((run) => (
                    <article
                      id={run.id}
                      key={run.id}
                      className="rounded-2xl border border-navy-700/70 bg-navy-950/45 p-4 scroll-mt-24"
                    >
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-600">{run.planLabel}</p>
                          <h3 className="mt-1 text-lg font-semibold text-white">{run.title}</h3>
                          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">{run.summary}</p>
                        </div>
                        <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-sm font-semibold text-emerald-100">
                          {run.approvalState}
                        </div>
                      </div>

                      <div className="mt-4 grid gap-2 sm:grid-cols-4">
                        <div className="rounded-xl border border-white/8 bg-white/[0.03] px-3 py-2">
                          <p className="text-[10px] uppercase tracking-[0.16em] text-slate-600">Per run</p>
                          <p className="mt-1 text-sm font-semibold text-white">{formatCredits(run.runCredits)} cr</p>
                        </div>
                        <div className="rounded-xl border border-white/8 bg-white/[0.03] px-3 py-2">
                          <p className="text-[10px] uppercase tracking-[0.16em] text-slate-600">Monthly</p>
                          <p className="mt-1 text-sm font-semibold text-white">{formatCredits(getMonthlyCredits(run))} cr</p>
                        </div>
                        <div className="rounded-xl border border-white/8 bg-white/[0.03] px-3 py-2">
                          <p className="text-[10px] uppercase tracking-[0.16em] text-slate-600">Cadence</p>
                          <p className="mt-1 text-sm font-semibold text-white">{run.cadence}</p>
                        </div>
                        <div className="rounded-xl border border-white/8 bg-white/[0.03] px-3 py-2">
                          <p className="text-[10px] uppercase tracking-[0.16em] text-slate-600">Provider cost</p>
                          <p className="mt-1 text-sm font-semibold text-white">{formatSampleUsd(run.providerCostUsd)}</p>
                        </div>
                      </div>

                      <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
                        <div>
                          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-600">Source trail</p>
                          <div className="mt-2 flex flex-wrap gap-2">
                            {run.sources.map((source) => (
                              <span key={source} className="rounded-full border border-cyan-500/20 bg-cyan-500/8 px-3 py-1 text-xs font-medium text-cyan-100">
                                {source}
                              </span>
                            ))}
                          </div>
                        </div>
                        <div>
                          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-600">Run ledger</p>
                          <div className="mt-2 grid gap-2 sm:grid-cols-2">
                            {run.ledger.map((event) => (
                              <div key={event} className="flex items-start gap-2 rounded-xl border border-white/8 bg-white/[0.03] px-3 py-2">
                                <Check className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-violet-300" />
                                <span className="text-xs leading-5 text-slate-300">{event}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>

                      <div className="mt-4 rounded-xl border border-amber-500/20 bg-amber-500/8 px-3 py-2 text-xs leading-5 text-amber-100">
                        Sample value check: {formatCredits(run.runCredits)} credits equals about {formatSampleUsd(getCreditValueUsd(run))} in Start-plan credit value before top-ups.
                      </div>
                      <Link
                        to={getSampleRunPath(run.id)}
                        className="mt-4 inline-flex items-center gap-2 rounded-2xl border border-white/12 bg-white/[0.04] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:border-violet-500/35 hover:bg-violet-500/10"
                      >
                        Open run page
                        <ArrowRight className="h-4 w-4" />
                      </Link>
                    </article>
                  ))}
                </div>
              </div>
            </section>

            <div className="mt-7 grid gap-5 xl:grid-cols-2 items-stretch">
              {PLANS.map((plan) => {
                const proofRun = getProofRunById(plan.proofRunId);
                return (
                  <div
                    key={plan.id}
                    className={`flex h-full flex-col rounded-[1.9rem] border p-6 transition-all ${
                      hoveredPlanId === plan.id
                        ? 'border-violet-500/55 bg-gradient-to-b from-violet-950/78 via-navy-900/80 to-navy-900/88 shadow-[0_18px_50px_rgba(76,29,149,0.22)] ring-1 ring-violet-500/15 -translate-y-1'
                        : 'border-navy-700/70 bg-navy-900/45'
                    }`}
                    onMouseEnter={() => setHoveredPlanId(plan.id)}
                    onMouseLeave={() => setHoveredPlanId(null)}
                    onFocusCapture={() => setHoveredPlanId(plan.id)}
                    onBlurCapture={() => setHoveredPlanId(null)}
                  >
                  {plan.featured && (
                    <div className={`mb-4 inline-flex rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${
                      hoveredPlanId === plan.id
                        ? 'border-violet-400/30 bg-violet-500/12 text-violet-100'
                        : 'border-violet-400/20 bg-violet-500/8 text-violet-200/80'
                    }`}>
                      Most popular
                    </div>
                  )}
                  <div className="flex min-h-[8.5rem] items-start justify-between gap-4">
                    <div>
                      <h2 className="text-2xl font-semibold text-white">{plan.name}</h2>
                      <p className="mt-2 text-sm leading-relaxed text-slate-400">{plan.description}</p>
                    </div>
                    {plan.id === 'team' ? (
                      <div className="rounded-2xl bg-cyan-500/10 p-3 text-cyan-300">
                        <Users className="h-5 w-5" />
                      </div>
                    ) : (
                      <div className="rounded-2xl bg-violet-500/10 p-3 text-violet-300">
                        <MessageSquare className="h-5 w-5" />
                      </div>
                    )}
                  </div>

                  <div className="mt-6 flex items-end gap-2">
                    <p className="text-4xl font-extrabold text-white">${plan.priceUsd}</p>
                    <p className="pb-1 text-sm text-slate-500">/ month</p>
                  </div>

                  <div className="mt-5 grid gap-2 sm:grid-cols-2">
                    <div className="rounded-2xl border border-navy-700/60 bg-navy-950/45 px-4 py-3">
                      <p className="text-[10px] uppercase tracking-[0.18em] text-slate-600">Mission range</p>
                      <p className="mt-2 text-lg font-semibold text-white">{plan.missions}</p>
                    </div>
                    <div className="rounded-2xl border border-navy-700/60 bg-navy-950/45 px-4 py-3">
                      <p className="text-[10px] uppercase tracking-[0.18em] text-slate-600">Credits</p>
                      <p className="mt-2 text-lg font-semibold text-white">{formatCredits(plan.credits)}</p>
                    </div>
                  </div>

                  <div className="mt-3 rounded-2xl border border-navy-700/60 bg-navy-950/45 px-4 py-3">
                    <p className="text-[10px] uppercase tracking-[0.18em] text-slate-600">Active automations</p>
                    <p className="mt-2 text-lg font-semibold text-white">{plan.automations}</p>
                  </div>

                  <div className="mt-3 rounded-2xl border border-amber-500/20 bg-amber-500/8 px-4 py-3">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-200/80">Sample monthly pressure</p>
                    <p className="mt-2 text-sm font-semibold text-white">{proofRun.title}</p>
                    <p className="mt-1 text-sm text-slate-300">
                      {formatCredits(proofRun.runCredits)} cr/run, {formatCredits(getMonthlyCredits(proofRun))} cr/month at {proofRun.cadence.toLowerCase()} cadence.
                    </p>
                    <Link
                      to={getSampleRunPath(proofRun.id)}
                      className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-amber-100 transition-colors hover:text-white"
                    >
                      Open run page
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  </div>

                  <ul className="mt-5 flex-1 space-y-3">
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex items-start gap-2.5 text-sm text-slate-300">
                        <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-violet-400" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>

                  <button
                    type="button"
                    onClick={() => { void handleSubscription(plan.id); }}
                    disabled={busyId !== null}
                    className={`mt-6 flex w-full items-center justify-center gap-2 rounded-2xl px-5 py-3.5 text-sm font-semibold text-white transition-all disabled:cursor-wait disabled:opacity-60 ${
                      hoveredPlanId === plan.id
                        ? 'bg-violet-600 hover:bg-violet-500 shadow-glow-violet'
                        : 'bg-navy-700 hover:bg-navy-600'
                    }`}
                  >
                    {busyId === plan.id ? 'Opening Stripe…' : `Choose ${plan.name}`}
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
                );
              })}
            </div>

            <div className="mt-8 rounded-[1.9rem] border border-navy-700/70 bg-navy-900/45 p-6">
              <div className="flex items-start gap-4">
                <div className="rounded-2xl bg-cyan-500/10 p-3 text-cyan-300">
                  <Shield className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-600">Enterprise</p>
                  <h3 className="mt-2 text-2xl font-semibold text-white">Custom for bigger teams</h3>
                  <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-400">
                    Custom mission volume, security controls, admin workflows, onboarding support, and SLA-ready positioning. Use this when Violema is becoming part of a broader operating stack.
                  </p>
                  <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                    <Link
                      to={getSampleRunPath('pricing-proof-enterprise-readiness')}
                      className="inline-flex items-center justify-center gap-2 rounded-2xl border border-navy-700/70 bg-navy-950/45 px-4 py-2.5 text-sm font-semibold text-slate-200 transition-colors hover:border-cyan-500/30 hover:text-white"
                    >
                      View enterprise sample
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                    <a
                      href="mailto:sales@purpleorange.io?subject=Violema%20Enterprise"
                      className="inline-flex items-center justify-center gap-2 rounded-2xl border border-cyan-500/30 bg-cyan-500/10 px-5 py-2.5 text-sm font-semibold text-cyan-200 transition-colors hover:bg-cyan-500/16"
                    >
                      Contact sales
                      <ArrowRight className="h-4 w-4" />
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="mt-7 grid gap-5 xl:grid-cols-3 items-stretch">
              {TOP_UP_OPTIONS.map((option) => (
                <div key={option.id} className="flex h-full flex-col rounded-[1.9rem] border border-navy-700/70 bg-navy-900/45 p-6">
                  <div className="min-h-[9rem]">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-600">{option.label}</p>
                    <p className="mt-4 text-4xl font-extrabold text-white">{formatCredits(option.credits)}</p>
                    <p className="mt-1 text-sm text-slate-500">one-time credits</p>
                    <p className="mt-4 text-sm leading-relaxed text-slate-400">{option.description}</p>
                  </div>
                  <div className="mt-6 rounded-2xl border border-navy-700/60 bg-navy-950/45 px-4 py-3">
                    <p className="text-[10px] uppercase tracking-[0.18em] text-slate-600">Price</p>
                    <p className="mt-2 text-xl font-semibold text-white">${option.priceUsd}</p>
                  </div>
                  <div className="mt-3 rounded-2xl border border-navy-700/60 bg-navy-950/45 px-4 py-3">
                    <p className="text-[10px] uppercase tracking-[0.18em] text-slate-600">Best for</p>
                    <p className="mt-2 text-sm text-slate-400">
                      {option.id === 'topup_500'
                        ? 'Light extra research or a few higher-effort task runs.'
                        : option.id === 'topup_1500'
                          ? 'A heavier operating week without moving plans yet.'
                          : 'A serious burst of execution across multiple automations or artifact-heavy work.'}
                    </p>
                  </div>
                  <div className="mt-auto pt-6">
                    <button
                    type="button"
                    onClick={() => { void handleTopUp(option.id); }}
                    disabled={busyId !== null}
                    className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl bg-violet-600 px-5 py-3.5 text-sm font-semibold text-white transition-colors hover:bg-violet-500 disabled:cursor-wait disabled:opacity-60"
                  >
                    {busyId === option.id ? 'Opening Stripe…' : 'Buy top-up'}
                    <ArrowRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-8 rounded-[1.9rem] border border-navy-700/70 bg-navy-900/45 p-6">
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-600">How top-ups work</p>
              <div className="mt-4 grid gap-4 md:grid-cols-3">
                {[
                  'Top-ups are one-time only and do not change your subscription plan.',
                  'Credits are added to the same workspace and consumed by tasks, tool runs, and automations.',
                  'Use top-ups when you need more execution without moving the whole team to a bigger monthly tier.',
                ].map((item) => (
                  <div key={item} className="rounded-2xl border border-navy-700/60 bg-navy-950/45 px-4 py-3 text-sm leading-relaxed text-slate-400">
                    {item}
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
