// deploy/deploy.sh must never rewrite the live company-site vhost. These tests run
// the real script against a temporary APP_DIR and NGINX_DIR with every external
// command that could reach the system (git, npm, npx, pm2, curl, nginx, systemctl,
// certbot, apt-get, chown, ln, rm, sed) replaced by a stub that only records its
// arguments. Nothing touches /etc, a package manager, PM2 or the network.
import test from 'node:test';
import assert from 'node:assert/strict';
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const repo = resolve(fileURLToPath(new URL('../../..', import.meta.url)));
const script = join(repo, 'deploy/deploy.sh');
const stubbed = ['git', 'npm', 'npx', 'pm2', 'curl', 'nginx', 'systemctl', 'certbot', 'apt-get', 'chown', 'ln', 'rm', 'sed'];
const overlayVhost = [
  'server {',
  '    server_name violema.com www.violema.com;',
  '    # BEGIN VIOLEMA SCIENCE COMPANY-ONLY OVERLAY',
  '    location = / { root /var/www/violema-science/current; }',
  '    # END VIOLEMA SCIENCE COMPANY-ONLY OVERLAY',
  '    location ^~ /api/ { proxy_pass http://127.0.0.1:3001; }',
  '}',
  '',
].join('\n');
// What the legacy template renders: violema.com, but no company markers.
const legacyVhost = 'server {\n    listen 80;\n    server_name violema.com www.violema.com;\n    root /var/www/nexus/frontend/dist;\n}\n';

function sandbox(t, { exitCodes = {} } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'violema-deploy-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const dirs = { bin: join(root, 'bin'), app: join(root, 'app'), nginx: join(root, 'nginx'), log: join(root, 'log') };
  for (const dir of [dirs.bin, join(dirs.app, '.git'), join(dirs.app, 'backend'), join(dirs.app, 'frontend/dist'),
    join(dirs.nginx, 'sites-available'), join(dirs.nginx, 'sites-enabled'), join(dirs.nginx, 'conf.d')]) mkdirSync(dir, { recursive: true });
  writeFileSync(join(dirs.app, 'backend/.env'), 'PORT=3001\n');
  writeFileSync(join(dirs.app, 'backend/package-lock.json'), '{"lockfileVersion":3}\n');
  writeFileSync(join(dirs.app, 'frontend/package-lock.json'), '{"lockfileVersion":3}\n');
  const calls = join(root, 'calls.log');
  for (const name of stubbed) {
    // `npm ci` creates node_modules so the stamp logic sees a real install.
    const extra = name === 'npm' ? '[ "$1" = ci ] && mkdir -p node_modules\n' : '';
    const stub = join(dirs.bin, name);
    writeFileSync(stub, `#!/bin/sh\nprintf '%s|%s\\n' "$(basename "$PWD")" "${name} $*" >> "${calls}"\n${extra}exit ${exitCodes[name] ?? 0}\n`);
    chmodSync(stub, 0o755);
  }
  const run = (args = [], env = {}) => {
    if (existsSync(calls)) rmSync(calls);
    const result = spawnSync('bash', [script, ...args], {
      encoding: 'utf8',
      env: {
        ...process.env, PATH: `${dirs.bin}:${process.env.PATH}`, APP_DIR: dirs.app, NGINX_DIR: dirs.nginx, LOG_DIR: dirs.log,
        HEALTH_ATTEMPTS: '2', HEALTH_INTERVAL_SECONDS: '0', ...env,
      },
    });
    const log = existsSync(calls) ? readFileSync(calls, 'utf8').trim().split('\n').filter(Boolean) : [];
    return { ...result, log, commands: log.map(line => line.split('|')[1]) };
  };
  return { ...dirs, run };
}

const vhostPath = box => join(box.nginx, 'sites-available/violema.com');
const enabledPath = box => join(box.nginx, 'sites-enabled/violema.com');

function assertRefused(result, pattern) {
  assert.notEqual(result.status, 0, 'refused with a non-zero exit');
  assert.match(result.stderr, pattern);
  assert.match(result.stderr, /Nothing was changed/);
  assert.deepEqual(result.commands, [], 'no package, git, build, nginx, link or PM2 command ran');
}

test('deploy.sh parses', () => {
  assert.equal(spawnSync('bash', ['-n', script]).status, 0);
});

test('a full deploy refuses the live company vhost before running anything', t => {
  const box = sandbox(t);
  writeFileSync(vhostPath(box), overlayVhost);
  for (const args of [[], ['--skip-deps']]) {
    assertRefused(box.run(args), /live company-site vhost/);
    assert.equal(readFileSync(vhostPath(box), 'utf8'), overlayVhost, 'vhost bytes unchanged');
  }
  assert.match(box.run().stderr, /--backend-only/, 'points at the safe path');
});

test('the guard follows sites-enabled and recognises the company root without markers', t => {
  const box = sandbox(t);
  const elsewhere = join(box.nginx, 'company.conf');
  writeFileSync(elsewhere, 'server { root /var/www/violema-science/current; }\n');
  symlinkSync(elsewhere, enabledPath(box));
  assertRefused(box.run(['--skip-deps']), /\/var\/www\/violema-science/);
});

test('a dangling sites-enabled link fails closed', t => {
  const box = sandbox(t);
  symlinkSync(join(box.nginx, 'sites-available/moved-away'), enabledPath(box));
  assertRefused(box.run(['--skip-deps']), /dangling symlink/);
});

test('a renamed company vhost is found through any sites-enabled link', t => {
  const box = sandbox(t);
  writeFileSync(join(box.nginx, 'sites-available/company-site'), overlayVhost);
  symlinkSync(join(box.nginx, 'sites-available/company-site'), join(box.nginx, 'sites-enabled/company-site'));
  assertRefused(box.run(['--skip-deps']), /company-site is the live company-site vhost/);
});

test('a conf.d-hosted company vhost, or any other file serving the domain, is refused', t => {
  const box = sandbox(t);
  writeFileSync(join(box.nginx, 'conf.d/company.conf'), overlayVhost);
  assertRefused(box.run(['--skip-deps']), /conf\.d\/company\.conf is the live company-site vhost/);

  const other = sandbox(t);
  writeFileSync(join(other.nginx, 'conf.d/hand-made.conf'), 'server {\n\tserver_name  www.violema.com;\n}\n');
  assertRefused(other.run(['--skip-deps']), /hand-made\.conf already serves violema\.com/);
});

test('overriding DOMAIN does not get a full deploy past the company vhost', t => {
  const box = sandbox(t);
  writeFileSync(vhostPath(box), overlayVhost);
  symlinkSync(vhostPath(box), enabledPath(box));
  assertRefused(box.run(['--skip-deps'], { DOMAIN: 'example.test' }), /live company-site vhost/);
});

test('without a company vhost the full deploy runs past the guard and rewrites its own legacy vhost', t => {
  for (const existing of [null, legacyVhost]) {
    const box = sandbox(t);
    writeFileSync(join(box.nginx, 'conf.d/unrelated.conf'), 'server { server_name violema.co *.violema.com; }\n');
    if (existing) {
      writeFileSync(vhostPath(box), existing);
      symlinkSync(vhostPath(box), enabledPath(box));
    }
    const result = box.run(['--skip-deps']);
    assert.equal(result.status, 0, result.stderr);
    const nginxCalls = result.commands.filter(c => /^(ln|rm|nginx|systemctl) /.test(c));
    assert.deepEqual(nginxCalls, [
      `ln -sf ${vhostPath(box)} ${enabledPath(box)}`,
      `rm -f ${join(box.nginx, 'sites-enabled/default')}`,
      `rm -f ${join(box.nginx, 'sites-enabled/nexus.purpleorange.io')}`,
      'nginx -t',
      'systemctl reload nginx',
      'systemctl reload nginx',
    ]);
    assert.ok(result.log.includes('frontend|npm run build'), 'the full deploy builds the frontend');
    assert.match(readFileSync(vhostPath(box), 'utf8'), /root .*\/frontend\/dist;/, 'bootstrap legacy vhost written in the sandbox');
  }
});

test('unknown options are rejected before anything runs', t => {
  const box = sandbox(t);
  const result = box.run(['--backend-onyl']);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Unknown option: --backend-onyl/);
  assert.deepEqual(result.commands, []);
});

const outsideBackend = ['nginx', 'systemctl', 'certbot', 'apt-get', 'chown', 'ln', 'rm', 'sed'];

test('--backend-only redeploys the backend and never touches nginx, the frontend or system packages', t => {
  const box = sandbox(t);
  writeFileSync(vhostPath(box), overlayVhost);
  const result = box.run(['--backend-only']);
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(result.commands.filter(c => !c.startsWith('git ')), [
    'npm ci --prefer-offline',
    'npx playwright install chromium',
    'npm run build',
    'pm2 describe violema-backend',
    `pm2 startOrReload ${join(box.app, 'deploy/ecosystem.config.cjs')} --only violema-backend --update-env`,
    'pm2 save',
    'curl -fsS --max-time 5 -o /dev/null http://127.0.0.1:3001/api/health',
  ]);
  assert.ok(result.commands.some(c => c.startsWith('git ') && c.endsWith(' reset --hard origin/main')), 'checkout synced to origin/main');
  assert.ok(result.log.filter(l => /\|(npm|npx) /.test(l)).every(l => l.startsWith('backend|')), 'npm only ran in backend/');
  for (const name of outsideBackend) assert.ok(!result.commands.some(c => c.startsWith(`${name} `)), `${name} not called`);
  assert.ok(!result.commands.some(c => c.includes('pm2 delete') || c.startsWith('pm2 start ')), 'no delete + start');
  assert.equal(readFileSync(vhostPath(box), 'utf8'), overlayVhost, 'vhost bytes unchanged');
  assert.ok(!existsSync(enabledPath(box)), 'nothing linked into sites-enabled');
});

test('--backend-only fails when the restarted backend never becomes healthy', t => {
  const box = sandbox(t, { exitCodes: { curl: 7 } });
  const result = box.run(['--backend-only', '--skip-deps']);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /did not answer http:\/\/127\.0\.0\.1:3001\/api\/health/);
  assert.equal(result.commands.filter(c => c.startsWith('curl ')).length, 2, 'retried HEALTH_ATTEMPTS times');
});

test('--backend-only fails closed when PM2 has no such process, instead of starting one', t => {
  const box = sandbox(t, { exitCodes: { pm2: 1 } });
  const result = box.run(['--backend-only', '--skip-deps']);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /PM2 has no process named violema-backend/);
  assert.deepEqual(result.commands.filter(c => c.startsWith('pm2 ')), ['pm2 describe violema-backend']);
  assert.ok(!result.commands.some(c => c.startsWith('curl ')), 'no health probe after a failed restart');
});

const installs = result => result.log.filter(l => l === 'backend|npm ci --prefer-offline').length;
const stampPath = box => join(box.app, 'backend/node_modules/.violema-deploy-lock.sha256');

test('--skip-deps still installs when package-lock.json changed, and skips only when it did not', t => {
  const box = sandbox(t);
  mkdirSync(join(box.app, 'backend/node_modules'));  // today's VPS: node_modules, no stamp
  const first = box.run(['--backend-only', '--skip-deps']);
  assert.equal(first.status, 0, first.stderr);
  assert.equal(installs(first), 1, 'an unstamped node_modules is not trusted');
  assert.match(first.stdout, /no install stamp yet/);
  assert.ok(existsSync(stampPath(box)), 'stamp written after a good install');

  const unchanged = box.run(['--backend-only', '--skip-deps']);
  assert.equal(unchanged.status, 0, unchanged.stderr);
  assert.equal(installs(unchanged), 0);
  assert.ok(!unchanged.commands.some(c => c.startsWith('npx playwright')), 'no browser install on a skip');
  assert.ok(unchanged.commands.includes('npm run build'));

  writeFileSync(join(box.app, 'backend/package-lock.json'), '{"lockfileVersion":3,"packages":{"node_modules/qs":{"version":"6.14.1"}}}\n');
  const changed = box.run(['--backend-only', '--skip-deps']);
  assert.equal(changed.status, 0, changed.stderr);
  assert.equal(installs(changed), 1, 'a lockfile-only fix installs under --skip-deps');
  assert.match(changed.stdout, /package-lock\.json changed since the last install/);
});

test('an empty stamp never matches an unhashable lockfile', t => {
  const box = sandbox(t);
  mkdirSync(join(box.app, 'backend/node_modules'));
  writeFileSync(stampPath(box), '');
  rmSync(join(box.app, 'backend/package-lock.json'));
  const result = box.run(['--backend-only', '--skip-deps']);
  assert.equal(installs(result), 1, 'treated as "install", not as a match');
  assert.notEqual(result.status, 0, 'no lockfile hash, so nothing is stamped and the deploy stops');
  assert.match(result.stderr, /Could not hash/);
  assert.ok(!result.commands.some(c => c.startsWith('pm2 ')), 'backend not restarted');
});

test('without --skip-deps the backend always installs', t => {
  const box = sandbox(t);
  box.run(['--backend-only']);
  const again = box.run(['--backend-only']);
  assert.equal(again.status, 0, again.stderr);
  assert.equal(installs(again), 1);
});

test('a failed install leaves no stamp, so the next --skip-deps run retries it', t => {
  for (const failing of ['npm', 'npx']) {
    const box = sandbox(t, { exitCodes: { [failing]: 1 } });
    mkdirSync(join(box.app, 'backend/node_modules'));
    const result = box.run(['--backend-only', '--skip-deps']);
    assert.notEqual(result.status, 0, `${failing} failure aborts the deploy`);
    assert.ok(!existsSync(stampPath(box)), `no stamp after a failed ${failing}`);
    assert.ok(!result.commands.some(c => c.startsWith('pm2 ')), 'backend not restarted');
  }
});
