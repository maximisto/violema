import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, stat, readdir } from 'node:fs/promises';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { corpora, stressTest } from '../data/corpora.mjs';
import { calculateBiasScenario, escapeHTML, sourceURL, corpusPanel, intervalFigure, traceSpecimen } from '../lib/render.mjs';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const dist=join(root,'dist');
const pages=[['/','index.html'],['/method/','method/index.html'],['/demo/','demo/index.html']];
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
  assert.match(html,/noindex,nofollow/);
  assert.match(html,/id="main"/);
  assert.doesNotMatch(html,/href="https:\/\/agent\.purpleorange\.ai/);
  assert.match(html,/planned destination, not live here/);
  assert.doesNotMatch(html,/—/,'Public copy uses no em-dashes');
  assert.match(html,/<a class="brand" href="\/" aria-label="Violema home"><img src="\/company-assets\/violema-logo\.png" width="2172" height="724" alt="Violema"><\/a>/);
  assert.match(html,/rel="icon" href="\/company-assets\/violema-icon\.png" type="image\/png"/);
  assert.match(html,/<meta name="color-scheme" content="light">/);
  assert.doesNotMatch(html,/\/Users\/|\/private\/tmp\/|OpenRouter\.env|Slack\.env|auth-users/);
  const ids=[...html.matchAll(/\sid="([^\"]+)"/g)].map(match=>match[1]);
  assert.equal(new Set(ids).size,ids.length,'Document IDs must be unique');
  for(const match of html.matchAll(/(?:href|src)="([^\"]+)"/g)){
    const href=decode(match[1]);
    if(href.startsWith('#')){assert.ok(ids.includes(href.slice(1)),`Missing anchor ${href}`);continue;}
    if(!href.startsWith('/'))continue;
    const [path,anchor]=href.split('#');
    let local=join(dist,path);
    if((await stat(local)).isDirectory())local=join(local,'index.html');
    assert.ok((await stat(local)).isFile(),`${href} exists`);
    if(anchor){const target=await readFile(local,'utf8');assert.ok(target.includes(`id="${anchor}"`),`Missing local target ${href}`);}
  }
});

test('titles use the house separators',async()=>{
  const title=async file=>(await readFile(join(dist,file),'utf8')).match(/<title>([^<]+)<\/title>/)[1];
  assert.equal(await title('index.html'),'Violema: scientific conclusions, with their evidence attached');
  assert.equal(await title('method/index.html'),'The method | Violema');
  assert.equal(await title('demo/index.html'),'Evidence lab | Violema');
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
  assert.doesNotMatch(css,/prefers-color-scheme/,'Light only until a reversed logo is approved');
  assert.match(css,/:root \{\n  color-scheme: light;/);
  assert.ok(!(await readdir(dist)).includes('assets'),'Legacy app asset namespace is preserved');
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

test('home instrument is the PsychDoc specimen with a bounded, initially hidden replay control',async()=>{
  const html=await readFile(join(dist,'index.html'),'utf8');
  assert.match(html,/<h2 id="specimen-title" class="instrument-title">PsychDoc specimen<\/h2>/);
  assert.equal((html.match(/class="trace trace-animate"/g)||[]).length,1);
  assert.match(html,/<div class="bias-control" data-bias-control hidden><label for="hero-bias-range">/);
  assert.match(html,/id="hero-bias-range" type="range" min="0" max="0\.6" step="0\.01" value="0"/);
  assert.ok(html.includes('The control adds the same assumed shift to the estimate and both interval endpoints. It does not estimate bias, refit the model, or change the interval width.'));
  assert.ok(html.includes(escapeHTML(stressTest.direction)));
  for(const corpus of corpora)assert.ok(html.includes(`href="/demo/#corpus-${corpus.id}"`),'teaser links into the lab');
  for(const page of ['method/index.html','demo/index.html'])assert.doesNotMatch(await readFile(join(dist,page),'utf8'),/trace-animate/);
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
  for(const [approved,served] of [['violema-restored-type-20261010.png','violema-logo.png'],['violema-fine-neck-icon-20261010.png','violema-icon.png']]){
    const source=await readFile(join(root,'brand',approved));
    assert.ok(source.equals(await readFile(join(dist,'company-assets',served))),`${served} is ${approved}`);
  }
});
