// Offline routing contract. The renderer uses these allowlists; this is not an
// nginx interpreter and its tests do not establish production routing validity.
export const appOrigin = 'https://agent.purpleorange.ai';
export const backend = 'http://127.0.0.1:3001';
export const browserPath = '/(?:login|signup|access-terms|plans|pricing|settings(?:/billing)?|connect/slack|integrations|admin|dashboard(?:/agents)?|runs/[A-Za-z0-9_-]+)';
export const publicLegacyPath = '/(?:faq|privacy|terms)';
export const redirectPatterns = [
  `^${browserPath}/?$`,
  '^/(?:plans|pricing)\\?(?:section=topups|plan=(?:pro|team)|checkout=(?:success|cancel))$',
  '^/dashboard\\?(?:panel=schedules|checkout=(?:success|cancel))$',
  '^/(?:login|signup|access-terms|connect/slack)\\?next=(?:%2[Ff]|/)(?:dashboard|plans|pricing)$',
];
export const protectedPath = '(?:^/(?:backend|frontend|deploy|company-site|docs|node_modules)(?:/|$)|(?:^|/)\\.[^/]*(?:/|$)|(?:\\.(?:bak|map|env|rtf)$)|^/(?:AGENTS|CLAUDE)\\.md$)';
export const legacyAssetPrefixes = ['/assets/', '/brand/', '/fonts/', '/seo/', '/blog/', '/ai-agents-for-founders/'];
export const legacyFiles = ['/blog', '/ai-agents-for-founders', '/po-logo.png', '/violema-icon.svg', '/violema-mark.svg', '/33bbbde5b8700c2c95901a438260d51d.txt'];

export function classify({ host = 'violema.com', method = 'GET', target = '/' } = {}) {
  if (!['violema.com', 'www.violema.com', 'agent.purpleorange.ai'].includes(host)) return { kind: 'outside-packet' };
  // Decode for the protection/route model only. Redirects match the raw request
  // target, excluding percent-encoded path tricks and unapproved query strings.
  const rawPath = target.split('?')[0];
  let pathname;
  try { pathname = decodeURIComponent(rawPath); } catch { return { kind: 'reject' }; }
  if (!pathname.startsWith('/') || pathname.includes('..') || new RegExp(protectedPath, 'i').test(pathname)) return { kind: 'reject' };
  if (pathname === '/api' || pathname.startsWith('/api/')) return { kind: 'proxy', backend };
  if (!['GET', 'HEAD'].includes(method)) return { kind: 'method-not-allowed' };
  if (host === 'agent.purpleorange.ai') return { kind: 'legacy-app' };
  if (redirectPatterns.some(pattern => new RegExp(pattern).test(target))) {
    // An explicit empty fragment prevents the browser inheriting an old #token.
    return { kind: 'redirect', status: 302, location: `${appOrigin}${target}#` };
  }
  if (['/', '/index.html', '/method', '/method/', '/demo', '/demo/', '/robots.txt', '/sitemap.xml', '/llms.txt'].includes(pathname) || pathname.startsWith('/company-assets/')) return { kind: 'company' };
  if (new RegExp(`^(?:${browserPath}|${publicLegacyPath})/?$`).test(pathname)) return { kind: 'legacy-app' };
  if (legacyAssetPrefixes.some(prefix => pathname.startsWith(prefix)) || legacyFiles.includes(pathname)) return { kind: 'legacy-static' };
  return { kind: 'not-found' };
}
