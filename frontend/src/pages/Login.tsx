import { useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ArrowRight, KeyRound, Mail } from 'lucide-react';
import { beginOAuthFlow, getAuthSession, isAdminEmail, persistAuthSessionToBackend, saveAuthSession, type AuthMethod } from '../lib/auth';
import PublicHeader from '../components/PublicHeader';
import { persistWorkspaceContext } from '../lib/workspace';

const PROVIDER_METHODS: Array<{
  id: Exclude<AuthMethod, 'email'>;
  label: string;
  icon: JSX.Element;
}> = [
  {
    id: 'google',
    label: 'Continue with Google',
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
        <path fill="#4285F4" d="M21.35 11.1H12v2.9h5.34c-.23 1.4-1.05 2.6-2.23 3.4v2.83h3.6c2.1-1.94 3.31-4.8 3.31-8.13 0-.71-.06-1.24-.17-2Z" />
        <path fill="#34A853" d="M12 22c2.97 0 5.46-.98 7.28-2.66l-3.6-2.83c-.99.66-2.26 1.05-3.68 1.05-2.83 0-5.23-1.91-6.09-4.47H2.17v2.9A10 10 0 0 0 12 22Z" />
        <path fill="#FBBC05" d="M5.91 13.09A5.99 5.99 0 0 1 5.6 12c0-.38.05-.75.11-1.09V8.01H2.17A10 10 0 0 0 2 12c0 1.6.38 3.12 1.04 4.47l2.87-2.38Z" />
        <path fill="#EA4335" d="M12 5.88c1.62 0 3.08.56 4.22 1.66l3.16-3.16C17.45 2.54 14.97 1.5 12 1.5A10 10 0 0 0 2.17 8.01l3.74 2.9C6.77 7.8 9.17 5.88 12 5.88Z" />
      </svg>
    ),
  },
  {
    id: 'microsoft',
    label: 'Continue with Microsoft',
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
        <rect x="2.5" y="2.5" width="8.5" height="8.5" fill="#F25022" rx="1.2" />
        <rect x="13" y="2.5" width="8.5" height="8.5" fill="#7FBA00" rx="1.2" />
        <rect x="2.5" y="13" width="8.5" height="8.5" fill="#00A4EF" rx="1.2" />
        <rect x="13" y="13" width="8.5" height="8.5" fill="#FFB900" rx="1.2" />
      </svg>
    ),
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

  async function handleContinue() {
    if (!/\S+@\S+\.\S+/.test(email) || name.trim().length < 2) return;
    setSubmitting(true);
    setErrorMessage(null);
    persistWorkspaceContext();
    const session = {
      email: email.trim(),
      name: name.trim(),
      role: isAdminEmail(email) ? 'admin' : existing?.role || 'user',
      method: existing?.method || 'email',
      acceptedTerms: true,
      acceptedEducation: true,
      createdAt: existing?.createdAt || new Date().toISOString(),
    } as const;

    try {
      saveAuthSession(session);
      await persistAuthSessionToBackend(session);
      navigate(next);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Could not sign in');
    } finally {
      setSubmitting(false);
    }
  }

  function handleProviderAuth(provider: Exclude<AuthMethod, 'email'>) {
    setErrorMessage(null);
    persistWorkspaceContext();
    beginOAuthFlow(provider, {
      intent: 'login',
      next,
    });
  }

  return (
    <div className="min-h-screen bg-hero-gradient">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(168,85,247,0.12),transparent_35%),radial-gradient(circle_at_bottom_right,rgba(34,211,238,0.06),transparent_28%)]" />
      <PublicHeader backHref="/" backLabel="Home" actionHref="/signup?next=%2Fplans" actionLabel="Create access" />
      <div className="relative mx-auto flex max-w-7xl items-center justify-center px-4 py-12 sm:px-6 lg:px-8">
        <div className="ui-panel-strong w-full max-w-xl p-6 sm:p-8">
          <div className="inline-flex items-center gap-2 rounded-full border border-violet-500/20 bg-violet-500/10 px-4 py-1.5 text-sm font-medium text-violet-300">
            <KeyRound className="h-3.5 w-3.5" />
            Sign in
          </div>
          <h1 className="mt-6 text-3xl font-bold text-white">Return to your workspace</h1>
          <p className="mt-3 text-slate-400">
            Use the same email you used during setup. This lightweight sign-in restores your local workspace access on this device.
          </p>

          <div className="mt-6">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-600">Continue with</p>
            <div className="mt-3 grid gap-2">
              {PROVIDER_METHODS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleProviderAuth(item.id)}
                  className="flex items-center gap-3 rounded-2xl border border-navy-700/80 bg-white/95 px-4 py-3 text-left transition-all hover:border-violet-700/40 hover:bg-white"
                >
                  <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-white shadow-sm ring-1 ring-black/5">
                    {item.icon}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-900">{item.label}</p>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {item.id === 'google' ? 'Fast for returning workspace users' : 'Best for managed enterprise sign-in'}
                    </p>
                  </div>
                </button>
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
            {submitting ? 'Signing in…' : 'Open workspace'}
            <ArrowRight className="h-4 w-4" />
          </button>

          {errorMessage ? (
            <p className="mt-3 text-center text-sm text-rose-300">{errorMessage}</p>
          ) : null}

          <p className="mt-4 text-center text-sm text-slate-500">
            New here? <Link to="/signup" className="text-violet-300 hover:text-violet-200">Create access first</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
