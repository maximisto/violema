import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

type TestServerContext = {
  baseUrl: string;
  workspaceId: string;
  modelRequestCount: () => number;
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

async function startAlwaysToolCallingModelServer() {
  let requestCount = 0;
  const server = http.createServer((req, res) => {
    if (req.method !== 'POST' || req.url !== '/chat/completions') {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: { message: 'not found' } }));
      return;
    }

    requestCount += 1;
    req.resume();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      choices: [
        {
          finish_reason: 'tool_calls',
          message: {
            role: 'assistant',
            content: null,
            tool_calls: [
              {
                id: `call_${requestCount}`,
                type: 'function',
                function: {
                  name: 'generate_report',
                  arguments: JSON.stringify({
                    report_type: 'status',
                    title: `Mock loop report ${requestCount}`,
                  }),
                },
              },
            ],
          },
        },
      ],
    }));
  });

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Mock model server did not bind to a port.');

  return {
    server,
    baseUrl: `http://127.0.0.1:${address.port}`,
    requestCount: () => requestCount,
  };
}

async function withTempChatServer(run: (context: TestServerContext) => Promise<void>) {
  const originalCwd = process.cwd();
  const originalEnv = {
    approved: process.env.VIOLEMA_APPROVED_EMAILS,
    disableScheduler: process.env.VIOLEMA_DISABLE_AUTOMATION_SCHEDULER,
    maxToolIterations: process.env.MAX_TOOL_ITERATIONS,
    defaultProvider: process.env.MODEL_DEFAULT_PROVIDER,
    defaultModel: process.env.MODEL_DEFAULT_MODEL,
    defaultApiKeyEnv: process.env.MODEL_DEFAULT_API_KEY_ENV,
    defaultBaseUrl: process.env.MODEL_DEFAULT_BASE_URL,
    openaiApiKey: process.env.OPENAI_API_KEY,
    retryDelays: process.env.MODEL_RETRY_DELAYS_MS,
  };
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'violema-server-chat-'));
  const mockModel = await startAlwaysToolCallingModelServer();

  process.chdir(tempDir);
  process.env.VIOLEMA_APPROVED_EMAILS = 'chat-user@example.com';
  process.env.VIOLEMA_DISABLE_AUTOMATION_SCHEDULER = '1';
  process.env.MAX_TOOL_ITERATIONS = '2';
  process.env.MODEL_DEFAULT_PROVIDER = 'openai';
  process.env.MODEL_DEFAULT_MODEL = 'mock-tool-loop';
  process.env.MODEL_DEFAULT_API_KEY_ENV = 'OPENAI_API_KEY';
  process.env.MODEL_DEFAULT_BASE_URL = mockModel.baseUrl;
  process.env.OPENAI_API_KEY = 'test-openai-key';
  process.env.MODEL_RETRY_DELAYS_MS = '0';

  let server: http.Server | null = null;

  try {
    const { default: app } = await import('../src/server');
    const auth = await import('../src/auth');
    const user = auth.upsertAuthUser({
      email: 'chat-user@example.com',
      name: 'Chat User',
      role: 'user',
      method: 'email',
      acceptedTerms: true,
      acceptedEducation: true,
    });
    const session = auth.createAuthSession(user.id);

    server = await new Promise<http.Server>((resolve) => {
      const listening = app.listen(0, () => resolve(listening));
    });
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('Test server did not bind to a port.');

    await run({
      baseUrl: `http://127.0.0.1:${address.port}`,
      workspaceId: user.defaultWorkspaceId,
      modelRequestCount: mockModel.requestCount,
    });

    await closeServer(server);
    server = null;
    auth.clearAuthSession(session.token);
  } finally {
    await closeServer(server);
    await closeServer(mockModel.server);
    process.chdir(originalCwd);
    if (typeof originalEnv.approved === 'string') process.env.VIOLEMA_APPROVED_EMAILS = originalEnv.approved;
    else delete process.env.VIOLEMA_APPROVED_EMAILS;
    if (typeof originalEnv.disableScheduler === 'string') process.env.VIOLEMA_DISABLE_AUTOMATION_SCHEDULER = originalEnv.disableScheduler;
    else delete process.env.VIOLEMA_DISABLE_AUTOMATION_SCHEDULER;
    if (typeof originalEnv.maxToolIterations === 'string') process.env.MAX_TOOL_ITERATIONS = originalEnv.maxToolIterations;
    else delete process.env.MAX_TOOL_ITERATIONS;
    if (typeof originalEnv.defaultProvider === 'string') process.env.MODEL_DEFAULT_PROVIDER = originalEnv.defaultProvider;
    else delete process.env.MODEL_DEFAULT_PROVIDER;
    if (typeof originalEnv.defaultModel === 'string') process.env.MODEL_DEFAULT_MODEL = originalEnv.defaultModel;
    else delete process.env.MODEL_DEFAULT_MODEL;
    if (typeof originalEnv.defaultApiKeyEnv === 'string') process.env.MODEL_DEFAULT_API_KEY_ENV = originalEnv.defaultApiKeyEnv;
    else delete process.env.MODEL_DEFAULT_API_KEY_ENV;
    if (typeof originalEnv.defaultBaseUrl === 'string') process.env.MODEL_DEFAULT_BASE_URL = originalEnv.defaultBaseUrl;
    else delete process.env.MODEL_DEFAULT_BASE_URL;
    if (typeof originalEnv.openaiApiKey === 'string') process.env.OPENAI_API_KEY = originalEnv.openaiApiKey;
    else delete process.env.OPENAI_API_KEY;
    if (typeof originalEnv.retryDelays === 'string') process.env.MODEL_RETRY_DELAYS_MS = originalEnv.retryDelays;
    else delete process.env.MODEL_RETRY_DELAYS_MS;
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

function parseSseEvents(body: string) {
  return body
    .split('\n\n')
    .map((chunk) => chunk.trim())
    .filter((chunk) => chunk.startsWith('data: '))
    .map((chunk) => JSON.parse(chunk.slice('data: '.length)) as Record<string, unknown>);
}

test('chat route caps concurrent always-tool-calling OpenAI loops and settles credit holds', async () => withTempChatServer(async ({ baseUrl, workspaceId, modelRequestCount }) => {
  const auth = await import('../src/auth');
  const store = await import('../src/platform/store');
  const session = auth.createAuthSession(auth.listAuthUsers()[0].id);

  const postChat = (suffix: string) => fetch(`${baseUrl}/api/chat`, {
    method: 'POST',
    headers: {
      cookie: `violema_session=${session.token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      modelProfile: 'default',
      autonomyMode: 'cautious',
      messages: [
        { role: 'user', content: `Keep calling the same tool forever for regression test ${suffix}.` },
      ],
    }),
  });

  const responses = await Promise.all([postChat('A'), postChat('B')]);
  assert.deepEqual(responses.map((response) => response.status), [200, 200]);
  const eventBatches = await Promise.all(responses.map(async (response) => parseSseEvents(await response.text())));
  assert.equal(modelRequestCount(), 4);
  for (const events of eventBatches) {
    assert.ok(events.some((event) => event.type === 'tool_loop_capped' && event.max_tool_iterations === 2));
    assert.ok(events.some((event) => event.type === 'done'));
  }

  const runs = store.listTaskRuns(workspaceId);
  assert.equal(runs.length, 2);
  assert.deepEqual(runs.map((run) => run.status), ['succeeded', 'succeeded']);
  assert.deepEqual(runs.map((run) => run.metadata?.capped), [true, true]);
  assert.deepEqual(runs.map((run) => run.metadata?.toolCallsExecuted), [2, 2]);

  const reserve = store.getWorkspaceCreditReserve(workspaceId);
  assert.equal(reserve.reservedCredits, 0);
  const ledger = store.listLedgerEntries(workspaceId);
  assert.equal(ledger.filter((entry) => entry.metadata?.holdStatus === 'settled' && entry.metadata?.toolCallsExecuted === 2).length, 2);
}));
