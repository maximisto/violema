import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Bot, KeyRound, RotateCcw, Save, Shield } from 'lucide-react';
import { resolveWorkspaceContext } from '../lib/workspace';

type Provider = 'anthropic' | 'openai' | 'openrouter' | 'mistral' | 'minimax';
type Profile = 'micro' | 'default' | 'hard' | 'critical' | 'ops' | 'memory_text' | 'memory_code';
type ReasoningEffort = 'none' | 'minimal' | 'low' | 'medium' | 'high' | 'xhigh';

interface ProviderStatus {
  configured: boolean;
  maskedToken?: string;
  workspaceConfigured?: boolean;
  serverConfigured?: boolean;
  activeSource?: 'workspace_token' | 'server_token' | 'none';
  activeSourceLabel?: string;
}

interface ModelOverride {
  provider?: Provider;
  model?: string;
  baseUrl?: string;
  reasoningEffort?: ReasoningEffort;
}

interface SettingsPayload {
  workspaceId: string;
  settings: {
    workspaceId: string;
    updatedAt?: string;
    providers: Record<Provider, ProviderStatus>;
    modelOverrides: Partial<Record<Profile, ModelOverride>>;
  };
  modelRouting: Record<string, {
    provider: string;
    model: string;
    configured: boolean;
    tool_loop_compatible: boolean;
    source?: 'server_default' | 'workspace_override' | 'workspace_token';
    source_label?: string;
    base_url?: string;
    reasoning_effort?: ReasoningEffort;
  }>;
}

interface ProviderTestState {
  tone: 'success' | 'error' | 'idle';
  message?: string;
  testing?: boolean;
}

interface ProfileTestState {
  tone: 'success' | 'error' | 'idle';
  message?: string;
  testing?: boolean;
}

const PROVIDER_COPY: Record<Provider, { label: string; help: string }> = {
  anthropic: { label: 'Anthropic', help: 'Used for the default and critical reasoning lanes by default.' },
  openai: { label: 'OpenAI', help: 'Used for micro and hard reasoning lanes by default.' },
  openrouter: { label: 'OpenRouter', help: 'Used for ops routing and broad model access.' },
  mistral: { label: 'Mistral', help: 'Used for memory and embedding workloads.' },
  minimax: { label: 'MiniMax', help: 'Optional direct provider for Anthropic-compatible routing.' },
};

const PROFILE_COPY: Array<{ id: Profile; label: string; help: string }> = [
  { id: 'micro', label: 'Micro', help: 'Cheap text work and utility routing.' },
  { id: 'default', label: 'Default', help: 'Normal chat, research, and core coordination.' },
  { id: 'hard', label: 'Hard', help: 'Deeper reasoning and technical work.' },
  { id: 'critical', label: 'Critical', help: 'High-assurance review and sensitive tasks.' },
  { id: 'ops', label: 'Ops', help: 'Operational and tool-heavy workflows.' },
  { id: 'memory_text', label: 'Memory text', help: 'Workspace memory embeddings.' },
  { id: 'memory_code', label: 'Memory code', help: 'Code-specific embedding lane.' },
];

const REASONING_OPTIONS: ReasoningEffort[] = ['none', 'minimal', 'low', 'medium', 'high', 'xhigh'];
const PROVIDER_OPTIONS: Provider[] = ['anthropic', 'openai', 'openrouter', 'mistral', 'minimax'];
const VIOLEMA_MARK = '/po-logo.png';

export default function SettingsPage() {
  const navigate = useNavigate();
  const workspace = useMemo(() => resolveWorkspaceContext(), []);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [data, setData] = useState<SettingsPayload | null>(null);
  const [notice, setNotice] = useState<{ tone: 'success' | 'error'; message: string } | null>(null);
  const [providerInputs, setProviderInputs] = useState<Record<Provider, string>>({
    anthropic: '',
    openai: '',
    openrouter: '',
    mistral: '',
    minimax: '',
  });
  const [providerClears, setProviderClears] = useState<Record<Provider, boolean>>({
    anthropic: false,
    openai: false,
    openrouter: false,
    mistral: false,
    minimax: false,
  });
  const [modelOverrides, setModelOverrides] = useState<Partial<Record<Profile, ModelOverride>>>({});
  const [providerTests, setProviderTests] = useState<Record<Provider, ProviderTestState>>({
    anthropic: { tone: 'idle' },
    openai: { tone: 'idle' },
    openrouter: { tone: 'idle' },
    mistral: { tone: 'idle' },
    minimax: { tone: 'idle' },
  });
  const [profileTests, setProfileTests] = useState<Record<Profile, ProfileTestState>>({
    micro: { tone: 'idle' },
    default: { tone: 'idle' },
    hard: { tone: 'idle' },
    critical: { tone: 'idle' },
    ops: { tone: 'idle' },
    memory_text: { tone: 'idle' },
    memory_code: { tone: 'idle' },
  });

  async function loadSettings(silent = false) {
    if (!silent) setLoading(true);
    try {
      const response = await fetch(`/api/settings?workspace_id=${encodeURIComponent(workspace.workspaceId)}&workspace_name=${encodeURIComponent(workspace.workspaceName)}`, {
        headers: {
          'X-Workspace-Id': workspace.workspaceId,
          'X-Workspace-Name': workspace.workspaceName,
        },
      });
      if (!response.ok) throw new Error('Could not load settings');
      const payload = await response.json() as SettingsPayload;
      setData(payload);
      setModelOverrides(payload.settings.modelOverrides || {});
      setProviderClears({
        anthropic: false,
        openai: false,
        openrouter: false,
        mistral: false,
        minimax: false,
      });
      setProviderInputs({
        anthropic: '',
        openai: '',
        openrouter: '',
        mistral: '',
        minimax: '',
      });
      setProviderTests({
        anthropic: { tone: 'idle' },
        openai: { tone: 'idle' },
        openrouter: { tone: 'idle' },
        mistral: { tone: 'idle' },
        minimax: { tone: 'idle' },
      });
      setProfileTests({
        micro: { tone: 'idle' },
        default: { tone: 'idle' },
        hard: { tone: 'idle' },
        critical: { tone: 'idle' },
        ops: { tone: 'idle' },
        memory_text: { tone: 'idle' },
        memory_code: { tone: 'idle' },
      });
    } catch (error) {
      setNotice({ tone: 'error', message: error instanceof Error ? error.message : 'Could not load settings.' });
    } finally {
      if (!silent) setLoading(false);
    }
  }

  useEffect(() => {
    void loadSettings();
  }, []);

  useEffect(() => {
    if (!notice) return;
    const timeout = window.setTimeout(() => setNotice(null), 3200);
    return () => window.clearTimeout(timeout);
  }, [notice]);

  async function handleSave() {
    setSaving(true);
    try {
      const providerTokens = Object.fromEntries(
        PROVIDER_OPTIONS.map((provider) => [
          provider,
          providerClears[provider] ? null : providerInputs[provider].trim() || undefined,
        ]),
      );

      const serializedOverrides = Object.fromEntries(
        PROFILE_COPY.map(({ id }) => {
          const current = modelOverrides[id];
          const hasValue = Boolean(current?.provider || current?.model || current?.baseUrl || current?.reasoningEffort);
          return [id, hasValue ? current : null];
        }),
      );

      const response = await fetch('/api/settings', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'X-Workspace-Id': workspace.workspaceId,
          'X-Workspace-Name': workspace.workspaceName,
        },
        body: JSON.stringify({
          workspaceId: workspace.workspaceId,
          workspaceName: workspace.workspaceName,
          providerTokens,
          modelOverrides: serializedOverrides,
        }),
      });
      if (!response.ok) throw new Error('Could not save settings');
      const payload = await response.json() as SettingsPayload;
      setData(payload);
      setModelOverrides(payload.settings.modelOverrides || {});
      setProviderInputs({
        anthropic: '',
        openai: '',
        openrouter: '',
        mistral: '',
        minimax: '',
      });
      setProviderClears({
        anthropic: false,
        openai: false,
        openrouter: false,
        mistral: false,
        minimax: false,
      });
      setNotice({ tone: 'success', message: 'Saved workspace setup.' });
    } catch (error) {
      setNotice({ tone: 'error', message: error instanceof Error ? error.message : 'Could not save settings.' });
    } finally {
      setSaving(false);
    }
  }

  function updateModelOverride(profile: Profile, patch: Partial<ModelOverride>) {
    setModelOverrides((current) => ({
      ...current,
      [profile]: {
        ...(current[profile] || {}),
        ...patch,
      },
    }));
  }

  function clearOverride(profile: Profile) {
    setModelOverrides((current) => {
      const next = { ...current };
      delete next[profile];
      return next;
    });
  }

  async function handleProviderTest(provider: Provider) {
    setProviderTests((current) => ({
      ...current,
      [provider]: { tone: 'idle', testing: true, message: 'Testing…' },
    }));

    try {
      const response = await fetch('/api/settings/test-provider', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Workspace-Id': workspace.workspaceId,
          'X-Workspace-Name': workspace.workspaceName,
        },
        body: JSON.stringify({
          workspaceId: workspace.workspaceId,
          workspaceName: workspace.workspaceName,
          provider,
          token: providerInputs[provider].trim() || undefined,
        }),
      });

      const payload = await response.json() as { ok?: boolean; detail?: string };
      if (!response.ok) throw new Error(payload.detail || 'Provider test failed');

      setProviderTests((current) => ({
        ...current,
        [provider]: { tone: 'success', message: payload.detail || 'Provider looks good.' },
      }));
    } catch (error) {
      setProviderTests((current) => ({
        ...current,
        [provider]: { tone: 'error', message: error instanceof Error ? error.message : 'Provider test failed.' },
      }));
    }
  }

  async function handleProfileTest(profile: Profile) {
    setProfileTests((current) => ({
      ...current,
      [profile]: { tone: 'idle', testing: true, message: 'Testing route…' },
    }));

    try {
      const response = await fetch('/api/settings/test-profile', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Workspace-Id': workspace.workspaceId,
          'X-Workspace-Name': workspace.workspaceName,
        },
        body: JSON.stringify({
          workspaceId: workspace.workspaceId,
          workspaceName: workspace.workspaceName,
          profile,
        }),
      });

      const payload = await response.json() as { ok?: boolean; detail?: string };
      if (!response.ok) throw new Error(payload.detail || 'Profile test failed');

      setProfileTests((current) => ({
        ...current,
        [profile]: { tone: 'success', message: payload.detail || 'Route looks good.' },
      }));
    } catch (error) {
      setProfileTests((current) => ({
        ...current,
        [profile]: { tone: 'error', message: error instanceof Error ? error.message : 'Profile test failed.' },
      }));
    }
  }

  return (
    <div className="min-h-screen bg-navy-950 text-white">
      {notice ? (
        <div className="pointer-events-none fixed inset-x-3 top-3 z-50 flex justify-center">
          <div className={`pointer-events-auto max-w-md rounded-2xl border px-4 py-3 shadow-[0_18px_50px_rgba(2,6,23,0.42)] backdrop-blur-md ${
            notice.tone === 'success'
              ? 'border-green-500/20 bg-green-500/12 text-green-100'
              : 'border-red-500/20 bg-red-500/12 text-red-100'
          }`}>
            <p className="text-sm font-medium">{notice.message}</p>
          </div>
        </div>
      ) : null}

      <header className="sticky top-0 z-30 border-b border-navy-800/80 bg-gradient-to-r from-navy-950/96 via-navy-900/92 to-navy-950/96 backdrop-blur-md">
        <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              onClick={() => navigate('/dashboard')}
              className="flex items-center gap-2 rounded-xl border border-navy-700 bg-navy-900/72 px-3 py-2 text-xs text-slate-300 transition-colors hover:border-violet-600/50 hover:text-white"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Dashboard
            </button>
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/8 bg-white/[0.04]">
              <img src={VIOLEMA_MARK} alt="Violema" className="h-8 w-8 object-contain" />
            </span>
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-[0.22em] text-slate-500">Workspace setup</p>
              <h1 className="truncate text-lg font-semibold tracking-[-0.02em] text-white">Models and provider tokens</h1>
              <p className="mt-1 text-sm text-slate-400">Bring your own provider keys, override model lanes, and make routing match the work you actually want to run.</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void loadSettings(true)}
              className="flex items-center gap-2 rounded-xl border border-navy-700 bg-navy-900/72 px-3 py-2 text-xs text-slate-300 transition-colors hover:border-violet-600/50 hover:text-white"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Refresh
            </button>
            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={saving}
              className="flex items-center gap-2 rounded-xl border border-violet-500/25 bg-violet-500/12 px-3 py-2 text-xs font-medium text-violet-100 transition-colors hover:bg-violet-500/18 disabled:opacity-60"
            >
              <Save className="h-3.5 w-3.5" />
              {saving ? 'Saving…' : 'Save setup'}
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1440px] px-4 py-6 sm:px-6">
        {loading || !data ? (
          <div className="rounded-[1.8rem] border border-dashed border-navy-700/70 bg-navy-950/35 px-5 py-12 text-center text-sm text-slate-500">
            Loading workspace setup…
          </div>
        ) : (
          <div className="space-y-6">
            <div className="grid gap-6 xl:grid-cols-[minmax(0,0.92fr),minmax(0,1.08fr)]">
              <section className="rounded-[1.8rem] border border-navy-800/80 bg-gradient-to-b from-navy-900/72 via-navy-900/56 to-navy-950/88 p-5">
                <div className="flex items-center gap-2">
                  <KeyRound className="h-4 w-4 text-cyan-300" />
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Provider access</p>
                    <h2 className="text-sm font-semibold text-white">Bring your own tokens</h2>
                  </div>
                </div>
                <p className="mt-2 text-sm leading-relaxed text-slate-400">
                  Workspace tokens override the shared server credentials for this workspace only. Useful for testing, cost separation, or forcing one client’s work onto their own accounts.
                </p>
                <div className="mt-4 space-y-4">
                  {PROVIDER_OPTIONS.map((provider) => {
                    const status = data.settings.providers[provider];
                    return (
                      <div key={provider} className="rounded-2xl border border-navy-700/70 bg-navy-950/42 p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-medium text-white">{PROVIDER_COPY[provider].label}</p>
                            <p className="mt-1 text-[11px] leading-relaxed text-slate-500">{PROVIDER_COPY[provider].help}</p>
                          </div>
                          <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${
                            status.activeSource === 'workspace_token'
                              ? 'border-cyan-500/18 bg-cyan-500/8 text-cyan-200'
                              : status.activeSource === 'server_token'
                                ? 'border-violet-500/18 bg-violet-500/8 text-violet-200'
                                : status.configured
                              ? 'border-green-500/18 bg-green-500/8 text-green-200'
                              : 'border-navy-700 bg-navy-900 text-slate-400'
                          }`}>
                            {status.activeSourceLabel || (status.configured ? status.maskedToken || 'Configured' : 'Using server default')}
                          </span>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2 text-[10px] text-slate-400">
                          <span className="ui-pill px-2 py-0.5 normal-case tracking-normal text-slate-300">
                            Active: {status.activeSourceLabel || 'Not configured'}
                          </span>
                          {status.workspaceConfigured ? (
                            <span className="ui-pill px-2 py-0.5 normal-case tracking-normal text-slate-300">
                              Workspace token {status.maskedToken || 'saved'}
                            </span>
                          ) : null}
                          {status.serverConfigured ? (
                            <span className="ui-pill px-2 py-0.5 normal-case tracking-normal text-slate-300">
                              Server token available
                            </span>
                          ) : null}
                        </div>
                        <div className="mt-3 space-y-2">
                          <div className="ui-input-shell">
                            <input
                              type="password"
                              value={providerInputs[provider]}
                              onChange={(event) => setProviderInputs((current) => ({ ...current, [provider]: event.target.value }))}
                              className="w-full bg-transparent px-3 py-3 text-sm text-slate-100 outline-none"
                              placeholder={`Paste a ${PROVIDER_COPY[provider].label} token`}
                            />
                          </div>
                          <div className="flex items-center justify-between gap-3">
                            <label className="flex items-center gap-2 text-[11px] text-slate-400">
                              <input
                                type="checkbox"
                                checked={providerClears[provider]}
                                onChange={(event) => setProviderClears((current) => ({ ...current, [provider]: event.target.checked }))}
                                className="rounded border-navy-700 bg-navy-950 text-violet-400 focus:ring-violet-500"
                              />
                              Clear workspace override and fall back to the server token
                            </label>
                            <button
                              type="button"
                              onClick={() => void handleProviderTest(provider)}
                              disabled={providerClears[provider] || providerTests[provider].testing}
                              className="ui-pill shrink-0 px-3 py-1.5 text-[10px] normal-case tracking-normal text-cyan-200 disabled:opacity-50"
                            >
                              {providerTests[provider].testing ? 'Testing…' : 'Test'}
                            </button>
                          </div>
                          {providerTests[provider].message ? (
                            <div className={`rounded-xl border px-3 py-2 text-[11px] ${
                              providerTests[provider].tone === 'success'
                                ? 'border-green-500/18 bg-green-500/8 text-green-200'
                                : providerTests[provider].tone === 'error'
                                  ? 'border-red-500/18 bg-red-500/8 text-red-200'
                                  : 'border-navy-700/70 bg-navy-950/35 text-slate-400'
                            }`}>
                              {providerTests[provider].message}
                            </div>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>

              <section className="rounded-[1.8rem] border border-navy-800/80 bg-gradient-to-b from-navy-900/72 via-navy-900/56 to-navy-950/88 p-5">
                <div className="flex items-center gap-2">
                  <Bot className="h-4 w-4 text-violet-300" />
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Routing lanes</p>
                    <h2 className="text-sm font-semibold text-white">Model selection</h2>
                  </div>
                </div>
                <p className="mt-2 text-sm leading-relaxed text-slate-400">
                  Each lane maps to a real runtime role. Override only where you have a reason. The goal is cleaner routing and lower spend, not more knobs for their own sake.
                </p>
                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  {PROFILE_COPY.map((profile) => {
                    const override = modelOverrides[profile.id] || {};
                    const live = data.modelRouting[profile.id];
                    return (
                      <div key={profile.id} className="rounded-2xl border border-navy-700/70 bg-navy-950/42 p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-medium text-white">{profile.label}</p>
                            <p className="mt-1 text-[11px] leading-relaxed text-slate-500">{profile.help}</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => clearOverride(profile.id)}
                            className="rounded-lg border border-navy-700/70 bg-navy-900/60 px-2 py-1 text-[10px] text-slate-400 transition-colors hover:text-white"
                          >
                            Reset
                          </button>
                        </div>
                        <div className="mt-3 rounded-xl border border-white/6 bg-white/[0.03] px-3 py-2.5 text-[11px] text-slate-400">
                          Live now: <span className="font-medium text-slate-200">{live?.provider || '—'}</span> · <span className="font-medium text-slate-200">{live?.model || '—'}</span>
                          <span className="text-slate-500"> · </span>
                          <span className="font-medium text-slate-200">{live?.source_label || 'Unknown source'}</span>
                        </div>
                        <div className="mt-2 flex flex-wrap gap-2 text-[10px] text-slate-400">
                          <span className="ui-pill px-2 py-0.5 normal-case tracking-normal text-slate-300">
                            {live?.tool_loop_compatible ? 'Tool loop ready' : 'Embedding lane'}
                          </span>
                          {live?.reasoning_effort ? (
                            <span className="ui-pill px-2 py-0.5 normal-case tracking-normal text-slate-300">
                              Reasoning: {live.reasoning_effort}
                            </span>
                          ) : null}
                          {live?.base_url ? (
                            <span className="ui-pill px-2 py-0.5 normal-case tracking-normal text-slate-300">
                              Custom base URL
                            </span>
                          ) : null}
                        </div>
                        <div className="mt-3 space-y-2">
                          <div className="ui-input-shell">
                            <select
                              value={override.provider || ''}
                              onChange={(event) => updateModelOverride(profile.id, { provider: (event.target.value || undefined) as Provider | undefined })}
                              className="w-full bg-transparent px-3 py-3 text-sm text-slate-100 outline-none"
                            >
                              <option value="" className="bg-slate-950 text-slate-100">Use system provider</option>
                              {PROVIDER_OPTIONS.map((provider) => (
                                <option key={provider} value={provider} className="bg-slate-950 text-slate-100">{PROVIDER_COPY[provider].label}</option>
                              ))}
                            </select>
                          </div>
                          <div className="ui-input-shell">
                            <input
                              value={override.model || ''}
                              onChange={(event) => updateModelOverride(profile.id, { model: event.target.value })}
                              className="w-full bg-transparent px-3 py-3 text-sm text-slate-100 outline-none"
                              placeholder="Use system model"
                            />
                          </div>
                          <div className="grid gap-2 sm:grid-cols-2">
                            <div className="ui-input-shell">
                              <input
                                value={override.baseUrl || ''}
                                onChange={(event) => updateModelOverride(profile.id, { baseUrl: event.target.value })}
                                className="w-full bg-transparent px-3 py-3 text-sm text-slate-100 outline-none"
                                placeholder="Optional base URL"
                              />
                            </div>
                            <div className="ui-input-shell">
                              <select
                                value={override.reasoningEffort || ''}
                                onChange={(event) => updateModelOverride(profile.id, { reasoningEffort: (event.target.value || undefined) as ReasoningEffort | undefined })}
                                className="w-full bg-transparent px-3 py-3 text-sm text-slate-100 outline-none"
                              >
                                <option value="" className="bg-slate-950 text-slate-100">Default reasoning</option>
                                {REASONING_OPTIONS.map((option) => (
                                  <option key={option} value={option} className="bg-slate-950 text-slate-100">{option}</option>
                                ))}
                              </select>
                            </div>
                          </div>
                          <div className="flex items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => void handleProfileTest(profile.id)}
                              disabled={profileTests[profile.id].testing}
                              className="ui-pill shrink-0 px-3 py-1.5 text-[10px] normal-case tracking-normal text-cyan-200 disabled:opacity-50"
                            >
                              {profileTests[profile.id].testing ? 'Testing route…' : 'Test lane'}
                            </button>
                          </div>
                          {profileTests[profile.id].message ? (
                            <div className={`rounded-xl border px-3 py-2 text-[11px] ${
                              profileTests[profile.id].tone === 'success'
                                ? 'border-green-500/18 bg-green-500/8 text-green-200'
                                : profileTests[profile.id].tone === 'error'
                                  ? 'border-red-500/18 bg-red-500/8 text-red-200'
                                  : 'border-navy-700/70 bg-navy-950/35 text-slate-400'
                            }`}>
                              {profileTests[profile.id].message}
                            </div>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            </div>

            <section className="rounded-[1.8rem] border border-navy-800/80 bg-gradient-to-b from-navy-900/72 via-navy-900/56 to-navy-950/88 p-5">
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-amber-300" />
                <div>
                  <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Guidance</p>
                  <h2 className="text-sm font-semibold text-white">How to use this without making a mess</h2>
                </div>
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-3">
                <div className="rounded-2xl border border-navy-700/70 bg-navy-950/42 p-4">
                  <p className="text-sm font-medium text-white">Start with routing, not custom models</p>
                  <p className="mt-2 text-sm leading-relaxed text-slate-400">Most gains come from better workflow design and agent policy. Only override models when you have a concrete reason.</p>
                </div>
                <div className="rounded-2xl border border-navy-700/70 bg-navy-950/42 p-4">
                  <p className="text-sm font-medium text-white">Use BYOK for cost isolation</p>
                  <p className="mt-2 text-sm leading-relaxed text-slate-400">Workspace tokens are best when you want one client, team, or test environment to burn against its own provider accounts.</p>
                </div>
                <div className="rounded-2xl border border-navy-700/70 bg-navy-950/42 p-4">
                  <p className="text-sm font-medium text-white">Keep cheap work cheap</p>
                  <p className="mt-2 text-sm leading-relaxed text-slate-400">Use stronger models for hard reasoning and review, not for delivery steps, scheduling glue, or basic summaries.</p>
                </div>
              </div>
            </section>
          </div>
        )}
      </main>
    </div>
  );
}
