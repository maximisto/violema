import { useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import ArrowRight from 'lucide-react/dist/esm/icons/arrow-right.js';
import Eye from 'lucide-react/dist/esm/icons/eye.js';
import Lock from 'lucide-react/dist/esm/icons/lock.js';
import Mail from 'lucide-react/dist/esm/icons/mail.js';
import MonitorSmartphone from 'lucide-react/dist/esm/icons/monitor-smartphone.js';
import { beginOAuthFlow, isAdminEmail, persistAuthSessionToBackend, type AuthMethod } from '../lib/auth';
import AuthProviderButton, { GoogleMark, MicrosoftMark } from '../components/AuthProviderButton';
import BrandIcon from '../components/BrandIcon';
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
    note: 'Best for personal and workspace Google identities.',
  },
  {
    id: 'microsoft',
    icon: <MicrosoftMark />,
    note: 'Best for company-managed Microsoft and Entra accounts.',
  },
];

type EducationCard = {
  title: string;
  body: string;
} & (
  | { icon: typeof Eye; iconName?: never }
  | { icon?: never; iconName: string }
);

const EDUCATION_CARDS: EducationCard[] = [
  {
    iconName: 'Slack',
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
  return useMemo(() => new URLSearchParams(location.search).get('next') || '/dashboard', [location.search]);
}

export default function Signup() {
  const navigate = useNavigate();
  const location = useLocation();
  const nextPath = useNextPath();
  const errorFromQuery = useMemo(() => new URLSearchParams(location.search).get('error'), [location.search]);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [acceptedEducation, setAcceptedEducation] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(errorFromQuery);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const canContinue = name.trim().length > 1 && /\S+@\S+\.\S+/.test(email) && acceptedTerms && acceptedEducation;
  const oauthNext = `/connect/slack?next=${encodeURIComponent(nextPath)}`;

  async function handleContinue() {
    if (!canContinue) return;

    setSubmitting(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    persistWorkspaceContext();
    const session = {
      email: email.trim(),
      name: name.trim(),
      role: isAdminEmail(email) ? 'admin' : 'user',
      method: 'email' as const,
      acceptedTerms,
      acceptedEducation,
      createdAt: new Date().toISOString(),
    } as const;

    try {
      const result = await persistAuthSessionToBackend(session, {
        next: `/connect/slack?next=${encodeURIComponent(nextPath)}`,
      });
      if (result.status === 'verification_sent') {
        setSuccessMessage(result.message);
        return;
      }
      navigate(`/connect/slack?next=${encodeURIComponent(nextPath)}`);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Could not create access');
    } finally {
      setSubmitting(false);
    }
  }

  function handleProviderAuth(provider: Exclude<AuthMethod, 'email'>) {
    if (!acceptedTerms || !acceptedEducation) {
      setErrorMessage('Accept the terms and access notice before continuing with Google or Microsoft.');
      return;
    }
    setErrorMessage(null);
    setSuccessMessage(null);
    persistWorkspaceContext();
    beginOAuthFlow(provider, {
      intent: 'signup',
      next: oauthNext,
      acceptedTerms,
      acceptedEducation,
    });
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
              {EDUCATION_CARDS.map((card) => {
                const Icon = 'icon' in card ? card.icon : null;
                return (
                  <div key={card.title} className="ui-panel flex gap-4 p-4">
                    <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl bg-violet-500/12 text-violet-300">
                      {typeof card.iconName === 'string' ? (
                        <BrandIcon name={card.iconName} className="h-4 w-4" />
                      ) : Icon ? (
                        <Icon className="h-4 w-4" />
                      ) : null}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-white">{card.title}</p>
                      <p className="mt-1 text-sm leading-relaxed text-slate-400">{card.body}</p>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-8 rounded-3xl border border-navy-700/70 bg-navy-950/45 p-5">
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-600">Channels</p>
              <div className="mt-3 flex flex-wrap gap-2.5">
                {['Slack', 'Web app'].map((label) => (
                  <div key={label} className="ui-pill px-3 py-2 text-slate-300">
                    <BrandIcon name={label} className="h-3.5 w-3.5" />
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
                <h2 className="mt-2 text-2xl font-semibold text-white">Request Violema beta access</h2>
              </div>
              <Link to="/login" className="text-sm font-medium text-slate-400 transition-colors hover:text-white">
                Already have access?
              </Link>
            </div>

            <div className="mt-6">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-600">Sign in with</p>
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
              disabled={!canContinue || submitting}
              className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl bg-violet-600 px-5 py-3.5 text-sm font-semibold text-white shadow-glow-violet transition-colors hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting ? 'Checking access…' : 'Request access'}
              <ArrowRight className="h-4 w-4" />
            </button>
            {errorMessage ? (
              <p className="mt-3 text-center text-sm text-rose-300">{errorMessage}</p>
            ) : null}
            {successMessage ? (
              <p className="mt-3 text-center text-sm text-emerald-300">{successMessage}</p>
            ) : null}
            <p className="mt-3 text-center text-xs text-slate-500">
              Access is manually approved. Approved beta users continue into setup; everyone else stays outside the workspace.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
