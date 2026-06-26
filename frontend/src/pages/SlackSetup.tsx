import { useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import ArrowRight from 'lucide-react/dist/esm/icons/arrow-right.js';
import CheckCircle2 from 'lucide-react/dist/esm/icons/check-circle-2.js';
import Copy from 'lucide-react/dist/esm/icons/copy.js';
import ExternalLink from 'lucide-react/dist/esm/icons/external-link.js';
import MessageSquare from 'lucide-react/dist/esm/icons/message-square.js';
import Slack from 'lucide-react/dist/esm/icons/slack.js';
import PublicHeader from '../components/PublicHeader';
import { getAuthSession, updateBackendAuthSession } from '../lib/auth';

function getNextPath(search: string) {
  const params = new URLSearchParams(search);
  return params.get('next') || '/dashboard';
}

export default function SlackSetup() {
  const location = useLocation();
  const navigate = useNavigate();
  const session = getAuthSession();
  const nextPath = useMemo(() => getNextPath(location.search), [location.search]);

  const [workspace, setWorkspace] = useState(session?.slackWorkspace || 'purpleorangehq');
  const [channelId, setChannelId] = useState(session?.slackChannelId || '');
  const [displayTarget, setDisplayTarget] = useState(session?.slackDisplayTarget || '');
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const canContinue = workspace.trim().length > 1 && /^([CGD])[A-Z0-9]{8,}$/.test(channelId.trim());

  async function handleSave() {
    if (!session || !canContinue) return;

    setSaving(true);
    setErrorMessage(null);
    try {
      await updateBackendAuthSession({
        slackWorkspace: workspace.trim(),
        slackChannelId: channelId.trim(),
        slackDisplayTarget: displayTarget.trim() || channelId.trim(),
        slackConnectedAt: new Date().toISOString(),
      });
      navigate(nextPath);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Could not save Slack setup');
    } finally {
      setSaving(false);
    }
  }

  async function handleCopy(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="min-h-screen bg-hero-gradient">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(168,85,247,0.12),transparent_35%),radial-gradient(circle_at_bottom_right,rgba(34,211,238,0.06),transparent_28%)]" />
      <PublicHeader backHref="/signup" backLabel="Back to access" actionHref={session ? nextPath : '/signup'} actionLabel={session ? 'Skip for now' : 'Create access'} />
      <div className="relative mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1.05fr)_minmax(420px,0.95fr)]">
          <div className="pt-2">
            <div className="inline-flex items-center gap-2 rounded-full border border-violet-500/20 bg-violet-500/10 px-4 py-1.5 text-sm font-medium text-violet-300">
              <Slack className="h-3.5 w-3.5" />
              Slack onboarding
            </div>
            <h1 className="mt-6 text-4xl font-extrabold leading-tight text-white sm:text-5xl">
              Connect Slack before
              <span className="gradient-text"> you rely on automations.</span>
            </h1>
            <p className="mt-4 max-w-2xl text-lg leading-relaxed text-slate-400">
              Slack is the best primary surface for Violema right now. Set one valid destination once, and your summaries, alerts, and approvals stop failing in the background.
            </p>

            <div className="mt-8 grid gap-4">
              {[
                {
                  title: '1. Install or invite the bot',
                  body: 'Make sure the VIOLEMA Slack bot is available in your workspace and invited to the channel where you want updates to land.',
                },
                {
                  title: '2. Copy the channel ID',
                  body: 'Right-click the Slack channel, copy the link, and grab the channel ID that starts with C or G. We prefer IDs over #channel names because they do not break silently.',
                },
                {
                  title: '3. Save one default target',
                  body: 'Once saved, Violema can use that Slack destination as the reliable default for automations and alerts in this workspace.',
                },
              ].map((item) => (
                <div key={item.title} className="ui-panel flex gap-4 p-4">
                  <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl bg-violet-500/12 text-violet-300">
                    <MessageSquare className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white">{item.title}</p>
                    <p className="mt-1 text-sm leading-relaxed text-slate-400">{item.body}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-6 rounded-3xl border border-navy-700/70 bg-navy-950/45 p-5">
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-600">Format</p>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <code className="rounded-2xl border border-navy-700/80 bg-navy-950/60 px-4 py-2 text-sm text-cyan-300">C0123456789</code>
                <button
                  type="button"
                  onClick={() => void handleCopy('C0123456789')}
                  className="ui-button-ghost px-3 py-2 text-xs"
                >
                  <Copy className="h-3.5 w-3.5" />
                  {copied ? 'Copied' : 'Copy example'}
                </button>
              </div>
              <p className="mt-3 text-sm text-slate-500">
                Use a real Slack channel ID. Avoid <span className="font-mono text-slate-400">#ops-alerts</span> style names unless we explicitly map them.
              </p>
            </div>
          </div>

          <div className="ui-panel-strong p-6 sm:p-7">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-violet-300/70">Slack target</p>
                <h2 className="mt-2 text-2xl font-semibold text-white">Save a reliable default</h2>
              </div>
              <Link to="/integrations" className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-400 transition-colors hover:text-white">
                Integrations
                <ExternalLink className="h-3.5 w-3.5" />
              </Link>
            </div>

            <div className="mt-6 grid gap-4">
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-300">Slack workspace</span>
                <input
                  value={workspace}
                  onChange={(event) => setWorkspace(event.target.value)}
                  placeholder="purpleorangehq"
                  className="w-full rounded-2xl border border-navy-700/80 bg-navy-950/50 px-4 py-3 text-sm text-white outline-none transition-colors placeholder:text-slate-600 focus:border-violet-500/40 focus:ring-2 focus:ring-violet-500/50"
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-300">Default Slack channel ID</span>
                <input
                  value={channelId}
                  onChange={(event) => setChannelId(event.target.value.toUpperCase())}
                  placeholder="C0123456789"
                  className="w-full rounded-2xl border border-navy-700/80 bg-navy-950/50 px-4 py-3 text-sm text-white outline-none transition-colors placeholder:text-slate-600 focus:border-violet-500/40 focus:ring-2 focus:ring-violet-500/50"
                />
                {channelId && !/^([CGD])[A-Z0-9]{8,}$/.test(channelId.trim()) ? (
                  <p className="mt-1.5 text-[11px] text-amber-400">
                    Must start with C, G, or D and be at least 9 characters (e.g. C0123456789)
                  </p>
                ) : channelId && /^([CGD])[A-Z0-9]{8,}$/.test(channelId.trim()) ? (
                  <p className="mt-1.5 text-[11px] text-emerald-400">Looks good ✓</p>
                ) : (
                  <p className="mt-1.5 text-[11px] text-slate-500">Starts with C, G, or D — find it by right-clicking a channel in Slack</p>
                )}
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-300">Friendly label</span>
                <input
                  value={displayTarget}
                  onChange={(event) => setDisplayTarget(event.target.value)}
                  placeholder="#ops-alerts"
                  className="w-full rounded-2xl border border-navy-700/80 bg-navy-950/50 px-4 py-3 text-sm text-white outline-none transition-colors placeholder:text-slate-600 focus:border-violet-500/40 focus:ring-2 focus:ring-violet-500/50"
                />
              </label>
            </div>

            <div className="mt-6 rounded-2xl border border-emerald-500/15 bg-emerald-500/8 p-4">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-300" />
                <div>
                  <p className="text-sm font-semibold text-white">Best current setup</p>
                  <p className="mt-1 text-sm leading-relaxed text-slate-400">
                    For now, each user should save one real Slack destination during onboarding, then use the web interface and Slack together. That gives Violema one dependable surface for alerts and approvals without guessing where to post.
                  </p>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={!canContinue || !session || saving}
              className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl bg-violet-600 px-5 py-3.5 text-sm font-semibold text-white shadow-glow-violet transition-colors hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save Slack setup'}
              <ArrowRight className="h-4 w-4" />
            </button>

            {errorMessage ? (
              <p className="mt-3 text-center text-sm text-rose-300">{errorMessage}</p>
            ) : null}

            <p className="mt-3 text-center text-xs text-slate-500">
              This now saves to your real account session, not just device-local state.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
