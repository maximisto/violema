import { mkdir, writeFile, copyFile, rm, access } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join } from 'node:path';
import { corpora, stressTest } from '../data/corpora.mjs';
import { homePage, methodPage, demoPage, reviewPage, legalPage } from '../lib/pages.mjs';
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

await exportCorpora(undefined, { check: true });
// Trial records must match primary.studies; with SYPRES_CSV set they are also re-derived from the pinned CSV.
const trials = await checkTrials({ csv: process.env.SYPRES_CSV });
// Only the generated company-site directory is removed; application output is separate.
await rm(dist, { recursive: true, force: true });
for (const directory of ['method', 'demo', 'review', 'legal/terms', 'legal/privacy', 'company-assets/browser', 'company-assets/data', 'company-assets/fonts']) {
  await mkdir(join(dist, directory), { recursive: true });
}
for (const [route, markup] of [
  ['index.html', homePage(corpora, stressTest, trials)],
  ['method/index.html', methodPage(corpora, stressTest)],
  ['demo/index.html', demoPage(corpora, stressTest)],
  ['review/index.html', reviewPage(corpora, stressTest)],
  ['legal/terms/index.html', legalPage('terms')],
  ['legal/privacy/index.html', legalPage('privacy')],
]) await writeFile(join(dist, route), markup);
for (const [source, destination] of [
  ['browser/site.css', 'company-assets/site.css'],
  ['browser/appearance.css', 'company-assets/appearance.css'],
  ['browser/experience.css', 'company-assets/experience.css'],
  ['browser/experience.mjs', 'company-assets/browser/experience.mjs'],
  ['browser/playback.mjs', 'company-assets/browser/playback.mjs'],
  ['browser/diagrams.mjs', 'company-assets/browser/diagrams.mjs'],
  ['browser/diagrams.css', 'company-assets/diagrams.css'],
  ['browser/site.mjs', 'company-assets/browser/site.mjs'],
  ['browser/tabs.mjs', 'company-assets/browser/tabs.mjs'],
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
for (const [source, destination] of fontFiles) await copyFile(join(assets, source), join(dist, 'company-assets', destination));
for (const [source, destination] of logoFiles) await copyFile(join(root, 'brand', source), join(dist, 'company-assets', destination));
await writeFile(join(dist, 'robots.txt'), 'User-agent: *\nAllow: /\n\nSitemap: https://violema.com/sitemap.xml\n');
await writeFile(join(dist, 'sitemap.xml'), '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' + ['/', '/method/', '/demo/', '/legal/terms/', '/legal/privacy/'].map(path => `<url><loc>https://violema.com${path}</loc></url>`).join('') + '</urlset>\n');
await writeFile(join(dist, 'llms.txt'), '# Violema\n\nScientific evidence systems that connect claims to sources, make consequential assumptions visible, and keep the record open to review. Prepared demonstrations remain subject to independent scientific review.\n\n- [Method](https://violema.com/method/): source, claim, assumption, review and version records.\n- [Evidence lab](https://violema.com/demo/): two manually curated packets; shared presentation, not universal scientific validity.\n- [PsychDoc](https://psychdoc.ai/): first scientific application.\n- [Website Terms of Use](https://violema.com/legal/terms/): public scientific website terms.\n- [Website Privacy Policy](https://violema.com/legal/privacy/): public scientific website information practices.\n\nThe existing workspace sign-in remains at https://violema.com/login.\n');
console.log(`Built six static pages and ${corpora.length} source packets in company-site/dist.`);
