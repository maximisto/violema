import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import AlertTriangle from 'lucide-react/dist/esm/icons/alert-triangle.js';
import ArrowRight from 'lucide-react/dist/esm/icons/arrow-right.js';
import Bot from 'lucide-react/dist/esm/icons/bot.js';
import CheckCircle2 from 'lucide-react/dist/esm/icons/check-circle-2.js';
import Globe from 'lucide-react/dist/esm/icons/globe.js';
import Link2 from 'lucide-react/dist/esm/icons/link-2.js';
import Loader2 from 'lucide-react/dist/esm/icons/loader-2.js';
import LogIn from 'lucide-react/dist/esm/icons/log-in.js';
import Plug from 'lucide-react/dist/esm/icons/plug.js';
import RefreshCw from 'lucide-react/dist/esm/icons/refresh-cw.js';
import Sparkles from 'lucide-react/dist/esm/icons/sparkles.js';
import { Link } from 'react-router-dom';
import BrandIcon from '../components/BrandIcon';
import PublicHeader from '../components/PublicHeader';
import { DEMO_INTEGRATIONS, IDENTITY_INTEGRATIONS, DEFERRED_INTEGRATIONS } from '../content/demoIntegrations';
import {
  getPartnerAppSlugs,
  isPartnerAppConnected,
  isSlugConnected,
  resolveToolkitSlug,
} from '../features/integrations/partnerToolkits';
import { useTheme } from '../lib/useTheme';
import { getWorkspaceRequest } from '../lib/workspace';

interface PartnerApp {
  name: string;
  label: string;
  detail: string;
  status?: string;
  /** Present on the newer catalog shape; absent on already-deployed servers. */
  partnerAppName?: string;
  sources?: string[];
}

/**
 * The connect surface has four honest states instead of one catch-all banner.
 * `anonymous` exists because /integrations is a public route while the catalog
 * endpoint sits behind the beta session gate — a signed-out visitor used to be
 * told connections "live inside approved workspaces" with no way to act on it.
 */
type ConnectState =
  | { kind: 'loading' }
  | { kind: 'anonymous' }
  | { kind: 'unavailable' }
  | { kind: 'ready'; enabled: boolean; degraded: boolean; connectedApps: string[]; apps: PartnerApp[] };

/** Focus/visibility refetches are throttled so tab-flipping cannot become a poll. */
const REFRESH_THROTTLE_MS = 4000;
/** OAuth propagation lag after the return leg: bounded retries, then stop. */
const RETURN_RETRY_DELAY_MS = 2500;
const RETURN_RETRY_LIMIT = 3;
const HIGHLIGHT_MS = 4500;
const JUST_CONNECTED_MS = 6000;
/** A refused or abandoned OAuth grant says so; it never silently retries. */
const CONNECT_FAILED_MESSAGE = 'Connection didn’t complete — try again';
/** Shown per card when live connection state could not be read at all. */
const STATUS_UNAVAILABLE_LABEL = 'Status unavailable';

async function fetchConnectState(): Promise<ConnectState> {
  try {
    // Workspace-scoped: a multi-workspace operator must see the catalog for the
    // workspace they are actually in, not their default one.
    const request = getWorkspaceRequest('/api/integrations/catalog');
    const response = await fetch(request.url, { credentials: 'same-origin', headers: request.headers });
    if (response.status === 401 || response.status === 403) return { kind: 'anonymous' };
    if (!response.ok) return { kind: 'unavailable' };

    const data = await response.json() as {
      partner?: { enabled?: boolean; connectedApps?: string[]; degraded?: boolean; apps?: PartnerApp[] };
      partnerApps?: PartnerApp[];
    };

    // Feature-detect: the newer contract nests apps under `partner`, while
    // already-deployed servers return a top-level `partnerApps` array.
    const partner = data.partner;
    const apps = Array.isArray(partner?.apps)
      ? partner.apps
      : Array.isArray(data.partnerApps) ? data.partnerApps : [];

    return {
      kind: 'ready',
      enabled: Boolean(partner?.enabled),
      degraded: partner?.degraded === true,
      connectedApps: Array.isArray(partner?.connectedApps) ? partner.connectedApps : [],
      apps,
    };
  } catch {
    return { kind: 'unavailable' };
  }
}

const CUSTOM = [
  { name: 'Custom MCP tools', body: 'Internal APIs and private systems' },
  { name: 'Workflow automation', body: 'Customer-specific workflow tooling' },
  { name: 'Workflow automation', body: 'Admin and approval-heavy back-office processes' },
  { name: 'Security workflows', body: 'Security-conscious rollouts that need tighter scoping' },
];

function ConnectionStatusNotice({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="mt-5 rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4">
      <p className="text-sm font-semibold text-amber-100">Connection status is temporarily unavailable</p>
      <p className="mt-1 max-w-2xl text-sm leading-relaxed text-amber-200/70">
        Violema could not read your live connection state just now, so this list may be incomplete. Nothing was changed.
      </p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-3 inline-flex items-center gap-1.5 rounded-xl border border-amber-400/30 bg-amber-400/10 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-amber-100 transition-colors hover:bg-amber-400/16 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300/60"
      >
        <RefreshCw className="h-3 w-3" />
        Retry
      </button>
    </div>
  );
}

function ComposioConnectSection() {
  const [state, setState] = useState<ConnectState>({ kind: 'loading' });
  const [busyApp, setBusyApp] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendingDisconnect, setPendingDisconnect] = useState<string | null>(null);
  const [highlightSlug, setHighlightSlug] = useState('');
  const [returnSlug, setReturnSlug] = useState('');
  const [failedSlug, setFailedSlug] = useState('');

  const mounted = useRef(true);
  const inFlight = useRef(false);
  const lastFetchAt = useRef(0);
  const returnAttempts = useRef(0);
  const scrolledSlug = useRef('');
  const sectionRef = useRef<HTMLElement | null>(null);
  const cardNodes = useRef(new Map<string, HTMLElement>());

  // Sign-in returns the visitor to whatever deep link brought them here, so a
  // `?provider=` CTA survives the round trip through /login. A consumed return
  // leg is dropped so signing in cannot replay a stale success state.
  const signInHref = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    params.delete('connected');
    params.delete('status');
    const search = params.toString();
    const here = `${window.location.pathname}${search ? `?${search}` : ''}`;
    return `/login?next=${encodeURIComponent(here)}`;
  }, []);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const refresh = useCallback(async (options?: { force?: boolean }) => {
    if (inFlight.current) return;
    if (!options?.force && Date.now() - lastFetchAt.current < REFRESH_THROTTLE_MS) return;
    inFlight.current = true;
    try {
      const next = await fetchConnectState();
      lastFetchAt.current = Date.now();
      if (mounted.current) setState(next);
    } finally {
      inFlight.current = false;
    }
  }, []);

  // Deep link (?provider=) and OAuth return leg (?connected=&status=).
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const providerSlug = resolveToolkitSlug(params.get('provider'));

    // The callback URL can carry more than one `status`: the provider appends
    // its own verdict, and an older deployed backend also pre-seeds one. Reading
    // only the first value let a seeded `status=success` mask a refused grant,
    // so every value is inspected and any 'failed' wins outright.
    const statusValues = params.getAll('status');
    const returnFailed = statusValues.includes('failed');
    const returnSucceeded = !returnFailed && statusValues.includes('success');
    const returnedSlug = resolveToolkitSlug(params.get('connected'));

    if (returnFailed) {
      returnAttempts.current = 0;
      setReturnSlug('');
      setFailedSlug(returnedSlug);
      if (returnedSlug) setHighlightSlug(returnedSlug);
      else setError(CONNECT_FAILED_MESSAGE);
    } else if (returnSucceeded && returnedSlug) {
      returnAttempts.current = 0;
      setFailedSlug('');
      setReturnSlug(returnedSlug);
      setHighlightSlug(returnedSlug);
    } else if (providerSlug) {
      setHighlightSlug(providerSlug);
    }

    if (statusValues.length > 0) {
      // Strip the consumed return leg so a refresh cannot replay a stale verdict.
      params.delete('connected');
      params.delete('status');
      const search = params.toString();
      window.history.replaceState(
        window.history.state,
        '',
        `${window.location.pathname}${search ? `?${search}` : ''}${window.location.hash}`,
      );
    }

    // Server truth governs either way: a failed return still refetches, so a
    // connection that did land is not hidden by the callback's verdict.
    void refresh({ force: true });
  }, [refresh]);

  useEffect(() => {
    if (!highlightSlug) return;
    const timer = window.setTimeout(() => setHighlightSlug(''), HIGHLIGHT_MS);
    return () => window.clearTimeout(timer);
  }, [highlightSlug]);

  // Land the visitor on the card they were sent for; fall back to the section
  // when the deep-linked app is not one of the partner connectors.
  useEffect(() => {
    if (!highlightSlug || state.kind === 'loading') return;
    if (scrolledSlug.current === highlightSlug) return;
    const node = cardNodes.current.get(highlightSlug) || sectionRef.current;
    if (!node) return;
    scrolledSlug.current = highlightSlug;
    node.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [highlightSlug, state]);

  // OAuth can land before the provider reports the connection. Retry a bounded
  // number of times, then fall back to the focus refetch below.
  useEffect(() => {
    if (!returnSlug || state.kind !== 'ready') return;

    if (isSlugConnected(returnSlug, state.connectedApps)) {
      const timer = window.setTimeout(() => setReturnSlug(''), JUST_CONNECTED_MS);
      return () => window.clearTimeout(timer);
    }

    if (returnAttempts.current >= RETURN_RETRY_LIMIT) return;
    const timer = window.setTimeout(() => {
      returnAttempts.current += 1;
      void refresh({ force: true });
    }, RETURN_RETRY_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [returnSlug, state, refresh]);

  // Coming back from an OAuth tab should not require a manual reload.
  useEffect(() => {
    const onFocus = () => {
      void refresh();
    };
    const onVisibility = () => {
      if (document.visibilityState === 'visible') void refresh();
    };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [refresh]);

  const registerCard = (app: PartnerApp) => (node: HTMLElement | null) => {
    for (const slug of getPartnerAppSlugs(app)) {
      if (node) cardNodes.current.set(slug, node);
      else cardNodes.current.delete(slug);
    }
  };

  // While connection state is unreadable, mutating is worse than waiting: a
  // connect click can mint a duplicate account and a disconnect can revoke one
  // the operator cannot currently see.
  const mutationsBlocked = state.kind === 'ready' && state.degraded;

  async function handleConnect(app: PartnerApp) {
    if (mutationsBlocked) return;
    setBusyApp(app.name);
    setError(null);
    setFailedSlug('');
    try {
      const request = getWorkspaceRequest('/api/integrations/composio/connect');
      const res = await fetch(request.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...request.headers },
        credentials: 'same-origin',
        body: JSON.stringify({ appName: app.name }),
      });
      if (res.status === 401 || res.status === 403) {
        setState({ kind: 'anonymous' });
        setBusyApp(null);
        return;
      }
      const data = await res.json().catch(() => ({})) as { redirectUrl?: string; error?: string };
      if (!res.ok || !data.redirectUrl) {
        throw new Error(typeof data.error === 'string' && data.error.trim()
          ? data.error.trim()
          : 'Could not open this connector. Try again or use native setup for now.');
      }
      window.location.assign(data.redirectUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not connect');
      setBusyApp(null);
    }
  }

  async function handleDisconnect(app: PartnerApp) {
    if (mutationsBlocked) return;
    setBusyApp(app.name);
    setError(null);
    try {
      const request = getWorkspaceRequest('/api/integrations/composio/disconnect');
      const res = await fetch(request.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...request.headers },
        credentials: 'same-origin',
        body: JSON.stringify({ appName: app.name }),
      });
      if (res.status === 401 || res.status === 403) {
        setState({ kind: 'anonymous' });
        return;
      }
      // 404 means the connection was already gone — the refetch reconciles it.
      if (!res.ok && res.status !== 404) {
        const data = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(typeof data.error === 'string' && data.error.trim()
          ? data.error.trim()
          : 'Could not disconnect this app. Try again in a moment.');
      }
      setPendingDisconnect(null);
      setReturnSlug('');
      setFailedSlug('');
      await refresh({ force: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not disconnect');
    } finally {
      setBusyApp(null);
    }
  }

  return (
    <section
      ref={sectionRef}
      id="connect-your-tools"
      className="mt-8 scroll-mt-24 rounded-[1.9rem] border border-navy-700/70 bg-navy-900/45 p-6"
    >
      <div className="flex items-center gap-3">
        <div className="rounded-2xl bg-violet-500/10 p-3 text-violet-300">
          <Plug className="h-5 w-5" />
        </div>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-600">Connect your tools</p>
          <h2 className="mt-1 text-2xl font-semibold text-white">Workflow-ready connections</h2>
        </div>
      </div>

      {state.kind === 'loading' && (
        <p className="mt-5 text-sm text-slate-500">Loading available integrations…</p>
      )}

      {state.kind === 'anonymous' && (
        <div className="mt-5 rounded-2xl border border-violet-500/20 bg-violet-500/6 p-5">
          <p className="text-sm font-semibold text-white">Sign in to connect your tools</p>
          <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-slate-400">
            Connections are scoped to your workspace, so Violema needs to know who you are before it can open an OAuth flow. Sign in and you land back on this page.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link
              to={signInHref}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-violet-500"
            >
              <LogIn className="h-4 w-4" />
              Sign in
            </Link>
            <Link
              to="/signup?next=%2Fintegrations"
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-cyan-500/30 bg-cyan-500/10 px-4 py-2.5 text-sm font-semibold text-cyan-200 transition-colors hover:bg-cyan-500/16"
            >
              Apply for beta
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      )}

      {state.kind === 'unavailable' && <ConnectionStatusNotice onRetry={() => void refresh({ force: true })} />}

      {state.kind === 'ready' && (
        <>
          <p className="mt-3 text-sm text-slate-400">
            Choose the tools this workflow needs. Violema will test access, explain the boundaries, and run a dry check before anything goes live.
          </p>

          {error && (
            <div className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm text-red-300">
              {error}
            </div>
          )}

          {state.degraded && <ConnectionStatusNotice onRetry={() => void refresh({ force: true })} />}

          {!state.enabled ? (
            <div className="mt-5 rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4">
              <p className="text-sm font-semibold text-amber-100">Connections are not enabled on this server</p>
              <p className="mt-1 max-w-2xl text-sm leading-relaxed text-amber-200/70">
                One-click OAuth connections are switched off for this deployment, so nothing here is connected on your behalf. Stripe and Slack still connect natively from settings.
              </p>
              <Link
                to="/settings"
                className="mt-3 inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-cyan-200 transition-colors hover:text-cyan-100"
              >
                Open native setup
                <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          ) : state.apps.length === 0 ? (
            <p className="mt-5 text-sm text-slate-500">
              No one-click connectors are published for this workspace yet.
            </p>
          ) : (
            <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {state.apps.map((app) => {
                const slugs = getPartnerAppSlugs(app);
                // While degraded the catalog cannot speak to connection state,
                // so no card claims either answer.
                const statusUnknown = state.degraded;
                const connected = !statusUnknown && isPartnerAppConnected(app, state.connectedApps);
                const isBusy = busyApp === app.name;
                const isReturnTarget = Boolean(returnSlug) && slugs.includes(returnSlug);
                const isFailedReturn = !statusUnknown && !connected && Boolean(failedSlug) && slugs.includes(failedSlug);
                const isHighlighted = (Boolean(highlightSlug) && slugs.includes(highlightSlug)) || isReturnTarget;
                const isFinishing = !statusUnknown && !connected && isReturnTarget && returnAttempts.current < RETURN_RETRY_LIMIT;
                const confirming = pendingDisconnect === app.name;

                return (
                  <article
                    key={app.name}
                    ref={registerCard(app)}
                    className={`flex flex-col rounded-2xl border px-4 py-4 transition-all duration-500 ${
                      connected
                        ? 'border-green-500/30 bg-green-500/5'
                        : isFailedReturn
                          ? 'border-red-500/30 bg-red-500/5'
                          : statusUnknown
                            ? 'border-navy-700/60 bg-navy-950/45'
                            : 'border-navy-700/60 bg-navy-950/45 hover:border-violet-500/40 hover:bg-navy-800/60'
                    } ${isHighlighted ? 'ring-1 ring-violet-400/50 shadow-[0_0_28px_rgba(139,92,246,0.16)]' : ''}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-2.5">
                        <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-slate-100">
                          <BrandIcon name={app.label || app.name} className="h-4 w-4" />
                        </span>
                        <p className="min-w-0 truncate text-sm font-semibold text-white">{app.label || app.name}</p>
                      </div>
                      {connected ? (
                        <CheckCircle2 className="h-4 w-4 flex-shrink-0 text-green-400" />
                      ) : isBusy || isFinishing ? (
                        <Loader2 className="h-4 w-4 flex-shrink-0 animate-spin text-violet-400" />
                      ) : isFailedReturn ? (
                        <AlertTriangle className="h-4 w-4 flex-shrink-0 text-red-400" />
                      ) : statusUnknown ? (
                        <AlertTriangle className="h-4 w-4 flex-shrink-0 text-amber-300/70" />
                      ) : (
                        <ArrowRight className="h-4 w-4 flex-shrink-0 text-slate-500" />
                      )}
                    </div>

                    <p className="mt-1.5 text-xs leading-5 text-slate-500">{app.detail}</p>

                    {isFailedReturn && (
                      <p className="mt-2 text-[11px] leading-5 text-red-300">{CONNECT_FAILED_MESSAGE}</p>
                    )}

                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                      {statusUnknown ? (
                        <>
                          <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-amber-200/80">
                            {STATUS_UNAVAILABLE_LABEL}
                          </span>
                          <button
                            type="button"
                            disabled
                            title="Connection status could not be read, so connecting is paused."
                            className="inline-flex cursor-not-allowed items-center gap-1.5 rounded-xl border border-navy-700/60 bg-navy-900/40 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500 opacity-70"
                          >
                            Connect
                          </button>
                        </>
                      ) : connected ? (
                        <>
                          <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-green-400">
                            {isReturnTarget ? 'Just connected' : 'Connected'}
                          </span>
                          {confirming ? (
                            <span className="inline-flex items-center gap-2 text-[10px] text-slate-400">
                              Disconnect?
                              <button
                                type="button"
                                onClick={() => handleDisconnect(app)}
                                disabled={isBusy}
                                className="font-semibold uppercase tracking-[0.14em] text-red-300 transition-colors hover:text-red-200 disabled:opacity-60"
                              >
                                {isBusy ? 'Working…' : 'Confirm'}
                              </button>
                              <button
                                type="button"
                                onClick={() => setPendingDisconnect(null)}
                                className="font-semibold uppercase tracking-[0.14em] text-slate-500 transition-colors hover:text-slate-300"
                              >
                                Cancel
                              </button>
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setPendingDisconnect(app.name)}
                              className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500 transition-colors hover:text-slate-300"
                            >
                              Disconnect
                            </button>
                          )}
                        </>
                      ) : isFinishing ? (
                        <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-cyan-200">
                          <Loader2 className="h-3 w-3 animate-spin" />
                          Finishing connection…
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleConnect(app)}
                          disabled={isBusy}
                          className="inline-flex items-center gap-1.5 rounded-xl border border-violet-500/30 bg-violet-500/10 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-violet-200 transition-colors hover:border-violet-400/50 hover:bg-violet-500/16 disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400"
                        >
                          {isBusy ? 'Opening…' : isFailedReturn ? 'Try again' : 'Connect'}
                          {!isBusy && <ArrowRight className="h-3 w-3" />}
                        </button>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
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
                Real company systems.
                <span className="gradient-text"> One reviewable workflow.</span>
              </h1>
              <p className="mt-4 max-w-3xl text-base leading-7 text-slate-400 sm:text-lg">
                Nine production integrations power Violema’s TechChicago demo workflow: live operating data in, a source-backed founder update out, and explicit approval before delivery.
              </p>
              <div className="mt-5 grid gap-3 md:grid-cols-3">
                {[
                  {
                    title: 'Workflow data',
                    body: 'Stripe, Gmail, Calendar, Drive, Linear, GitHub, and live web research.',
                  },
                  {
                    title: 'Delivery',
                    body: 'Slack is the primary reviewed delivery surface, with Postmark email available as fallback.',
                  },
                  {
                    title: 'Identity',
                    body: 'Google and Microsoft sign-in secure workspace access without being counted as workflow-data connectors.',
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
                  <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-600">Production boundary</p>
                  <p className="mt-2 text-sm leading-relaxed text-slate-400">
                    Violema reads only the approved, bounded data needed for the workflow. Gmail and Drive stay metadata-only. External delivery stays held until review.
                  </p>
                </div>
              </div>
              <div className="mt-5 rounded-2xl border border-navy-700/60 bg-navy-950/45 px-4 py-3">
                <p className="text-[10px] uppercase tracking-[0.18em] text-slate-600">Flagship workflow</p>
                <p className="mt-2 text-sm leading-relaxed text-slate-400">
                  Weekly Founder Update rolls up revenue, delivery, commitments, operating context, and market signals into one inspectable brief.
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
                <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-600">Production verified</p>
                <h2 className="mt-1 text-2xl font-semibold text-white">Active workflow and delivery integrations</h2>
              </div>
            </div>
            <div className="mt-6 grid gap-4 md:grid-cols-2">
              {DEMO_INTEGRATIONS.map(({ id, name, category, detail, description }) => (
                <div key={id} className="rounded-2xl border border-green-500/15 bg-navy-950/45 p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-slate-100">
                      <BrandIcon name={name} className="h-[1.05rem] w-[1.05rem]" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-semibold text-white">{name}</p>
                        <span className="rounded-full border border-green-500/30 bg-green-500/10 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.14em] text-green-300">Active</span>
                      </div>
                      <p className="mt-1 text-[9px] font-semibold uppercase tracking-[0.16em] text-violet-300/80">{category}</p>
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
                <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-600">Identity layer</p>
                <h2 className="mt-1 text-xl font-semibold text-white">Secure workspace access</h2>
              </div>
            </div>
            <div className="mt-5 space-y-3">
              {IDENTITY_INTEGRATIONS.map(({ id, name, category, detail }) => (
                <div key={id} className="rounded-2xl border border-navy-700/60 bg-navy-950/45 px-4 py-3">
                  <div className="flex items-center gap-2 text-sm font-semibold text-white">
                    <BrandIcon name={name} className="h-4 w-4 text-cyan-200" />
                    {name}
                  </div>
                  <p className="mt-2 text-[9px] font-semibold uppercase tracking-[0.16em] text-cyan-300/80">{category}</p>
                  <p className="mt-1 text-sm leading-relaxed text-slate-400">{detail}</p>
                </div>
              ))}
              <p className="px-1 text-xs leading-relaxed text-slate-500">
                Identity providers authenticate people. They are intentionally separate from the nine systems that read workflow data or deliver approved results.
              </p>
            </div>
          </div>
        </section>

        <ComposioConnectSection />

        <section className="mt-8 grid gap-5 lg:grid-cols-2">
          <div className="rounded-[1.9rem] border border-navy-700/70 bg-navy-900/45 p-6">
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-600">After the demos</p>
            <h3 className="mt-2 text-2xl font-semibold text-white">Intentionally deferred</h3>
            <p className="mt-2 text-sm leading-relaxed text-slate-500">
              We froze the connector scope around one product workflow that can be demonstrated end to end.
            </p>
            <div className="mt-5 space-y-3">
              {DEFERRED_INTEGRATIONS.map((item) => (
                <div key={item.id} className="flex items-start gap-3 rounded-2xl border border-navy-700/60 bg-navy-950/45 px-4 py-3 text-sm text-slate-400">
                  <span className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-slate-100">
                    <BrandIcon name={item.name} className="h-4 w-4" />
                  </span>
                  <span>
                    <span className="block font-semibold text-slate-100">{item.name}</span>
                    <span className="mt-0.5 block">{item.detail}</span>
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
                Violema is a real, reviewable operating workflow across nine active integrations. The next connector wave comes after this loop is reliable—not before.
              </p>
            </div>
            <div className="flex flex-col gap-3">
              <Link
                to="/signup?next=%2Fdashboard"
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-violet-600 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-violet-500"
              >
                Apply for beta
                <ArrowRight className="h-4 w-4" />
              </Link>
              <a
                href="mailto:hello@violema.com?subject=Violema%20Integrations"
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
