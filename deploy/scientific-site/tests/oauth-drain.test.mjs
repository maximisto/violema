import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const packet = fileURLToPath(new URL('../', import.meta.url));
const repo = resolve(packet, '../..');
const map = readFileSync(resolve(packet, 'oauth-drain.http.nginx.conf.snippet'), 'utf8');
const guard = readFileSync(resolve(packet, 'oauth-drain.nginx.conf.snippet'), 'utf8');
// Inspect the actual inert map, not a separately maintained routing regex.
const match = map.match(/"~\*([^"\n]+)"\s+900;/);
assert.ok(match, 'case-insensitive 900-second start-path rule must exist');
const startRule = new RegExp(match[1], 'i');
const blocked = target => startRule.test(decodeURIComponent(target.split('?')[0]));

test('drain uses a normalized URI map and a server return before location selection', () => {
  assert.match(map, /map \$uri \$scientific_oauth_drain_retry_after \{/);
  assert.match(map, /default "";/);
  assert.doesNotMatch(map, /map \$request_uri/);
  assert.match(guard, /^add_header Retry-After \$scientific_oauth_drain_retry_after always;/m);
  assert.match(guard, /^if \(\$scientific_oauth_drain_retry_after\) \{\s+return 503 /m);
  assert.doesNotMatch(guard, /^location\s/m);
  assert.doesNotMatch(guard, /return 30[1278]/);
});

test('drain blocks trailing slash, case, query and encoded-provider forms while callbacks remain open', () => {
  for (const target of [
    '/api/auth/google/start', '/api/auth/microsoft/start',
    '/api/auth/google/start/', '/api/auth/microsoft/start/',
    '/api/AUTH/google/START', '/api/AUTH/microsoft/START/',
    '/API/Auth/google/sTaRt/?intent=login&next=%2Fdashboard',
    '/api/auth/%67oogle/start', '/api/auth/micro%73oft/start/',
  ]) assert.equal(blocked(target), true, target);
  for (const target of [
    '/api/auth/google/callback?code=secret&state=signed',
    '/api/AUTH/microsoft/CALLBACK/?code=secret&state=signed',
    '/api/auth/session', '/api/auth/google/start-extra', '/api/auth/google/start/extra',
    '/api/auth/google/restart', '/api/auth/magic-link/consume?token=secret',
    '/api/slack/events', '/api/slack/interactions', '/api/email/postmark/webhook',
    '/api/billing/stripe/webhook', '/dashboard?next=/api/auth/google/start',
  ]) assert.equal(blocked(target), false, target);
});

test('drain covers supported starts accepted by the installed Express route matcher', t => {
  // Optional dependency-backed check, never imports the app or starts a server.
  // Point at an already installed backend when this worktree has no node_modules.
  const backendRoot = process.env.VIOLEMA_TEST_BACKEND_ROOT || resolve(repo, 'backend');
  const require = createRequire(resolve(backendRoot, 'package.json'));
  let Layer;
  try { Layer = require('express/lib/router/layer'); }
  catch (error) {
    if (error.code !== 'MODULE_NOT_FOUND') throw error;
    t.skip('Express is not installed here; set VIOLEMA_TEST_BACKEND_ROOT for the independent matcher check');
    return;
  }
  const route = new Layer('/api/auth/:provider/start', { sensitive: false, strict: false, end: true }, () => {});
  let checked = 0;
  for (const api of ['api', 'API', 'aPi']) {
    for (const auth of ['auth', 'AUTH', 'aUtH']) {
      for (const start of ['start', 'START', 'sTaRt']) {
        for (const provider of ['google', 'microsoft', '%67oogle', 'micro%73oft']) {
          for (const suffix of ['', '/']) {
            const path = `/${api}/${auth}/${provider}/${start}${suffix}`;
            assert.equal(route.match(path), true, path);
            assert.ok(['google', 'microsoft'].includes(route.params.provider), path);
            assert.equal(blocked(path), true, `Express-supported start bypasses drain: ${path}`);
            checked++;
          }
        }
      }
    }
  }
  assert.equal(checked, 216);
});
