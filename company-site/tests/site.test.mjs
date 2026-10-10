import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, stat, readdir } from 'node:fs/promises';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { corpora, stressTest } from '../data/corpora.mjs';
import { calculateBiasScenario, escapeHTML, sourceURL, corpusPanel } from '../lib/render.mjs';

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
  const browser=await readFile(join(dist,'company-assets/browser/site.mjs'),'utf8');
  for(const [,relative] of browser.matchAll(/from '([^']+)'/g))assert.ok((await stat(resolve(dist,'company-assets/browser',relative))).isFile());
  const css=await readFile(join(dist,'company-assets/site.css'),'utf8');
  for(const [,relative] of css.matchAll(/url\('([^']+)'\)/g))assert.ok((await stat(join(dist,relative))).isFile());
  assert.match(css,/prefers-reduced-motion:reduce/);
  assert.match(css,/:focus-visible/);
  assert.ok(!(await readdir(dist)).includes('assets'),'Legacy app asset namespace is preserved');
});
