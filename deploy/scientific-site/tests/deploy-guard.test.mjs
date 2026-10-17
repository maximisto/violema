// deploy/deploy.sh must never rewrite the live company-site vhost. These tests run
// the real script against a temporary APP_DIR and NGINX_DIR with every external
// command (git, npm, npx, pm2, curl, nginx, systemctl, certbot, apt-get, chown)
// replaced by a stub that only records its arguments. Nothing touches /etc,
// a package manager, PM2 or the network.
import test from 'node:test';
import assert from 'node:assert/strict';
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const repo = resolve(fileURLToPath(new URL('../../..', import.meta.url)));
const script = join(repo, 'deploy/deploy.sh');
const stubbed = ['git', 'npm', 'npx', 'pm2', 'curl', 'nginx', 'systemctl', 'certbot', 'apt-get', 'chown'];
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

function sandbox(t) {
  const root = mkdtempSync(join(tmpdir(), 'violema-deploy-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const dirs = { bin: join(root, 'bin'), app: join(root, 'app'), nginx: join(root, 'nginx'), log: join(root, 'log') };
  for (const dir of [dirs.bin, join(dirs.app, '.git'), join(dirs.app, 'backend'), join(dirs.app, 'frontend'),
    join(dirs.nginx, 'sites-available'), join(dirs.nginx, 'sites-enabled')]) mkdirSync(dir, { recursive: true });
  writeFileSync(join(dirs.app, 'backend/.env'), 'PORT=3001\n');
  writeFileSync(join(dirs.app, 'backend/package-lock.json'), '{"lockfileVersion":3}\n');
  writeFileSync(join(dirs.app, 'frontend/package-lock.json'), '{"lockfileVersion":3}\n');
  const calls = join(root, 'calls.log');
  for (const name of stubbed) {
    // `npm ci` creates node_modules so the stamp logic sees a real install.
    const extra = name === 'npm' ? '[ "$1" = ci ] && mkdir -p node_modules\n' : '';
    const stub = join(dirs.bin, name);
    writeFileSync(stub, `#!/bin/sh\nprintf '%s|%s\\n' "$(basename "$PWD")" "${name} $*" >> "${calls}"\n${extra}exit 0\n`);
    chmodSync(stub, 0o755);
  }
  const run = (...args) => {
    rmSync(calls, { force: true });
    const result = spawnSync('bash', [script, ...args], {
      encoding: 'utf8',
      env: { ...process.env, PATH: `${dirs.bin}:${process.env.PATH}`, APP_DIR: dirs.app, NGINX_DIR: dirs.nginx, LOG_DIR: dirs.log },
    });
    const log = existsSync(calls) ? readFileSync(calls, 'utf8').trim().split('\n').filter(Boolean) : [];
    return { ...result, log, commands: log.map(line => line.split('|')[1]) };
  };
  return { ...dirs, run };
}

const vhostPath = box => join(box.nginx, 'sites-available/violema.com');

test('deploy.sh parses', () => {
  assert.equal(spawnSync('bash', ['-n', script]).status, 0);
});

test('a full deploy refuses the live company vhost before running anything', t => {
  const box = sandbox(t);
  writeFileSync(vhostPath(box), overlayVhost);
  for (const args of [[], ['--skip-deps']]) {
    const result = box.run(...args);
    assert.notEqual(result.status, 0, `exit status for ${args.join(' ') || 'no flags'}`);
    assert.match(result.stderr, /live company-site vhost/);
    assert.match(result.stderr, /--backend-only/);
    assert.deepEqual(result.commands, [], 'no package, git, build, nginx or PM2 command ran');
    assert.equal(readFileSync(vhostPath(box), 'utf8'), overlayVhost, 'vhost bytes unchanged');
  }
});

test('the guard follows sites-enabled and recognises the company root without markers', t => {
  const box = sandbox(t);
  const elsewhere = join(box.nginx, 'company.conf');
  writeFileSync(elsewhere, 'server { root /var/www/violema-science/current; }\n');
  symlinkSync(elsewhere, join(box.nginx, 'sites-enabled/violema.com'));
  const result = box.run('--skip-deps');
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /\/var\/www\/violema-science/);
  assert.deepEqual(result.commands, []);
});

test('unknown options are rejected before anything runs', t => {
  const box = sandbox(t);
  const result = box.run('--backend-onyl');
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Unknown option: --backend-onyl/);
  assert.deepEqual(result.commands, []);
});
