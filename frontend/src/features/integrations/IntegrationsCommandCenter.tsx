import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import AlertTriangle from 'lucide-react/dist/esm/icons/alert-triangle.js';
import ArrowRight from 'lucide-react/dist/esm/icons/arrow-right.js';
import CheckCircle2 from 'lucide-react/dist/esm/icons/check-circle-2.js';
import ExternalLink from 'lucide-react/dist/esm/icons/external-link.js';
import FolderOpen from 'lucide-react/dist/esm/icons/folder-open.js';
import Loader2 from 'lucide-react/dist/esm/icons/loader-2.js';
import LogIn from 'lucide-react/dist/esm/icons/log-in.js';
import Plug from 'lucide-react/dist/esm/icons/plug.js';
import RefreshCw from 'lucide-react/dist/esm/icons/refresh-cw.js';
import { Link } from 'react-router-dom';
import BrandIcon from '../../components/BrandIcon';
import type { WorkflowTemplateDefinition } from '../../content/workflowTemplates';
import {
  fetchConnectState,
  type ConnectState,
  type PartnerApp,
  type PendingConnection,
} from './catalogState';
import { postIntegrationAction } from './connectionActions';
import {
  buildMissionSourceSubjects,
  getMissionSourceLabel,
  type LiveMissionSourceInput,
  type MissionSourceSubject,
} from './missionSources';
import { getPartnerAppSlugs, normalizeToolkitSlug } from './partnerToolkits';
import {
  fetchReadinessProbe,
  resolveSourceStates,
  summarizeMissionReadiness,
  type SourceVerdict,
} from './sourceReadiness';
import type { WorkflowReadinessReport } from './WorkflowReadinessPanel';

/**
 * The in-workspace integrations command center.
 *
 * This tab used to render a static chip strip and a paragraph of marketing
 * copy, so the only place a connection could actually be made was the public
 * /integrations page — the operator had to leave their workspace to fix a
 * mission and come back to find out whether it worked. This is the one place
 * connections are managed now.
 *
 * Three principles it will not trade away:
 *   1. Connecting never navigates away. OAuth opens in its own tab and the
 *      dashboard refetches when focus returns.
 *   2. Connected is not the same as sufficient. A connection missing a needed
 *      capability renders as its own state with a Reconnect action, never as a
 *      green check.
 *   3. Unreadable status is unknown, never "not connected", and nothing mutable
 *      stays clickable while the server cannot see the truth.
 */

/** Focus/visibility refetches are throttled so tab-flipping cannot become a poll. */
const REFRESH_THROTTLE_MS = 4000;
/** OAuth propagation lag after the connect tab lands: bounded retries, then stop. */
const AWAIT_RETRY_DELAY_MS = 2500;
const AWAIT_RETRY_LIMIT = 3;
const JUST_CONNECTED_MS = 6000;

export const COMMAND_CENTER_DEGRADED_NOTICE = 'Connection status is temporarily unavailable';
const STATUS_UNAVAILABLE_LABEL = 'Status unavailable';

/**
 * Native systems have no OAuth connector. Only routes that actually resolve to
 * a setup surface belong here — Stripe is the one with a real anchor in
 * SettingsPage. A row with no entry renders no button rather than a link that
 * lands nowhere.
 */
const NATIVE_SETUP_ROUTES: Record<string, string> = {
  stripe: '/settings#integration-stripe',
};

interface ConnectionRow {
  key: string;
  /** Source id used for the capability/readiness lookup. */
  sourceId: string;
  label: string;
  detail: string;
  /** The partner app to connect/disconnect, or null for native systems. */
  app: PartnerApp | null;
  nativeRoute: string;
  verdict: SourceVerdict;
  /** Titles of missions in this workspace that read or deliver through it. */
  usedBy: string[];
}

function toneForVerdict(verdict: SourceVerdict) {
  switch (verdict.state) {
    case 'connected':
      return { chip: 'border-emerald-300/25 bg-emerald-300/10 text-emerald-100', seam: 'bg-emerald-400/70' };
    case 'limited':
      return { chip: 'border-amber-300/30 bg-amber-300/10 text-amber-100', seam: 'bg-amber-400/70' };
    case 'missing':
      return { chip: 'border-white/12 bg-white/[0.04] text-slate-300', seam: 'bg-slate-600/60' };
    case 'builtin':
      return { chip: 'border-white/12 bg-white/[0.04] text-slate-400', seam: 'bg-slate-700/60' };
    default:
      return { chip: 'border-amber-300/20 bg-amber-300/[0.06] text-amber-200/80', seam: 'bg-amber-500/40' };
  }
}

function chipLabel(verdict: SourceVerdict): string {
  switch (verdict.state) {
    case 'connected':
      return 'Connected';
    case 'limited':
      return verdict.missing.length > 0 ? `Limited — no ${verdict.missing.join(', ')}` : 'Limited access';
    case 'missing':
      return 'Not connected';
    case 'builtin':
      return 'Built in';
    default:
      return STATUS_UNAVAILABLE_LABEL;
  }
}

function StatusNotice({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="rounded-2xl border border-amber-500/20 bg-amber-500/[0.06] p-4">
      <p className="text-sm font-semibold text-amber-100">{COMMAND_CENTER_DEGRADED_NOTICE}</p>
      <p className="mt-1 max-w-2xl text-sm leading-6 text-amber-200/70">
        Violema could not read your live connection state just now, so nothing below is claiming to
        be connected or disconnected. Nothing was changed.
      </p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-3 inline-flex items-center gap-1.5 whitespace-nowrap rounded-xl border border-amber-400/30 bg-amber-400/10 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-amber-100 transition-colors hover:bg-amber-400/16 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300/60"
      >
        <RefreshCw className="h-3 w-3" />
        Retry
      </button>
    </div>
  );
}

export interface IntegrationsCommandCenterProps {
  workspaceId: string;
  workspaceName: string;
  liveMissions: LiveMissionSourceInput[];
  templates: WorkflowTemplateDefinition[];
}

export function IntegrationsCommandCenter({
  workspaceId,
  workspaceName,
  liveMissions,
  templates,
}: IntegrationsCommandCenterProps) {
  const [state, setState] = useState<ConnectState>({ kind: 'loading' });
  const [readiness, setReadiness] = useState<WorkflowReadinessReport | null>(null);
  const [readinessDegraded, setReadinessDegraded] = useState(false);
  const [busyKey, setBusyKey] = useState('');
  const [error, setError] = useState('');
  const [pendingDisconnect, setPendingDisconnect] = useState('');
  const [awaitingApp, setAwaitingApp] = useState('');
  const [justConnected, setJustConnected] = useState('');

  const mounted = useRef(true);
  const inFlight = useRef(false);
  const lastFetchAt = useRef(0);
  const awaitAttempts = useRef(0);

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
      // Exactly two reads, always: the catalog, and one readiness probe whose
      // requirement set is a superset of every mission's. No per-mission fan-out.
      const [next, probe] = await Promise.all([
        fetchConnectState(),
        fetchReadinessProbe(workspaceId),
      ]);
      lastFetchAt.current = Date.now();
      if (!mounted.current) return;
      setState(next);
      setReadiness(probe.report);
      setReadinessDegraded(probe.degraded);
    } finally {
      inFlight.current = false;
    }
  }, [workspaceId]);

  useEffect(() => {
    void refresh({ force: true });
  }, [refresh]);

  // The OAuth tab lives outside this document, so returning focus is the signal
  // that something may have changed.
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

  const connectedSlugs = useMemo(() => {
    if (state.kind !== 'ready') return new Set<string>();
    return new Set(state.connectedApps.map(normalizeToolkitSlug).filter(Boolean));
  }, [state]);

  // A provider can report the connection a beat after the OAuth tab lands.
  // Retry a bounded number of times, then leave it to the focus refetch.
  useEffect(() => {
    if (!awaitingApp || state.kind !== 'ready') return undefined;
    const landed = state.apps.some(
      (app) => app.name === awaitingApp
        && getPartnerAppSlugs(app).some((slug) => connectedSlugs.has(slug)),
    );
    if (landed) {
      setJustConnected(awaitingApp);
      setAwaitingApp('');
      awaitAttempts.current = 0;
      return undefined;
    }
    if (awaitAttempts.current >= AWAIT_RETRY_LIMIT) return undefined;
    const timer = window.setTimeout(() => {
      awaitAttempts.current += 1;
      void refresh({ force: true });
    }, AWAIT_RETRY_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [awaitingApp, state, connectedSlugs, refresh]);

  useEffect(() => {
    if (!justConnected) return undefined;
    const timer = window.setTimeout(() => setJustConnected(''), JUST_CONNECTED_MS);
    return () => window.clearTimeout(timer);
  }, [justConnected]);

  const subjects: MissionSourceSubject[] = useMemo(
    () => buildMissionSourceSubjects({ liveMissions, templates }),
    [liveMissions, templates],
  );

  const verdicts = useMemo(() => {
    const ids = new Set<string>();
    for (const subject of subjects) {
      for (const requirement of subject.requirements) ids.add(requirement.id);
    }
    if (state.kind === 'ready') {
      for (const app of state.apps) {
        const sources = app.sources || [];
        for (const source of sources) ids.add(source.toLowerCase());
        if (sources.length === 0) ids.add(app.name.toLowerCase());
      }
    }
    return resolveSourceStates(Array.from(ids), {
      degraded: state.kind === 'ready' ? state.degraded : false,
      capability: state.kind === 'ready' ? state.capability : {},
      connectedApps: state.kind === 'ready' ? state.connectedApps : [],
      apps: state.kind === 'ready' ? state.apps : [],
      readiness,
      readinessDegraded,
    });
  }, [state, subjects, readiness, readinessDegraded]);

  const unknownVerdict: SourceVerdict = useMemo(
    () => ({ state: 'unknown', missing: [], detail: COMMAND_CENTER_DEGRADED_NOTICE }),
    [],
  );

  const rows: ConnectionRow[] = useMemo(() => {
    if (state.kind !== 'ready') return [];

    const usedBy = new Map<string, string[]>();
    for (const subject of subjects) {
      for (const requirement of subject.requirements) {
        const list = usedBy.get(requirement.id) || [];
        if (!list.includes(subject.title)) list.push(subject.title);
        usedBy.set(requirement.id, list);
      }
    }

    const out: ConnectionRow[] = [];
    const claimed = new Set<string>();

    for (const app of state.apps) {
      const sources = (app.sources || []).map((source) => source.toLowerCase());
      const sourceId = sources[0] || app.name.toLowerCase();
      for (const source of sources) claimed.add(source);
      claimed.add(app.name.toLowerCase());
      claimed.add(app.label.toLowerCase());
      const missions = [
        ...sources.flatMap((source) => usedBy.get(source) || []),
        ...(usedBy.get(app.name.toLowerCase()) || []),
        ...(usedBy.get(app.label.toLowerCase()) || []),
      ];
      out.push({
        key: app.name,
        sourceId,
        label: app.label || app.name,
        detail: app.detail,
        app,
        nativeRoute: '',
        verdict: verdicts[sourceId] || unknownVerdict,
        usedBy: Array.from(new Set(missions)),
      });
    }

    // Natively-configured systems a mission still depends on (Stripe, email
    // delivery). They cannot be OAuth-connected, but hiding them would leave the
    // most common blocker invisible on the surface built to show blockers.
    for (const [sourceId, missions] of usedBy.entries()) {
      if (claimed.has(sourceId)) continue;
      const verdict = verdicts[sourceId];
      if (!verdict || verdict.state === 'builtin') continue;
      const provider = state.providers.find((entry) => entry.id === sourceId);
      const nativeRoute = NATIVE_SETUP_ROUTES[sourceId] || '';
      out.push({
        key: `native:${sourceId}`,
        sourceId,
        label: provider?.label || getMissionSourceLabel(sourceId),
        detail: provider?.detail
          || (nativeRoute
            ? 'Configured in workspace settings.'
            : 'Not a one-click connector — this system is set up on the server.'),
        app: null,
        nativeRoute,
        verdict,
        usedBy: missions,
      });
    }

    // Anything needing attention floats to the top: limited first, because it
    // is the state that looks fine and fails anyway.
    const weight = (row: ConnectionRow) =>
      row.verdict.state === 'limited' ? 0
        : row.verdict.state === 'missing' ? 1
          : row.verdict.state === 'unknown' ? 2 : 3;

    return out.sort((a, b) => weight(a) - weight(b) || a.label.localeCompare(b.label));
  }, [state, subjects, verdicts, unknownVerdict]);

  const inUse = rows.filter((row) => row.usedBy.length > 0);
  const available = rows.filter((row) => row.usedBy.length === 0);

  // While connection state is unreadable, mutating is worse than waiting: a
  // connect click can mint a duplicate account and a disconnect can revoke one
  // the operator cannot currently see.
  const mutationsBlocked = state.kind === 'ready' && state.degraded;

  const handleConnect = useCallback(async (app: PartnerApp) => {
    if (mutationsBlocked) return;
    // Opened synchronously so the click is still a user gesture, which is what
    // keeps the workspace mounted instead of navigating away. `opener` is
    // cleared before navigation so the OAuth tab cannot reach back in. A
    // blocked popup falls back to a full navigation.
    const oauthTab = window.open('', '_blank');
    if (oauthTab) oauthTab.opener = null;

    setBusyKey(app.name);
    setError('');
    const result = await postIntegrationAction<{ redirectUrl?: string }>(
      '/api/integrations/composio/connect',
      { appName: app.name },
      'Could not open this connector. Try again in a moment.',
    );

    if (!mounted.current) return;
    setBusyKey('');

    if (!result.ok) {
      oauthTab?.close();
      if (result.kind === 'unauthorized') setState({ kind: 'anonymous' });
      else setError(result.message);
      return;
    }

    const redirectUrl = typeof result.data.redirectUrl === 'string' ? result.data.redirectUrl : '';
    if (!redirectUrl) {
      oauthTab?.close();
      setError('Could not open this connector. Try again in a moment.');
      return;
    }

    awaitAttempts.current = 0;
    setAwaitingApp(app.name);
    if (oauthTab) oauthTab.location.href = redirectUrl;
    else window.location.assign(redirectUrl);
  }, [mutationsBlocked]);

  const handleDisconnect = useCallback(async (app: PartnerApp) => {
    if (mutationsBlocked) return;
    setBusyKey(app.name);
    setError('');
    const result = await postIntegrationAction(
      '/api/integrations/composio/disconnect',
      { appName: app.name },
      'Could not disconnect this app. Try again in a moment.',
    );
    if (!mounted.current) return;
    setBusyKey('');
    if (!result.ok && result.kind === 'unauthorized') {
      setState({ kind: 'anonymous' });
      return;
    }
    // 'missing' means the connection was already gone — the refetch reconciles it.
    if (!result.ok && result.kind === 'error') {
      setError(result.message);
      return;
    }
    setPendingDisconnect('');
    setAwaitingApp('');
    await refresh({ force: true });
  }, [mutationsBlocked, refresh]);

  const handleCancelPending = useCallback(async (entry: PendingConnection) => {
    setBusyKey(entry.id);
    setError('');
    const result = await postIntegrationAction(
      '/api/integrations/composio/cancel-pending',
      { id: entry.id, appName: entry.appName },
      'Could not cancel that half-finished connection.',
    );
    if (!mounted.current) return;
    setBusyKey('');
    if (!result.ok && result.kind === 'error') {
      setError(result.message);
      return;
    }
    await refresh({ force: true });
  }, [refresh]);

  const handleProvisionLibrary = useCallback(async () => {
    setBusyKey('library');
    setError('');
    const result = await postIntegrationAction(
      '/api/integrations/library/provision',
      {},
      'Could not set up the library folder. Try again in a moment.',
    );
    if (!mounted.current) return;
    setBusyKey('');
    if (!result.ok) {
      setError(result.message);
      return;
    }
    await refresh({ force: true });
  }, [refresh]);

  const renderRow = (row: ConnectionRow) => {
    const tone = toneForVerdict(row.verdict);
    const isBusy = busyKey === row.key;
    const isAwaiting = Boolean(row.app) && awaitingApp === row.app?.name;
    const isJustConnected = Boolean(row.app) && justConnected === row.app?.name;
    const confirming = pendingDisconnect === row.key;

    return (
      <article
        key={row.key}
        className="group relative flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-navy-950/45 transition-all duration-200 hover:border-white/16"
      >
        <span aria-hidden className={`h-[2.5px] w-full ${tone.seam}`} />
        <div className="flex flex-wrap items-center gap-3 p-4">
          <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-slate-100">
            <BrandIcon name={row.label} className="h-4 w-4" />
          </span>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="truncate text-sm font-semibold text-white">{row.label}</p>
              <span
                className={`inline-flex flex-shrink-0 items-center whitespace-nowrap rounded-full border px-2 py-0.5 text-[10px] font-semibold ${tone.chip}`}
              >
                {isJustConnected ? 'Just connected' : chipLabel(row.verdict)}
              </span>
            </div>
            <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-400">
              {row.verdict.state === 'limited' || row.verdict.state === 'unknown'
                ? row.verdict.detail
                : row.detail}
            </p>
            {row.usedBy.length > 0 ? (
              <p className="mt-1 truncate text-[11px] text-slate-500">
                Used by {row.usedBy.join(' · ')}
              </p>
            ) : null}
          </div>

          <div className="flex flex-shrink-0 items-center gap-1.5">
            {!row.app ? (
              row.nativeRoute ? (
                <Link
                  to={row.nativeRoute}
                  className="inline-flex items-center gap-1 whitespace-nowrap rounded-lg border border-cyan-400/30 bg-cyan-500/10 px-2.5 py-1 text-[11px] font-semibold text-cyan-100 transition-all hover:border-cyan-300/50 hover:bg-cyan-500/20"
                >
                  Open setup
                  <ArrowRight className="h-3 w-3" aria-hidden="true" />
                </Link>
              ) : null
            ) : row.verdict.state === 'unknown' ? (
              <button
                type="button"
                disabled
                title="Connection status could not be read, so connecting is paused."
                className="inline-flex cursor-not-allowed items-center gap-1 whitespace-nowrap rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-1 text-[11px] font-semibold text-slate-500 opacity-70"
              >
                {STATUS_UNAVAILABLE_LABEL}
              </button>
            ) : isAwaiting ? (
              <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-[11px] font-semibold text-cyan-200">
                <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
                Finishing in the other tab…
              </span>
            ) : confirming ? (
              <span className="inline-flex items-center gap-2 whitespace-nowrap text-[11px] text-slate-400">
                Disconnect?
                <button
                  type="button"
                  onClick={() => void handleDisconnect(row.app as PartnerApp)}
                  disabled={isBusy}
                  className="font-semibold uppercase tracking-[0.14em] text-red-300 transition-colors hover:text-red-200 disabled:opacity-60"
                >
                  {isBusy ? 'Working…' : 'Confirm'}
                </button>
                <button
                  type="button"
                  onClick={() => setPendingDisconnect('')}
                  className="font-semibold uppercase tracking-[0.14em] text-slate-500 transition-colors hover:text-slate-300"
                >
                  Cancel
                </button>
              </span>
            ) : row.verdict.state === 'limited' ? (
              <button
                type="button"
                onClick={() => void handleConnect(row.app as PartnerApp)}
                disabled={isBusy}
                className="inline-flex items-center gap-1 whitespace-nowrap rounded-lg border border-amber-400/35 bg-amber-500/12 px-2.5 py-1 text-[11px] font-semibold text-amber-100 transition-all hover:border-amber-300/55 hover:bg-amber-500/20 disabled:opacity-60"
              >
                {isBusy ? 'Opening…' : 'Reconnect'}
                {!isBusy && <ArrowRight className="h-3 w-3" aria-hidden="true" />}
              </button>
            ) : row.verdict.state === 'connected' ? (
              <button
                type="button"
                onClick={() => setPendingDisconnect(row.key)}
                className="whitespace-nowrap rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-1 text-[11px] font-semibold text-slate-400 transition-colors hover:border-white/20 hover:text-slate-200"
              >
                Disconnect
              </button>
            ) : (
              <button
                type="button"
                onClick={() => void handleConnect(row.app as PartnerApp)}
                disabled={isBusy}
                className="inline-flex items-center gap-1 whitespace-nowrap rounded-lg border border-violet-400/30 bg-violet-500/10 px-2.5 py-1 text-[11px] font-semibold text-violet-100 transition-all hover:border-violet-300/50 hover:bg-violet-500/20 disabled:opacity-60"
              >
                {isBusy ? 'Opening…' : 'Connect'}
                {!isBusy && <ArrowRight className="h-3 w-3" aria-hidden="true" />}
              </button>
            )}
          </div>
        </div>
      </article>
    );
  };

  return (
    <section
      aria-labelledby="integrations-command-center-heading"
      className="relative overflow-hidden rounded-2xl border border-violet-500/20 bg-navy-900/48 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] sm:p-6"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_8%_0%,rgba(139,92,246,0.10),transparent_38%),radial-gradient(circle_at_96%_100%,rgba(34,211,238,0.05),transparent_30%)]"
      />

      <header className="relative flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.26em] text-violet-300/90">
            Connections
          </p>
          <h2
            id="integrations-command-center-heading"
            className="mt-1.5 font-display text-xl font-semibold tracking-[-0.02em] text-white sm:text-2xl"
          >
            Everything {workspaceName} runs on
          </h2>
          <p className="mt-1.5 max-w-2xl text-sm leading-6 text-slate-400">
            Connect, reconnect, and disconnect without leaving your workspace. A connection that
            cannot do the job says so here, before a mission finds out mid-run.
          </p>
        </div>
        <div className="flex flex-shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={() => void refresh({ force: true })}
            className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-1 text-[11px] font-semibold text-slate-300 transition-colors hover:border-white/20 hover:text-white"
          >
            <RefreshCw className="h-3 w-3" aria-hidden="true" />
            Refresh
          </button>
          <Plug className="hidden h-5 w-5 flex-shrink-0 text-violet-300/80 sm:block" aria-hidden="true" />
        </div>
      </header>

      <div className="relative mt-5 flex flex-col gap-4">
        {state.kind === 'loading' ? (
          <p className="inline-flex items-center gap-2 text-sm text-slate-500">
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
            Reading live connection state…
          </p>
        ) : null}

        {state.kind === 'anonymous' ? (
          <div className="rounded-2xl border border-violet-500/20 bg-violet-500/[0.06] p-5">
            <p className="text-sm font-semibold text-white">Sign in to manage connections</p>
            <p className="mt-1.5 max-w-2xl text-sm leading-6 text-slate-400">
              Connections are scoped to this workspace, so Violema needs to know who you are before
              it can open an OAuth flow.
            </p>
            <Link
              to={`/login?next=${encodeURIComponent('/dashboard')}`}
              className="mt-4 inline-flex items-center gap-2 whitespace-nowrap rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-violet-500"
            >
              <LogIn className="h-4 w-4" aria-hidden="true" />
              Sign in
            </Link>
          </div>
        ) : null}

        {state.kind === 'unavailable' ? <StatusNotice onRetry={() => void refresh({ force: true })} /> : null}

        {error ? (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm text-red-200">
            {error}
          </div>
        ) : null}

        {state.kind === 'ready' ? (
          <>
            {state.degraded ? <StatusNotice onRetry={() => void refresh({ force: true })} /> : null}

            {/* Feature-detected: only rendered when the server reports pending work. */}
            {state.pending.length > 0 ? (
              <div className="rounded-2xl border border-cyan-400/25 bg-cyan-500/[0.07] p-4">
                <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-cyan-200/90">
                  Finish connecting
                </p>
                <p className="mt-1.5 text-sm leading-6 text-slate-300">
                  These were started but never completed — the provider tab closed before the grant
                  came back. Resume where you left off, or clear them out.
                </p>
                <div className="mt-3 flex flex-col gap-2">
                  {state.pending.map((entry) => (
                    <div
                      key={entry.id}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-navy-950/45 px-3 py-2.5"
                    >
                      <span className="flex min-w-0 items-center gap-2.5">
                        <BrandIcon name={entry.label} className="h-4 w-4 flex-shrink-0 text-slate-200" />
                        <span className="truncate text-sm font-medium text-slate-100">{entry.label}</span>
                        {entry.startedAt ? (
                          <span className="hidden whitespace-nowrap text-[11px] text-slate-500 sm:inline">
                            started {new Date(entry.startedAt).toLocaleDateString()}
                          </span>
                        ) : null}
                      </span>
                      <span className="flex flex-shrink-0 items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            if (entry.redirectUrl) {
                              const tab = window.open('', '_blank');
                              if (tab) {
                                tab.opener = null;
                                tab.location.href = entry.redirectUrl;
                                setAwaitingApp(entry.appName);
                                return;
                              }
                              window.location.assign(entry.redirectUrl);
                              return;
                            }
                            const app = state.apps.find((candidate) => candidate.name === entry.appName);
                            if (app) void handleConnect(app);
                          }}
                          className="inline-flex items-center gap-1 whitespace-nowrap rounded-lg border border-cyan-400/30 bg-cyan-500/10 px-2.5 py-1 text-[11px] font-semibold text-cyan-100 transition-all hover:border-cyan-300/50 hover:bg-cyan-500/20"
                        >
                          Resume
                          <ExternalLink className="h-3 w-3" aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleCancelPending(entry)}
                          disabled={busyKey === entry.id}
                          className="whitespace-nowrap rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-1 text-[11px] font-semibold text-slate-400 transition-colors hover:border-white/20 hover:text-slate-200 disabled:opacity-60"
                        >
                          {busyKey === entry.id ? 'Working…' : 'Cancel'}
                        </button>
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {!state.enabled ? (
              <div className="rounded-2xl border border-amber-500/20 bg-amber-500/[0.06] p-4">
                <p className="text-sm font-semibold text-amber-100">
                  One-click connections are not enabled on this server
                </p>
                <p className="mt-1 max-w-2xl text-sm leading-6 text-amber-200/70">
                  Nothing here is connected on your behalf. Stripe and Slack still connect natively
                  from settings.
                </p>
                <Link
                  to="/settings"
                  className="mt-3 inline-flex items-center gap-1.5 whitespace-nowrap text-[11px] font-semibold uppercase tracking-[0.14em] text-cyan-200 transition-colors hover:text-cyan-100"
                >
                  Open native setup
                  <ArrowRight className="h-3 w-3" aria-hidden="true" />
                </Link>
              </div>
            ) : null}

            {inUse.length > 0 ? (
              <div>
                <div className="flex items-center gap-3">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.26em] text-slate-500">
                    Your missions use
                  </p>
                  <span className="h-px flex-1 bg-white/8" />
                </div>
                <div className="mt-3 grid gap-2.5 xl:grid-cols-2">{inUse.map(renderRow)}</div>
              </div>
            ) : null}

            {available.length > 0 ? (
              <div>
                <div className="flex items-center gap-3">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.26em] text-slate-500">
                    Also available
                  </p>
                  <span className="h-px flex-1 bg-white/8" />
                </div>
                <div className="mt-3 grid gap-2.5 xl:grid-cols-2">{available.map(renderRow)}</div>
              </div>
            ) : null}

            {rows.length === 0 && state.enabled ? (
              <p className="text-sm text-slate-500">
                No one-click connectors are published for this workspace yet.
              </p>
            ) : null}

            {/* Feature-detected: only rendered when the server reports a library. */}
            {state.library ? (
              <div className="rounded-2xl border border-white/10 bg-navy-950/45 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500">
                      Intelligence library
                    </p>
                    <p className="mt-1.5 text-sm leading-6 text-slate-300">
                      {state.library.provisioned
                        ? `Recurring missions record findings here${
                          state.library.entryCount !== null ? ` — ${state.library.entryCount} entries` : ''
                        }${
                          state.library.lastEntryAt
                            ? `, last updated ${new Date(state.library.lastEntryAt).toLocaleDateString()}`
                            : ''
                        }.`
                        : 'Recurring missions compare each run against the last one. They need a Drive folder to record findings in.'}
                    </p>
                  </div>
                  <span className="flex flex-shrink-0 items-center gap-1.5">
                    {state.library.provisioned && state.library.folderUrl ? (
                      <a
                        href={state.library.folderUrl}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="inline-flex items-center gap-1 whitespace-nowrap rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-1 text-[11px] font-semibold text-slate-300 transition-colors hover:border-white/20 hover:text-white"
                      >
                        <FolderOpen className="h-3 w-3" aria-hidden="true" />
                        Open folder
                      </a>
                    ) : null}
                    {!state.library.provisioned ? (
                      <button
                        type="button"
                        onClick={() => void handleProvisionLibrary()}
                        disabled={busyKey === 'library'}
                        className="inline-flex items-center gap-1 whitespace-nowrap rounded-lg border border-violet-400/30 bg-violet-500/10 px-2.5 py-1 text-[11px] font-semibold text-violet-100 transition-all hover:border-violet-300/50 hover:bg-violet-500/20 disabled:opacity-60"
                      >
                        {busyKey === 'library' ? 'Working…' : 'Set up library folder'}
                      </button>
                    ) : null}
                  </span>
                </div>
              </div>
            ) : null}

            {subjects.length > 0 ? (
              <div>
                <div className="flex items-center gap-3">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.26em] text-slate-500">
                    Mission readiness
                  </p>
                  <span className="h-px flex-1 bg-white/8" />
                </div>
                <div className="mt-3 flex flex-col gap-2">
                  {subjects.map((subject) => {
                    const summary = summarizeMissionReadiness(subject.requirements, verdicts);
                    return (
                      <div
                        key={`${subject.origin}:${subject.key}`}
                        className="rounded-2xl border border-white/10 bg-navy-950/45 px-3.5 py-3"
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-semibold text-white">{subject.title}</p>
                          {subject.origin === 'live' ? (
                            <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full border border-emerald-300/30 bg-emerald-300/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-100">
                              <span aria-hidden className="h-1 w-1 rounded-full bg-emerald-300" />
                              Live
                            </span>
                          ) : null}
                          <span
                            className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
                              summary.unknown > 0
                                ? 'border-amber-300/20 bg-amber-300/[0.06] text-amber-200/80'
                                : summary.ready
                                  ? 'border-emerald-300/25 bg-emerald-300/10 text-emerald-100'
                                  : 'border-amber-300/30 bg-amber-300/10 text-amber-100'
                            }`}
                          >
                            {summary.unknown > 0
                              ? 'Readiness unavailable'
                              : summary.ready
                                ? 'Ready to run'
                                : `${summary.blocking + summary.limited} to fix`}
                          </span>
                        </div>
                        <div className="panel-scroll mt-2 flex flex-nowrap items-center gap-1.5 overflow-x-auto pb-0.5">
                          {subject.requirements.map((requirement) => {
                            const verdict = verdicts[requirement.id] || unknownVerdict;
                            const tone = toneForVerdict(verdict);
                            const mark =
                              verdict.state === 'connected' ? '✓'
                                : verdict.state === 'limited' ? '!'
                                  : verdict.state === 'missing' ? '✗' : '·';
                            return (
                              <span
                                key={requirement.id}
                                title={verdict.detail}
                                className={`inline-flex flex-shrink-0 items-center gap-1 whitespace-nowrap rounded-md border px-1.5 py-0.5 text-[10px] font-medium ${tone.chip}`}
                              >
                                <span aria-hidden>{mark}</span>
                                {requirement.label}
                                {requirement.optional ? <span className="text-slate-500">opt</span> : null}
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : null}

            <p className="inline-flex items-start gap-1.5 text-[11px] leading-5 text-slate-500">
              {mutationsBlocked ? (
                <AlertTriangle className="mt-0.5 h-3 w-3 flex-shrink-0 text-amber-300/80" aria-hidden="true" />
              ) : (
                <CheckCircle2 className="mt-0.5 h-3 w-3 flex-shrink-0 text-slate-600" aria-hidden="true" />
              )}
              {mutationsBlocked
                ? 'Connecting and disconnecting are paused until live status can be read again.'
                : 'Connecting opens a provider tab and brings you straight back — your workspace stays open.'}
            </p>
          </>
        ) : null}
      </div>
    </section>
  );
}

export default IntegrationsCommandCenter;
