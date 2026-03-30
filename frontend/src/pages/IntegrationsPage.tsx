import { ArrowRight, BellRing, Bot, Github, Globe, Layers3, Link2, Search, Shield, Slack, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';
import PublicHeader from '../components/PublicHeader';

const NATIVE_NOW = [
  {
    name: 'Slack',
    icon: Slack,
    detail: 'Messaging and team coordination',
    description: 'Send updates, deliver summaries, and run Nexus where teams already work.',
  },
  {
    name: 'Email',
    icon: BellRing,
    detail: 'Outbound notifications and follow-ups',
    description: 'Route alerts, summaries, and human-facing messages through email when Slack is not the right surface.',
  },
  {
    name: 'Web search',
    icon: Search,
    detail: 'Current information and research',
    description: 'Pull current web context into real tasks instead of relying on stale model memory.',
  },
  {
    name: 'Browser screenshots',
    icon: Globe,
    detail: 'Visual inspection and capture',
    description: 'Inspect real pages, grab screenshots, and bring visual state back into the workflow.',
  },
  {
    name: 'Stripe',
    icon: Layers3,
    detail: 'Billing and workspace purchases',
    description: 'Power subscriptions, top-ups, and billing state directly inside the Nexus commercial surface.',
  },
  {
    name: 'GitHub',
    icon: Github,
    detail: 'Issues, repos, and engineering context',
    description: 'Support engineering workflows where code, repo state, and shipping decisions matter.',
  },
];

const NEXT_UP = [
  'Notion and Linear workspace sync',
  'Shared alerts into more team destinations',
  'A cleaner long-tail integration layer for non-core business tools',
];

const CUSTOM = [
  'Internal APIs and private systems',
  'Customer-specific workflow tooling',
  'Admin and approval-heavy back-office processes',
  'Security-conscious rollouts that need tighter scoping',
];

export default function IntegrationsPage() {
  return (
    <div className="min-h-screen bg-hero-gradient">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(168,85,247,0.12),transparent_35%),radial-gradient(circle_at_bottom_right,rgba(34,211,238,0.06),transparent_28%)]" />
      <PublicHeader backHref="/" backLabel="Home" actionHref="/signup?next=%2Fplans" actionLabel="Get access" />

      <main className="relative mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <section className="rounded-[2rem] border border-navy-700/60 bg-navy-950/40 px-6 py-8 shadow-[0_24px_80px_rgba(3,8,24,0.3)] sm:px-8 lg:px-10">
          <div className="grid gap-8 lg:grid-cols-[minmax(0,1.3fr)_22rem] lg:items-start">
            <div className="max-w-4xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-violet-500/20 bg-violet-500/10 px-4 py-1.5 text-sm font-medium text-violet-300">
                <Link2 className="h-3.5 w-3.5" />
                Integrations
              </div>
              <h1 className="mt-5 max-w-5xl text-4xl font-extrabold leading-[0.96] text-white sm:text-5xl lg:text-[4rem]">
                Connect the tools
                <span className="gradient-text"> that actually matter.</span>
              </h1>
              <p className="mt-4 max-w-3xl text-base leading-7 text-slate-400 sm:text-lg">
                Nexus does not need every connector on day one. It needs the right systems first: where work starts, where decisions land, and where execution needs to follow through.
              </p>
              <div className="mt-5 grid gap-3 md:grid-cols-3">
                {[
                  {
                    title: 'Native now',
                    body: 'The core tools already wired into the product and available to real workflows today.',
                  },
                  {
                    title: 'Expand next',
                    body: 'The next layer of high-leverage connectors and messaging surfaces already on the product path.',
                  },
                  {
                    title: 'Custom later',
                    body: 'Private systems and enterprise-specific tooling should plug in through a deliberate integration layer, not a hacked-on one-off.',
                  },
                ].map((item) => (
                  <div key={item.title} className="rounded-2xl border border-navy-700/60 bg-navy-950/45 px-4 py-3">
                    <p className="text-[10px] uppercase tracking-[0.18em] text-slate-600">{item.title}</p>
                    <p className="mt-2 text-sm leading-relaxed text-slate-400">{item.body}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="ui-panel rounded-[1.7rem] px-5 py-5">
              <div className="flex items-start gap-3">
                <div className="rounded-2xl bg-cyan-500/10 p-3 text-cyan-300">
                  <Bot className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-600">How we should talk about integrations</p>
                  <p className="mt-2 text-sm leading-relaxed text-slate-400">
                    Be precise. Native where it’s real. Expandable where the architecture supports it. Custom where the customer needs it.
                  </p>
                </div>
              </div>
              <div className="mt-5 rounded-2xl border border-navy-700/60 bg-navy-950/45 px-4 py-3">
                <p className="text-[10px] uppercase tracking-[0.18em] text-slate-600">Best next implementation</p>
                <p className="mt-2 text-sm leading-relaxed text-slate-400">
                  Keep the core connectors native, then add an embedded integration partner for the long tail. That is how we eventually earn a broad integrations claim without faking it first.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="mt-8 grid gap-5 xl:grid-cols-3">
          <div className="rounded-[1.9rem] border border-navy-700/70 bg-navy-900/45 p-6 xl:col-span-2">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl bg-violet-500/10 p-3 text-violet-300">
                <Sparkles className="h-5 w-5" />
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-600">Native now</p>
                <h2 className="mt-1 text-2xl font-semibold text-white">The current operating layer</h2>
              </div>
            </div>
            <div className="mt-6 grid gap-4 md:grid-cols-2">
              {NATIVE_NOW.map(({ name, icon: Icon, detail, description }) => (
                <div key={name} className="rounded-2xl border border-navy-700/60 bg-navy-950/45 p-4">
                  <div className="flex items-center gap-3">
                    <div className="rounded-xl bg-violet-500/10 p-2.5 text-violet-300">
                      <Icon className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-white">{name}</p>
                      <p className="text-xs text-slate-500">{detail}</p>
                    </div>
                  </div>
                  <p className="mt-3 text-sm leading-relaxed text-slate-400">{description}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[1.9rem] border border-navy-700/70 bg-navy-900/45 p-6">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl bg-cyan-500/10 p-3 text-cyan-300">
                <Globe className="h-5 w-5" />
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-600">Messaging surfaces</p>
                <h2 className="mt-1 text-xl font-semibold text-white">Where Nexus shows up</h2>
              </div>
            </div>
            <div className="mt-5 space-y-3">
              {[
                { label: 'Slack', note: 'Primary team-facing surface for alerts, summaries, approvals, and shared execution.', icon: Slack },
                { label: 'Web app', note: 'Primary control surface for workflows, settings, task visibility, and full execution detail.', icon: Globe },
              ].map(({ label, note, icon: Icon }) => (
                <div key={label} className="rounded-2xl border border-navy-700/60 bg-navy-950/45 px-4 py-3">
                  <div className="flex items-center gap-2 text-sm font-semibold text-white">
                    <Icon className="h-4 w-4 text-cyan-300" />
                    {label}
                  </div>
                  <p className="mt-2 text-sm leading-relaxed text-slate-400">{note}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mt-8 grid gap-5 lg:grid-cols-2">
          <div className="rounded-[1.9rem] border border-navy-700/70 bg-navy-900/45 p-6">
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-600">Coming next</p>
            <h3 className="mt-2 text-2xl font-semibold text-white">The next connector wave</h3>
            <div className="mt-5 space-y-3">
              {NEXT_UP.map((item) => (
                <div key={item} className="flex items-start gap-3 rounded-2xl border border-navy-700/60 bg-navy-950/45 px-4 py-3 text-sm text-slate-400">
                  <span className="mt-1 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-violet-400" />
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[1.9rem] border border-navy-700/70 bg-navy-900/45 p-6">
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-600">Enterprise / custom</p>
            <h3 className="mt-2 text-2xl font-semibold text-white">Where custom integration work belongs</h3>
            <div className="mt-5 space-y-3">
              {CUSTOM.map((item) => (
                <div key={item} className="flex items-start gap-3 rounded-2xl border border-navy-700/60 bg-navy-950/45 px-4 py-3 text-sm text-slate-400">
                  <Shield className="mt-0.5 h-4 w-4 flex-shrink-0 text-cyan-300" />
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mt-8 rounded-[1.9rem] border border-navy-700/70 bg-navy-900/45 p-6">
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-600">What this means commercially</p>
          <div className="mt-3 grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_20rem] lg:items-start">
            <div>
              <h3 className="text-2xl font-semibold text-white">The honest product line</h3>
              <p className="mt-3 max-w-3xl text-sm leading-relaxed text-slate-400">
                Market the current product around the integrations that are actually there. Then position the broader connector layer as expandable, not magical. That is how we keep credibility while still aiming higher.
              </p>
            </div>
            <div className="flex flex-col gap-3">
              <Link
                to="/signup?next=%2Fplans"
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-violet-600 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-violet-500"
              >
                Set up access
                <ArrowRight className="h-4 w-4" />
              </Link>
              <a
                href="mailto:hello@purpleorange.io?subject=Nexus%20Integrations"
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-cyan-500/30 bg-cyan-500/10 px-5 py-3 text-sm font-semibold text-cyan-200 transition-colors hover:bg-cyan-500/16"
              >
                Talk about custom integrations
              </a>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
