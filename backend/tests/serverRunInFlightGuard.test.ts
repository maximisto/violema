import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import type { PersistedAutomationStep } from '../src/platform/types';

/**
 * The in-flight run guard on manual triggers.
 *
 * Production 2026-08-04: the Run button fired twice (19:40:02 and 19:40:17),
 * both requests were accepted, and the second draft superseded the first —
 * double the spend for one intended run. The guard answers the second click
 * with the run that already exists instead of starting another.
 */

const CHECK_STRIPE_STEPS: PersistedAutomationStep[] = [
  {
    id: 'step_stripe_revenue',
    kind: 'query',
    title: 'Check Stripe revenue',
    objective: 'Pull revenue signals from Stripe.',
    inputs: { source: 'stripe', query_type: 'revenue_summary' },
  },
];

type TestServerContext = {
  baseUrl: string;
  sessionToken: string;
  workspaceId: string;
  automationId: string;
  store: typeof import('../src/platform/store');
};

function closeServer(server: http.Server | null) {
  if (!server) return Promise.resolve();
  server.closeIdleConnections?.();
  server.closeAllConnections?.();
  if (!server.listening) return Promise.resolve();
  return new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}

async function withGuardServer(run: (context: TestServerContext) => Promise<void>) {
  const originalCwd = process.cwd();
  const originalApproved = process.env.VIOLEMA_APPROVED_EMAILS;
  const originalDisableScheduler = process.env.VIOLEMA_DISABLE_AUTOMATION_SCHEDULER;
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'violema-run-inflight-guard-'));

  process.chdir(tempDir);
  process.env.VIOLEMA_APPROVED_EMAILS = 'qa@example.com';
  process.env.VIOLEMA_DISABLE_AUTOMATION_SCHEDULER = '1';

  let server: http.Server | null = null;

  try {
    const serverModule = await import('../src/server');
    const auth = await import('../src/auth');
    const consent = await import('../src/betaConsentStore');
    const betaProgram = await import('../src/betaProgram');
    const scheduler = await import('../src/scheduler');
    const store = await import('../src/platform/store');
    const acceptedAt = '2026-07-11T12:01:00.000Z';

    consent.recordBetaConsent({
      email: 'qa@example.com',
      participantType: 'founder_operator',
      termsVersion: betaProgram.CURRENT_BETA_TERMS_VERSION,
      termsDigest: betaProgram.CURRENT_BETA_TERMS_DIGEST,
      acceptedAt,
      authMethod: 'email',
      acceptanceSource: 'signup',
    });

    const user = auth.upsertAuthUser({
      email: 'qa@example.com',
      name: 'QA Operator',
      role: 'admin',
      method: 'email',
      participantType: 'founder_operator',
      acceptedTerms: true,
      acceptedTermsVersion: betaProgram.CURRENT_BETA_TERMS_VERSION,
      acceptedTermsAt: acceptedAt,
      acceptedEducation: true,
    });
    const session = auth.createAuthSession(user.id);

    // Stripe is deliberately unconfigured, so a fall-through past the
    // in-flight guard is observable as `workflow_not_ready` — the two 409
    // codes distinguish which gate answered.
    const automation = scheduler.createAutomation(
      {
        workspaceId: user.defaultWorkspaceId,
        owner_user_id: user.id,
        name: 'QA revenue watch',
        schedule: 'every monday at 9am',
        actions: ['Check Stripe revenue'],
        steps: CHECK_STRIPE_STEPS,
        notify: '#violema-demo',
      },
      async () => ({ ok: true }),
    );

    server = await new Promise<http.Server>((resolve) => {
      const listening = serverModule.default.listen(0, () => resolve(listening));
    });
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('Test server did not bind to a port.');

    await run({
      baseUrl: `http://127.0.0.1:${address.port}`,
      sessionToken: session.token,
      workspaceId: user.defaultWorkspaceId,
      automationId: automation.id,
      store,
    });

    auth.clearAuthSession(session.token);
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

function authHeaders(sessionToken: string) {
  return {
    cookie: `violema_session=${sessionToken}`,
    'Content-Type': 'application/json',
  };
}

function seedRun(
  store: TestServerContext['store'],
  input: { workspaceId: string; automationId: string; status?: 'running' | 'succeeded' },
) {
  const task = store.createTask({
    workspaceId: input.workspaceId,
    title: 'QA revenue watch',
    kind: 'automation',
    priority: 'medium',
    metadata: { automationId: input.automationId },
  });
  const run = store.createTaskRun({
    workspaceId: input.workspaceId,
    taskId: task.id,
    agentRole: 'analyst',
    modelTier: 'default',
    estimatedCredits: 10,
    metadata: { automationId: input.automationId },
  });
  if (input.status === 'succeeded') {
    store.finalizeTaskRun(run.id, { status: 'succeeded' });
  }
  return run;
}

test('a second manual run while one is in flight answers 409 run_already_in_progress and starts nothing', async () =>
  withGuardServer(async ({ baseUrl, sessionToken, automationId, workspaceId, store }) => {
    const inFlight = seedRun(store, { workspaceId, automationId });
    const runsBefore = store.listTaskRuns(workspaceId).length;

    const response = await fetch(`${baseUrl}/api/automations/${automationId}/run`, {
      method: 'POST',
      headers: authHeaders(sessionToken),
    });
    const payload = await response.json() as Record<string, unknown>;

    assert.equal(response.status, 409);
    assert.equal(payload.code, 'run_already_in_progress');
    assert.equal(payload.ok, false);
    assert.equal(payload.runId, inFlight.id);
    assert.match(String(payload.message), /already running/i);
    // The dashboard flattens an error body to `error` first — both carry it.
    assert.equal(payload.error, payload.message);
    assert.equal(store.listTaskRuns(workspaceId).length, runsBefore);
  }));

test('a finished run does not block the next manual trigger — the request falls through to readiness', async () =>
  withGuardServer(async ({ baseUrl, sessionToken, automationId, workspaceId, store }) => {
    seedRun(store, { workspaceId, automationId, status: 'succeeded' });

    const response = await fetch(`${baseUrl}/api/automations/${automationId}/run`, {
      method: 'POST',
      headers: authHeaders(sessionToken),
    });
    const payload = await response.json() as Record<string, unknown>;

    // Fell past the in-flight guard: the answer is the readiness gate's, not ours.
    assert.equal(response.status, 409);
    assert.equal(payload.code, 'workflow_not_ready');
  }));

test('an in-flight run for a different automation does not block', async () =>
  withGuardServer(async ({ baseUrl, sessionToken, automationId, workspaceId, store }) => {
    seedRun(store, { workspaceId, automationId: 'auto_someone_else' });

    const response = await fetch(`${baseUrl}/api/automations/${automationId}/run`, {
      method: 'POST',
      headers: authHeaders(sessionToken),
    });
    const payload = await response.json() as Record<string, unknown>;

    assert.equal(response.status, 409);
    assert.equal(payload.code, 'workflow_not_ready');
  }));
