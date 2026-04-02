import { useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ArrowRight, Eye, Globe, Lock, Mail, MonitorSmartphone, Slack } from 'lucide-react';
import { isAdminEmail, saveAuthSession, type AuthMethod } from '../lib/auth';
import PublicHeader from '../components/PublicHeader';
import { persistWorkspaceContext } from '../lib/workspace';

const PROVIDER_METHODS: Array<{
  id: Exclude<AuthMethod, 'email'>;
  label: string;
  accent: string;
  icon: JSX.Element;
}> = [
  {
    id: 'google',
    label: 'Continue with Google',
    accent: 'from-[#3c4043] via-[#5f6368] to-[#3c4043]',
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
    accent: 'from-[#00a4ef] via-[#7fba00] to-[#f25022]',
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

const EDUCATION_CARDS = [
  {
    icon: Slack,
    title: 'Works where teams already are',
    body: 'Run Violema from Slack or the web app. Slack is the team-facing layer. The web app is the full control surface.',
  },
  {
    icon: Eye,
    title: 'Humans stay in the loop',
    body: 'Choose the right autonomy level for the job. Violema can move fast, but approvals and reasoning visibility stay available when they matter.',
  },
  {
    icon: MonitorSmartphone,
    title: 'Built for real execution',
    body: 'One manager coordinates a team of specialists to handle research, execution, and automation without wasting context or tokens.',
  },
];

function useNextPath() {
  const location = useLocation();
  return useMemo(() => new URLSearchParams(location.search).get('next') || '/plans', [location.search]);
}

export default function Signup() {
  const navigate = useNavigate();
  const nextPath = useNextPath();
  const [method, setMethod] = useState<AuthMethod>('email');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [acceptedEducation, setAcceptedEducation] = useState(false);

  const canContinue = name.trim().length > 1 && /\S+@\S+\.\S+/.test(email) && acceptedTerms && acceptedEducation;

  function handleContinue() {
    if (!canContinue) return;

    persistWorkspaceContext();
    saveAuthSession({
      email: email.trim(),
      name: name.trim(),
      role: isAdminEmail(email) ? 'admin' : 'user',
      method,
      acceptedTerms,
      acceptedEducation,
      createdAt: new Date().toISOString(),
    });

    navigate(`/connect/slack?next=${encodeURIComponent(nextPath)}`);
  }

  return (
    <div className="min-h-screen bg-hero-gradient">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(168,85,247,0.12),transparent_35%),radial-gradient(circle_at_bottom_right,rgba(34,211,238,0.06),transparent_28%)]" />
      <PublicHeader backHref="/" backLabel="Home" actionHref="/login" actionLabel="Sign in" />
      <div className="relative mx-auto flex max-w-7xl flex-col justify-center px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1.05fr)_minmax(420px,0.95fr)]">
          <div className="pt-2">
            <div className="inline-flex items-center gap-2 rounded-full border border-violet-500/20 bg-violet-500/10 px-4 py-1.5 text-sm font-medium text-violet-300">
              <Lock className="h-3.5 w-3.5" />
              Access Violema
            </div>
            <h1 className="mt-6 text-4xl font-extrabold leading-tight text-white sm:text-5xl">
              Set up access before
              <span className="gradient-text"> you enter the workspace.</span>
            </h1>
            <p className="mt-4 max-w-xl text-lg leading-relaxed text-slate-400">
              Violema doesn’t just answer. It gets the work done. We set expectations, permissions, and billing first because this product can research, execute, automate, and communicate across your stack.
            </p>

            <div className="mt-8 grid gap-4">
              {EDUCATION_CARDS.map(({ icon: Icon, title, body }) => (
                <div key={title} className="ui-panel flex gap-4 p-4">
                  <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl bg-violet-500/12 text-violet-300">
                    <Icon className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white">{title}</p>
                    <p className="mt-1 text-sm leading-relaxed text-slate-400">{body}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-8 rounded-3xl border border-navy-700/70 bg-navy-950/45 p-5">
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-600">Channels</p>
              <div className="mt-3 flex flex-wrap gap-2.5">
                {[
                  { icon: Slack, label: 'Slack' },
                  { icon: Globe, label: 'Web app' },
                ].map(({ icon: Icon, label }) => (
                  <div key={label} className="ui-pill px-3 py-2 text-slate-300">
                    <Icon className="h-3.5 w-3.5" />
                    {label}
                  </div>
                ))}
              </div>
              <p className="mt-3 text-xs leading-relaxed text-slate-500">
                One manager leads six resident specialists and opens four elastic lanes only when the run justifies it.
              </p>
            </div>
          </div>

          <div className="ui-panel-strong p-6 sm:p-7">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-violet-300/70">Registration</p>
                <h2 className="mt-2 text-2xl font-semibold text-white">Create your Violema access</h2>
              </div>
              <Link to="/login" className="text-sm font-medium text-slate-400 transition-colors hover:text-white">
                Already have access?
              </Link>
            </div>

            <div className="mt-6">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-600">Sign in with</p>
              <div className="mt-3 grid gap-2">
                {PROVIDER_METHODS.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setMethod(item.id)}
                    className={`flex items-center gap-3 rounded-2xl border px-4 py-3 text-left transition-all ${
                      method === item.id
                        ? 'border-violet-500/40 bg-white text-slate-950 shadow-[0_0_0_1px_rgba(168,85,247,0.14)]'
                        : 'border-navy-700/80 bg-white/95 hover:border-violet-700/40 hover:bg-white'
                    }`}
                  >
                    <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-white shadow-sm ring-1 ring-black/5">
                      {item.icon}
                    </div>
                    <div className="min-w-0">
                      <p className={`text-sm font-semibold ${method === item.id ? 'text-slate-950' : 'text-slate-900'}`}>{item.label}</p>
                      <p className={`mt-0.5 text-xs ${method === item.id ? 'text-slate-600' : 'text-slate-500'}`}>
                        {item.id === 'google' ? 'Fast for workspace users' : 'Preferred for enterprise sign-in'}
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
                  placeholder="Max Markovtsev"
                  className="w-full rounded-2xl border border-navy-700/80 bg-navy-950/50 px-4 py-3 text-sm text-white outline-none transition-colors placeholder:text-slate-600 focus:border-violet-500/40"
                />
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-300">Work email</span>
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

            <div className="mt-6 space-y-3 rounded-2xl border border-navy-700/80 bg-navy-950/45 p-4">
              <label className="flex items-start gap-3 text-sm text-slate-300">
                <input
                  type="checkbox"
                  checked={acceptedTerms}
                  onChange={(e) => setAcceptedTerms(e.target.checked)}
                  className="mt-1 h-4 w-4 rounded border-navy-700 bg-navy-950 text-violet-500"
                />
                <span>
                  I agree to the <Link to="/terms" className="text-violet-300 hover:text-violet-200">Terms of Service</Link> and <Link to="/privacy" className="text-violet-300 hover:text-violet-200">Privacy Policy</Link>.
                </span>
              </label>
              <label className="flex items-start gap-3 text-sm text-slate-300">
                <input
                  type="checkbox"
                  checked={acceptedEducation}
                  onChange={(e) => setAcceptedEducation(e.target.checked)}
                  className="mt-1 h-4 w-4 rounded border-navy-700 bg-navy-950 text-violet-500"
                />
                <span>
                  I understand Violema can send messages, run automations, and take actions across connected tools depending on the mode I choose.
                </span>
              </label>
            </div>

            <button
              type="button"
              onClick={handleContinue}
              disabled={!canContinue}
              className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl bg-violet-600 px-5 py-3.5 text-sm font-semibold text-white shadow-glow-violet transition-colors hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Create account
              <ArrowRight className="h-4 w-4" />
            </button>
            <p className="mt-3 text-center text-xs text-slate-500">
              Access is stored on this device for now. Full account auth can layer in next without changing the funnel.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
