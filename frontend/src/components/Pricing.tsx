import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, Zap } from 'lucide-react';
import { hasAcceptedAccess } from '../lib/auth';

const PLANS = [
  {
    id: 'starter',
    name: 'Starter',
    price: '$29',
    period: 'per month',
    description: 'A lean self-serve tier for founders and operators getting started.',
    cta: 'Start with Starter',
    featured: false,
    features: [
      '500 Violema credits',
      '3 active automations',
      'Web research',
      'Code execution',
      'Email support',
    ],
  },
  {
    id: 'pro',
    name: 'Pro',
    price: '$79',
    period: 'per month',
    description: 'The default operating tier for serious solo operators and execution-heavy workflows.',
    cta: 'Choose Pro',
    featured: true,
    badge: 'Recommended beta tier',
    features: [
      '2,000 Violema credits',
      '20 active automations',
      'Multi-agent orchestration',
      'Task automation',
      'Long-term memory',
      'Slack + email support',
      'Analytics dashboard',
    ],
  },
  {
    id: 'team',
    name: 'Team',
    price: '$249',
    period: 'per month',
    description: 'A real team workspace for coordinated operations, approvals, and shared execution.',
    cta: 'Choose Team',
    featured: false,
    features: [
      '7,500 Violema credits',
      '100 active automations',
      '5 included seats',
      'Approvals and review gates',
      'Admin visibility',
      'Shared workspace / shared memory',
      'Priority support',
    ],
    footnote: 'Extra seats default to $29/seat/month.',
  },
];

export default function Pricing() {
  const navigate = useNavigate();
  const [hoveredPlan, setHoveredPlan] = useState<string | null>(null);

  function handleCheckout(planId: 'starter' | 'pro' | 'team') {
    if (hasAcceptedAccess()) {
      navigate(`/plans?plan=${planId}`);
      return;
    }
    navigate(`/signup?next=${encodeURIComponent(`/plans?plan=${planId}`)}`);
  }

  return (
    <section className="py-24 relative" id="pricing">
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-violet-950/5 to-transparent pointer-events-none" />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 bg-navy-800 border border-navy-700 rounded-full px-4 py-1.5 mb-6">
            <span className="text-violet-400 text-sm font-medium">Pricing</span>
          </div>
          <h2 className="text-4xl sm:text-5xl font-bold text-white mb-4">
            Simple, transparent pricing
          </h2>
          <p className="text-xl text-slate-400 max-w-2xl mx-auto">
            Start lean, then scale into heavier execution as Violema takes on more of the work.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8 items-stretch">
          {PLANS.map((plan) => {
            const isActive = hoveredPlan === plan.id;
            return (
              <div
                key={plan.id}
                onMouseEnter={() => setHoveredPlan(plan.id)}
                onMouseLeave={() => setHoveredPlan(null)}
                onFocusCapture={() => setHoveredPlan(plan.id)}
                onBlurCapture={() => setHoveredPlan(null)}
                className={`interactive-glow surface-lift relative flex h-full flex-col rounded-2xl p-8 transition-all duration-300 ${
                  isActive
                    ? 'bg-gradient-to-b from-violet-950/82 via-navy-900/80 to-navy-800/80 border border-violet-500/55 shadow-glow-violet -translate-y-1'
                    : 'bg-navy-800/50 border border-navy-700/60 hover:border-navy-600'
                }`}
              >
                {plan.badge && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                    <span className={`text-white text-xs font-bold px-4 py-1.5 rounded-full shadow-glow-violet ${isActive ? 'bg-violet-500' : 'bg-violet-600'}`}>
                      {plan.badge}
                    </span>
                  </div>
                )}

                <div className="mb-6 min-h-[8.5rem]">
                  <div className="flex items-center gap-2 mb-2">
                    <Zap className={`w-4 h-4 ${isActive ? 'text-violet-300' : 'text-violet-400/80'}`} fill="currentColor" />
                    <h3 className="text-lg font-semibold text-white">{plan.name}</h3>
                  </div>
                  <div className="flex items-end gap-2 mb-2">
                    <span className="text-4xl font-extrabold text-white">
                      {plan.price}
                    </span>
                    {plan.price !== 'Custom' && (
                      <span className="text-slate-400 text-sm mb-1">/ {plan.period}</span>
                    )}
                  </div>
                  <p className="text-slate-400 text-sm">{plan.description}</p>
                </div>

                <button
                  onClick={() => handleCheckout(plan.id as 'starter' | 'pro' | 'team')}
                  className={`w-full py-3 px-6 rounded-xl font-semibold text-sm transition-all duration-200 mb-8 ${
                    isActive
                      ? 'bg-violet-600 hover:bg-violet-500 text-white shadow-glow-violet'
                      : 'bg-navy-700 hover:bg-navy-600 text-slate-200 border border-navy-600'
                  }`}
                >
                  {plan.cta}
                </button>

                <ul className="flex-1 space-y-3">
                  {plan.features.map((feature, j) => (
                    <li key={j} className="flex items-start gap-3 text-sm">
                      <Check
                        className={`w-4 h-4 flex-shrink-0 mt-0.5 ${
                          isActive ? 'text-violet-300' : 'text-slate-500'
                        }`}
                      />
                      <span className={isActive ? 'text-slate-200' : 'text-slate-400'}>
                        {feature}
                      </span>
                    </li>
                  ))}
                </ul>

                <div className="mt-5 min-h-[1.75rem]">
                  {'footnote' in plan && plan.footnote ? (
                    <p className="text-xs text-slate-500">{plan.footnote}</p>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>

        <div className="interactive-glow surface-lift mt-10 rounded-2xl border border-navy-700/60 bg-navy-900/40 px-6 py-5 text-center">
          <p className="text-lg font-semibold text-white">Enterprise</p>
          <p className="mt-2 text-sm text-slate-400">
            Custom pricing for larger teams that need higher limits, stronger security controls, custom onboarding, and security review.
          </p>
          <div className="mt-4 flex justify-center">
            <a
              href="mailto:sales@purpleorange.io?subject=Violema%20Enterprise"
              className="inline-flex rounded-xl border border-cyan-500/30 bg-cyan-500/10 px-5 py-3 text-sm font-semibold text-cyan-200 transition-colors hover:bg-cyan-500/16"
            >
              Contact sales
            </a>
          </div>
        </div>

        <div className="mt-10 space-y-2 text-center">
          <p className="text-sm text-slate-400">
            Credits map to actual agent work. Start lean, then scale as Violema takes on more execution.
          </p>
          <p className="text-sm text-slate-500">
            500 credits is suited for light weekly usage; higher tiers support heavier multi-agent workflows.
          </p>
        </div>
      </div>
    </section>
  );
}
