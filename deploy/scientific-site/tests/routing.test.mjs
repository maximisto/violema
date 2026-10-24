import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { classify, backend } from '../routing.mjs';
import { render } from '../render.mjs';

const packet = fileURLToPath(new URL('../', import.meta.url));
const repo = resolve(packet, '../..');
const read = path => readFileSync(resolve(repo, path), 'utf8');
const oldHosts = ['violema.com', 'www.violema.com'];
const apiTargets = [
  '/api', '/api/health', '/api/auth/google/callback?code=secret&state=signed',
  '/api/auth/microsoft/callback?code=secret&state=signed', '/api/auth/admin/magic?token=secret',
  '/api/auth/magic-link/consume?token=secret', '/api/integrations/composio/connect',
  '/api/slack/events', '/api/slack/interactions', '/api/email/postmark/webhook?token=secret',
  '/api/billing/stripe/webhook', '/api/brief-charts/old-chart.svg',
  '/api/generated-screenshots/old-shot.png',
];

test('all API, provider deliveries, callbacks and historical generated links retain one upstream', () => {
  for (const host of [...oldHosts, 'agent.purpleorange.ai']) for (const method of ['GET', 'POST', 'OPTIONS', 'HEAD']) for (const target of apiTargets) {
    assert.deepEqual(classify({ host, method, target }), { kind: 'proxy', backend }, `${host} ${method} ${target}`);
  }
});

test('old workspace pages, old assets and unknown paths are the company 404 page, never a redirect', () => {
  const notFound = { kind: 'not-found', status: 404, page: '/404.html' };
  const oldPages = ['/login', '/signup', '/access-terms', '/dashboard', '/dashboard/agents', '/settings', '/settings/billing', '/plans', '/pricing', '/connect/slack', '/integrations', '/admin', '/runs/run_123', '/faq', '/terms', '/privacy'];
  const oldQueries = ['/plans?section=topups', '/pricing?plan=pro', '/dashboard?panel=schedules', '/login?next=%2Fdashboard', '/login?token=secret', '/pricing?checkout=success&session_id=cs_123'];
  const oldAssets = ['/assets/old-bundle.js', '/brand/violema-slack-avatar.png', '/fonts/geist/geist-sans-400.woff2', '/seo/seo.css', '/blog', '/blog/weekly-founder-update-ai-agent/index.html', '/ai-agents-for-founders', '/po-logo.png', '/violema-icon.svg'];
  const unknown = ['/nonexistent', '/Login', '/dashboard-other', '/runs/a/b', '/api-other', '/wp-login.php', '/login%3Ftoken=secret', '/404.html'];
  for (const host of oldHosts) for (const method of ['GET', 'HEAD', 'POST']) for (const target of [...oldPages, ...oldQueries, ...oldAssets, ...unknown]) {
    assert.deepEqual(classify({ host, method, target }), notFound, `${host} ${method} ${target}`);
  }
});

test('company pages and metadata use company HTML; non-read methods are refused', () => {
  const pages = ['/', '/index.html', '/method', '/method/', '/method/index.html', '/demo', '/demo/', '/demo/index.html', '/review', '/review/', '/review/index.html', '/about', '/about/', '/about/index.html', '/legal/terms', '/legal/terms/', '/legal/privacy/', '/legal/privacy/index.html', '/records/fe4s4-benchmark', '/records/fe4s4-benchmark/', '/records/fe4s4-benchmark/index.html', '/records/fe4s4-benchmark/record', '/records/fe4s4-benchmark/record/', '/records/fe4s4-benchmark/record/index.html', '/robots.txt', '/sitemap.xml', '/llms.txt', '/company-assets/site.css', '/company-assets/data/psychdoc.json'];
  for (const host of oldHosts) for (const target of pages) {
    assert.equal(classify({ host, target }).kind, 'company', target);
    assert.equal(classify({ host, method: 'POST', target }).kind, 'method-not-allowed', target);
  }
});

test('agent.purpleorange.ai keeps the old app for reads', () => {
  for (const target of ['/', '/login', '/dashboard', '/assets/old-bundle.js']) assert.equal(classify({ host: 'agent.purpleorange.ai', target }).kind, 'legacy-app', target);
  assert.equal(classify({ host: 'agent.purpleorange.ai', method: 'POST', target: '/login' }).kind, 'method-not-allowed');
});

test('source and sensitive file paths are rejected before asset and API prefix handling', () => {
  for (const host of [...oldHosts, 'agent.purpleorange.ai']) for (const target of ['/.env', '/%2eenv', '/.git/config', '/backend/auth-users.json', '/frontend/src/App.tsx', '/docs/notes.md', '/assets/index.js.map', '/brand/file.bak', '/api/.env', '/CLAUDE.md']) assert.equal(classify({ host, target }).kind, 'reject', target);
});

test('rendered configs match committed inert templates and proxy all API locations unchanged', () => {
  for (const mode of ['preview', 'cutover']) {
    const output = render({ mode });
    assert.equal(output, readFileSync(resolve(packet, `${mode}.nginx.conf.template`), 'utf8'));
    const upstreams = [...output.matchAll(/proxy_pass\s+([^;]+);/g)].map(match => match[1]);
    assert.equal(upstreams.length, mode === 'preview' ? 4 : 6);
    assert.deepEqual([...new Set(upstreams)], [backend]);
    assert.equal((output.match(/location \^~ \/api\/ \{/g) || []).length, mode === 'preview' ? 2 : 3);
    assert.match(output, /location = \/api \{/);
    assert.match(output, /location = \/method \{[\s\S]*?try_files \/method\/index\.html =404;/);
    assert.match(output, /location \/ \{ return 404; \}/);
    assert.match(output, /error_page 404 \/404\.html;\n    location = \/404\.html \{\n        internal;/);
    assert.doesNotMatch(output, /proxy_redirect|proxy_cookie_domain|rewrite\s|return 30[12]|scientific_browser_redirect|\$request_uri#/);
    // The company server never reads the old app's root or names the app host.
    const company = output.split('server {').find(block => /listen (?:127\.0\.0\.1:8088|443 ssl);\n    server_name (?:localhost|violema\.com)/.test(block));
    assert.ok(company, `${mode} company server`);
    assert.doesNotMatch(company.replace(/#.*$/gm, ''), /frontend\/dist|agent\.purpleorange\.ai/);
  }
});

test('preview binds only loopback; renderer defaults to preview and rejects injection or install flags', () => {
  const preview = render();
  assert.deepEqual([...preview.matchAll(/listen ([^;]+);/g)].map(match => match[1]), ['127.0.0.1:8088', '127.0.0.1:8089']);
  for (const companyRoot of ['/tmp/x; include /etc/passwd', '/tmp/../backend', '/tmp/path with spaces', 'relative']) assert.throws(() => render({ companyRoot }));
  assert.throws(() => render({ companyRoot: '/tmp/same', legacyRoot: '/tmp/same' }));
  const result = spawnSync(process.execPath, [resolve(packet, 'render.mjs'), '--install'], { encoding: 'utf8' });
  assert.notEqual(result.status, 0);
  assert.equal(result.stdout, '');
});

test('fresh source inventory: app routes, callbacks, cookie and one-process assumptions remain visible', () => {
  const source = read('backend/src/server.ts');
  for (const route of ['/api/auth/:provider/callback', '/api/slack/events', '/api/slack/interactions', '/api/email/postmark/webhook', '/api/billing/stripe/webhook', '/api/brief-charts', '/api/generated-screenshots']) assert.ok(source.includes(`'${route}'`), route);
  for (const name of ['AUTH_PUBLIC_URL', 'AUTH_COOKIE_DOMAIN', 'PUBLIC_APP_URL', 'APP_BASE_URL']) assert.ok(source.includes(`process.env.${name}`), name);
  assert.match(source, /Date\.now\(\) - payload\.issuedAt > 1000 \* 60 \* 15/);
  assert.match(read('deploy/ecosystem.config.cjs'), /instances: 1/);
  assert.ok(read('frontend/src/lib/auth.ts').includes("fetch('/api/auth/session'"));
  for (const route of ['/login', '/signup', '/plans', '/pricing', '/settings/billing', '/connect/slack', '/integrations', '/settings', '/admin', '/dashboard', '/dashboard/agents']) assert.ok(read('frontend/src/App.tsx').includes(`path="${route}"`), route);
});

test('prepared runtime patch remains applicable without modifying its target files', () => {
  const result = spawnSync('git', ['apply', '--check', 'deploy/scientific-site/runtime-origin-changes.patch'], { cwd: repo, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
});
