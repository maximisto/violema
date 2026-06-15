import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import test from 'node:test';

function requireModuleWithin(modulePath: string, timeoutMs: number) {
  const result = spawnSync(
    process.execPath,
    [
      '-e',
      [
        'const started = Date.now();',
        `require(${JSON.stringify(modulePath)});`,
        "process.stdout.write(String(Date.now() - started));",
      ].join(' '),
    ],
    {
      cwd: process.cwd(),
      encoding: 'utf8',
      env: {
        ...process.env,
        ANTHROPIC_API_KEY: '',
        COMPOSIO_API_KEY: '',
        STRIPE_SECRET_KEY: '',
      },
      timeout: timeoutMs,
    }
  );

  assert.ifError(result.error);
  assert.equal(result.status, 0, result.stderr);
  const elapsedMs = Number(result.stdout.trim());
  assert.ok(Number.isFinite(elapsedMs), `Expected elapsed time, got "${result.stdout}".`);
  assert.ok(elapsedMs < timeoutMs, `Expected ${modulePath} to load under ${timeoutMs}ms, took ${elapsedMs}ms.`);
}

test('backend cold-path modules do not import heavyweight SDKs during startup', () => {
  const backendRoot = process.cwd();

  for (const modulePath of [
    path.join(backendRoot, 'dist/models.js'),
    path.join(backendRoot, 'dist/tools/browserScreenshot.js'),
    path.join(backendRoot, 'dist/platform/index.js'),
  ]) {
    requireModuleWithin(modulePath, 2500);
  }
});
