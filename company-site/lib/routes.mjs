// Routes shared by the page shell, the field page and the records, kept free of imports so
// pages.mjs and records.mjs can both read them without importing each other at load time.
export const FIELD = { route: '/fields/quantum-advantage/', name: 'Quantum advantage' };
export const FE4S4_ROUTE = '/records/fe4s4-benchmark/';
export const FE4S4_RECORD_ROUTE = '/records/fe4s4-benchmark/record/';

// Every page the build writes, in sitemap order. An indexable page carries index,follow and is listed in
// the sitemap; a record names the field it sits under. The live vhost is an allowlist, so a new route also
// needs its locations in deploy/scientific-site/routing.mjs and on the server.
export const PAGES = Object.freeze([
  { route: '/', indexable: true },
  { route: '/method/', indexable: true },
  { route: '/demo/', indexable: true },
  // The physician walkthrough is reached by a shared link, not by search.
  { route: '/review/', indexable: false },
  { route: '/about/', indexable: true },
  { route: FIELD.route, indexable: true },
  { route: FE4S4_ROUTE, indexable: true, field: FIELD.route },
  { route: FE4S4_RECORD_ROUTE, indexable: true, field: FIELD.route },
  { route: '/legal/terms/', indexable: true },
  { route: '/legal/privacy/', indexable: true },
  // nginx serves the 404 page at whatever address missed, so it has no canonical URL of its own.
  { route: '/404', indexable: false, notFound: true },
].map(page => Object.freeze({ ...page, file: page.notFound ? '404.html' : `${page.route.slice(1)}index.html` })));

export function pageFor(route) {
  const page = PAGES.find(item => item.route === route);
  if (!page) throw new Error(`Unregistered page route: ${route}`);
  return page;
}
