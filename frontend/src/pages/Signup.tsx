import { useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ArrowRight, CheckCircle2, Disc3, Eye, Globe, Lock, Mail, MessageSquare, MonitorSmartphone, Shield, Slack } from 'lucide-react';
import { saveAuthSession, type AccessRole, type AuthMethod } from '../lib/auth';
import PublicHeader from '../components/PublicHeader';

const METHODS: Array<{ id: AuthMethod; label: string; hint: string }> = [
  { id: 'email', label: 'Email access', hint: 'Fastest way in right now.' },
  { id: 'google', label: 'Google Workspace', hint: 'Best for shared team onboarding.' },
  { id: 'microsoft', label: 'Microsoft', hint: 'For enterprise and internal ops teams.' },
];

const ROLES: Array<{ id: AccessRole; label: string; hint: string }> = [
  { id: 'user', label: 'Operator', hint: 'Using Nexus for real work inside your stack.' },
  { id: 'tester', label: 'Tester', hint: 'Evaluating flows, QA, and product behavior.' },
  { id: 'investor', label: 'Investor', hint: 'Reviewing the product and commercial surface.' },
];

const EDUCATION_CARDS = [
  {
    icon: Slack,
    title: 'Works where teams already are',
    body: 'Run Nexus from Slack, Telegram, Discord, or the web interface. The same account follows you across surfaces.',
  },
  {
    icon: Eye,
    title: 'Choose the right autonomy level',
    body: 'Go autonomous for routine execution, cautious for explained actions, or supervised when you want full reasoning visible.',
  },
  {
    icon: MonitorSmartphone,
    title: 'Credits map to real execution',
    body: 'Plans set your monthly runway. Top-ups are one-time add-ons when you want more research, automations, or delegated work.',
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
  const [role, setRole] = useState<AccessRole>('user');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [acceptedEducation, setAcceptedEducation] = useState(false);

  const canContinue = name.trim().length > 1 && /\S+@\S+\.\S+/.test(email) && acceptedTerms && acceptedEducation;

  function handleContinue() {
    if (!canContinue) return;

    saveAuthSession({
      email: email.trim(),
      name: name.trim(),
      role,
      method,
      acceptedTerms,
      acceptedEducation,
      createdAt: new Date().toISOString(),
    });

    navigate(nextPath);
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
              Access Nexus
            </div>
            <h1 className="mt-6 text-4xl font-extrabold leading-tight text-white sm:text-5xl">
              Set up access before
              <span className="gradient-text"> you enter the workspace.</span>
            </h1>
            <p className="mt-4 max-w-xl text-lg leading-relaxed text-slate-400">
              Nexus is not a toy chat box. It can message teams, run automations, and move across your stack. We set expectations, permissions, and billing before people touch the product.
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
                  { icon: MessageSquare, label: 'Telegram' },
                  { icon: Disc3, label: 'Discord' },
                  { icon: Globe, label: 'Web interface' },
                ].map(({ icon: Icon, label }) => (
                  <div key={label} className="ui-pill px-3 py-2 text-slate-300">
                    <Icon className="h-3.5 w-3.5" />
                    {label}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="ui-panel-strong p-6 sm:p-7">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-violet-300/70">Registration</p>
                <h2 className="mt-2 text-2xl font-semibold text-white">Create your Nexus access</h2>
              </div>
              <Link to="/login" className="text-sm font-medium text-slate-400 transition-colors hover:text-white">
                Already have access?
              </Link>
            </div>

            <div className="mt-6">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-600">Access method</p>
              <div className="mt-3 grid gap-2">
                {METHODS.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setMethod(item.id)}
                    className={`rounded-2xl border px-4 py-3 text-left transition-all ${
                      method === item.id
                        ? 'border-violet-500/40 bg-violet-500/10'
                        : 'border-navy-700/80 bg-navy-950/45 hover:border-violet-700/40'
                    }`}
                  >
                    <p className="text-sm font-semibold text-white">{item.label}</p>
                    <p className="mt-1 text-sm text-slate-400">{item.hint}</p>
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-6">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-600">Account type</p>
              <div className="mt-3 grid gap-2 sm:grid-cols-3">
                {ROLES.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setRole(item.id)}
                    className={`rounded-2xl border px-4 py-3 text-left transition-all ${
                      role === item.id
                        ? 'border-cyan-500/35 bg-cyan-500/10'
                        : 'border-navy-700/80 bg-navy-950/45 hover:border-cyan-700/30'
                    }`}
                  >
                    <p className="text-sm font-semibold text-white">{item.label}</p>
                    <p className="mt-1 text-xs leading-relaxed text-slate-500">{item.hint}</p>
                  </button>
                ))}
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
                  I understand Nexus can send messages, run automations, and take actions across connected tools depending on the mode I choose.
                </span>
              </label>
            </div>

            <button
              type="button"
              onClick={handleContinue}
              disabled={!canContinue}
              className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl bg-violet-600 px-5 py-3.5 text-sm font-semibold text-white shadow-glow-violet transition-colors hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Continue to plans
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
