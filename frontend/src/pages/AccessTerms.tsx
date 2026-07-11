import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import ArrowRight from 'lucide-react/dist/esm/icons/arrow-right.js';
import FileText from 'lucide-react/dist/esm/icons/file-text.js';
import Lock from 'lucide-react/dist/esm/icons/lock.js';
import PublicHeader from '../components/PublicHeader';
import { fetchBackendAuthSession, type ParticipantType } from '../lib/auth';

interface TermsDocument {
  version: string;
  digest: string;
  path: string;
  canonicalText: string;
  participantTypes: ParticipantType[];
}

export function sanitizeLocalNextPath(value: string | null, origin = window.location.origin) {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return '/dashboard';

  try {
    const resolved = new URL(value, origin);
    if (resolved.origin !== origin) return '/dashboard';
    const resolvedPath = decodeURIComponent(resolved.pathname);
    if (resolvedPath === '/access-terms' || resolvedPath.startsWith('/access-terms/')) return '/dashboard';
  } catch {
    return '/dashboard';
  }

  return value;
}

export default function AccessTerms() {
  const location = useLocation();
  const navigate = useNavigate();
  const nextPath = useMemo(
    () => sanitizeLocalNextPath(new URLSearchParams(location.search).get('next')),
    [location.search],
  );
  const [terms, setTerms] = useState<TermsDocument | null>(null);
  const [acceptedConfidentiality, setAcceptedConfidentiality] = useState(false);
  const [acceptedActionAwareness, setAcceptedActionAwareness] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    void fetch('/api/auth/terms', { credentials: 'same-origin' })
      .then(async (response) => {
        const payload = await response.json().catch(() => null) as Partial<TermsDocument> & { error?: string } | null;
        if (
          !response.ok
          || !payload?.version
          || !payload.path
          || !payload.digest
          || !payload.canonicalText
          || !Array.isArray(payload.participantTypes)
        ) {
          throw new Error(payload?.error || 'Could not load the current beta terms.');
        }
        if (active) setTerms(payload as TermsDocument);
      })
      .catch((error) => {
        if (active) setErrorMessage(error instanceof Error ? error.message : 'Could not load the current beta terms.');
      });

    return () => {
      active = false;
    };
  }, []);

  async function handleAccept() {
    if (!terms || !acceptedConfidentiality || !acceptedActionAwareness) return;

    setSubmitting(true);
    setErrorMessage(null);
    try {
      const response = await fetch('/api/auth/terms/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          acceptedTerms: true,
          termsVersion: terms.version,
        }),
      });
      const payload = await response.json().catch(() => null) as { error?: string } | null;
      if (!response.ok) {
        throw new Error(payload?.error || 'Could not record your acceptance.');
      }

      const session = await fetchBackendAuthSession();
      if (!session) throw new Error('Your session expired. Sign in again to continue.');
      navigate(nextPath, { replace: true });
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Could not record your acceptance.');
    } finally {
      setSubmitting(false);
    }
  }

  const canAccept = Boolean(terms && acceptedConfidentiality && acceptedActionAwareness && !submitting);

  return (
    <div className="min-h-screen bg-hero-gradient">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(168,85,247,0.12),transparent_35%),radial-gradient(circle_at_bottom_right,rgba(34,211,238,0.06),transparent_28%)]" />
      <PublicHeader backHref="/" backLabel="Home" actionHref="/login" actionLabel="Sign in" />

      <main className="relative mx-auto flex max-w-3xl items-center px-4 py-12 sm:px-6 lg:px-8">
        <div className="ui-panel-strong w-full p-6 sm:p-8">
          <div className="inline-flex items-center gap-2 rounded-full border border-violet-500/20 bg-violet-500/10 px-4 py-1.5 text-sm font-medium text-violet-300">
            <Lock className="h-3.5 w-3.5" />
            Access terms update
          </div>
          <h1 className="mt-6 text-3xl font-bold text-white">Review the current beta terms</h1>
          <p className="mt-3 leading-relaxed text-slate-400">
            Violema’s controlled beta terms have changed. Review the current confidentiality and evaluation terms before continuing into the workspace.
          </p>

          <div className="mt-6 rounded-2xl border border-navy-700/80 bg-navy-950/45 p-5">
            <div className="flex items-start gap-3">
              <FileText className="mt-0.5 h-5 w-5 flex-shrink-0 text-violet-300" />
              <div>
                <p className="text-sm font-semibold text-white">Beta Confidentiality and Evaluation Terms</p>
                <p className="mt-1 text-xs text-slate-500">
                  {terms ? `Version ${terms.version}` : 'Loading current version…'}
                </p>
                {terms ? (
                  <Link to={terms.path} className="mt-3 inline-flex text-sm font-medium text-violet-300 transition-colors hover:text-violet-200">
                    Read the complete Terms of Service
                  </Link>
                ) : null}
              </div>
            </div>
          </div>

          {terms ? (
            <pre className="mt-6 max-h-96 overflow-y-auto whitespace-pre-wrap rounded-2xl border border-navy-700/80 bg-navy-950/65 p-5 font-sans text-sm leading-relaxed text-slate-300">{terms.canonicalText}</pre>
          ) : null}

          <div className="mt-6 space-y-3 rounded-2xl border border-navy-700/80 bg-navy-950/45 p-4">
            <label className="flex items-start gap-3 text-sm leading-relaxed text-slate-300">
              <input
                type="checkbox"
                checked={acceptedConfidentiality}
                onChange={(event) => setAcceptedConfidentiality(event.target.checked)}
                className="mt-1 h-4 w-4 rounded border-navy-700 bg-navy-950 text-violet-500"
              />
              <span>I have read and agree to the current Beta Confidentiality and Evaluation Terms.</span>
            </label>
            <label className="flex items-start gap-3 text-sm leading-relaxed text-slate-300">
              <input
                type="checkbox"
                checked={acceptedActionAwareness}
                onChange={(event) => setAcceptedActionAwareness(event.target.checked)}
                className="mt-1 h-4 w-4 rounded border-navy-700 bg-navy-950 text-violet-500"
              />
              <span>I understand Violema can send messages, run automations, and take actions across connected tools according to the mode and permissions I choose.</span>
            </label>
          </div>

          <button
            type="button"
            onClick={() => void handleAccept()}
            disabled={!canAccept}
            className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl bg-violet-600 px-5 py-3.5 text-sm font-semibold text-white shadow-glow-violet transition-colors hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? 'Recording acceptance…' : 'Accept and continue'}
            <ArrowRight className="h-4 w-4" />
          </button>

          {errorMessage ? <p className="mt-3 text-center text-sm text-rose-300">{errorMessage}</p> : null}
          <p className="mt-4 text-center text-xs text-slate-500">
            This is a required beta access step, not a claim that the language has received legal approval.
          </p>
        </div>
      </main>
    </div>
  );
}
