import { useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import ArrowRight from 'lucide-react/dist/esm/icons/arrow-right.js';
import KeyRound from 'lucide-react/dist/esm/icons/key-round.js';
import Mail from 'lucide-react/dist/esm/icons/mail.js';
import { beginOAuthFlow, getAuthSession, persistAuthSessionToBackend, type AuthMethod } from '../lib/auth';
import AuthProviderButton, { GoogleMark, MicrosoftMark } from '../components/AuthProviderButton';
import PublicHeader from '../components/PublicHeader';
import { persistWorkspaceContext } from '../lib/workspace';

const PROVIDER_METHODS: Array<{
  id: Exclude<AuthMethod, 'email'>;
  icon: JSX.Element;
  note: string;
}> = [
  {
    id: 'google',
    icon: <GoogleMark />,
    note: 'Best for returning users on Google Workspace.',
  },
  {
    id: 'microsoft',
    icon: <MicrosoftMark />,
    note: 'Best for managed enterprise Microsoft identities.',
  },
];

export default function Login() {
  const location = useLocation();
  const navigate = useNavigate();
  const next = useMemo(() => new URLSearchParams(location.search).get('next') || '/dashboard', [location.search]);
  const errorFromQuery = useMemo(() => new URLSearchParams(location.search).get('error'), [location.search]);
  const existing = getAuthSession();
  const [email, setEmail] = useState(existing?.email || '');
  const [name, setName] = useState(existing?.name || '');
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(errorFromQuery);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  async function handleContinue() {
    if (!/\S+@\S+\.\S+/.test(email) || name.trim().length < 2) return;
    setSubmitting(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    persistWorkspaceContext();
    const session = {
      intent: 'login',
      email: email.trim(),
      name: name.trim(),
      role: 'user',
      method: existing?.method || 'email',
      createdAt: existing?.createdAt || new Date().toISOString(),
    } as const;

    try {
      const result = await persistAuthSessionToBackend(session, { next });
      if (result.status === 'verification_sent') {
        setSuccessMessage(result.message);
        return;
      }
      navigate(next);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Could not sign in');
    } finally {
      setSubmitting(false);
    }
  }

  function handleProviderAuth(provider: Exclude<AuthMethod, 'email'>) {
    setErrorMessage(null);
    setSuccessMessage(null);
    persistWorkspaceContext();
    beginOAuthFlow(provider, {
      intent: 'login',
      next,
    });
  }

  return (
    <div className="min-h-screen bg-hero-gradient">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(168,85,247,0.12),transparent_35%),radial-gradient(circle_at_bottom_right,rgba(34,211,238,0.06),transparent_28%)]" />
      <PublicHeader backHref="/" backLabel="Home" actionHref="/signup?next=%2Fdashboard" actionLabel="Start free" />
      <div className="relative mx-auto flex max-w-7xl items-center justify-center px-4 py-12 sm:px-6 lg:px-8">
        <div className="ui-panel-strong w-full max-w-xl p-6 sm:p-8">
          <div className="inline-flex items-center gap-2 rounded-full border border-violet-500/20 bg-violet-500/10 px-4 py-1.5 text-sm font-medium text-violet-300">
            <KeyRound className="h-3.5 w-3.5" />
            Sign in
          </div>
          <h1 className="mt-6 text-3xl font-bold text-white">Return to your workspace</h1>
          <p className="mt-3 text-slate-400">
            Use the email tied to your preview or workspace. Violema checks access on the server before opening the workspace.
          </p>

          <div className="mt-6">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-600">Continue with</p>
            <div className="mt-3 grid gap-2">
              {PROVIDER_METHODS.map((item) => (
                <AuthProviderButton
                  key={item.id}
                  onClick={() => handleProviderAuth(item.id)}
                  provider={item.id}
                  icon={item.icon}
                  note={item.note}
                />
              ))}
            </div>
          </div>

          <div className="mt-6">
            <div className="flex items-center gap-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-600">
              <span className="h-px flex-1 bg-white/8" />
              <span>Or use email</span>
              <span className="h-px flex-1 bg-white/8" />
            </div>
          </div>

          <div className="mt-6 grid gap-4">
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-slate-300">Full name</span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
                className="w-full rounded-2xl border border-navy-700/80 bg-navy-950/50 px-4 py-3 text-sm text-white outline-none transition-colors placeholder:text-slate-600 focus:border-violet-500/40"
              />
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-slate-300">Email</span>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-600" />
                <input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@company.com"
                  className="w-full rounded-2xl border border-navy-700/80 bg-navy-950/50 py-3 pl-11 pr-4 text-sm text-white outline-none transition-colors placeholder:text-slate-600 focus:border-violet-500/40"
                />
              </div>
            </label>
          </div>

          <button
            type="button"
            onClick={handleContinue}
            disabled={!/\S+@\S+\.\S+/.test(email) || name.trim().length < 2 || submitting}
            className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl bg-violet-600 px-5 py-3.5 text-sm font-semibold text-white shadow-glow-violet transition-colors hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? 'Checking access…' : 'Continue'}
            <ArrowRight className="h-4 w-4" />
          </button>

          {errorMessage ? (
            <p className="mt-3 text-center text-sm text-rose-300">{errorMessage}</p>
          ) : null}
          {successMessage ? (
            <p className="mt-3 text-center text-sm text-emerald-300">{successMessage}</p>
          ) : null}

          <p className="mt-4 text-center text-sm text-slate-500">
            New here? <Link to="/signup" className="text-violet-300 hover:text-violet-200">Start free preview first</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
