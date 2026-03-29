import { useNavigate } from 'react-router-dom';
import { Check, Zap } from 'lucide-react';
import { createBillingCheckout } from '../lib/credits';

const PLANS = [
  {
    id: 'starter',
    name: 'Starter',
    price: '$29',
    period: 'per month',
    description: 'A lean entry tier for founders and individuals.',
    cta: 'Choose Starter',
    featured: false,
    features: [
      '500 Nexus credits',
      '3 active automations',
      'Web research',
      'Code execution',
      'Email support',
    ],
  },
  {
    id: 'pro',
    name: 'Pro',
    price: '$50',
    period: 'per month',
    description: 'The default operating tier for serious teams.',
    cta: 'Upgrade to Pro',
    featured: true,
    badge: 'Most popular',
    features: [
      '1,000 Nexus credits',
      '15 active automations',
      'Multi-agent orchestration',
      'Task automation',
      'Long-term memory',
      'Slack + Email support',
      'Analytics dashboard',
    ],
  },
  {
    id: 'team',
    name: 'Team',
    price: '$149',
    period: 'per month',
    description: 'For companies running Nexus as an operating layer.',
    cta: 'Upgrade to Team',
    featured: false,
    features: [
      '5,000 Nexus credits',
      '100 active automations',
      'Approvals and review gates',
      'Multi-agent orchestration',
      'Priority support',
      'Admin visibility',
    ],
  },
];

export default function Pricing() {
  const navigate = useNavigate();

  async function handleCheckout(planId: 'starter' | 'pro' | 'team') {
    try {
      const result = await createBillingCheckout({ kind: 'subscription', planId });
      if (result.session?.checkoutUrl) {
        window.location.assign(result.session.checkoutUrl);
        return;
      }
    } catch {
      // fall back below
    }
    navigate('/dashboard');
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
            Start for free. Scale as your team grows. No hidden fees.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8 items-start">
          {PLANS.map((plan, i) => (
            <div
              key={i}
              className={`relative rounded-2xl p-8 transition-all duration-300 hover:-translate-y-1 ${
                plan.featured
                  ? 'bg-gradient-to-b from-violet-950/80 to-navy-800/80 border-2 border-violet-500/60 shadow-glow-violet'
                  : 'bg-navy-800/50 border border-navy-700/60 hover:border-navy-600'
              }`}
            >
              {plan.badge && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                  <span className="bg-violet-600 text-white text-xs font-bold px-4 py-1.5 rounded-full shadow-glow-violet">
                    {plan.badge}
                  </span>
                </div>
              )}

              <div className="mb-6">
                <div className="flex items-center gap-2 mb-2">
                  {plan.featured && <Zap className="w-4 h-4 text-violet-400" fill="currentColor" />}
                  <h3 className="text-lg font-semibold text-white">{plan.name}</h3>
                </div>
                <div className="flex items-end gap-2 mb-2">
                  <span className={`text-4xl font-extrabold ${plan.featured ? 'text-white' : 'text-white'}`}>
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
                  plan.featured
                    ? 'bg-violet-600 hover:bg-violet-500 text-white shadow-glow-violet'
                    : 'bg-navy-700 hover:bg-navy-600 text-slate-200 border border-navy-600'
                }`}
              >
                {plan.cta}
              </button>

              <ul className="space-y-3">
                {plan.features.map((feature, j) => (
                  <li key={j} className="flex items-start gap-3 text-sm">
                    <Check
                      className={`w-4 h-4 flex-shrink-0 mt-0.5 ${
                        plan.featured ? 'text-violet-400' : 'text-slate-500'
                      }`}
                    />
                    <span className={plan.featured ? 'text-slate-300' : 'text-slate-400'}>
                      {feature}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <p className="text-center text-slate-500 text-sm mt-10">
          Credits map to actual work. Start lean, then scale up as Nexus takes on more execution.
        </p>
      </div>
    </section>
  );
}
