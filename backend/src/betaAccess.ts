function isPublicAuthApiPath(method: string, path: string) {
  const normalizedMethod = method.toUpperCase();
  if (path === '/api/auth/terms') return normalizedMethod === 'GET';
  if (path === '/api/auth/terms/accept') return normalizedMethod === 'POST';
  if (path === '/api/auth/session') return ['GET', 'POST'].includes(normalizedMethod);
  if (path === '/api/auth/logout') return normalizedMethod === 'POST';
  if (path === '/api/auth/admin/magic') return normalizedMethod === 'GET';
  // Signing in cannot require a session. Both magic-link routes enforce their
  // own gate: `/request` only ever answers with the same generic message, and
  // `/consume` re-checks approval before it mints anything.
  if (path === '/api/auth/magic-link/request') return normalizedMethod === 'POST';
  if (path === '/api/auth/magic-link/consume') return normalizedMethod === 'GET';
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
    // Postmark cannot present a session cookie either; the route is dormant
    // without POSTMARK_WEBHOOK_SECRET and authenticated by that shared secret.
    path === '/api/email/postmark/webhook' ||
    path === '/api/slack/events' ||
    // Slack cannot present a Violema session cookie. Both Slack paths are
    // authenticated by request signature instead, and the interactions path
    // additionally checks the Slack member id against the operator allowlist
    // before it will execute anything.
    path === '/api/slack/interactions' ||
    isPublicAuthApiPath(method, path)
  );
}
