import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, stat, readdir } from 'node:fs/promises';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { corpora, stressTest } from '../data/corpora.mjs';
import { calculateBiasScenario, escapeHTML, sourceURL, corpusPanel, intervalFigure, traceSpecimen } from '../lib/render.mjs';
import { homePage } from '../lib/pages.mjs';
import { TRACKER_SRC } from '../lib/analytics.mjs';
import { profiles, profileIcon } from '../lib/social.mjs';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const dist=join(root,'dist');
const pages=[['/','index.html'],['/method/','method/index.html'],['/demo/','demo/index.html'],['/review/','review/index.html'],['/about/','about/index.html'],['/legal/terms/','legal/terms/index.html'],['/legal/privacy/','legal/privacy/index.html']];
const decode = value => value.replaceAll('&amp;','&');

test('additive replay preserves original result and interval width throughout declared domain',()=>{
  const original=calculateBiasScenario(stressTest,0);
  assert.equal(original.estimate,stressTest.estimate);
  for(const bias of [0,.01,.05,.31,.6]){
    const result=calculateBiasScenario(stressTest,bias);
    assert.equal(result.estimate,stressTest.estimate+bias);
    assert.ok(Math.abs((result.upper-result.lower)-(stressTest.upper-stressTest.lower))<1e-12);
    assert.ok(result.lower<result.estimate&&result.estimate<result.upper);
  }
});

test('reference crossings use full precision; rounded text never drives calculation',()=>{
  for(const threshold of stressTest.thresholds){
    const crossing=threshold-stressTest.upper;
    assert.ok(calculateBiasScenario(stressTest,crossing-1e-8).upper<threshold);
    assert.ok(Math.abs(calculateBiasScenario(stressTest,crossing).upper-threshold)<1e-12);
    assert.ok(calculateBiasScenario(stressTest,crossing+1e-8).upper>threshold);
  }
  for(const invalid of [-.01,.61,NaN,Infinity,'invalid'])assert.throws(()=>calculateBiasScenario(stressTest,invalid),RangeError);
});

test('untrusted source protocol and markup cannot become executable HTML',()=>{
  assert.equal(sourceURL('javascript:alert(1)'),'#');
  assert.equal(sourceURL('data:text/html,test'),'#');
  assert.equal(sourceURL('//example.org'),'#');
  assert.equal(sourceURL('https://example.org/?a=1&b=2'),'https://example.org/?a=1&amp;b=2');
  assert.equal(escapeHTML('<script>"\'&'),'&lt;script&gt;&quot;&#39;&amp;');
});

test('materials renderer never carries a clinical numerical control',()=>{
  const materials=corpusPanel(corpora.find(c=>c.id==='perovskite-stability'),stressTest);
  assert.doesNotMatch(materials,/id="bias-range"|data-interval-chart|data-scenario-result/);
  assert.match(materials,/No pooled effect/);
  const clinical=corpusPanel(corpora.find(c=>c.id===stressTest.corpusId),stressTest);
  assert.match(clinical,/Replay of a saved analysis/);
  assert.match(clinical,/id="bias-range"/);
});

for(const [route,file] of pages)test(`${route} is meaningful HTML with correct metadata and resolvable local resources`,async()=>{
  const html=await readFile(join(dist,file),'utf8');
  assert.match(html,/<!doctype html>/i);
  assert.equal((html.match(/<h1[ >]/g)||[]).length,1);
  assert.match(html,/<html lang="en">/);
  assert.match(html,/<meta name="description" content="[^\"]{40,}/);
  assert.ok(html.includes(`rel="canonical" href="https://violema.com${route}"`));
  assert.ok(html.includes(`<meta name="robots" content="${route === '/review/' ? 'noindex,follow' : 'index,follow'}">`));
  assert.match(html,/id="main"/);
  assert.doesNotMatch(html,/href="https:\/\/agent\.purpleorange\.ai/);
  // The old workspace moved to agent.purpleorange.ai; violema.com no longer serves or links its pages.
  assert.doesNotMatch(html,/href="\/(?:login|signup|dashboard|terms|privacy|blog)\b/);
  assert.doesNotMatch(html,/planned destination, not live here/);
  assert.doesNotMatch(html,/—/,'Public copy uses no em-dashes');
  assert.match(html,/<a class="brand" href="\/" aria-label="Violema home"><img class="brand-light" src="\/company-assets\/violema-logo\.png" width="2172" height="724" alt="Violema"><img class="brand-dark" src="\/company-assets\/violema-logo-dark\.png" width="2172" height="724" alt="Violema" loading="lazy"><\/a>/);
  assert.match(html,/rel="icon" href="\/company-assets\/violema-icon\.png" type="image\/png"/);
  assert.match(html,/<meta name="color-scheme" content="light dark">/);
  assert.doesNotMatch(html,/\/Users\/|\/private\/tmp\/|OpenRouter\.env|Slack\.env|auth-users/);
  const ids=[...html.matchAll(/\sid="([^\"]+)"/g)].map(match=>match[1]);
  assert.equal(new Set(ids).size,ids.length,'Document IDs must be unique');
  for(const match of html.matchAll(/(?:href|src)="([^\"]+)"/g)){
    const href=decode(match[1]);
    if(href.startsWith('#')){assert.ok(ids.includes(href.slice(1)),`Missing anchor ${href}`);continue;}
    if(!href.startsWith('/'))continue;
    if(href===TRACKER_SRC)continue; // nginx proxies it to Umami (lib/analytics.mjs); never part of dist.
    const [path,anchor]=href.split('#');
    let local=join(dist,path);
    if((await stat(local)).isDirectory())local=join(local,'index.html');
    assert.ok((await stat(local)).isFile(),`${href} exists`);
    if(anchor){const target=await readFile(local,'utf8');assert.ok(target.includes(`id="${anchor}"`),`Missing local target ${href}`);}
  }
});

test('website policies are reachable from every company footer without replacing workspace policies',async()=>{
  for(const [,file] of pages){
    const html=await readFile(join(dist,file),'utf8');
    const footer=html.match(/<footer class="site-footer">[\s\S]*?<\/footer>/)[0];
    for(const route of ['/legal/terms/','/legal/privacy/'])assert.ok(footer.includes(`href="${route}"`));
  }
  for(const slug of ['terms','privacy']){
    const html=await readFile(join(dist,'legal',slug,'index.html'),'utf8');
    assert.match(html,/Violema, Inc\./);
    assert.match(html,/Delaware corporation/);
    assert.match(html,slug==='terms'?/separate workspace terms and a workspace privacy policy/:/separate workspace privacy policy/,'Workspace policies stay named, unlinked');
    assert.doesNotMatch(html,/<form[ >]|\[Address\]|\[Company|12.month retention/);
  }
  const entries=await readdir(dist);
  assert.ok(!entries.includes('terms')&&!entries.includes('privacy'),'Company bundle does not shadow app policy paths');
  const sitemap=await readFile(join(dist,'sitemap.xml'),'utf8');
  assert.match(sitemap,/<loc>https:\/\/violema\.com\/legal\/terms\/<\/loc>/);
  assert.match(sitemap,/<loc>https:\/\/violema\.com\/legal\/privacy\/<\/loc>/);
});

test('titles use the house separators',async()=>{
  const title=async file=>(await readFile(join(dist,file),'utf8')).match(/<title>([^<]+)<\/title>/)[1];
  assert.equal(await title('index.html'),'Scientific evidence systems | Violema');
  assert.equal(await title('method/index.html'),'Scientific evidence method | Violema');
  assert.equal(await title('demo/index.html'),'Scientific evidence examples | Violema');
});

test('the 404 page works at any address and is never indexed',async()=>{
  const html=await readFile(join(dist,'404.html'),'utf8');
  assert.equal(html.match(/<title>([^<]+)<\/title>/)[1],'Page not found | Violema');
  assert.equal((html.match(/<h1[ >]/g)||[]).length,1);
  assert.ok(html.includes('<meta name="robots" content="noindex,follow">'));
  assert.doesNotMatch(html,/rel="canonical"|property="og:url"|name="googlebot"/,'A 404 has no canonical address');
  assert.doesNotMatch(html,/—/,'Public copy uses no em-dashes');
  // nginx serves this file at the missed address (/a/b/c), so a relative link or asset would resolve against it.
  for(const match of html.matchAll(/(?:href|src)="([^\"]+)"/g))assert.match(match[1],/^(?:\/|#|https:\/\/)/,`${match[1]} is root-absolute`);
  const footer=html.match(/<footer class="site-footer">[\s\S]*?<\/footer>/)[0];
  for(const route of ['/legal/terms/','/legal/privacy/'])assert.ok(footer.includes(`href="${route}"`));
  assert.doesNotMatch(await readFile(join(dist,'sitemap.xml'),'utf8'),/404/);
});

test('all claims, cited sources and condition tables exist before JavaScript',async()=>{
  const html=await readFile(join(dist,'demo/index.html'),'utf8');
  for(const corpus of corpora){
    assert.ok(html.includes(`id="corpus-${corpus.id}"`));
    for(const claim of corpus.claims){
      assert.ok(html.includes(escapeHTML(claim.text)));
      assert.ok(html.includes(escapeHTML(claim.caveat)));
      for(const sourceId of claim.sourceIds){const source=corpus.sources.find(s=>s.id===sourceId);assert.ok(html.includes(sourceURL(source.url)));assert.ok(html.includes(escapeHTML(source.locator)));}
    }
  }
  assert.equal((html.match(/<table>/g)||[]).length,corpora.length);
  assert.match(html,/<noscript>/);
  assert.doesNotMatch(html,/data-corpus-panel="[^\"]+" hidden/);
});

test('downloaded packets stay identical to source and do not leak analysis across corpora',async()=>{
  for(const corpus of corpora){
    const source=await readFile(join(root,'data',`${corpus.id}.json`),'utf8');
    const served=await readFile(join(dist,'company-assets/data',`${corpus.id}.json`),'utf8');
    assert.equal(served,source);
    const packet=JSON.parse(served);
    assert.equal(packet.corpus.id,corpus.id);
    if(corpus.id!==stressTest.corpusId)assert.equal(packet.analysis,null);
  }
});

test('browser module paths and self-hosted stylesheet assets resolve in the generated namespace',async()=>{
  // Follow static and dynamic imports from the entry module through every module it reaches.
  const seen=new Set(),queue=[join(dist,'company-assets/browser/site.mjs')];
  while(queue.length){
    const file=queue.shift();
    if(seen.has(file))continue;
    seen.add(file);
    assert.ok((await stat(file)).isFile(),`${file} exists`);
    const source=await readFile(file,'utf8');
    for(const [,relative] of source.matchAll(/(?:from |import\()'([^']+)'/g))queue.push(resolve(dirname(file),relative));
  }
  for(const module of ['tabs.mjs','lab.mjs','render.mjs'])assert.ok(seen.has(join(dist,'company-assets/browser',module)),`${module} is reachable from site.mjs`);
  const css=await readFile(join(dist,'company-assets/site.css'),'utf8');
  for(const [,relative] of css.matchAll(/url\('([^']+)'\)/g))assert.ok((await stat(join(dist,relative))).isFile());
  assert.match(css,/prefers-reduced-motion:\s*reduce/);
  assert.match(css,/:focus-visible/);
  assert.doesNotMatch(css,/prefers-color-scheme/,'Theme is reader-selected, not forced by the operating system');
  assert.match(css,/:root \{\n  color-scheme: light;/);
  assert.ok(!(await readdir(dist)).includes('assets'),'Legacy app asset namespace is preserved');
});

test('/about/ shows the six former clients as one-ink marks, each with an accessible name',async()=>{
  const html=await readFile(join(dist,'about/index.html'),'utf8');
  const grid=html.match(/<ul class="founder-client-grid"[\s\S]*?<\/ul>/)?.[0]??'';
  assert.equal((grid.match(/<li>/g)||[]).length,6);
  assert.match(grid,/<img class="founder-client-logo founder-client-logo--wrigley" src="\/company-assets\/clients\/wrigley\.svg"[^>]* alt="Wrigley"/);
  assert.match(grid,/<img class="founder-client-logo founder-client-logo--nestle" src="\/company-assets\/clients\/nestle\.svg"[^>]* alt="Nestlé"/);
  // The Unilever icon is decorative; the visible word carries the name.
  assert.match(grid,/unilever\.svg"[^>]* alt=""[^>]*>Unilever<\/span>/);
  for(const name of ['P&amp;G','Northwestern Mutual','U.S. Marine Corps'])assert.ok(grid.includes(`>${name}</span>`),`${name} wordmark`);
  for(const name of ['unilever.svg','wrigley.svg','nestle.svg'])assert.deepEqual(await readFile(join(dist,'company-assets/clients',name)),await readFile(join(root,'assets/clients',name)));
  const css=await readFile(join(dist,'company-assets/site.css'),'utf8');
  assert.match(css,/\.founder-client-logo \{[^}]*filter: brightness\(0\);/);
  assert.match(css,/\[data-theme='dark'\] \.founder-client-logo \{ filter: brightness\(0\) invert\(1\); \}/);
});

test('every footer links the company profiles as icon links; a row without a confirmed URL stays in place and says so',async()=>{
  assert.deepEqual(profiles.map(profile=>profile.id),['linkedin','instagram','x','youtube','reddit','facebook','github']);
  for(const profile of profiles){
    assert.equal(profile.owner,'Violema',`${profile.id} is the company account, not a personal one`);
    if(profile.href!==null)assert.match(profile.href,/^https:\/\//);
    assert.match(profileIcon(profile.id),/^<svg viewBox="0 0 24 24"[^>]* aria-hidden="true"[^>]*><path d="[^"]+"\/><\/svg>$/);
  }
  assert.equal(profiles.find(profile=>profile.id==='linkedin').href,'https://www.linkedin.com/company/violema/','the company page, not the founder\'s');
  assert.equal(profiles.find(profile=>profile.id==='instagram').href,'https://www.instagram.com/violemaai/');
  for(const [,file] of pages){
    const html=await readFile(join(dist,file),'utf8');
    const list=html.match(/<ul class="social-list footer-social" aria-label="Social profiles">([\s\S]*?)<\/ul>/)?.[1]??'';
    const links=[...list.matchAll(/<a class="social-link social-link--([a-z]+)( social-link--pending)?" href="([^"]+)"( target="_blank" rel="noopener noreferrer")? aria-label="([^"]+)" title="([^"]+)"><svg/g)].map(match=>match.slice(1));
    assert.deepEqual(links,profiles.map(profile=>profile.href
      ?[profile.id,undefined,profile.href,' target="_blank" rel="noopener noreferrer"',`Violema on ${profile.name}`,profile.name]
      :[profile.id,' social-link--pending','/',undefined,`Violema on ${profile.name}, page to come`,`${profile.name}: page to come`]),`${file} footer profiles`);
    assert.ok(!list.includes('maximisto')&&!list.includes('orcid.org'),`${file} footer carries no personal profile`);
  }
});

test('/about/ puts LinkedIn and ORCID cards with their handles under the founder card, brand colours there only',async()=>{
  const html=await readFile(join(dist,'about/index.html'),'utf8');
  const aside=html.match(/<div class="founder-aside">([\s\S]*?)<div class="founder-narrative">/)?.[1]??'';
  assert.match(aside,/<\/figure>\s*<ul class="founder-profiles" aria-label="Max Markovtsev's profiles">/);
  const cards=[...aside.matchAll(/<a class="profile-card profile-card--([a-z]+)" href="([^"]+)"[^>]* aria-label="([^"]+)">[\s\S]*?<span class="profile-card-handle">([^<]+)<\/span>/g)].map(match=>match.slice(1));
  assert.deepEqual(cards,[
    ['linkedin','https://www.linkedin.com/in/maximisto/','Max Markovtsev on LinkedIn: in/maximisto','in/maximisto'],
    ['orcid','https://orcid.org/0009-0009-9354-2207','Max Markovtsev on ORCID: 0009-0009-9354-2207','0009-0009-9354-2207'],
  ]);
  // The cards replace the card's former text badges.
  assert.doesNotMatch(html,/founder-badge/);
  const css=await readFile(join(dist,'company-assets/site.css'),'utf8');
  assert.deepEqual(css.match(/[^\n]*#A6CE39[^\n]*/gi).length,1,'ORCID green appears once, on the card mark');
  assert.match(css,/\.profile-card--orcid svg \{ color: #A6CE39;/);
});

test('/about/ career explorer has five eras in order, each tab with a short title and its years',async()=>{
  const html=await readFile(join(dist,'about/index.html'),'utf8');
  const nav=html.match(/<nav class="guide-tabs" data-tablist aria-label="Explore Max Markovtsev career eras">([\s\S]*?)<\/nav>/)?.[1]??'';
  const tabs=[...nav.matchAll(/<a href="#(founder-era-[a-z]+)"><span class="era-num">(\d+)<\/span><span class="era-text"><span class="era-title">([^<]+)<\/span><span class="era-years">([^<]*)<\/span><\/span><\/a>/g)].map(match=>match.slice(1));
  assert.deepEqual(tabs.map(([id])=>id),['founder-era-agencies','founder-era-independent','founder-era-ai','founder-era-violema','founder-era-disclosure']);
  assert.deepEqual(tabs.slice(0,3).map(([,,,years])=>years),['1994–2009','2010–2017','2017–now']);
  for(const [id] of tabs)assert.match(html,new RegExp(`<section id="${id}" aria-labelledby="${id}-heading">`));
  // Every ledger row in the founder card opens an existing era.
  for(const [,target] of html.matchAll(/data-epoch-target="([^"]+)"/g))assert.ok(tabs.some(([id])=>id===target),target);
  assert.doesNotMatch(html,/Enterprise BI/);
});

test('self-hosted fonts match their recorded checksums and ship with their licences',async()=>{
  const sums=(await readFile(join(root,'assets/fonts/SHA256SUMS'),'utf8')).trim().split('\n').map(line=>line.split(/\s+/));
  assert.deepEqual(sums.map(([,name])=>name).sort(),['LICENSE-instrument-sans.txt','LICENSE-inter.txt','instrument-sans-latin-wght-normal.woff2','inter-latin-wght-normal.woff2']);
  for(const [hash,name] of sums){
    const source=await readFile(join(root,'assets/fonts',name));
    assert.equal(createHash('sha256').update(source).digest('hex'),hash,name);
    assert.ok(source.equals(await readFile(join(dist,'company-assets/fonts',name))),`${name} is served unchanged`);
  }
});

test('interval scale marks come from the saved analysis and the assumed shift',()=>{
  const position=value=>(4+(value+1.6)/2.2*92).toFixed(3)+'%';
  for(const bias of [0,.31,.6]){
    const svg=intervalFigure(stressTest,bias);
    const scenario=calculateBiasScenario(stressTest,bias);
    assert.ok(svg.includes(`cx="${position(stressTest.estimate)}" cy="42"`),'saved estimate stays put');
    assert.ok(svg.includes(`cx="${position(scenario.estimate)}" cy="72"`),'shifted estimate moves by the shift');
    assert.ok(svg.includes(`x1="${position(scenario.lower)}" y1="72" x2="${position(scenario.upper)}" y2="72"`),'shifted interval keeps both bounds');
    for(const threshold of stressTest.thresholds)assert.ok(svg.includes(`x1="${position(threshold)}"`),'reference line drawn at its saved threshold');
  }
  assert.match(intervalFigure(stressTest),/aria-label="Saved estimate −0\.90, interval −1\.26 to −0\.55 in Hedges’ g; assumed shift 0\.00\."/);
});

test('the trace draws one lead per cited source, at each equal row centre',()=>{
  for(const corpus of corpora)for(const claim of corpus.claims){
    const markup=traceSpecimen(corpus,claim);
    const rows=claim.sourceIds.length;
    assert.equal((markup.match(/class="trace-lead"/g)||[]).length,rows);
    assert.equal((markup.match(/class="trace-trunk"/g)||[]).length,rows);
    assert.ok(markup.includes(`--rows:${rows}`));
    claim.sourceIds.forEach((id,i)=>{
      const source=corpus.sources.find(item=>item.id===id);
      const centre=((i+.5)/rows*100).toFixed(3);
      assert.ok(markup.includes(`y1="${centre}%" x2="100%" y2="${centre}%"`));
      assert.ok(markup.includes(escapeHTML(source.title)));
      assert.ok(markup.includes(`<code>${escapeHTML(source.id)}</code>`));
      assert.ok(markup.includes(sourceURL(source.url)));
    });
    assert.ok(markup.includes(escapeHTML(claim.text))&&markup.includes(escapeHTML(claim.caveat)));
    assert.doesNotMatch(markup,/trace-animate/,'only the hero opts into motion');
  }
});

test('the physician review has the actual claim, sources and bounded replay',async()=>{
  const html=await readFile(join(dist,'review/index.html'),'utf8');
  assert.match(html,/<h2 id="specimen-title" class="instrument-title">PsychDoc specimen<\/h2>/);
  assert.match(html,/<div class="bias-control" data-bias-control hidden><label for="review-bias-range">/);
  assert.match(html,/id="review-bias-range" type="range" min="0" max="0\.6" step="0\.01" value="0"/);
  assert.ok(html.includes('The control adds the same assumed shift to the estimate and both interval endpoints. It does not estimate bias, refit the model, or change the interval width.'));
  const claim=corpora.find(c=>c.id==='psychdoc').claims[0];
  assert.ok(html.includes(escapeHTML(claim.text))&&html.includes(escapeHTML(claim.caveat)));
  assert.ok(html.includes(escapeHTML(stressTest.direction)));
  assert.match(html,/https:\/\/psychdoc\.ai\/evidence\/psilocybin-rewiring#c-mouse-spines-persist/);
  assert.match(html,/comparison does not currently include animal findings/);
  assert.match(html,/Do not include patient information/);
  assert.doesNotMatch(html,/<form|<textarea|type="email"/);
  assert.doesNotMatch(await readFile(join(dist,'index.html'),'utf8'),/data-bias-root|data-bias-control/,'dense review controls live on the review page');
});

test('method page keeps its three sections, six stations and packet-derived examples',async()=>{
  const html=await readFile(join(dist,'method/index.html'),'utf8');
  for(const id of ['trace','assumptions','transfer'])assert.ok(html.includes(`id="${id}"`));
  assert.equal((html.match(/class="station"/g)||[]).length,6);
  const claim=corpora.find(c=>c.id==='psychdoc').claims[0];
  assert.ok(html.includes(escapeHTML(claim.text))&&html.includes(escapeHTML(claim.caveat))&&html.includes('Limit recorded beside the claim'));
  assert.ok(html.includes(escapeHTML(stressTest.reviewStatus)));
  assert.match(html,/href="\/company-assets\/data\/portability-receipt\.json" download/);
});

test('demo bench keeps one rail, one dark instrument and one evidence column per corpus',async()=>{
  const html=await readFile(join(dist,'demo/index.html'),'utf8');
  assert.match(html,/<nav class="segmented corpus-switch" data-corpus-switch aria-label="Choose a research corpus">/);
  assert.match(html,/<button class="button button-secondary reset-button" type="button" data-reset hidden>/);
  for(const corpus of corpora){
    const panel=corpusPanel(corpus,stressTest);
    assert.equal((panel.match(/class="instrument bench-instrument"/g)||[]).length,1);
    for(const claim of corpus.claims){
      assert.equal((panel.match(new RegExp(`data-claim-panel="${claim.id}"`,'g'))||[]).length,2,'claim and its evidence switch together');
      assert.ok(panel.includes(`id="claim-heading-${claim.id}"`)&&panel.includes(`id="evidence-${claim.id}"`));
      assert.ok(panel.includes(escapeHTML(claim.status)));
    }
    assert.ok(panel.includes(escapeHTML(corpus.reviewStatus))&&panel.includes(escapeHTML(corpus.scopeNote)));
  }
  assert.match(html,/class="table-scroll" tabindex="0" role="region"/);
});

test('the header logo and icon are the owner-approved brand files, served unchanged',async()=>{
  for(const [approved,served] of [['violema-restored-type-20261010.png','violema-logo.png'],['violema-dark-bk-logo-20261015.png','violema-logo-dark.png'],['violema-fine-neck-icon-20261010.png','violema-icon.png']]){
    const source=await readFile(join(root,'brand',approved));
    assert.ok(source.equals(await readFile(join(dist,'company-assets',served))),`${served} is ${approved}`);
  }
});

test('approved copy: the copyright line and the materials example replace the Oryx card',async()=>{
  for(const [,file] of pages){
    const html=await readFile(join(dist,file),'utf8');
    assert.equal((html.match(/<p class="footer-copyright">Copyright 2026 Violema, Inc\.<\/p>/g)||[]).length,1);
  }
  const home=await readFile(join(dist,'index.html'),'utf8');
  assert.doesNotMatch(home,/Oryx/);
  for(const text of ['Second example','Materials research','Curated demonstration','Can solar-cell stability results be compared on the same terms?','Explore four perovskite solar-cell reports alongside stability-reporting guidance. Trace each claim to its source, compare recorded test conditions, and see where information is missing.','Materials expert review pending. No pooled estimate is presented.','Explore the materials example'])assert.ok(home.includes(text),text);
});

test('the 12 trial records match primary.studies, primary.k and, when given, the pinned CSV',async()=>{
  const { checkTrials, trialId } = await import('../scripts/export-trials.mjs');
  const snapshot=JSON.parse(await readFile(join(root,'data/stage-b-snapshot.json'),'utf8'));
  const stored=await checkTrials({ csv: process.env.SYPRES_CSV });
  assert.equal(stored.trials.length,snapshot.primary.k);
  assert.equal(snapshot.primary.studies.length,snapshot.primary.k);
  assert.deepEqual(stored.trials.map(t=>t.study),snapshot.primary.studies);
  assert.deepEqual(stored.trials.map(t=>t.id),snapshot.primary.studies.map(trialId));
  assert.equal(stored.source.sha256,snapshot.dataSha256);
  for(const trial of stored.trials){
    assert.ok(Array.isArray(trial.dois)&&trial.dois.length>=1,'every publication DOI is kept as a list');
    assert.ok(!('doi' in trial),'no single DOI stands for a trial');
    assert.match(trial.study,/ (\d{4})$/);
    assert.equal(trial.year,Number(trial.study.slice(-4)));
  }
  const served=await readFile(join(dist,'company-assets/data/sypres-primary-trials.json'),'utf8');
  assert.equal(served,await readFile(join(root,'data/sypres-primary-trials.json'),'utf8'));
  assert.match(await readFile(join(dist,'demo/index.html'),'utf8'),/href="\/company-assets\/data\/sypres-primary-trials\.json" download/);
});

test('the homepage illustration includes exactly the 12 recorded trials and the source-linked primary claim',async()=>{
  const snapshot=JSON.parse(await readFile(join(root,'data/stage-b-snapshot.json'),'utf8'));
  const packet=JSON.parse(await readFile(join(root,'data/sypres-primary-trials.json'),'utf8'));
  const html=await readFile(join(dist,'index.html'),'utf8');
  const field=html.match(/<figure class="evidence-hero instrument"[\s\S]*?<\/figure>/)[0];
  const nodes=[...field.matchAll(/<li data-trial="([^"]+)"/g)].map(m=>m[1]);
  assert.equal(nodes.length,snapshot.primary.k);
  assert.deepEqual(nodes,packet.trials.map(t=>t.id));
  for(const trial of packet.trials)assert.ok(field.includes(escapeHTML(trial.study)));
  assert.equal((field.match(/class="assembly-line"/g)||[]).length,snapshot.primary.k);
  const primary=corpora.find(c=>c.id==='psychdoc').claims[0];
  assert.ok(field.includes(escapeHTML(primary.text)));
  assert.ok(field.includes(escapeHTML(primary.caveat)),'the headline result retains its interpretation limit');
  assert.match(field,/Lines show inclusion in this saved analysis/);
  assert.match(field,/href="\/review\/#review-specimen"/);
  assert.equal((html.match(/class="evidence-hero instrument"/g)||[]).length,1);
  for(const page of ['method/index.html','demo/index.html','review/index.html'])assert.doesNotMatch(await readFile(join(dist,page),'utf8'),/evidence-hero instrument/);
  assert.throws(()=>homePage(corpora,stressTest,{...packet,trials:packet.trials.slice(1)}),/primary\.k/);
});

test('the home page build is deterministic',async()=>{
  const packet=JSON.parse(await readFile(join(root,'data/sypres-primary-trials.json'),'utf8'));
  const first=homePage(corpora,stressTest,packet);
  assert.equal(homePage(corpora,stressTest,packet),first);
  assert.equal(await readFile(join(dist,'index.html'),'utf8'),first,'a separate build process produced the same bytes');
});

test('the home hero offers two actions, and its briefing button lands on the form in the closing chapter',async()=>{
  const html=await readFile(join(dist,'index.html'),'utf8');
  const hero=html.match(/<section class="hero experience-hero"[\s\S]*?<\/section>/)[0];
  const actions=hero.match(/<div class="actions">[\s\S]*?<\/div>/)[0];
  assert.match(actions,/^<div class="actions"><a class="button button-primary" href="#evidence">Follow the evidence /,'the primary action still leads');
  assert.equal((actions.match(/class="button /g)||[]).length,2,'exactly two buttons in the hero');
  assert.match(actions,/<a class="button button-secondary" href="#briefing">Request a briefing <span aria-hidden="true">↓<\/span><\/a>/,'the second button stays on this site');
  const closing=html.match(/<section class="experience-chapter chapter-connect"[\s\S]*?<\/section>/)[0];
  assert.match(closing,/<form class="briefing-form" id="briefing" action="\/api\/briefing" method="post" novalidate aria-labelledby="briefing-title" data-briefing-form data-briefing-intents="[^"]+">/,'the form is the closing chapter\'s action and the address every briefing link uses');
  assert.ok(closing.includes('<a class="text-link" href="/review/">Here to review the science? '),'the reviewer path stays beside the form');
});

test('the briefing form is complete without JavaScript and uses the lead handler\'s field contract',async()=>{
  const html=await readFile(join(dist,'index.html'),'utf8');
  const form=html.match(/<form class="briefing-form"[\s\S]*?<\/form>/)[0];
  assert.equal((html.match(/<form class="briefing-form"/g)||[]).length,1,'one briefing form on the homepage');
  for(const name of ['intent','role','name','email','organization','topic','message'])assert.match(form,new RegExp(`<(?:input|select|textarea) class="briefing-control" id="briefing-${name}" name="${name}"`),`${name} control`);
  assert.deepEqual([...form.matchAll(/<option value="([a-z-]+)"/g)].map(m=>m[1]),['briefing','pilot','expert-review','correction','privacy','biotech','fund','clinic','research','other'],'option values are the handler\'s, labels may differ');
  assert.match(form,/<div class="briefing-trap" aria-hidden="true"><label for="briefing-website">Website<\/label><input id="briefing-website" name="website" type="text" tabindex="-1" autocomplete="off"><\/div>/,'the honeypot the handler discards is hidden from people');
  assert.match(form,/<button class="button button-primary" type="submit" data-briefing-submit disabled>Request a briefing<\/button>/,'the button waits for the module: a plain post cannot reach the JSON-only handler');
  assert.match(form,/<noscript><p class="briefing-note">Sending needs JavaScript\. The same form is on <a href="https:\/\/psychdoc\.ai\/#briefing">PsychDoc\.AI<\/a>\.<\/p><\/noscript>/);
  assert.match(form,/<a href="\/legal\/privacy\/">Privacy Policy<\/a>/);
  assert.ok(html.includes("import('./briefing.mjs')")===false&&(await readFile(join(dist,'company-assets/browser/site.mjs'),'utf8')).includes("import('./briefing.mjs')"),'the page loads the module only through site.mjs');
  await stat(join(dist,'company-assets/browser/briefing.mjs'));
  assert.ok(!/[—]/.test(form),'no em-dashes in public copy');
});

test('every "Request a briefing" link on the site points at the form; nothing links the PsychDoc form except the noscript fallback',async()=>{
  for(const [route,file] of pages){
    const html=await readFile(join(dist,file),'utf8');
    const external=html.split('<noscript>')[0]+(html.split('</noscript>')[1]??'');
    assert.ok(!external.includes('psychdoc.ai/#briefing'),`${route} sends briefing requests to this site`);
    for(const [,href] of html.matchAll(/<a[^>]*href="([^"]+)"[^>]*>Request a briefing/g))assert.ok(href==='#briefing'||href==='/#briefing',`${route}: ${href}`);
  }
  const privacy=await readFile(join(dist,'legal/privacy/index.html'),'utf8');
  assert.ok(privacy.includes('<strong>Briefing form.</strong>'),'the privacy policy describes the form');
  assert.ok(!privacy.includes('submission forms'),'the policy no longer claims the site has no forms');
  const terms=await readFile(join(dist,'legal/terms/index.html'),'utf8');
  assert.ok(terms.includes('accept one submission: the briefing form'));
});

test('the demo replay states that it always uses Claim 1, beside the control, clinical corpus only',async()=>{
  const label='<p class="replay-scope" id="replay-scope">Saved replay: Claim 1, primary analysis. Selecting another claim does not change this replay.</p>';
  const clinical=corpusPanel(corpora.find(c=>c.id===stressTest.corpusId),stressTest);
  assert.ok(clinical.includes(`${label}<div class="bias-control" data-bias-control hidden>`),'the label sits directly beside the assumed-shift control');
  assert.equal(clinical.split('Saved replay:').length-1,1);
  assert.match(clinical,/id="bias-range"[^>]*aria-describedby="replay-scope bias-explanation"/);
  assert.doesNotMatch(corpusPanel(corpora.find(c=>c.id==='perovskite-stability'),stressTest),/Saved replay:|replay-scope/);
  const demo=await readFile(join(dist,'demo/index.html'),'utf8');
  assert.equal(demo.split('Saved replay: Claim 1, primary analysis.').length-1,1);
  assert.doesNotMatch(demo,/whichever claim is selected/,'earlier wording is gone');
});

test('the release is discoverable while the physician walkthrough remains noindex',async()=>{
  const robots=await readFile(join(dist,'robots.txt'),'utf8');
  assert.match(robots,/Allow: \//);
  assert.doesNotMatch(robots,/Disallow: \//);
  const sitemap=await readFile(join(dist,'sitemap.xml'),'utf8');
  for(const route of ['/','/method/','/demo/'])assert.ok(sitemap.includes(`<loc>https://violema.com${route}</loc>`));
  assert.doesNotMatch(sitemap,/\/review\//);
  assert.match(await readFile(join(dist,'review/index.html'),'utf8'),/<meta name="robots" content="noindex,follow">/);
});
