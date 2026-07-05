import ArrowRight from 'lucide-react/dist/esm/icons/arrow-right.js';
import CheckCircle2 from 'lucide-react/dist/esm/icons/check-circle-2.js';
import Sparkles from 'lucide-react/dist/esm/icons/sparkles.js';
import ShieldCheck from 'lucide-react/dist/esm/icons/shield-check.js';
import { betaAccessSignals, betaAccessSteps } from '../content/homepage';
import { consultationUrl, openCalendlyConsultation } from '../lib/calendly';
import Reveal from './Reveal';

const accessIncludes = [
  'Workflow audit and first-mission scoping',
  'One recurring mission with review gates',
  'Slack or web delivery',
  'Run log and source trail',
  'Start at $79 or Pro at $249',
];

export default function BetaAccess() {
  return (
    <section id="beta-access" className="scroll-mt-24 border-t border-white/10 bg-ink-950 py-20 sm:py-28">
      <div className="mx-auto max-w-[88rem] px-4 sm:px-6 lg:px-8">
        <Reveal className="max-w-4xl">
          <div>
            <p className="text-telemetry text-[0.62rem] text-signal-400">// workflow audit</p>
            <h2 className="mt-4 font-display text-[2.6rem] font-semibold leading-[0.98] tracking-[-0.03em] text-white sm:text-[3.5rem]">
              Launch with one workflow we can prove.
            </h2>
          </div>
          <p className="mt-5 max-w-2xl text-base leading-7 text-[#aeb7cd] sm:text-lg">
            Most teams should not pick a tier blind. We map the first mission, confirm sources and approvals, then choose Start, Pro, or custom Enterprise.
          </p>
        </Reveal>

        <Reveal delay={80} className="mt-10 grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-white/10 bg-white/10 lg:grid-cols-4">
          {betaAccessSignals.map((signal) => (
            <div key={signal.label} className="bg-ink-900 p-5">
              <p className="text-telemetry text-[0.55rem] text-[#6f7a91]">{signal.label}</p>
              <p className="mt-2 text-lg font-semibold tracking-[-0.02em] text-white sm:text-xl">{signal.value}</p>
            </div>
          ))}
        </Reveal>

        <div className="mt-5 grid gap-5 lg:grid-cols-[1.12fr_0.88fr] lg:items-stretch">
          <Reveal delay={80}>
            <article className="signal-orbit relative flex h-full flex-col overflow-hidden rounded-[1.6rem] border border-violet-300/30 bg-gradient-to-b from-violet-500/[0.13] to-ink-900 p-6 shadow-[0_40px_120px_-44px_rgba(124,58,237,0.72)] sm:p-8">
              <span className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-signal-500/70 to-transparent" />

              <div className="flex flex-wrap items-center gap-3">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-signal-500/30 bg-signal-500/12 px-2.5 py-1">
                  <Sparkles className="h-3 w-3 text-signal-300" />
                  <span className="text-telemetry text-[0.5rem] text-signal-200">Call first</span>
                </span>
                <span className="text-telemetry text-[0.54rem] text-[#8793ad]">Start free preview available</span>
              </div>

              <h3 className="mt-5 max-w-2xl font-display text-3xl font-semibold leading-tight tracking-[-0.03em] text-white sm:text-4xl">
                Book the audit when one founder workflow is ready to run every week.
              </h3>
              <p className="mt-4 max-w-2xl text-sm leading-6 text-[#aeb7cd] sm:text-base sm:leading-7">
                The first implementation should have a real owner, connected context, an approval rule, and a payoff clear enough to repeat.
              </p>

              <div className="mt-7 flex flex-col gap-3 sm:flex-row">
                <a
                  href={consultationUrl}
                  onClick={(event) => { void openCalendlyConsultation(event, 'workflow-audit-primary'); }}
                  className="group inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-white px-5 text-sm font-bold text-[#070b16] transition duration-200 hover:bg-[#eef2ff] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300"
                >
                  <span>Book workflow audit</span>
                  <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" />
                </a>
                <a
                  href="/signup?next=%2Fdashboard"
                  className="inline-flex min-h-12 items-center justify-center rounded-xl border border-white/12 bg-white/[0.04] px-5 text-sm font-semibold text-white transition duration-200 hover:border-signal-500/40 hover:bg-signal-500/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300"
                >
                  Start free preview
                </a>
              </div>

              <ul className="mt-8 grid gap-3 sm:grid-cols-2">
                {accessIncludes.map((feature) => (
                  <li key={feature} className="flex gap-3 text-sm leading-6 text-[#c2cadb]">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 flex-none text-signal-300" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
            </article>
          </Reveal>

          <Reveal delay={140} className="grid gap-3">
            {betaAccessSteps.map((step) => (
              <article key={step.label} className="rounded-2xl border border-white/10 bg-ink-900 p-5">
                <div className="flex items-start gap-4">
                  <span className="flex h-10 w-10 flex-none items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-telemetry text-[0.58rem] text-violet-100">
                    {step.label}
                  </span>
                  <div>
                    <h3 className="font-display text-xl font-semibold tracking-[-0.02em] text-white">{step.title}</h3>
                    <p className="mt-2 text-sm leading-6 text-[#aeb7cd]">{step.body}</p>
                  </div>
                </div>
              </article>
            ))}
          </Reveal>
        </div>

        <Reveal delay={80} className="mt-5 grid gap-4 rounded-[1.6rem] border border-white/10 bg-ink-900 p-6 lg:grid-cols-[1fr_auto] lg:items-center">
          <div>
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-500/14 text-violet-100">
                <ShieldCheck className="h-5 w-5" />
              </span>
              <p className="font-display text-xl font-semibold tracking-[-0.02em] text-white">How pricing works now</p>
            </div>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[#aeb7cd]">
              Start is $79 per month for the first reliable mission. Pro is $249 for recurring operating cadence. Enterprise is custom.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row lg:flex-col xl:flex-row">
            <a
              href="/pricing"
              className="inline-flex min-h-12 items-center justify-center rounded-xl bg-white px-5 text-sm font-semibold text-[#070b16] transition duration-200 hover:bg-[#eef2ff] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300"
            >
              View pricing
            </a>
            <a
              href={consultationUrl}
              onClick={(event) => { void openCalendlyConsultation(event, 'workflow-audit-secondary'); }}
              className="inline-flex min-h-12 items-center justify-center rounded-xl border border-white/12 bg-white/[0.04] px-5 text-sm font-semibold text-white transition duration-200 hover:border-signal-500/40 hover:bg-signal-500/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300"
            >
              Book workflow audit
            </a>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
