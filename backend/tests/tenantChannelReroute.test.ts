import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test, { after } from 'node:test';

// The scheduler and the workspace store both resolve their file paths from
// process.cwd() at import time, so the temp cwd has to exist before either
// module loads.
const originalCwd = process.cwd();
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'violema-reroute-'));
process.chdir(tempDir);

const FIXTURE_TIMESTAMP = '2026-08-01T12:00:00.000Z';
const DEFAULT_WORKSPACE = 'purpleorangehq';
const TENANT_WORKSPACE = 'workspace_tenant_a';
const DEMO_WORKSPACE = 'workspace_demo_b';

after(() => {
  process.chdir(originalCwd);
  fs.rmSync(tempDir, { recursive: true, force: true });
});

function writeWorkspaces(items: Array<Record<string, unknown>>) {
  fs.writeFileSync(path.join(tempDir, 'platform-workspaces.json'), JSON.stringify(items, null, 2));
}

function workspaceFixture(id: string, metadata?: Record<string, unknown>) {
  return {
    id,
    slug: id.replace(/_/g, '-'),
    name: `Workspace ${id}`,
    createdAt: FIXTURE_TIMESTAMP,
    updatedAt: FIXTURE_TIMESTAMP,
    ...(metadata ? { metadata } : {}),
  };
}

/** An automation that names the old founder channels everywhere it can. */
function automationFixture(id: string, workspaceId: string | undefined) {
  return {
    id,
    ...(workspaceId ? { workspaceId } : {}),
    name: `Weekly update ${id}`,
    workflow_prompt: 'Deliver the weekly brief to #founders once approved.',
    schedule: 'every monday at 9am',
    cron_expression: '0 9 * * 1',
    actions: ['Deliver latest result to #founders', 'Cc #all-purple-orange'],
    steps: [
      {
        id: 'step_deliver',
        kind: 'deliver',
        title: 'Deliver',
        objective: 'Deliver the brief to #founders',
        deliveryTarget: { channel: 'slack', target: '#founders' },
      },
    ],
    notify: '#founders',
    status: 'active',
    created_at: FIXTURE_TIMESTAMP,
  };
}

function writeAutomations(items: Array<Record<string, unknown>>) {
  fs.writeFileSync(path.join(tempDir, 'automations.json'), JSON.stringify(items, null, 2));
}

test('the raise-period channel reroute still rewrites the default workspace', async () => {
  writeWorkspaces([workspaceFixture(DEFAULT_WORKSPACE)]);
  writeAutomations([automationFixture('auto_internal', DEFAULT_WORKSPACE)]);
  const { getAutomationById } = await import('../src/scheduler');

  const record = getAutomationById('auto_internal');

  assert.ok(record);
  assert.equal(record.notify, '#violema-demo');
  assert.equal(record.steps?.[0].deliveryTarget?.target, '#violema-demo');
  assert.deepEqual(record.actions, [
    'Deliver latest result to #violema-demo',
    'Cc #violema-demo',
  ]);
  assert.match(String(record.workflow_prompt), /#violema-demo/);
});

test('the reroute still rewrites an automation with no workspace attribution', async () => {
  writeWorkspaces([]);
  // The seeded core automations carry no workspaceId at all. They are Max's,
  // so they must keep behaving exactly as before multi-tenancy.
  writeAutomations([automationFixture('auto_unattributed', undefined)]);
  const { getAutomationById } = await import('../src/scheduler');

  const record = getAutomationById('auto_unattributed');

  assert.ok(record);
  assert.equal(record.notify, '#violema-demo');
  assert.equal(record.steps?.[0].deliveryTarget?.target, '#violema-demo');
});

test('the reroute still rewrites a demo workspace', async () => {
  writeWorkspaces([workspaceFixture(DEMO_WORKSPACE, { demo: true })]);
  writeAutomations([automationFixture('auto_demo', DEMO_WORKSPACE)]);
  const { getAutomationById } = await import('../src/scheduler');

  const record = getAutomationById('auto_demo');

  assert.ok(record);
  assert.equal(record.notify, '#violema-demo');
  assert.equal(record.steps?.[0].deliveryTarget?.target, '#violema-demo');
});

test('the reroute never rewrites a tenant automation', async () => {
  writeWorkspaces([workspaceFixture(TENANT_WORKSPACE)]);
  writeAutomations([automationFixture('auto_tenant', TENANT_WORKSPACE)]);
  const { getAutomationById } = await import('../src/scheduler');

  const record = getAutomationById('auto_tenant');

  // A tenant's '#founders' means THEIR channel. Rewriting it would deliver a
  // customer's brief into Violema's own demo channel.
  assert.ok(record);
  assert.equal(record.notify, '#founders');
  assert.equal(record.steps?.[0].deliveryTarget?.target, '#founders');
  assert.deepEqual(record.actions, [
    'Deliver latest result to #founders',
    'Cc #all-purple-orange',
  ]);
  assert.match(String(record.workflow_prompt), /#founders/);
  assert.doesNotMatch(String(record.workflow_prompt), /violema-demo/);
});

test('tenant and internal automations are rerouted independently in one read', async () => {
  writeWorkspaces([workspaceFixture(DEFAULT_WORKSPACE), workspaceFixture(TENANT_WORKSPACE)]);
  writeAutomations([
    automationFixture('auto_internal', DEFAULT_WORKSPACE),
    automationFixture('auto_tenant', TENANT_WORKSPACE),
  ]);
  const { listAutomations } = await import('../src/scheduler');

  const byId = new Map(listAutomations().map((item) => [item.id, item]));

  assert.equal(byId.get('auto_internal')?.notify, '#violema-demo');
  assert.equal(byId.get('auto_tenant')?.notify, '#founders');
});

test('the demo Slack channel aliases resolve only for internal and demo workspaces', async () => {
  writeWorkspaces([workspaceFixture(DEFAULT_WORKSPACE), workspaceFixture(TENANT_WORKSPACE)]);
  const originalToken = process.env.SLACK_BOT_TOKEN;
  const originalAliases = process.env.SLACK_CHANNEL_ALIASES;
  // No bot token means channel-name lookup cannot reach Slack, so a name that
  // does not resolve to an id surfaces as a thrown "not visible" error naming
  // the target it tried. That distinguishes the two paths with no network call.
  delete process.env.SLACK_BOT_TOKEN;
  delete process.env.SLACK_CHANNEL_ALIASES;

  try {
    const { validateMessageTarget } = await import('../src/integrations');

    // Internal: '#founders' is aliased to '#violema-demo' before lookup.
    await assert.rejects(
      () => validateMessageTarget({ to: '#founders', channel: 'slack', workspaceId: DEFAULT_WORKSPACE }),
      /not visible to Violema/,
    );

    // Tenant: the alias is never consulted, so the error names THEIR channel.
    await assert.rejects(
      () => validateMessageTarget({ to: '#founders', channel: 'slack', workspaceId: TENANT_WORKSPACE }),
      /"#founders" is not visible to Violema/,
    );
  } finally {
    if (typeof originalToken === 'string') process.env.SLACK_BOT_TOKEN = originalToken;
    if (typeof originalAliases === 'string') process.env.SLACK_CHANNEL_ALIASES = originalAliases;
  }
});

test('a raw Slack channel id is never rewritten for any workspace', async () => {
  writeWorkspaces([workspaceFixture(TENANT_WORKSPACE)]);
  const { validateMessageTarget } = await import('../src/integrations');

  for (const workspaceId of [DEFAULT_WORKSPACE, TENANT_WORKSPACE]) {
    const validated = await validateMessageTarget({
      to: 'C0123456789',
      channel: 'slack',
      workspaceId,
    });
    assert.equal(validated.normalizedTarget, 'C0123456789');
  }
});
