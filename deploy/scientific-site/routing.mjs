// Offline routing contract. The renderer uses these allowlists; this is not an
// nginx interpreter and its tests do not establish production routing validity.
// violema.com serves only the company site: since release 20261016-d673fe0-not-found
// every old workspace page and asset is a 404 with the company 404.html, and only
// /api/ still reaches the backend. The old app lives on agent.purpleorange.ai.
export const backend = 'http://127.0.0.1:3001';
export const protectedPath = '(?:^/(?:backend|frontend|deploy|company-site|docs|node_modules)(?:/|$)|(?:^|/)\\.[^/]*(?:/|$)|(?:\\.(?:bak|map|env|rtf)$)|^/(?:AGENTS|CLAUDE)\\.md$)';
export const notFoundPage = '/404.html';

const companyDirectories = ['/method', '/demo', '/review', '/legal/terms', '/legal/privacy'];
// Exact company routes and the built file each serves, mirroring the live overlay.
export const companyPages = [
  ['/', '/index.html'], ['/index.html', '/index.html'],
  ...companyDirectories.flatMap(dir => [dir, `${dir}/`, `${dir}/index.html`].map(route => [route, `${dir}/index.html`])),
  ['/robots.txt', '/robots.txt'], ['/sitemap.xml', '/sitemap.xml'], ['/llms.txt', '/llms.txt'],
];
const companyRoutes = new Set(companyPages.map(([route]) => route));
const readOnly = method => ['GET', 'HEAD'].includes(method);

export function classify({ host = 'violema.com', method = 'GET', target = '/' } = {}) {
  if (!['violema.com', 'www.violema.com', 'agent.purpleorange.ai'].includes(host)) return { kind: 'outside-packet' };
  const rawPath = target.split('?')[0];
  let pathname;
  try { pathname = decodeURIComponent(rawPath); } catch { return { kind: 'reject' }; }
  if (!pathname.startsWith('/') || pathname.includes('..') || new RegExp(protectedPath, 'i').test(pathname)) return { kind: 'reject' };
  if (pathname === '/api' || pathname.startsWith('/api/')) return { kind: 'proxy', backend };
  if (host === 'agent.purpleorange.ai') return readOnly(method) ? { kind: 'legacy-app' } : { kind: 'method-not-allowed' };
  if (companyRoutes.has(pathname) || pathname.startsWith('/company-assets/')) {
    return readOnly(method) ? { kind: 'company' } : { kind: 'method-not-allowed' };
  }
  // Old workspace pages, old assets and unknown paths: the company 404 page, never a redirect.
  return { kind: 'not-found', status: 404, page: notFoundPage };
}
