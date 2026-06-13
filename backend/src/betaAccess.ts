export function isPublicBetaApiPath(method: string, path: string) {
  if (method.toUpperCase() === 'OPTIONS') return true;
  if (!path.startsWith('/api/')) return true;

  return (
    path === '/api/health' ||
    path === '/api/waitlist' ||
    path === '/api/billing/stripe/webhook' ||
    path === '/api/slack/events' ||
    path.startsWith('/api/auth/')
  );
}
