import { useEffect, useState } from 'react';
import ArrowRight from 'lucide-react/dist/esm/icons/arrow-right.js';
import Bot from 'lucide-react/dist/esm/icons/bot.js';
import CheckCircle2 from 'lucide-react/dist/esm/icons/check-circle-2.js';
import Globe from 'lucide-react/dist/esm/icons/globe.js';
import Link2 from 'lucide-react/dist/esm/icons/link-2.js';
import Loader2 from 'lucide-react/dist/esm/icons/loader-2.js';
import Plug from 'lucide-react/dist/esm/icons/plug.js';
import Sparkles from 'lucide-react/dist/esm/icons/sparkles.js';
import { Link } from 'react-router-dom';
import BrandIcon from '../components/BrandIcon';
import PublicHeader from '../components/PublicHeader';
import { useTheme } from '../lib/useTheme';

interface PartnerApp {
  name: string;
  label: string;
  detail: string;
  status?: string;
}

interface IntegrationCatalog {
  readiness: {
    headline: string;
    body: string;
    stages: Array<{ title: string; body: string }>;
  };
  partner: {
    enabled: boolean;
    connectedApps: string[];
    unavailableMessage: string;
  };
  partnerApps: PartnerApp[];
}

const NATIVE_NOW = [
  {
    name: 'Slack',
    detail: 'Messaging and team coordination',
    description: 'Send updates, deliver summaries, and run Violema where teams already work.',
  },
  {
    name: 'Email',
    detail: 'Outbound notifications and follow-ups',
    description: 'Route alerts, summaries, and human-facing messages through email when Slack is not the right surface.',
  },
  {
    name: 'Web search',
    detail: 'Current information and research',
    description: 'Pull current web context into real tasks instead of relying on stale model memory.',
  },
  {
    name: 'Browser screenshots',
    detail: 'Visual inspection and capture',
    description: 'Inspect real pages, grab screenshots, and bring visual state back into the workflow.',
  },
  {
    name: 'Stripe',
    detail: 'Billing and workspace purchases',
    description: 'Support billing state for approved workspaces after workflow scope and access are agreed.',
  },
  {
    name: 'GitHub',
    detail: 'Issues, repos, and engineering context',
    description: 'Support engineering workflows where code, repo state, and shipping decisions matter.',
  },
];

const NEXT_UP = [
  { name: 'Notion', body: 'Workspace knowledge sync' },
  { name: 'Linear', body: 'Product issue and cycle sync' },
  { name: 'Google Calendar', body: 'Calendar-aware scheduling and follow-up' },
  { name: 'Microsoft Teams', body: 'Shared alerts into more team destinations' },
  { name: 'Custom MCP tools', body: 'A cleaner long-tail layer for non-core business tools' },
];

const CUSTOM = [
  { name: 'Custom MCP tools', body: 'Internal APIs and private systems' },
  { name: 'Workflow automation', body: 'Customer-specific workflow tooling' },
  { name: 'Workflow automation', body: 'Admin and approval-heavy back-office processes' },
  { name: 'Security workflows', body: 'Security-conscious rollouts that need tighter scoping' },
];

function ComposioConnectSection() {
  const [catalog, setCatalog] = useState<IntegrationCatalog | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetch('/api/integrations/catalog', { credentials: 'same-origin' })
      .then((r) => r.json())
      .then((data) => {
        if (!active) return;
        setCatalog({
          readiness: data.readiness,
          partner: {
            enabled: Boolean(data.partner?.enabled),
            connectedApps: Array.isArray(data.partner?.connectedApps) ? data.partner.connectedApps : [],
            unavailableMessage: typeof data.partner?.unavailableMessage === 'string'
              ? data.partner.unavailableMessage
              : 'Some one-click connectors are temporarily unavailable. Violema can still run native and sample-data workflows while we finish the connector layer.',
          },
          partnerApps: Array.isArray(data.partnerApps) ? data.partnerApps : [],
        });
      })
      .catch(() => {
        if (active) {
          setCatalog({
            readiness: {
              headline: 'Workflow readiness, not connector setup',
              body: 'Connect the tools this workflow needs, approve the boundaries, run a dry test, then let Violema operate with a record you can inspect.',
              stages: [],
            },
            partner: {
              enabled: false,
              connectedApps: [],
              unavailableMessage: 'Some one-click connectors are temporarily unavailable. Violema can still run native and sample-data workflows while we finish the connector layer.',
            },
            partnerApps: [],
          });
        }
      });
    return () => {
      active = false;
    };
  }, []);

  async function handleConnect(appName: string) {
    setBusy(appName);
    setError(null);
    try {
      const res = await fetch('/api/integrations/composio/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ appName }),
      });
      const data = await res.json() as { redirectUrl?: string; error?: string };
      if (!res.ok || !data.redirectUrl) throw new Error('Could not open this connector. Try again or use native setup for now.');
      window.location.assign(data.redirectUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not connect');
      setBusy(null);
    }
  }

  return (
    <section className="mt-8 rounded-[1.9rem] border border-navy-700/70 bg-navy-900/45 p-6">
      <div className="flex items-center gap-3">
        <div className="rounded-2xl bg-violet-500/10 p-3 text-violet-300">
          <Plug className="h-5 w-5" />
        </div>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-600">Connect your tools</p>
          <h2 className="mt-1 text-2xl font-semibold text-white">Workflow-ready connections</h2>
        </div>
      </div>

      {catalog === null ? (
        <p className="mt-5 text-sm text-slate-500">Loading available integrations…</p>
      ) : !catalog.partner.enabled ? (
        <div className="mt-5 rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4 text-sm text-amber-200/90">
          <p className="font-semibold">Some one-click connectors are temporarily unavailable.</p>
          <p className="mt-1 text-amber-200/70">{catalog.partner.unavailableMessage}</p>
        </div>
      ) : (
        <>
          <p className="mt-3 text-sm text-slate-400">
            Choose the tools this workflow needs. Violema will test access, explain the boundaries, and run a dry check before anything goes live.
          </p>
          {error && (
            <div className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm text-red-300">
              {error}
            </div>
          )}
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {catalog.partnerApps.map((app) => {
              const connected = catalog.partner.connectedApps.some((connectedApp) => connectedApp.toLowerCase() === app.name.toLowerCase());
              const isBusy = busy === app.name;
              return (
                <button
                  key={app.name}
                  onClick={() => !connected && handleConnect(app.name)}
                  disabled={connected || isBusy}
                  className={`rounded-2xl border px-4 py-4 text-left transition-all ${
                    connected
                      ? 'border-green-500/30 bg-green-500/5 cursor-default'
                      : 'border-navy-700/60 bg-navy-950/45 hover:border-violet-500/40 hover:bg-navy-800/60'
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-2.5">
                      <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-slate-100">
                        <BrandIcon name={app.label || app.name} className="h-4 w-4" />
                      </span>
                      <p className="min-w-0 truncate text-sm font-semibold text-white">{app.label}</p>
                    </div>
                    {connected ? (
                      <CheckCircle2 className="h-4 w-4 text-green-400" />
                    ) : isBusy ? (
                      <Loader2 className="h-4 w-4 text-violet-400 animate-spin" />
                    ) : (
                      <ArrowRight className="h-4 w-4 text-slate-500" />
                    )}
                  </div>
                  <p className="mt-1 text-xs text-slate-500">{app.detail}</p>
                  <p className="mt-2 text-[10px] uppercase tracking-wider font-medium">
                    {connected ? <span className="text-green-400">Connected</span> : <span className="text-violet-400">Connect</span>}
                  </p>
                </button>
              );
            })}
          </div>
        </>
      )}
    </section>
  );
}

export default function IntegrationsPage() {
  const { scopeClass } = useTheme();
  return (
    <div className={`min-h-screen bg-hero-gradient ${scopeClass}`}>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(168,85,247,0.12),transparent_35%),radial-gradient(circle_at_bottom_right,rgba(34,211,238,0.06),transparent_28%)]" />
      <PublicHeader backHref="/" backLabel="Home" actionHref="/signup?next=%2Fdashboard" actionLabel="Get access" />

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
                Violema does not need every connector on day one. It needs the right systems first: where work starts, where decisions land, and where execution needs to follow through.
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
              {NATIVE_NOW.map(({ name, detail, description }) => (
                <div key={name} className="rounded-2xl border border-navy-700/60 bg-navy-950/45 p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-slate-100">
                      <BrandIcon name={name} className="h-[1.05rem] w-[1.05rem]" />
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
                <h2 className="mt-1 text-xl font-semibold text-white">Where Violema shows up</h2>
              </div>
            </div>
            <div className="mt-5 space-y-3">
              {[
                { label: 'Slack', note: 'Primary team-facing surface for alerts, summaries, approvals, and shared execution.' },
                { label: 'Web app', note: 'Primary control surface for workflows, settings, task visibility, and full execution detail.' },
              ].map(({ label, note }) => (
                <div key={label} className="rounded-2xl border border-navy-700/60 bg-navy-950/45 px-4 py-3">
                  <div className="flex items-center gap-2 text-sm font-semibold text-white">
                    <BrandIcon name={label} className="h-4 w-4 text-cyan-200" />
                    {label}
                  </div>
                  <p className="mt-2 text-sm leading-relaxed text-slate-400">{note}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <ComposioConnectSection />

        <section className="mt-8 grid gap-5 lg:grid-cols-2">
          <div className="rounded-[1.9rem] border border-navy-700/70 bg-navy-900/45 p-6">
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-600">Coming next</p>
            <h3 className="mt-2 text-2xl font-semibold text-white">The next connector wave</h3>
            <div className="mt-5 space-y-3">
              {NEXT_UP.map((item) => (
                <div key={item.name} className="flex items-start gap-3 rounded-2xl border border-navy-700/60 bg-navy-950/45 px-4 py-3 text-sm text-slate-400">
                  <span className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-slate-100">
                    <BrandIcon name={item.name} className="h-4 w-4" />
                  </span>
                  <span>
                    <span className="block font-semibold text-slate-100">{item.name}</span>
                    <span className="mt-0.5 block">{item.body}</span>
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[1.9rem] border border-navy-700/70 bg-navy-900/45 p-6">
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-600">Enterprise / custom</p>
            <h3 className="mt-2 text-2xl font-semibold text-white">Where custom integration work belongs</h3>
            <div className="mt-5 space-y-3">
              {CUSTOM.map((item) => (
                <div key={item.body} className="flex items-start gap-3 rounded-2xl border border-navy-700/60 bg-navy-950/45 px-4 py-3 text-sm text-slate-400">
                  <span className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-cyan-200">
                    <BrandIcon name={item.name} className="h-4 w-4" />
                  </span>
                  <span>{item.body}</span>
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
                to="/signup?next=%2Fdashboard"
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-violet-600 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-violet-500"
              >
                Set up access
                <ArrowRight className="h-4 w-4" />
              </Link>
              <a
                href="mailto:hello@purpleorange.io?subject=Violema%20Integrations"
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
