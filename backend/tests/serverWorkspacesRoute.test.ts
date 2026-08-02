import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

const FIXTURE_ACCEPTED_AT = '2026-08-01T12:00:00.000Z';
const DEFAULT_WORKSPACE = 'purpleorangehq';

interface WorkspaceListItem {
  id: string;
  name: string;
  role: 'member' | 'admin';
  isDefault: boolean;
}

function closeServer(server: http.Server | null) {
  if (!server) return Promise.resolve();
  server.closeIdleConnections?.();
  server.closeAllConnections?.();
  if (!server.listening) return Promise.resolve();
  return new Promise<void>((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  });
}

async function withTempServer(run: (context: { baseUrl: string }) => Promise<void>) {
  const originalCwd = process.cwd();
  const originalAdminEmails = process.env.ADMIN_EMAILS;
  const originalApproved = process.env.VIOLEMA_APPROVED_EMAILS;
  const originalDisableScheduler = process.env.VIOLEMA_DISABLE_AUTOMATION_SCHEDULER;
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'violema-workspaces-route-'));

  process.chdir(tempDir);
  process.env.ADMIN_EMAILS = 'admin@example.com';
  process.env.VIOLEMA_APPROVED_EMAILS = 'member@example.com';
  process.env.VIOLEMA_DISABLE_AUTOMATION_SCHEDULER = '1';

  let server: http.Server | null = null;

  try {
    const { default: app } = await import('../src/server');
    server = await new Promise<http.Server>((resolve) => {
      const listening = app.listen(0, () => resolve(listening));
    });
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('Test server did not bind to a port.');

    await run({ baseUrl: `http://127.0.0.1:${address.port}` });
  } finally {
    await closeServer(server);
    process.chdir(originalCwd);
    if (typeof originalAdminEmails === 'string') process.env.ADMIN_EMAILS = originalAdminEmails;
    else delete process.env.ADMIN_EMAILS;
    if (typeof originalApproved === 'string') process.env.VIOLEMA_APPROVED_EMAILS = originalApproved;
    else delete process.env.VIOLEMA_APPROVED_EMAILS;
    if (typeof originalDisableScheduler === 'string') process.env.VIOLEMA_DISABLE_AUTOMATION_SCHEDULER = originalDisableScheduler;
    else delete process.env.VIOLEMA_DISABLE_AUTOMATION_SCHEDULER;
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

async function createMember(email = 'member@example.com') {
  const auth = await import('../src/auth');
  const consent = await import('../src/betaConsentStore');
  const betaProgram = await import('../src/betaProgram');

  consent.recordBetaConsent({
    email,
    participantType: 'founder_operator',
    termsVersion: betaProgram.CURRENT_BETA_TERMS_VERSION,
    termsDigest: betaProgram.CURRENT_BETA_TERMS_DIGEST,
    acceptedAt: FIXTURE_ACCEPTED_AT,
    authMethod: 'email',
    acceptanceSource: 'signup',
  });

  return auth.upsertAuthUser({
    email,
    name: 'Member',
    role: 'user',
    method: 'email',
    participantType: 'founder_operator',
    acceptedTerms: true,
    acceptedTermsVersion: betaProgram.CURRENT_BETA_TERMS_VERSION,
    acceptedTermsAt: FIXTURE_ACCEPTED_AT,
    acceptedEducation: true,
  });
}

test('the workspace switcher endpoint scopes workspaces to the session', async () =>
  withTempServer(async ({ baseUrl }) => {
    const auth = await import('../src/auth');

    // The route sits behind the standard beta gate.
    const anonymous = await fetch(`${baseUrl}/api/workspaces/mine`);
    assert.equal(anonymous.status, 401);

    const member = await createMember();
    const admin = auth.upsertAuthUser({
      email: 'admin@example.com',
      name: 'Admin',
      role: 'admin',
      method: 'email',
      participantType: 'founder_operator',
      acceptedTerms: true,
      acceptedEducation: true,
    });

    const memberSession = auth.createAuthSession(member.id);
    const adminSession = auth.createAuthSession(admin.id);

    const memberResponse = await fetch(`${baseUrl}/api/workspaces/mine`, {
      headers: { cookie: `violema_session=${memberSession.token}` },
    });
    assert.equal(memberResponse.status, 200);
    const memberBody = await memberResponse.json() as { items: WorkspaceListItem[] };

    // A member sees exactly their own workspace — never Violema's.
    assert.equal(memberBody.items.length, 1);
    const [memberWorkspace] = memberBody.items;
    assert.equal(memberWorkspace.id, member.defaultWorkspaceId);
    assert.equal(memberWorkspace.role, 'member');
    assert.equal(memberWorkspace.isDefault, true);
    assert.equal(typeof memberWorkspace.name, 'string');
    assert.ok(memberWorkspace.name.length > 0);
    assert.deepEqual(Object.keys(memberWorkspace).sort(), ['id', 'isDefault', 'name', 'role']);
    assert.ok(!memberBody.items.some((item) => item.id === DEFAULT_WORKSPACE));

    const adminResponse = await fetch(`${baseUrl}/api/workspaces/mine`, {
      headers: { cookie: `violema_session=${adminSession.token}` },
    });
    assert.equal(adminResponse.status, 200);
    const adminBody = await adminResponse.json() as { items: WorkspaceListItem[] };

    // An admin additionally operates Violema's own workspace.
    const adminIds = adminBody.items.map((item) => item.id);
    assert.ok(adminIds.includes(DEFAULT_WORKSPACE));
    assert.ok(adminBody.items.every((item) => item.role === 'admin'));
    const adminDefault = adminBody.items.find((item) => item.isDefault);
    assert.equal(adminDefault?.id, admin.defaultWorkspaceId);
    // Being allowed to access any workspace is not the same as listing them:
    // the switcher must not enumerate the member's private workspace.
    assert.ok(!adminIds.includes(member.defaultWorkspaceId));
  }));

test('the workspace switcher endpoint ignores workspace context headers', async () =>
  withTempServer(async ({ baseUrl }) => {
    const auth = await import('../src/auth');
    const workspace = await import('../src/platform/workspace');

    const member = await createMember();
    const session = auth.createAuthSession(member.id);
    const workspaceCountBefore = workspace.listWorkspaces().length;

    // Asking to act as another workspace cannot widen or change the answer.
    const response = await fetch(`${baseUrl}/api/workspaces/mine`, {
      headers: {
        cookie: `violema_session=${session.token}`,
        'X-Workspace-Id': DEFAULT_WORKSPACE,
      },
    });

    assert.equal(response.status, 200);
    const body = await response.json() as { items: WorkspaceListItem[] };
    assert.deepEqual(body.items.map((item) => item.id), [member.defaultWorkspaceId]);

    // And listing is read-only: no profile was created as a side effect of a GET.
    assert.equal(workspace.listWorkspaces().length, workspaceCountBefore);
  }));

test('the workspace switcher endpoint reports stored profile names', async () =>
  withTempServer(async ({ baseUrl }) => {
    const auth = await import('../src/auth');
    const workspace = await import('../src/platform/workspace');

    const member = await createMember();
    workspace.upsertWorkspaceProfile(member.defaultWorkspaceId, { name: 'Acme Co' });
    const session = auth.createAuthSession(member.id);

    const response = await fetch(`${baseUrl}/api/workspaces/mine`, {
      headers: { cookie: `violema_session=${session.token}` },
    });

    const body = await response.json() as { items: WorkspaceListItem[] };
    assert.equal(body.items[0].name, 'Acme Co');
  }));
