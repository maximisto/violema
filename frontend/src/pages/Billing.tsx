import { useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ArrowRight, Check, CreditCard, Layers3, MessageSquare, Shield, Sparkles, Users } from 'lucide-react';
import { TOP_UP_OPTIONS, createBillingCheckout, formatCredits } from '../lib/credits';
import { getAuthSession, hasAcceptedAccess } from '../lib/auth';

const PLANS = [
  {
    id: 'starter' as const,
    name: 'Starter',
    priceUsd: 29,
    description: 'A lean self-serve tier for founders and operators getting started.',
    credits: 500,
    automations: 3,
    features: ['Web research', 'Code execution', 'Email support'],
  },
  {
    id: 'pro' as const,
    name: 'Pro',
    priceUsd: 79,
    description: 'The default operating tier for serious solo operators and execution-heavy workflows.',
    credits: 2000,
    automations: 20,
    features: ['Multi-agent orchestration', 'Task automation', 'Long-term memory', 'Slack + email support', 'Analytics dashboard'],
    featured: true,
  },
  {
    id: 'team' as const,
    name: 'Team',
    priceUsd: 249,
    description: 'A real team workspace with shared context, approvals, and admin visibility.',
    credits: 7500,
    automations: 100,
    seats: 5,
    features: ['Approvals / review gates', 'Admin visibility', 'Shared workspace / shared memory', 'Priority support'],
  },
];

export default function Billing() {
  const location = useLocation();
  const navigate = useNavigate();
  const session = getAuthSession();
  const [busyId, setBusyId] = useState<string | null>(null);
  const search = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const section = search.get('section') === 'topups' ? 'topups' : 'plans';
  const requestedPlan = search.get('plan');

  async function handleSubscription(planId: 'starter' | 'pro' | 'team') {
    if (!hasAcceptedAccess()) {
      navigate(`/signup?next=${encodeURIComponent(`/plans?plan=${planId}`)}`);
      return;
    }
    setBusyId(planId);
    try {
      const result = await createBillingCheckout({ kind: 'subscription', planId });
      if (result.session?.checkoutUrl) {
        window.location.assign(result.session.checkoutUrl);
        return;
      }
    } finally {
      setBusyId(null);
    }
  }

  async function handleTopUp(offerId: 'topup_500' | 'topup_1500' | 'topup_5000') {
    if (!hasAcceptedAccess()) {
      navigate(`/signup?next=${encodeURIComponent('/plans?section=topups')}`);
      return;
    }
    setBusyId(offerId);
    try {
      const result = await createBillingCheckout({ kind: 'top-up', offerId });
      if (result.session?.checkoutUrl) {
        window.location.assign(result.session.checkoutUrl);
        return;
      }
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="min-h-screen bg-hero-gradient">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(168,85,247,0.12),transparent_35%),radial-gradient(circle_at_bottom_right,rgba(34,211,238,0.06),transparent_28%)]" />
      <div className="relative mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="rounded-[2rem] border border-navy-700/60 bg-navy-950/40 px-5 py-6 shadow-[0_24px_80px_rgba(3,8,24,0.3)] sm:px-7 lg:px-8">
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1.55fr)_22rem] lg:items-start">
            <div className="max-w-4xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-violet-500/20 bg-violet-500/10 px-4 py-1.5 text-sm font-medium text-violet-300">
              <Sparkles className="h-3.5 w-3.5" />
              Billing and access
              </div>
              <h1 className="mt-5 max-w-5xl text-4xl font-extrabold leading-[0.95] text-white sm:text-5xl lg:text-[4rem]">
                Pick the right runway
                <span className="gradient-text"> before Nexus starts executing.</span>
              </h1>
              <p className="mt-4 max-w-3xl text-base leading-7 text-slate-400 sm:text-lg">
                Plans set your monthly credit budget and automation limits. Top-ups are one-time add-ons for extra work without changing your plan.
              </p>
              <div className="mt-5 space-y-1.5">
                <p className="text-sm text-slate-300">
                  Credits map to actual agent work. Start lean, then scale as Nexus takes on more execution.
                </p>
                <p className="text-sm text-slate-500">
                  Starter is for light weekly usage. Higher tiers are built for heavier multi-agent workflows and bigger automation volume.
                </p>
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
                  {hasAcceptedAccess() ? 'Ready' : 'Setup required'}
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
              </div>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-white/6 pt-5">
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => navigate('/plans')}
                className={`ui-pill px-4 py-2 ${section === 'plans' ? 'border-violet-500/35 bg-violet-500/12 text-violet-200' : ''}`}
              >
                <Layers3 className="h-3.5 w-3.5" />
                Plans
              </button>
              <button
                type="button"
                onClick={() => navigate('/plans?section=topups')}
                className={`ui-pill px-4 py-2 ${section === 'topups' ? 'border-violet-500/35 bg-violet-500/12 text-violet-200' : ''}`}
              >
                <CreditCard className="h-3.5 w-3.5" />
                Top-ups
              </button>
            </div>
            <div className="text-sm text-slate-500">
              {section === 'topups'
                ? 'Top-ups add credits only. They do not change your monthly plan.'
                : 'Pick the monthly tier first. Add top-ups later if Nexus needs more room to run.'}
            </div>
          </div>
        </div>

        {section === 'plans' ? (
          <>
            <div className="mt-7 grid gap-5 xl:grid-cols-3">
              {PLANS.map((plan) => (
                <div
                  key={plan.id}
                  className={`rounded-[1.9rem] border p-6 transition-all ${
                    plan.featured
                      ? 'border-violet-500/45 bg-gradient-to-b from-violet-950/70 to-navy-900/80 shadow-glow-violet'
                      : 'border-navy-700/70 bg-navy-900/45'
                  }`}
                >
                  {plan.featured && (
                    <div className="mb-4 inline-flex rounded-full border border-violet-400/30 bg-violet-500/12 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-violet-200">
                      Most popular
                    </div>
                  )}
                  <div className="flex items-start justify-between gap-4">
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
                      <p className="text-[10px] uppercase tracking-[0.18em] text-slate-600">Credits</p>
                      <p className="mt-2 text-lg font-semibold text-white">{formatCredits(plan.credits)}</p>
                    </div>
                    <div className="rounded-2xl border border-navy-700/60 bg-navy-950/45 px-4 py-3">
                      <p className="text-[10px] uppercase tracking-[0.18em] text-slate-600">Active automations</p>
                      <p className="mt-2 text-lg font-semibold text-white">{plan.automations}</p>
                    </div>
                  </div>

                  {plan.seats && (
                    <div className="mt-3 rounded-2xl border border-cyan-500/20 bg-cyan-500/8 px-4 py-3">
                      <p className="text-[10px] uppercase tracking-[0.18em] text-cyan-300/80">Included seats</p>
                      <p className="mt-2 text-lg font-semibold text-white">{plan.seats} seats + $29 per extra seat</p>
                    </div>
                  )}

                  <ul className="mt-5 space-y-3">
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
                    className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl bg-violet-600 px-5 py-3.5 text-sm font-semibold text-white transition-colors hover:bg-violet-500 disabled:cursor-wait disabled:opacity-60"
                  >
                    {busyId === plan.id ? 'Opening Stripe…' : `Choose ${plan.name}`}
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              ))}
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
                    Higher limits, security controls, admin workflows, onboarding support, and SLA-ready positioning. Use this when Nexus is becoming part of a broader operating stack.
                  </p>
                  <a
                    href="mailto:sales@purpleorange.io?subject=Nexus%20Enterprise"
                    className="mt-4 inline-flex items-center gap-2 rounded-2xl border border-cyan-500/30 bg-cyan-500/10 px-5 py-3 text-sm font-semibold text-cyan-200 transition-colors hover:bg-cyan-500/16"
                  >
                    Contact sales
                    <ArrowRight className="h-4 w-4" />
                  </a>
                </div>
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="mt-7 grid gap-5 xl:grid-cols-3">
              {TOP_UP_OPTIONS.map((option) => (
                <div key={option.id} className="rounded-[1.9rem] border border-navy-700/70 bg-navy-900/45 p-6">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-600">{option.label}</p>
                  <p className="mt-4 text-4xl font-extrabold text-white">{formatCredits(option.credits)}</p>
                  <p className="mt-1 text-sm text-slate-500">one-time credits</p>
                  <p className="mt-4 text-sm leading-relaxed text-slate-400">{option.description}</p>
                  <div className="mt-6 rounded-2xl border border-navy-700/60 bg-navy-950/45 px-4 py-3">
                    <p className="text-[10px] uppercase tracking-[0.18em] text-slate-600">Price</p>
                    <p className="mt-2 text-xl font-semibold text-white">${option.priceUsd}</p>
                  </div>
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
