import { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { fetchBackendAuthSession, isAdminSession } from '../lib/auth';

interface ProtectedRouteProps {
  children: JSX.Element;
  blockedRedirectPath?: '/signup' | '/login';
  requireAdmin?: boolean;
}

export default function ProtectedRoute({ children, blockedRedirectPath = '/signup', requireAdmin = false }: ProtectedRouteProps) {
  const location = useLocation();
  const [status, setStatus] = useState<'checking' | 'allowed' | 'blocked' | 'denied'>('checking');

  useEffect(() => {
    let active = true;

    const check = async () => {
      const backendSession = await fetchBackendAuthSession().catch(() => null);
      if (!active) return;

      if (backendSession?.acceptedTerms && backendSession.acceptedEducation) {
        if (requireAdmin && !isAdminSession(backendSession)) {
          setStatus('denied');
          return;
        }
        setStatus('allowed');
        return;
      }

      setStatus('blocked');
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
    const next = encodeURIComponent(`${location.pathname}${location.search}`);
    return <Navigate to={`${blockedRedirectPath}?next=${next}`} replace />;
  }

  return children;
}
