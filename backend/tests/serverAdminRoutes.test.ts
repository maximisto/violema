import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

type TestServerContext = {
  baseUrl: string;
};

function closeServer(server: http.Server | null) {
  if (!server) return Promise.resolve();
  server.closeIdleConnections?.();
  server.closeAllConnections?.();
  if (!server.listening) return Promise.resolve();
  return new Promise<void>((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  });
}

async function withTempServer(run: (context: TestServerContext) => Promise<void>) {
  const originalCwd = process.cwd();
  const originalAdminEmails = process.env.ADMIN_EMAILS;
  const originalApproved = process.env.VIOLEMA_APPROVED_EMAILS;
  const originalDisableScheduler = process.env.VIOLEMA_DISABLE_AUTOMATION_SCHEDULER;
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'violema-server-admin-'));

  process.chdir(tempDir);
  process.env.ADMIN_EMAILS = 'admin@example.com';
  process.env.VIOLEMA_APPROVED_EMAILS = 'user@example.com,target@example.com';
  process.env.VIOLEMA_DISABLE_AUTOMATION_SCHEDULER = '1';

  let server: http.Server | null = null;

  try {
    const { default: app } = await import('../src/server');
    server = await new Promise<http.Server>((resolve) => {
      const listening = app.listen(0, () => resolve(listening));
    });
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('Test server did not bind to a port.');

    await run({
      baseUrl: `http://127.0.0.1:${address.port}`,
    });
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

async function readJson(response: Response) {
  return response.json() as Promise<Record<string, unknown>>;
}

test('admin routes require backend admin sessions and revoke target user sessions', async () => withTempServer(async ({ baseUrl }) => {
  const auth = await import('../src/auth');

  const admin = auth.upsertAuthUser({
    email: 'admin@example.com',
    name: 'Admin',
    role: 'admin',
    method: 'email',
    acceptedTerms: true,
    acceptedEducation: true,
  });
  const user = auth.upsertAuthUser({
    email: 'user@example.com',
    name: 'Normal User',
    role: 'user',
    method: 'email',
    acceptedTerms: true,
    acceptedEducation: true,
  });
  const target = auth.upsertAuthUser({
    email: 'target@example.com',
    name: 'Target User',
    role: 'user',
    method: 'email',
    acceptedTerms: true,
    acceptedEducation: true,
  });

  const adminSession = auth.createAuthSession(admin.id);
  const userSession = auth.createAuthSession(user.id);
  const targetSession = auth.createAuthSession(target.id);
  const adminHeaders = { cookie: `violema_session=${adminSession.token}` };
  const userHeaders = { cookie: `violema_session=${userSession.token}` };
  const targetHeaders = { cookie: `violema_session=${targetSession.token}` };

  const anonymousAdmin = await fetch(`${baseUrl}/api/admin/users`);
  assert.equal(anonymousAdmin.status, 401);

  const userAdmin = await fetch(`${baseUrl}/api/admin/users`, { headers: userHeaders });
  assert.equal(userAdmin.status, 403);
  assert.match(String((await readJson(userAdmin)).error), /Admin access required/);

  const adminUsers = await fetch(`${baseUrl}/api/admin/users`, { headers: adminHeaders });
  assert.equal(adminUsers.status, 200);
  assert.ok(((await readJson(adminUsers)).items as Array<{ email: string }>).some((item) => item.email === 'target@example.com'));

  const revokeTarget = await fetch(`${baseUrl}/api/admin/users/target@example.com/access`, {
    method: 'PATCH',
    headers: {
      ...adminHeaders,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      status: 'revoked',
      note: 'Route-level revocation smoke test',
    }),
  });
  assert.equal(revokeTarget.status, 200);
  const revokePayload = await readJson(revokeTarget);
  assert.equal((revokePayload.record as { status?: string }).status, 'revoked');

  const revokedTargetWorkspace = await fetch(`${baseUrl}/api/workspace`, { headers: targetHeaders });
  assert.equal(revokedTargetWorkspace.status, 401);
}));
