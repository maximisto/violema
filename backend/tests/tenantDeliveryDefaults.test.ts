import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test, { after } from 'node:test';

// The workspace store resolves its file path from process.cwd() at import time,
// so the temp cwd has to be in place before any platform module loads.
const originalCwd = process.cwd();
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'violema-tenant-delivery-'));
process.chdir(tempDir);

const FIXTURE_TIMESTAMP = '2026-08-01T12:00:00.000Z';
const DEFAULT_WORKSPACE = 'purpleorangehq';
const TENANT_WORKSPACE = 'workspace_tenant_a';
const DEMO_WORKSPACE = 'workspace_demo_b';

/** A tenant that connected its own Stripe account. */
const TENANT_OWN_STRIPE = {
  integrations: { stripe: { configured: true, workspaceConfigured: true } },
};
/** A workspace where only Violema's env STRIPE_SECRET_KEY is set. */
const SERVER_ONLY_STRIPE = {
  integrations: {
    stripe: { configured: true, workspaceConfigured: false, serverConfigured: true },
  },
};

after(() => {
  process.chdir(originalCwd);
  fs.rmSync(tempDir, { recursive: true, force: true });
});

function writeWorkspaces(items: Array<Record<string, unknown>>) {
  fs.writeFileSync(path.join(tempDir, 'platform-workspaces.json'), JSON.stringify(items, null, 2));
}

function workspaceFixture(
  id: string,
  extra: { ownerEmail?: string; metadata?: Record<string, unknown> } = {},
) {
  return {
    id,
    slug: id.replace(/_/g, '-'),
    name: `Workspace ${id}`,
    createdAt: FIXTURE_TIMESTAMP,
    updatedAt: FIXTURE_TIMESTAMP,
    ...(extra.ownerEmail ? { ownerEmail: extra.ownerEmail } : {}),
    ...(extra.metadata ? { metadata: extra.metadata } : {}),
  };
}

test('a tenant workflow defaults to delivering at the workspace owner', async () => {
  writeWorkspaces([workspaceFixture(TENANT_WORKSPACE, { ownerEmail: 'founder@example.com' })]);
  const { checkWorkflowReadiness } = await import('../src/integrationGateway/workflowReadiness');

  const report = checkWorkflowReadiness({
    workflowId: 'revenue-watch',
    workspaceId: TENANT_WORKSPACE,
    settingsView: TENANT_OWN_STRIPE,
  });

  // Not '#violema-demo' — that is Violema's own channel, and a tenant has no
  // Slack story until they connect one.
  assert.equal(report.deliveryTarget, 'founder@example.com');
  assert.equal(report.ready, true);
  assert.deepEqual(report.blockers, []);
});

test('a tenant with no owner on file is asked for a destination, not defaulted', async () => {
  writeWorkspaces([workspaceFixture(TENANT_WORKSPACE)]);
  const { checkWorkflowReadiness } = await import('../src/integrationGateway/workflowReadiness');

  const report = checkWorkflowReadiness({
    workflowId: 'revenue-watch',
    workspaceId: TENANT_WORKSPACE,
    settingsView: TENANT_OWN_STRIPE,
  });

  assert.equal(report.deliveryTarget, null);
  assert.equal(report.ready, false);
  const blocker = report.blockers.find((item) => item.key === 'delivery_target');
  assert.ok(blocker, 'a missing destination must be an honest ask');
  assert.equal(blocker.route, '/integrations?provider=slack');
  // It must never silently fall back to one of our channels.
  assert.doesNotMatch(JSON.stringify(report), /violema-demo/);
});

test('a tenant weekly founder update is also blocked without a destination', async () => {
  writeWorkspaces([workspaceFixture(TENANT_WORKSPACE)]);
  const { checkWorkflowReadiness } = await import('../src/integrationGateway/workflowReadiness');

  const report = checkWorkflowReadiness({
    workflowId: 'weekly-founder-update',
    workspaceId: TENANT_WORKSPACE,
    settingsView: TENANT_OWN_STRIPE,
    runtimeStatus: {
      github: { ready: true },
      linear: { ready: true },
      email: { ready: true },
      calendar: { ready: true },
      google_drive: { ready: true },
      tavily: { ready: true },
      slack: { ready: true },
      postmark: { ready: true },
    },
  });

  assert.equal(report.deliveryTarget, null);
  assert.ok(report.blockers.some((item) => item.key === 'delivery_target'));
});

test('a tenant delivering by email is not blocked on a Slack connection', async () => {
  writeWorkspaces([workspaceFixture(TENANT_WORKSPACE, { ownerEmail: 'founder@example.com' })]);
  const { checkWorkflowReadiness } = await import('../src/integrationGateway/workflowReadiness');

  const report = checkWorkflowReadiness({
    workflowId: 'weekly-founder-update',
    workspaceId: TENANT_WORKSPACE,
    settingsView: TENANT_OWN_STRIPE,
    runtimeStatus: {
      github: { ready: true },
      linear: { ready: true },
      email: { ready: true },
      calendar: { ready: true },
      google_drive: { ready: true },
      tavily: { ready: true },
      // Slack is deliberately unconnected: the delivery goes by email.
      slack: { ready: false, code: 'integration_not_ready' },
      postmark: { ready: true },
    },
  });

  assert.equal(report.deliveryTarget, 'founder@example.com');
  // Requiring a Slack connection the delivery never touches would make the
  // flagship workflow unrunnable for every tester on an email default.
  assert.ok(!report.requiredIntegrationIds.includes('slack'));
  assert.ok(report.requiredIntegrationIds.includes('postmark'));
  assert.ok(!report.optionalIntegrationIds.includes('postmark'));
  assert.ok(!report.blockers.some((item) => item.key === 'slack'));
  assert.equal(report.ready, true);
});

test('a tenant delivering to Slack is still required to connect Slack', async () => {
  writeWorkspaces([workspaceFixture(TENANT_WORKSPACE, { ownerEmail: 'founder@example.com' })]);
  const { checkWorkflowReadiness } = await import('../src/integrationGateway/workflowReadiness');

  const report = checkWorkflowReadiness({
    workflowId: 'weekly-founder-update',
    workspaceId: TENANT_WORKSPACE,
    deliveryTarget: '#their-channel',
    settingsView: TENANT_OWN_STRIPE,
    runtimeStatus: {
      github: { ready: true },
      linear: { ready: true },
      email: { ready: true },
      calendar: { ready: true },
      google_drive: { ready: true },
      tavily: { ready: true },
      slack: { ready: false, code: 'integration_not_ready' },
      postmark: { ready: true },
    },
  });

  assert.ok(report.requiredIntegrationIds.includes('slack'));
  const blocker = report.blockers.find((item) => item.key === 'slack');
  assert.ok(blocker, 'a Slack destination needs a Slack connection');
  assert.equal(blocker.label, 'Connect Slack');
  assert.equal(report.ready, false);
});

test('the internal workspace still requires Slack for its channel delivery', async () => {
  writeWorkspaces([workspaceFixture(DEFAULT_WORKSPACE)]);
  const { checkWorkflowReadiness } = await import('../src/integrationGateway/workflowReadiness');

  const report = checkWorkflowReadiness({
    workflowId: 'weekly-founder-update',
    workspaceId: DEFAULT_WORKSPACE,
    settingsView: { integrations: { stripe: { configured: true } } },
    runtimeStatus: {
      github: { ready: true },
      linear: { ready: true },
      email: { ready: true },
      calendar: { ready: true },
      google_drive: { ready: true },
      tavily: { ready: true },
      slack: { ready: true },
      postmark: { ready: true },
    },
  });

  assert.equal(report.deliveryTarget, '#violema-demo');
  assert.deepEqual(report.requiredIntegrationIds, [
    'stripe',
    'github',
    'linear',
    'email',
    'calendar',
    'tavily',
    'slack',
  ]);
  assert.deepEqual(report.optionalIntegrationIds, ['google_drive', 'postmark']);
  assert.equal(report.ready, true);
});

test('an explicit tenant delivery target always wins over the owner default', async () => {
  writeWorkspaces([workspaceFixture(TENANT_WORKSPACE, { ownerEmail: 'founder@example.com' })]);
  const { checkWorkflowReadiness } = await import('../src/integrationGateway/workflowReadiness');

  const report = checkWorkflowReadiness({
    workflowId: 'revenue-watch',
    workspaceId: TENANT_WORKSPACE,
    deliveryTarget: '#their-own-channel',
    settingsView: TENANT_OWN_STRIPE,
  });

  assert.equal(report.deliveryTarget, '#their-own-channel');
  assert.equal(report.ready, true);
});

test('the default and demo workspaces keep the demo channel default', async () => {
  writeWorkspaces([
    workspaceFixture(DEFAULT_WORKSPACE),
    workspaceFixture(DEMO_WORKSPACE, { metadata: { demo: true } }),
  ]);
  const { checkWorkflowReadiness } = await import('../src/integrationGateway/workflowReadiness');

  for (const workspaceId of [DEFAULT_WORKSPACE, DEMO_WORKSPACE]) {
    const report = checkWorkflowReadiness({
      workflowId: 'revenue-watch',
      workspaceId,
      settingsView: { integrations: { stripe: { configured: true, workspaceConfigured: true } } },
    });
    assert.equal(report.deliveryTarget, '#violema-demo', `${workspaceId} keeps the demo channel`);
  }
});

test("a tenant cannot satisfy Stripe readiness with Violema's own key", async () => {
  writeWorkspaces([workspaceFixture(TENANT_WORKSPACE, { ownerEmail: 'founder@example.com' })]);
  const { checkWorkflowReadiness } = await import('../src/integrationGateway/workflowReadiness');

  const report = checkWorkflowReadiness({
    workflowId: 'revenue-watch',
    workspaceId: TENANT_WORKSPACE,
    settingsView: SERVER_ONLY_STRIPE,
  });

  assert.equal(report.ready, false);
  const blocker = report.blockers.find((item) => item.key === 'stripe');
  assert.ok(blocker, 'a tenant must be asked to connect their own Stripe');
  assert.equal(blocker.route, '/integrations?provider=stripe&workflow=revenue-watch');
});

test("a demo workspace cannot satisfy Stripe readiness with Violema's own key either", async () => {
  writeWorkspaces([workspaceFixture(DEMO_WORKSPACE, { metadata: { demo: true } })]);
  const { checkWorkflowReadiness } = await import('../src/integrationGateway/workflowReadiness');

  const report = checkWorkflowReadiness({
    workflowId: 'revenue-watch',
    workspaceId: DEMO_WORKSPACE,
    settingsView: SERVER_ONLY_STRIPE,
  });

  // Demo workspaces may show labeled sample data; they may not read our real
  // revenue and present it as a run result.
  assert.equal(report.ready, false);
  assert.ok(report.blockers.some((item) => item.key === 'stripe'));
});

test('the default workspace still satisfies Stripe readiness with the server key', async () => {
  writeWorkspaces([workspaceFixture(DEFAULT_WORKSPACE)]);
  const { checkWorkflowReadiness } = await import('../src/integrationGateway/workflowReadiness');

  const report = checkWorkflowReadiness({
    workflowId: 'revenue-watch',
    workspaceId: DEFAULT_WORKSPACE,
    settingsView: SERVER_ONLY_STRIPE,
  });

  // The server key IS the default workspace's own account.
  assert.equal(report.ready, true);
  assert.deepEqual(report.blockers, []);
});

test('signing up records the workspace owner so tenant delivery has a destination', async () => {
  writeWorkspaces([]);
  const originalApproved = process.env.VIOLEMA_APPROVED_EMAILS;
  process.env.VIOLEMA_APPROVED_EMAILS = 'tester@example.com';

  try {
    const { upsertAuthUser } = await import('../src/auth');
    const { checkWorkflowReadiness } = await import('../src/integrationGateway/workflowReadiness');

    const user = upsertAuthUser({
      email: 'tester@example.com',
      name: 'Tester',
      role: 'user',
      method: 'email',
      acceptedTerms: true,
      acceptedEducation: true,
    });

    const report = checkWorkflowReadiness({
      workflowId: 'revenue-watch',
      workspaceId: user.defaultWorkspaceId,
      settingsView: TENANT_OWN_STRIPE,
    });

    // End to end: a tester who just signed up already has somewhere to deliver.
    assert.equal(report.deliveryTarget, 'tester@example.com');
    assert.equal(report.ready, true);
  } finally {
    if (typeof originalApproved === 'string') process.env.VIOLEMA_APPROVED_EMAILS = originalApproved;
    else delete process.env.VIOLEMA_APPROVED_EMAILS;
  }
});

test('recording the workspace owner never overwrites an existing owner', async () => {
  const { upsertAuthUser } = await import('../src/auth');
  const { listWorkspaces, upsertWorkspaceProfile } = await import('../src/platform/workspace');

  const first = upsertAuthUser({
    email: 'owner@example.com',
    name: 'Owner',
    role: 'user',
    method: 'email',
    acceptedTerms: true,
    acceptedEducation: true,
  });

  // Simulate the workspace already having a recorded owner, then a later sign
  // in. A workspace can have several members; the most recent one to log in
  // must not silently take ownership.
  upsertWorkspaceProfile(first.defaultWorkspaceId, { ownerEmail: 'original-owner@example.com' });
  upsertAuthUser({
    email: 'owner@example.com',
    name: 'Owner Renamed',
    role: 'user',
    method: 'email',
    acceptedTerms: true,
    acceptedEducation: true,
  });

  const profile = listWorkspaces().find((item) => item.id === first.defaultWorkspaceId);
  assert.equal(profile?.ownerEmail, 'original-owner@example.com');
});
