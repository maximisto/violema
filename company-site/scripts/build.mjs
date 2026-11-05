import { mkdir, writeFile, copyFile, rm, access, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join } from 'node:path';
import { corpora, stressTest } from '../data/corpora.mjs';
import { homePage, methodPage, demoPage, reviewPage, aboutPage, legalPage, notFoundPage } from '../lib/pages.mjs';
import { fe4s4Page, fe4s4RecordPage } from '../lib/records.mjs';
import { fieldPage } from '../lib/fields.mjs';
import { PAGES, FIELD, FE4S4_ROUTE, FE4S4_RECORD_ROUTE } from '../lib/routes.mjs';
import { exportCorpora } from './export-corpora.mjs';
import { checkTrials } from './export-trials.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');
const assets = join(root, 'assets');

// Self-hosted fonts owned by company-site (see README "Fonts").
const fontFiles = [
  ['fonts/instrument-sans-latin-wght-normal.woff2', 'fonts/instrument-sans-latin-wght-normal.woff2'],
  ['fonts/inter-latin-wght-normal.woff2', 'fonts/inter-latin-wght-normal.woff2'],
  ['fonts/LICENSE-instrument-sans.txt', 'fonts/LICENSE-instrument-sans.txt'],
  ['fonts/LICENSE-inter.txt', 'fonts/LICENSE-inter.txt'],
];
// The owner-approved scientific logo and icon, copied unchanged from company-site/brand/.
const logoFiles = [
  ['violema-restored-type-20261010.png', 'violema-logo.png'],
  ['violema-dark-bk-logo-20261015.png', 'violema-logo-dark.png'],
  ['violema-fine-neck-icon-20261010.png', 'violema-icon.png'],
  ['psychdoc-wordmark-light.svg', 'psychdoc-wordmark-light.svg'],
  ['psychdoc-wordmark-dark.svg', 'psychdoc-wordmark-dark.svg'],
];
// Former-client marks for the About page, copied unchanged from purpleorange.ai's founder strip (assets/brand/founder/).
const clientLogoFiles = ['unilever.svg', 'wrigley.svg', 'nestle.svg'];

await exportCorpora(undefined, { check: true });
// Trial records must match primary.studies; with SYPRES_CSV set they are also re-derived from the pinned CSV.
const trials = await checkTrials({ csv: process.env.SYPRES_CSV });
// Only the generated company-site directory is removed; application output is separate.
await rm(dist, { recursive: true, force: true });
for (const directory of ['company-assets/browser', 'company-assets/data', 'company-assets/fonts', 'company-assets/clients']) {
  await mkdir(join(dist, directory), { recursive: true });
}
// One renderer per registered page; the registry in lib/routes.mjs gives each page its file and whether it is indexed.
const rendered = new Map([
  ['/', homePage(corpora, stressTest, trials)],
  ['/method/', methodPage(corpora, stressTest)],
  ['/demo/', demoPage(corpora, stressTest)],
  ['/review/', reviewPage(corpora, stressTest)],
  ['/about/', aboutPage()],
  ['/legal/terms/', legalPage('terms')],
  ['/legal/privacy/', legalPage('privacy')],
  ['/404', notFoundPage()],
  // The field and its hypothesis records: public, indexed and listed in the sitemap and llms.txt below.
  [FIELD.route, fieldPage()],
  [FE4S4_ROUTE, fe4s4Page()],
  [FE4S4_RECORD_ROUTE, fe4s4RecordPage()],
]);
// The shell refuses an unregistered route, so the only gap left is a registered page with no renderer.
const unrendered = PAGES.filter(page => !rendered.has(page.route)).map(page => page.route);
if (unrendered.length) throw new Error(`Registered pages with no renderer: ${unrendered.join(', ')}`);
for (const { route, file } of PAGES) {
  await mkdir(dirname(join(dist, file)), { recursive: true });
  await writeFile(join(dist, file), rendered.get(route));
}
for (const [source, destination] of [
  ['browser/site.css', 'company-assets/site.css'],
  ['browser/appearance.css', 'company-assets/appearance.css'],
  ['browser/experience.css', 'company-assets/experience.css'],
  ['browser/experience.mjs', 'company-assets/browser/experience.mjs'],
  ['browser/playback.mjs', 'company-assets/browser/playback.mjs'],
  ['browser/diagrams.mjs', 'company-assets/browser/diagrams.mjs'],
  ['browser/diagrams.css', 'company-assets/diagrams.css'],
  ['browser/records.css', 'company-assets/records.css'],
  ['browser/fe4s4.mjs', 'company-assets/browser/fe4s4.mjs'],
  ['lib/fe4s4-figures.mjs', 'company-assets/browser/fe4s4-figures.mjs'],
  ['browser/site.mjs', 'company-assets/browser/site.mjs'],
  ['browser/analytics.mjs', 'company-assets/browser/analytics.mjs'],
  ['browser/tabs.mjs', 'company-assets/browser/tabs.mjs'],
  ['browser/briefing.mjs', 'company-assets/browser/briefing.mjs'],
  ['browser/lab.mjs', 'company-assets/browser/lab.mjs'],
  ['browser/evidence-map.mjs', 'company-assets/browser/evidence-map.mjs'],
  ['lib/evidence-map.mjs', 'company-assets/browser/evidence-map-render.mjs'],
  ['lib/render.mjs', 'company-assets/browser/render.mjs'],
  ['data/corpora.mjs', 'company-assets/data/corpora.mjs'],
]) await copyFile(join(root, source), join(dist, destination));
for (const corpus of corpora) {
  const packet = join(root, 'data', `${corpus.id}.json`);
  // Missing exported provenance packets fail the build rather than create an unversioned fallback.
  await access(packet);
  await copyFile(packet, join(dist, 'company-assets/data', `${corpus.id}.json`));
}
for (const name of ['provenance.md', 'stage-b-snapshot.json', 'portability-receipt.json', 'sypres-primary-trials.json', 'evidence-map.json']) {
  await copyFile(join(root, 'data', name), join(dist, 'company-assets/data', name));
}
// Earlier packet revisions stay downloadable byte for byte, so each one's receipt still verifies (see provenance.md).
for (const version of await readdir(join(root, 'data/archive'))) {
  if (version.startsWith('.')) continue;
  await mkdir(join(dist, 'company-assets/data/archive', version), { recursive: true });
  for (const name of await readdir(join(root, 'data/archive', version))) {
    if (!name.startsWith('.')) await copyFile(join(root, 'data/archive', version, name), join(dist, 'company-assets/data/archive', version, name));
  }
}
for (const [source, destination] of fontFiles) await copyFile(join(assets, source), join(dist, 'company-assets', destination));
for (const [source, destination] of logoFiles) await copyFile(join(root, 'brand', source), join(dist, 'company-assets', destination));
for (const name of clientLogoFiles) await copyFile(join(assets, 'clients', name), join(dist, 'company-assets/clients', name));
await copyFile(join(assets, 'violema-social-hero.jpg'), join(dist, 'company-assets/violema-social-hero.jpg'));
await copyFile(join(assets, 'max-markovtsev.jpg'), join(dist, 'company-assets/max-markovtsev.jpg'));
await writeFile(join(dist, 'robots.txt'), 'User-agent: *\nAllow: /\n\nSitemap: https://violema.com/sitemap.xml\n');
// Every indexable page in registry order; the physician walkthrough and the 404 page stay out.
const sitemapRoutes = PAGES.filter(page => page.indexable).map(page => page.route);
await writeFile(join(dist, 'sitemap.xml'), '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' + sitemapRoutes.map(path => `<url><loc>https://violema.com${path}</loc></url>`).join('') + '</urlset>\n');
// Written by hand, one line per page; tests/site.test.mjs checks that every indexable page but the home page is linked.
await writeFile(join(dist, 'llms.txt'), '# Violema\n\nScientific evidence systems that connect claims to sources, make consequential assumptions visible, and keep the record open to review. Prepared demonstrations remain subject to independent scientific review.\n\n- [Method](https://violema.com/method/): source, claim, assumption, review and version records.\n- [Evidence lab](https://violema.com/demo/): two manually prepared packets; shared presentation, not universal scientific validity.\n- [About Violema](https://violema.com/about/): company charter, scientific governance, and divisions.\n- [Quantum advantage records](https://violema.com/fields/quantum-advantage/): draft protocols for committed tests of claims that a quantum-assisted workflow beats the strongest publicly tested classical methods on a defined problem, chemistry first.\n- [Fe₄S₄ benchmark record](https://violema.com/records/fe4s4-benchmark/): a draft committed test of one narrow quantum-advantage claim on an iron-sulfur benchmark, with its outcome rule written before any result counts.\n- [Fe₄S₄ full record](https://violema.com/records/fe4s4-benchmark/record/): the claim, the test and its outcome rule, and the evidence in the order it became public.\n- [PsychDoc](https://psychdoc.ai/): first scientific application.\n- [Website Terms of Use](https://violema.com/legal/terms/): public scientific website terms.\n- [Website Privacy Policy](https://violema.com/legal/privacy/): public scientific website information practices.\n');
console.log(`Built seven static pages, one field page, two record pages, the 404 page and ${corpora.length} source packets in company-site/dist.`);

const heroAssets = join(assets, 'violema-hero');
await mkdir(join(dist, 'company-assets/violema-hero'), { recursive: true });
// Only the layers used by the light and dark compositions are shipped.
for (const name of ['evidence-network-light.svg', 'evidence-network-dark.svg', 'scientific-diagrams-light.svg', 'scientific-diagrams-dark.svg', 'earth-horizon-light.webp', 'earth-horizon-dark.webp', 'dna-glass.webp', 'handaxe-concept.webp', 'observe-microscope.webp', 'record-document.webp', 'revisit-network.webp']) {
  await copyFile(join(heroAssets, name), join(dist, 'company-assets/violema-hero', name));
}
