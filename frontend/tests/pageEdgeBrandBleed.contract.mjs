import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const assetUrl = new URL('../public/brand/po-half-logo.png', import.meta.url);
const componentUrl = new URL('../src/components/PageBrandBleed.tsx', import.meta.url);
const app = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');
const hero = readFileSync(new URL('../src/components/Hero.tsx', import.meta.url), 'utf8');
const appCss = readFileSync(new URL('../src/index.css', import.meta.url), 'utf8');
const seoCss = readFileSync(new URL('../public/seo/seo.css', import.meta.url), 'utf8');
const component = existsSync(componentUrl) ? readFileSync(componentUrl, 'utf8') : '';
const asset = existsSync(assetUrl) ? readFileSync(assetUrl) : Buffer.alloc(0);
const assetHash = createHash('sha256').update(asset).digest('hex');
const expectedAssetHash = '8f6198ef28958e0e655564f1fa9bc02070cf71ed7fc4440bddefb042cc791ae5';

const staticPages = [
  '../public/ai-agents-for-founders/index.html',
  '../public/blog/index.html',
  '../public/blog/agentic-ai-for-startup-operations/index.html',
  '../public/blog/ai-agent-vs-workflow-automation/index.html',
  '../public/blog/competitor-intelligence-ai-agent/index.html',
  '../public/blog/customer-risk-monitoring-ai-agent/index.html',
  '../public/blog/human-in-the-loop-ai-agents-for-founders/index.html',
  '../public/blog/reviewable-ai-operator-for-founder-led-teams/index.html',
  '../public/blog/weekly-founder-update-ai-agent/index.html',
  '../public/blog/what-should-founders-automate-first-with-ai-agents/index.html',
];

assert(assetHash === expectedAssetHash, 'public asset is the exact supplied Purple Orange half-logo PNG');
assert(component.includes('src="/brand/po-half-logo.png"'), 'global component uses the supplied half-logo');
assert(component.includes('className="page-brand-bleed"'), 'global component owns the fixed branding class');
assert(component.includes('alt=""') && component.includes('aria-hidden="true"'), 'global mark remains decorative');
assert(component.includes('width={206}') && component.includes('height={430}'), 'global mark reserves the source aspect ratio');
assert(app.includes("import PageBrandBleed from './components/PageBrandBleed'"), 'app imports global branding');
assert(
  /<BrowserRouter>\s*<PageBrandBleed \/>\s*<Suspense/.test(app),
  'global branding renders once outside the route switch',
);
assert(!hero.includes('po-half-logo'), 'hero no longer owns the branding mark');
assert(appCss.includes('.page-brand-bleed'), 'SPA stylesheet defines the branding treatment');
assert(appCss.includes('position: fixed'), 'SPA branding stays in place while scrolling');
assert(appCss.includes('left: 6px'), 'SPA branding matches the 6px Purple Orange Group edge inset');
assert(appCss.includes('z-index: 40'), 'SPA branding stays visible above page content');
assert(appCss.includes('@media (max-width: 1279px)'), 'SPA branding has a narrow-window treatment');
assert(appCss.includes('filter: brightness(0.7)'), 'SPA branding darkens on narrower windows');
assert(seoCss.includes('.page-brand-bleed'), 'standalone pages share the branding treatment');
assert(seoCss.includes('position: fixed'), 'standalone branding stays in place while scrolling');
assert(seoCss.includes('left: 6px'), 'standalone branding matches the 6px Purple Orange Group edge inset');

for (const pagePath of staticPages) {
  const page = readFileSync(new URL(pagePath, import.meta.url), 'utf8');
  assert(page.includes('class="page-brand-bleed"'), `${pagePath} renders the fixed half-logo`);
  assert(page.includes('src="/brand/po-half-logo.png"'), `${pagePath} uses the supplied half-logo asset`);
}

console.log('pageEdgeBrandBleed.contract: persistent supplied half-logo verified across all public surfaces');
