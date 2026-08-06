import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

// WORKSPACES_FILE binds to process.cwd() at import, so claim a temp dir first.
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'violema-business-context-store-'));
process.chdir(tempDir);

test('setBusinessContext persists and getBusinessContext round-trips', async () => {
  const workspace = await import('../src/platform/workspace');

  assert.equal(workspace.getBusinessContext('workspace_test_espresso'), null);

  const result = workspace.setBusinessContext(
    'workspace_test_espresso',
    {
      summary: 'An AI-powered espresso machine company.',
      marketKeywords: ['AI-powered espresso machine'],
      competitors: ['decenttespresso.com'],
    },
    'user_123',
  );
  assert.ok(result.ok);

  const ctx = workspace.getBusinessContext('workspace_test_espresso');
  assert.ok(ctx);
  assert.equal(ctx.summary, 'An AI-powered espresso machine company.');
  assert.equal(ctx.updatedBy, 'user_123');
  assert.ok(Date.parse(ctx.updatedAt) > 0);
});

test('setBusinessContext rejects invalid input without writing', async () => {
  const workspace = await import('../src/platform/workspace');
  const result = workspace.setBusinessContext('workspace_test_invalid', {
    summary: '',
    marketKeywords: [],
  });
  assert.equal(result.ok, false);
  if (!result.ok) assert.ok(result.errors.length >= 1);
  assert.equal(workspace.getBusinessContext('workspace_test_invalid'), null);
});

test('getBusinessContext never creates a workspace profile (no write-on-read)', async () => {
  const workspace = await import('../src/platform/workspace');
  workspace.getBusinessContext('workspace_never_written');
  assert.ok(
    !workspace.listWorkspaces().some((item) => item.id === 'workspace_never_written'),
    'a read must not mint a profile',
  );
});
