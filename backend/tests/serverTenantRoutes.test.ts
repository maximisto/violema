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
  const originalApproved = process.env.VIOLEMA_APPROVED_EMAILS;
  const originalDisableScheduler = process.env.VIOLEMA_DISABLE_AUTOMATION_SCHEDULER;
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'violema-server-tenant-'));

  process.chdir(tempDir);
  process.env.VIOLEMA_APPROVED_EMAILS = 'alice@example.com,bob@example.com';
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

test('tenant routes reject valid sessions selecting another user workspace', async () => withTempServer(async ({ baseUrl }) => {
  const auth = await import('../src/auth');
  const store = await import('../src/platform/store');
  const scheduler = await import('../src/scheduler');

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
  const aliceSession = auth.createAuthSession(alice.id);
  const bobSession = auth.createAuthSession(bob.id);

  const bobTask = store.createTask({
    workspaceId: bob.defaultWorkspaceId,
    title: 'Bob private task',
    description: 'Tenant-isolated work item',
    kind: 'automation',
    priority: 'medium',
    autonomyMode: 'supervised',
    assigneeRole: 'operator',
  });
  const bobAutomation = scheduler.createAutomation({
    workspaceId: bob.defaultWorkspaceId,
    name: 'Bob private automation',
    schedule: 'daily at 9am',
    actions: ['Summarize Bob-only data'],
  }, async () => ({ ok: true }));

  const aliceHeaders = {
    cookie: `violema_session=${aliceSession.token}`,
  };
  const bobHeaders = {
    cookie: `violema_session=${bobSession.token}`,
  };
  const protectedPaths = [
    '/api/settings',
    '/api/platform/tasks',
    '/api/automations',
    '/api/billing/config',
  ];

  for (const apiPath of protectedPaths) {
    const response = await fetch(`${baseUrl}${apiPath}`, {
      headers: {
        ...aliceHeaders,
        'X-Workspace-Id': bob.defaultWorkspaceId,
      },
    });
    assert.equal(response.status, 403, `${apiPath} should reject cross-tenant workspace selection`);
    const payload = await readJson(response);
    assert.match(String(payload.error), /Workspace access denied/);
  }

  const aliceTasks = await fetch(`${baseUrl}/api/platform/tasks`, { headers: aliceHeaders });
  assert.equal(aliceTasks.status, 200);
  assert.deepEqual((await readJson(aliceTasks)).items, []);

  const bobTasks = await fetch(`${baseUrl}/api/platform/tasks`, { headers: bobHeaders });
  assert.equal(bobTasks.status, 200);
  const bobTaskPayload = await readJson(bobTasks);
  assert.deepEqual(
    (bobTaskPayload.items as Array<{ id: string }>).map((item) => item.id),
    [bobTask.id],
  );

  const bobAutomations = await fetch(`${baseUrl}/api/automations`, { headers: bobHeaders });
  assert.equal(bobAutomations.status, 200);
  const bobAutomationPayload = await readJson(bobAutomations);
  assert.deepEqual(
    (bobAutomationPayload.items as Array<{ id: string }>).map((item) => item.id),
    [bobAutomation.id],
  );

  const aliceCreatedAutomation = await fetch(`${baseUrl}/api/automations`, {
    method: 'POST',
    headers: {
      ...aliceHeaders,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: 'Alice owned automation',
      schedule: 'daily at 11am',
      actions: ['Summarize Alice-only data'],
    }),
  });
  assert.equal(aliceCreatedAutomation.status, 201);
  const aliceCreatedPayload = await readJson(aliceCreatedAutomation);
  assert.equal((aliceCreatedPayload.item as { owner_user_id?: string }).owner_user_id, alice.id);
}));
