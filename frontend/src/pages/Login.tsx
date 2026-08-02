import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import ArrowRight from 'lucide-react/dist/esm/icons/arrow-right.js';
import KeyRound from 'lucide-react/dist/esm/icons/key-round.js';
import Mail from 'lucide-react/dist/esm/icons/mail.js';
import MailCheck from 'lucide-react/dist/esm/icons/mail-check.js';
import {
  beginOAuthFlow,
  getAuthSession,
  persistAuthSessionToBackend,
  requestMagicLinkSignIn,
  type AuthMethod,
} from '../lib/auth';
import {
  isValidMagicLinkEmail,
  MAGIC_LINK_ELIGIBILITY_NOTE,
  MAGIC_LINK_RESEND_COOLDOWN_SECONDS,
  type MagicLinkFeedback,
} from '../lib/magicLink';
import AuthProviderButton, { GoogleMark, MicrosoftMark } from '../components/AuthProviderButton';
import PublicHeader from '../components/PublicHeader';

const MAGIC_LINK_PANEL_ID = 'magic-link-panel';

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

  // --- Email sign-in link ---------------------------------------------------
  // The browser-agnostic door, for people whose Safari never comes back from
  // the Google account chooser.
  const [magicLinkOpen, setMagicLinkOpen] = useState(false);
  const [magicLinkEmail, setMagicLinkEmail] = useState(existing?.email || '');
  const [magicLinkSending, setMagicLinkSending] = useState(false);
  const [magicLinkFeedback, setMagicLinkFeedback] = useState<MagicLinkFeedback | null>(null);
  const [cooldownSeconds, setCooldownSeconds] = useState(0);
  const cooldownTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => () => {
    if (cooldownTimer.current) clearInterval(cooldownTimer.current);
  }, []);

  function startResendCooldown() {
    setCooldownSeconds(MAGIC_LINK_RESEND_COOLDOWN_SECONDS);
    if (cooldownTimer.current) clearInterval(cooldownTimer.current);
    cooldownTimer.current = setInterval(() => {
      setCooldownSeconds((remaining) => {
        if (remaining <= 1) {
          if (cooldownTimer.current) clearInterval(cooldownTimer.current);
          return 0;
        }
        return remaining - 1;
      });
    }, 1000);
  }

  /**
   * Sends, then shows one confirmation. There is deliberately no success or
   * failure branch here: the endpoint answers identically for every address, so
   * a UI that reacted differently would leak what the API hides.
   */
  async function handleMagicLinkRequest() {
    if (!isValidMagicLinkEmail(magicLinkEmail) || magicLinkSending || cooldownSeconds > 0) return;
    setMagicLinkSending(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      const feedback = await requestMagicLinkSignIn(magicLinkEmail, { next });
      setMagicLinkFeedback(feedback);
      if (feedback.kind === 'sent') startResendCooldown();
    } finally {
      setMagicLinkSending(false);
    }
  }

  async function handleContinue() {
    if (!/\S+@\S+\.\S+/.test(email) || name.trim().length < 2) return;
    setSubmitting(true);
    setErrorMessage(null);
    setSuccessMessage(null);
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
    beginOAuthFlow(provider, {
      intent: 'login',
      next,
    });
  }

  return (
    <div className="min-h-screen bg-hero-gradient">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(168,85,247,0.12),transparent_35%),radial-gradient(circle_at_bottom_right,rgba(34,211,238,0.06),transparent_28%)]" />
      <PublicHeader backHref="/" backLabel="Home" actionHref="/signup?next=%2Fdashboard" actionLabel="Apply for beta" />
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
              {/*
                Third card in the same grid, through the same component, with no
                divider above it — the email link is a peer of the two OAuth
                options, not a fallback tucked underneath them. Some people
                genuinely cannot complete a provider round-trip in their browser.
              */}
              <AuthProviderButton
                provider="email"
                icon={<MailCheck className="h-5 w-5 text-violet-200" />}
                note="No provider popup. Good when a sign-in window never comes back."
                expanded={magicLinkOpen}
                controls={MAGIC_LINK_PANEL_ID}
                onClick={() => {
                  setMagicLinkOpen((open) => !open);
                  setMagicLinkFeedback(null);
                }}
              />
            </div>

            {magicLinkOpen ? (
              <div
                id={MAGIC_LINK_PANEL_ID}
                className="mt-3 rounded-[1.35rem] border border-violet-500/18 bg-navy-950/40 p-4"
              >
                {magicLinkFeedback ? (
                  <div>
                    <p className="text-sm font-semibold text-white">Check your inbox</p>
                    <p className="mt-1.5 text-sm leading-relaxed text-slate-400">
                      {magicLinkFeedback.message}
                    </p>
                    <p className="mt-1.5 text-xs text-slate-500">
                      The link expires in 10 minutes and works once.
                    </p>
                    <button
                      type="button"
                      onClick={handleMagicLinkRequest}
                      disabled={cooldownSeconds > 0 || magicLinkSending}
                      className="mt-3 text-sm font-medium text-violet-300 transition-colors hover:text-violet-200 disabled:cursor-not-allowed disabled:text-slate-600"
                    >
                      {cooldownSeconds > 0 ? `Resend in ${cooldownSeconds}s` : 'Send another link'}
                    </button>
                  </div>
                ) : (
                  <div>
                    <label className="block">
                      <span className="mb-2 block text-sm font-medium text-slate-300">Work email</span>
                      <div className="relative">
                        <Mail className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-600" />
                        <input
                          type="email"
                          autoComplete="email"
                          value={magicLinkEmail}
                          onChange={(e) => setMagicLinkEmail(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') void handleMagicLinkRequest();
                          }}
                          placeholder="you@company.com"
                          className="w-full rounded-2xl border border-navy-700/80 bg-navy-950/50 py-3 pl-11 pr-4 text-sm text-white outline-none transition-colors placeholder:text-slate-600 focus:border-violet-500/40"
                        />
                      </div>
                    </label>
                    <button
                      type="button"
                      onClick={handleMagicLinkRequest}
                      disabled={!isValidMagicLinkEmail(magicLinkEmail) || magicLinkSending}
                      className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl border border-violet-500/30 bg-violet-500/12 px-5 py-3 text-sm font-semibold text-violet-100 transition-colors hover:bg-violet-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {magicLinkSending ? 'Sending…' : 'Send sign-in link'}
                    </button>
                    <p className="mt-3 text-xs leading-relaxed text-slate-500">
                      {MAGIC_LINK_ELIGIBILITY_NOTE}
                    </p>
                  </div>
                )}
              </div>
            ) : null}
          </div>

          <div className="mt-6">
            <div className="flex items-center gap-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-600">
              <span className="h-px flex-1 bg-white/8" />
              <span>Admin direct access</span>
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
            New here? <Link to="/signup" className="text-violet-300 hover:text-violet-200">Apply for the controlled beta</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
