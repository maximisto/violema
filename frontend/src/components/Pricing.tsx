import ArrowRight from 'lucide-react/dist/esm/icons/arrow-right.js';
import CheckCircle2 from 'lucide-react/dist/esm/icons/check-circle-2.js';
import Sparkles from 'lucide-react/dist/esm/icons/sparkles.js';
import { useNavigate } from 'react-router-dom';
import { hasAcceptedAccess } from '../lib/auth';
import { pricingPlans, pricingSignals, type PricingPlan } from '../content/homepage';
import Reveal from './Reveal';

function PlanCard({ plan, onCheckout }: { plan: PricingPlan; onCheckout: (id: PricingPlan['id']) => void }) {
  return (
    <article
      className={`relative flex h-full flex-col overflow-hidden rounded-[1.6rem] border p-6 ${
        plan.featured
          ? 'signal-orbit border-violet-300/30 bg-gradient-to-b from-violet-500/[0.12] to-ink-900 shadow-[0_40px_120px_-44px_rgba(124,58,237,0.7)]'
          : 'border-white/10 bg-ink-900'
      }`}
    >
      <span
        className={`absolute inset-x-0 top-0 h-px ${
          plan.featured ? 'bg-gradient-to-r from-transparent via-signal-500/70 to-transparent' : 'bg-gradient-to-r from-transparent via-white/20 to-transparent'
        }`}
      />

      <div className="flex items-center justify-between gap-3">
        <h3 className="font-display text-2xl font-semibold tracking-[-0.02em] text-white">{plan.name}</h3>
        {plan.featured ? (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-signal-500/30 bg-signal-500/12 px-2.5 py-1">
            <Sparkles className="h-3 w-3 text-signal-300" />
            <span className="text-telemetry text-[0.5rem] text-signal-200">Most popular</span>
          </span>
        ) : null}
      </div>

      <p className="mt-3 min-h-[3rem] text-sm leading-6 text-[#aeb7cd]">{plan.description}</p>

      <div className="mt-5 flex items-end gap-2">
        <span className="font-mono text-[3.1rem] font-semibold leading-none tracking-[-0.05em] text-white tabular">{plan.price}</span>
        <span className="pb-1.5 text-telemetry text-[0.55rem] text-[#8793ad]">{plan.period}</span>
      </div>

      <p className="mt-4 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-sm font-semibold text-violet-100">
        {plan.capacity}
      </p>

      <button
        type="button"
        onClick={() => onCheckout(plan.id)}
        className={`group mt-5 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl px-4 text-sm font-bold transition duration-200 active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300 ${
          plan.featured
            ? 'bg-white text-[#070b16] hover:bg-[#eef2ff]'
            : 'border border-white/12 bg-white/[0.04] text-white hover:border-violet-200/40 hover:bg-violet-200/[0.08]'
        }`}
      >
        <span className="whitespace-nowrap">{plan.cta}</span>
        <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" />
      </button>

      <ul className="mt-6 flex-1 space-y-3">
        {plan.features.map((feature) => (
          <li key={feature} className="flex gap-3 text-sm leading-6 text-[#c2cadb]">
            <CheckCircle2 className={`mt-0.5 h-4 w-4 flex-none ${plan.featured ? 'text-signal-300' : 'text-violet-200'}`} />
            <span>{feature}</span>
          </li>
        ))}
      </ul>

      <div className="mt-6 border-t border-white/10 pt-4 text-xs leading-5 text-[#8793ad]">
        {plan.footnote ?? 'Upgrade or downgrade as workflow volume changes.'}
      </div>
    </article>
  );
}

export default function Pricing() {
  const navigate = useNavigate();

  function handleCheckout(planId: PricingPlan['id']) {
    if (hasAcceptedAccess()) {
      navigate(`/plans?plan=${planId}`);
      return;
    }
    navigate(`/signup?next=${encodeURIComponent(`/plans?plan=${planId}`)}`);
  }

  return (
    <section id="pricing" className="scroll-mt-24 border-t border-white/10 bg-ink-950 py-20 sm:py-28">
      <div className="mx-auto max-w-[88rem] px-4 sm:px-6 lg:px-8">
        <Reveal className="grid gap-6 lg:grid-cols-[0.85fr_1fr] lg:items-end">
          <div>
            <p className="text-telemetry text-[0.62rem] text-signal-400">// pricing</p>
            <h2 className="mt-4 max-w-3xl font-display text-[2.6rem] font-semibold leading-[0.98] tracking-[-0.03em] text-white sm:text-[3.5rem]">
              Start with one valuable run. Scale when it becomes rhythm.
            </h2>
          </div>
          <p className="max-w-2xl text-base leading-7 text-[#aeb7cd] sm:text-lg lg:justify-self-end">
            Plans are organized around the work Violema performs: active workflows, run credits, review gates, run history, and team visibility.
          </p>
        </Reveal>

        <Reveal delay={80} className="mt-10 grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-white/10 bg-white/10 lg:grid-cols-4">
          {pricingSignals.map((signal) => (
            <div key={signal.label} className="bg-ink-900 p-5">
              <p className="text-telemetry text-[0.55rem] text-[#6f7a91]">{signal.label}</p>
              <p className="mt-2 font-mono text-xl font-semibold tracking-[-0.02em] text-white tabular sm:text-2xl">{signal.value}</p>
            </div>
          ))}
        </Reveal>

        <div className="mt-5 grid gap-4 lg:grid-cols-[0.92fr_1.16fr_0.92fr] lg:items-stretch">
          {pricingPlans.map((plan, index) => (
            <Reveal key={plan.id} delay={index * 90}>
              <PlanCard plan={plan} onCheckout={handleCheckout} />
            </Reveal>
          ))}
        </div>

        <Reveal delay={80} className="mt-5 grid gap-4 rounded-[1.6rem] border border-white/10 bg-ink-900 p-6 lg:grid-cols-[1fr_auto] lg:items-center">
          <div>
            <p className="font-display text-xl font-semibold tracking-[-0.02em] text-white">Need workspace-specific controls?</p>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[#aeb7cd]">
              Larger teams can add onboarding, security review, higher workflow limits, custom policies, and dedicated operating support.
            </p>
          </div>
          <a
            href="mailto:sales@purpleorange.io?subject=Violema%20Enterprise"
            className="inline-flex min-h-12 items-center justify-center rounded-xl border border-white/12 bg-white/[0.04] px-5 text-sm font-semibold text-white transition duration-200 hover:border-signal-500/40 hover:bg-signal-500/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300"
          >
            Contact sales
          </a>
        </Reveal>
      </div>
    </section>
  );
}
