import { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { fetchBackendAuthSession, hasAcceptedAccess } from '../lib/auth';

export default function ProtectedRoute({ children }: { children: JSX.Element }) {
  const location = useLocation();
  const [status, setStatus] = useState<'checking' | 'allowed' | 'blocked'>(() =>
    hasAcceptedAccess() ? 'allowed' : 'checking'
  );

  useEffect(() => {
    let active = true;

    const check = async () => {
      const localAccess = hasAcceptedAccess();
      const backendSession = await fetchBackendAuthSession().catch(() => null);
      if (!active) return;

      if (backendSession?.acceptedTerms && backendSession.acceptedEducation) {
        setStatus('allowed');
        return;
      }

      setStatus(localAccess ? 'allowed' : 'blocked');
    };

    void check();

    return () => {
      active = false;
    };
  }, [location.pathname, location.search]);

  if (status === 'checking') {
    return (
      <div className="min-h-screen bg-hero-gradient flex items-center justify-center px-6">
        <p className="text-sm text-slate-400">Checking access…</p>
      </div>
    );
  }

  if (status !== 'allowed') {
    const next = encodeURIComponent(`${location.pathname}${location.search}`);
    return <Navigate to={`/signup?next=${next}`} replace />;
  }

  return children;
}
