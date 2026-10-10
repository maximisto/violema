import { mkdir, writeFile, copyFile, rm, access } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join } from 'node:path';
import { corpora, stressTest } from '../data/corpora.mjs';
import { homePage, methodPage, demoPage } from '../lib/pages.mjs';
import { exportCorpora } from './export-corpora.mjs';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root,'dist');
const frontend = resolve(root,'../frontend/public');

await exportCorpora(undefined,{check:true});
// Only the generated company-site directory is removed; application output is separate.
await rm(dist,{recursive:true,force:true});
for (const directory of ['method','demo','company-assets/browser','company-assets/data','company-assets/fonts']) await mkdir(join(dist,directory),{recursive:true});
for (const [route,markup] of [['index.html',homePage(corpora,stressTest)],['method/index.html',methodPage(corpora,stressTest)],['demo/index.html',demoPage(corpora,stressTest)]]) await writeFile(join(dist,route),markup);
for (const [source,destination] of [['browser/site.css','company-assets/site.css'],['browser/site.mjs','company-assets/browser/site.mjs'],['lib/render.mjs','company-assets/browser/render.mjs'],['data/corpora.mjs','company-assets/data/corpora.mjs']]) await copyFile(join(root,source),join(dist,destination));
for (const corpus of corpora) {
  const packet = join(root,'data',`${corpus.id}.json`);
  // Missing exported provenance packets fail the build rather than create an unversioned fallback.
  await access(packet);
  await copyFile(packet,join(dist,'company-assets/data',`${corpus.id}.json`));
}
for(const name of ['provenance.md','stage-b-snapshot.json','portability-receipt.json']) await copyFile(join(root,'data',name),join(dist,'company-assets/data',name));
for(const [source,destination] of [['violema-warm-wordmark-20261010.png','violema-logo.png'],['violema-open-eye-icon-20261010.png','violema-icon.png']]) await copyFile(join(root,'brand',source),join(dist,'company-assets',destination));
for(const font of ['geist-sans-400','geist-sans-500','geist-sans-600']) await copyFile(join(frontend,'fonts/geist',`${font}.woff2`),join(dist,'company-assets/fonts',`${font}.woff2`));
await copyFile(join(frontend,'fonts/clash/clash-display-500.woff2'),join(dist,'company-assets/fonts/clash-display-500.woff2'));
await writeFile(join(dist,'robots.txt'),'User-agent: *\nDisallow: /\n# Local preview: remove noindex and disallow only in a separately approved release.\n');
await writeFile(join(dist,'sitemap.xml'),'<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'+['/','/method/','/demo/'].map(path=>`<url><loc>https://violema.com${path}</loc></url>`).join('')+'</urlset>\n');
await writeFile(join(dist,'llms.txt'),'# Violema scientific company preview\n\nPrepared scientific evidence demonstration; independent review pending.\n\n- [Method](https://violema.com/method/): source, claim, assumption, review and version records.\n- [Evidence lab](https://violema.com/demo/): two manually curated packets; shared presentation, not universal scientific validity.\n- [PsychDoc](https://psychdoc.ai/): canonical first scientific application.\n\nThe existing founder-agent application has a planned destination at agent.purpleorange.ai. This preview does not perform that migration.\n');
console.log(`Built three static pages and ${corpora.length} source packets in company-site/dist.`);
