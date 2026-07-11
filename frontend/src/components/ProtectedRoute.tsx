import { useEffect, useState } from 'react';
import { Link, Navigate, useLocation } from 'react-router-dom';
import { fetchBackendAuthSession, isAdminSession } from '../lib/auth';

interface ProtectedRouteProps {
  children: JSX.Element;
  blockedRedirectPath?: '/signup' | '/login';
  requireAdmin?: boolean;
}

export default function ProtectedRoute({ children, blockedRedirectPath = '/signup', requireAdmin = false }: ProtectedRouteProps) {
  const location = useLocation();
  const [status, setStatus] = useState<'checking' | 'allowed' | 'blocked' | 'denied' | 'requires-terms'>('checking');
  const [showAdminTermsPrompt, setShowAdminTermsPrompt] = useState(false);

  useEffect(() => {
    let active = true;

    const check = async () => {
      const backendSession = await fetchBackendAuthSession().catch(() => null);
      if (!active) return;

      if (!backendSession) {
        setShowAdminTermsPrompt(false);
        setStatus('blocked');
        return;
      }

      if (requireAdmin && !isAdminSession(backendSession)) {
        setShowAdminTermsPrompt(false);
        setStatus('denied');
        return;
      }

      if (backendSession.requiresTermsAcceptance && backendSession.role !== 'admin') {
        setShowAdminTermsPrompt(false);
        setStatus('requires-terms');
        return;
      }

      setShowAdminTermsPrompt(backendSession.requiresTermsAcceptance && backendSession.role === 'admin');
      setStatus('allowed');
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
    if (status === 'denied') {
      return <Navigate to="/dashboard" replace />;
    }
    if (status === 'requires-terms') {
      return <Navigate to={`/access-terms?next=${encodeURIComponent(location.pathname + location.search)}`} replace />;
    }
    const next = encodeURIComponent(`${location.pathname}${location.search}`);
    return <Navigate to={`${blockedRedirectPath}?next=${next}`} replace />;
  }

  const adminTermsPath = `/access-terms?next=${encodeURIComponent(location.pathname + location.search)}`;

  return (
    <>
      {showAdminTermsPrompt ? (
        <div className="relative z-[70] border-b border-amber-400/20 bg-amber-400/10 px-4 py-2 text-center text-sm text-amber-100">
          The current beta terms are ready for review. Admin access remains available.{' '}
          <Link to={adminTermsPath} className="font-semibold underline underline-offset-2 hover:text-white">
            Review and accept
          </Link>
        </div>
      ) : null}
      {children}
    </>
  );
}
