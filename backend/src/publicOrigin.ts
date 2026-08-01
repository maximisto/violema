/**
 * Where this deployment is reachable from a browser.
 *
 * Deliberately server-derived. Anything that redirects a user back into the app
 * after a third-party round trip (Composio OAuth today) must build its URL from
 * this and never from request headers — `Host`/`Origin`/`Referer` are
 * attacker-controlled, and trusting them turns a callback into an open redirect.
 */
export function resolvePublicOrigin(): string {
  const configured = process.env.APP_PUBLIC_ORIGIN?.trim();
  if (configured) return configured.replace(/\/+$/, '');
  return process.env.NODE_ENV === 'production'
    ? 'https://violema.com'
    : 'http://localhost:5173';
}

/**
 * Where Composio returns the user once they finish (or abandon) an OAuth flow.
 *
 * Carries only `connected=<toolkit>`. Composio appends the outcome itself —
 * `status=success` or `status=failed`, per `CreateConnectedAccountLinkOptions`
 * — so pre-seeding a status here would produce `status=success&status=failed`
 * on a failed connection, and a parser reading the first value would call a
 * failure a success. Leaving it off makes Composio's value the only one.
 */
export function buildPartnerConnectCallbackUrl(toolkit: string): string {
  return `${resolvePublicOrigin()}/integrations?connected=${encodeURIComponent(toolkit)}`;
}
