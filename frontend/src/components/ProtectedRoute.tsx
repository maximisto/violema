import { Navigate, useLocation } from 'react-router-dom';
import { hasAcceptedAccess } from '../lib/auth';

export default function ProtectedRoute({ children }: { children: JSX.Element }) {
  const location = useLocation();

  if (!hasAcceptedAccess()) {
    const next = encodeURIComponent(`${location.pathname}${location.search}`);
    return <Navigate to={`/signup?next=${next}`} replace />;
  }

  return children;
}
