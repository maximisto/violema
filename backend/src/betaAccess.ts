function isPublicAuthApiPath(method: string, path: string) {
  const normalizedMethod = method.toUpperCase();
  if (path === '/api/auth/terms') return normalizedMethod === 'GET';
  if (path === '/api/auth/terms/accept') return normalizedMethod === 'POST';
  if (path === '/api/auth/session') return ['GET', 'POST'].includes(normalizedMethod);
  if (path === '/api/auth/logout') return normalizedMethod === 'POST';
  if (path === '/api/auth/admin/magic') return normalizedMethod === 'GET';
  return normalizedMethod === 'GET'
    && /^\/api\/auth\/(google|microsoft)\/(start|callback)$/.test(path);
}

export function isPublicBetaApiPath(method: string, path: string) {
  if (method.toUpperCase() === 'OPTIONS') return true;
  if (!path.startsWith('/api/')) return true;

  return (
    path === '/api/health' ||
    path === '/api/waitlist' ||
    path === '/api/billing/stripe/webhook' ||
    path === '/api/slack/events' ||
    isPublicAuthApiPath(method, path)
  );
}
