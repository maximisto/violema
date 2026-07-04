import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';

test('stores, masks, reads, and clears workspace integration credentials', async () => {
  const originalCwd = process.cwd();
  const tempDir = mkdtempSync(path.join(tmpdir(), 'violema-settings-'));

  process.env.WORKSPACE_SETTINGS_SECRET = 'test-settings-secret';
  process.env.GITHUB_TOKEN = '';

  try {
    process.chdir(tempDir);
    const settings = await import('../src/settingsStore');

    settings.upsertWorkspaceSettings({
      workspaceId: 'workspace-integrations-test',
      integrationCredentials: {
        github: {
          token: 'ghp_test_1234567890abcdef',
        },
        stripe: {
          secretKey: 'sk_test_1234567890abcdef',
        },
      },
    });

    const view = settings.getWorkspaceSettingsView('workspace-integrations-test');

    assert.equal(view.integrations.github.workspaceConfigured, true);
    assert.equal(view.integrations.github.activeSource, 'workspace_credentials');
    assert.equal(view.integrations.github.fields.token.configured, true);
    assert.notEqual(view.integrations.github.fields.token.maskedValue, 'ghp_test_1234567890abcdef');
    assert.match(view.integrations.github.fields.token.maskedValue || '', /^ghp_.*cdef$/);

    assert.equal(
      settings.getWorkspaceIntegrationCredential('workspace-integrations-test', 'github', 'token'),
      'ghp_test_1234567890abcdef',
    );
    assert.equal(
      settings.getWorkspaceIntegrationCredential('workspace-integrations-test', 'stripe', 'secretKey'),
      'sk_test_1234567890abcdef',
    );
    assert.equal(view.integrations.gmail.configured, false);
    assert.equal(view.integrations.gmail.activeSource, 'none');
    assert.deepEqual(Object.keys(view.integrations.gmail.fields), []);

    settings.upsertWorkspaceSettings({
      workspaceId: 'workspace-integrations-test',
      integrationCredentials: {
        github: null,
      },
    });

    const cleared = settings.getWorkspaceSettingsView('workspace-integrations-test');
    assert.equal(cleared.integrations.github.workspaceConfigured, false);
    assert.equal(settings.getWorkspaceIntegrationCredential('workspace-integrations-test', 'github', 'token'), undefined);
    assert.equal(
      settings.getWorkspaceIntegrationCredential('workspace-integrations-test', 'stripe', 'secretKey'),
      'sk_test_1234567890abcdef',
    );
  } finally {
    process.chdir(originalCwd);
    rmSync(tempDir, { recursive: true, force: true });
  }
});
