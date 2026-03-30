import { useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ArrowRight, KeyRound, Mail } from 'lucide-react';
import { getAuthSession, saveAuthSession } from '../lib/auth';

export default function Login() {
  const location = useLocation();
  const navigate = useNavigate();
  const next = useMemo(() => new URLSearchParams(location.search).get('next') || '/dashboard', [location.search]);
  const existing = getAuthSession();
  const [email, setEmail] = useState(existing?.email || '');
  const [name, setName] = useState(existing?.name || '');

  function handleContinue() {
    if (!/\S+@\S+\.\S+/.test(email) || name.trim().length < 2) return;
    saveAuthSession({
      email: email.trim(),
      name: name.trim(),
      role: existing?.role || 'user',
      method: existing?.method || 'email',
      acceptedTerms: true,
      acceptedEducation: true,
      createdAt: existing?.createdAt || new Date().toISOString(),
    });
    navigate(next);
  }

  return (
    <div className="min-h-screen bg-hero-gradient">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(168,85,247,0.12),transparent_35%),radial-gradient(circle_at_bottom_right,rgba(34,211,238,0.06),transparent_28%)]" />
      <div className="relative mx-auto flex min-h-screen max-w-7xl items-center justify-center px-4 py-16 sm:px-6 lg:px-8">
        <div className="ui-panel-strong w-full max-w-xl p-6 sm:p-8">
          <div className="inline-flex items-center gap-2 rounded-full border border-violet-500/20 bg-violet-500/10 px-4 py-1.5 text-sm font-medium text-violet-300">
            <KeyRound className="h-3.5 w-3.5" />
            Sign in
          </div>
          <h1 className="mt-6 text-3xl font-bold text-white">Return to your workspace</h1>
          <p className="mt-3 text-slate-400">
            Use the same email you used for access setup. This lightweight sign-in keeps testers, investors, and users out of the product until they’ve gone through the gate.
          </p>

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
            disabled={!/\S+@\S+\.\S+/.test(email) || name.trim().length < 2}
            className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl bg-violet-600 px-5 py-3.5 text-sm font-semibold text-white shadow-glow-violet transition-colors hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Open workspace
            <ArrowRight className="h-4 w-4" />
          </button>

          <p className="mt-4 text-center text-sm text-slate-500">
            New here? <Link to="/signup" className="text-violet-300 hover:text-violet-200">Create access first</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
