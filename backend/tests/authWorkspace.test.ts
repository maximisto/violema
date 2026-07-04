import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

test('auth users get server-owned workspaces and non-admins cannot select other workspaces', async () => {
  const originalCwd = process.cwd();
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'violema-auth-workspace-'));
  process.chdir(tempDir);

  try {
    const legacyUser = {
      id: 'user_legacy',
      email: 'legacy@example.com',
      name: 'Legacy User',
      role: 'user',
      method: 'email',
      acceptedTerms: true,
      acceptedEducation: true,
      createdAt: '2026-07-04T00:00:00.000Z',
      updatedAt: '2026-07-04T00:00:00.000Z',
    };
    fs.writeFileSync(path.join(tempDir, 'auth-users.json'), JSON.stringify([legacyUser], null, 2));

    const auth = await import('../src/auth');
    const [migratedLegacy] = auth.listAuthUsers();

    assert.match(migratedLegacy.defaultWorkspaceId, /^workspace_[a-f0-9]{16}$/);
    assert.deepEqual(migratedLegacy.workspaceIds, [migratedLegacy.defaultWorkspaceId]);
    assert.deepEqual(
      JSON.parse(fs.readFileSync(path.join(tempDir, 'auth-users.json'), 'utf-8'))[0].workspaceIds,
      [migratedLegacy.defaultWorkspaceId],
    );

    const alice = auth.upsertAuthUser({
      email: 'alice@example.com',
      name: 'Alice',
      role: 'user',
      method: 'email',
      acceptedTerms: true,
      acceptedEducation: true,
    });
    const bob = auth.upsertAuthUser({
      email: 'bob@example.com',
      name: 'Bob',
      role: 'user',
      method: 'email',
      acceptedTerms: true,
      acceptedEducation: true,
    });

    assert.notEqual(alice.defaultWorkspaceId, bob.defaultWorkspaceId);
    assert.equal(auth.canAuthUserAccessWorkspace(alice, alice.defaultWorkspaceId), true);
    assert.equal(auth.canAuthUserAccessWorkspace(alice, bob.defaultWorkspaceId), false);
    assert.throws(
      () => auth.assertAuthUserCanAccessWorkspace(alice, bob.defaultWorkspaceId),
      /Workspace access denied/,
    );

    const admin = auth.upsertAuthUser({
      email: 'max@violema.com',
      name: 'Max',
      role: 'admin',
      method: 'email',
      acceptedTerms: true,
      acceptedEducation: true,
    });

    assert.equal(admin.defaultWorkspaceId, 'purpleorangehq');
    assert.equal(auth.canAuthUserAccessWorkspace(admin, bob.defaultWorkspaceId), true);
  } finally {
    process.chdir(originalCwd);
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});
