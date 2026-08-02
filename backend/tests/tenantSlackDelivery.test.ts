import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test, { after } from 'node:test';

// Isolate the workspace store: the demo-metadata lookup resolves its path from
// process.cwd() at import time.
const originalCwd = process.cwd();
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'violema-tenant-slack-'));
process.chdir(tempDir);
fs.writeFileSync(
  path.join(tempDir, 'platform-workspaces.json'),
  JSON.stringify(
    [
      {
        id: 'workspace_tenant_a',
        slug: 'workspace-tenant-a',
        name: 'Workspace tenant a',
        createdAt: '2026-08-01T12:00:00.000Z',
        updatedAt: '2026-08-01T12:00:00.000Z',
      },
    ],
    null,
    2,
  ),
);

const TENANT_WORKSPACE = 'workspace_tenant_a';
const DEFAULT_WORKSPACE = 'purpleorangehq';

after(() => {
  process.chdir(originalCwd);
  fs.rmSync(tempDir, { recursive: true, force: true });
});

interface RecordedCall {
  actionName: string;
  input: Record<string, unknown>;
  entityId: string;
}

/** A Composio stand-in. No network, no API key, no SDK. */
function fakeComposio(options: { apps: string[]; ok?: boolean; envelope?: unknown }) {
  const calls: RecordedCall[] = [];
  return {
    calls,
    deps: {
      listConnectedApps: async () => ({ apps: options.apps, ok: options.ok ?? true }),
      execute: async (
        actionName: string,
        input: Record<string, unknown>,
        ctx: { entityId: string },
      ) => {
        calls.push({ actionName, input, entityId: ctx.entityId });
        return options.envelope ?? { successful: true, data: { ts: '1700000000.000100' } };
      },
    },
  };
}

test('tests never hold a Composio API key', () => {
  assert.equal(process.env.COMPOSIO_API_KEY, undefined);
});

test('a tenant Slack delivery routes through their own Composio bot connection', async () => {
  const composio = fakeComposio({ apps: ['slackbot', 'gmail'] });
  const { sendTenantSlackMessage } = await import('../src/integrationGateway/slackDelivery');

  const result = await sendTenantSlackMessage(
    {
      workspaceId: TENANT_WORKSPACE,
      to: '#founders',
      subject: 'Weekly founder update',
      body: 'MRR is up 4%.',
    },
    composio.deps,
  );

  assert.equal(composio.calls.length, 1);
  const [call] = composio.calls;
  assert.equal(call.actionName, 'SLACKBOT_SEND_MESSAGE');
  // entityId is the workspace: Composio resolves THEIR credentials, not ours.
  assert.equal(call.entityId, TENANT_WORKSPACE);
  assert.equal(call.input.channel, 'founders');
  assert.match(String(call.input.markdown_text), /Weekly founder update/);
  assert.match(String(call.input.markdown_text), /MRR is up 4%/);
  // The verified schema has no `text` parameter — only `markdown_text`.
  assert.equal(call.input.text, undefined);
  assert.equal(call.input.thread_ts, undefined);

  assert.equal(result.success, true);
  assert.equal(result.transport, 'composio');
  assert.equal(result.partner_toolkit, 'slackbot');
  assert.equal(result.slack_ts, '1700000000.000100');
});

test('a tenant that connected the user Slack toolkit uses its send action', async () => {
  const composio = fakeComposio({ apps: ['slack'] });
  const { sendTenantSlackMessage } = await import('../src/integrationGateway/slackDelivery');

  const result = await sendTenantSlackMessage(
    { workspaceId: TENANT_WORKSPACE, to: 'C0123456789', body: 'Brief.' },
    composio.deps,
  );

  assert.equal(composio.calls[0].actionName, 'SLACK_SEND_MESSAGE');
  assert.equal(composio.calls[0].input.channel, 'C0123456789');
  assert.equal(result.partner_toolkit, 'slack');
});

test('a tenant with no Slack connection fails the delivery naming Connect Slack', async () => {
  const composio = fakeComposio({ apps: ['gmail', 'github'] });
  const { sendTenantSlackMessage, TenantSlackUnroutedError } = await import(
    '../src/integrationGateway/slackDelivery'
  );

  await assert.rejects(
    () =>
      sendTenantSlackMessage(
        { workspaceId: TENANT_WORKSPACE, to: '#founders', body: 'Brief.' },
        composio.deps,
      ),
    (error: unknown) => {
      assert.ok(error instanceof TenantSlackUnroutedError);
      assert.equal(error.code, 'slack_not_connected');
      assert.equal(error.nextAction.label, 'Connect Slack');
      assert.equal(error.nextAction.route, '/integrations?provider=slack');
      assert.match(error.message, /Connect Slack/);
      return true;
    },
  );

  // The critical property: nothing was sent. Never silently via our bot.
  assert.equal(composio.calls.length, 0);
});

test('an unreachable Composio is reported as unverifiable, not as disconnected', async () => {
  const composio = fakeComposio({ apps: [], ok: false });
  const { sendTenantSlackMessage, TenantSlackUnroutedError } = await import(
    '../src/integrationGateway/slackDelivery'
  );

  await assert.rejects(
    () =>
      sendTenantSlackMessage(
        { workspaceId: TENANT_WORKSPACE, to: '#founders', body: 'Brief.' },
        composio.deps,
      ),
    (error: unknown) => {
      assert.ok(error instanceof TenantSlackUnroutedError);
      // "We cannot tell" is a different fact from "you have not connected",
      // and only one of them is fixed by connecting Slack.
      assert.equal(error.code, 'slack_lookup_unavailable');
      return true;
    },
  );
  assert.equal(composio.calls.length, 0);
});

test('a failed Composio send surfaces the provider error instead of reporting success', async () => {
  const composio = fakeComposio({
    apps: ['slackbot'],
    envelope: { successful: false, error: 'channel_not_found' },
  });
  const { sendTenantSlackMessage } = await import('../src/integrationGateway/slackDelivery');

  await assert.rejects(
    () =>
      sendTenantSlackMessage(
        { workspaceId: TENANT_WORKSPACE, to: '#missing', body: 'Brief.' },
        composio.deps,
      ),
    /channel_not_found/,
  );
});

test('a long tenant brief continues in a thread rather than being truncated', async () => {
  const composio = fakeComposio({ apps: ['slackbot'] });
  const { sendTenantSlackMessage } = await import('../src/integrationGateway/slackDelivery');

  const body = Array.from(
    { length: 400 },
    (_, index) => `Line ${index} of the operating brief.`,
  ).join('\n');
  const result = await sendTenantSlackMessage(
    { workspaceId: TENANT_WORKSPACE, to: '#founders', body },
    composio.deps,
  );

  assert.ok(composio.calls.length > 1, 'a long brief should span several messages');
  assert.equal(composio.calls[0].input.thread_ts, undefined);
  for (const call of composio.calls.slice(1)) {
    // Continuations hang off the first message, so the brief stays one thread.
    assert.equal(call.input.thread_ts, '1700000000.000100');
  }
  assert.equal(result.slack_parts, composio.calls.length);

  const delivered = composio.calls.map((call) => String(call.input.markdown_text)).join('\n');
  assert.match(delivered, /Line 0 of the operating brief/);
  assert.match(delivered, /Line 399 of the operating brief/);
});

test('sendMessage routes a tenant Slack target through Composio', async () => {
  const composio = fakeComposio({ apps: ['slackbot'] });
  const { sendMessage } = await import('../src/integrations');

  const result = await sendMessage({
    to: '#founders',
    body: 'Approved brief.',
    channel: 'slack',
    workspaceId: TENANT_WORKSPACE,
    tenantSlackDeps: composio.deps,
  });

  assert.equal(composio.calls.length, 1);
  assert.equal(composio.calls[0].entityId, TENANT_WORKSPACE);
  assert.equal((result as { transport?: string }).transport, 'composio');
});

test('sendMessage keeps the default workspace on the native bot path', async () => {
  const composio = fakeComposio({ apps: ['slackbot'] });
  const originalToken = process.env.SLACK_BOT_TOKEN;
  // With no bot token the native sender throws before any network call, which
  // is exactly the evidence we want: it took the native branch.
  delete process.env.SLACK_BOT_TOKEN;

  try {
    const { sendMessage } = await import('../src/integrations');

    await assert.rejects(
      () =>
        sendMessage({
          to: '#founders',
          body: 'Internal brief.',
          channel: 'slack',
          workspaceId: DEFAULT_WORKSPACE,
          tenantSlackDeps: composio.deps,
        }),
      /SLACK_BOT_TOKEN/,
    );

    // Max's internal delivery must never be diverted through Composio.
    assert.equal(composio.calls.length, 0);
  } finally {
    if (typeof originalToken === 'string') process.env.SLACK_BOT_TOKEN = originalToken;
  }
});

test('a tenant email delivery is unaffected by Slack routing', async () => {
  const composio = fakeComposio({ apps: [] });
  const originalKey = process.env.POSTMARK_API_KEY;
  delete process.env.POSTMARK_API_KEY;

  try {
    const { sendMessage } = await import('../src/integrations');

    // Reaches the Postmark sender (which then wants its key) rather than being
    // caught by the Slack fork.
    await assert.rejects(
      () =>
        sendMessage({
          to: 'founder@example.com',
          body: 'Approved brief.',
          workspaceId: TENANT_WORKSPACE,
          tenantSlackDeps: composio.deps,
        }),
      /POSTMARK_API_KEY/,
    );
    assert.equal(composio.calls.length, 0);
  } finally {
    if (typeof originalKey === 'string') process.env.POSTMARK_API_KEY = originalKey;
  }
});

test('tenant Slack readiness reflects the workspace connection, not our server bot', async () => {
  const { buildPartnerRuntimeStatus } = await import(
    '../src/integrationGateway/workflowRuntimeStatus'
  );

  const connectedNative = { tavily: true, slack: true, postmark: true };

  const tenantWithout = buildPartnerRuntimeStatus({
    connectedPartnerApps: ['gmail'],
    nativeStatus: connectedNative,
    workspaceId: TENANT_WORKSPACE,
  });
  // Our bot being configured says nothing about whether THEIR delivery lands.
  assert.equal(tenantWithout.slack.ready, false);
  assert.equal(tenantWithout.slack.code, 'integration_not_ready');

  const tenantWith = buildPartnerRuntimeStatus({
    connectedPartnerApps: ['slackbot'],
    nativeStatus: { tavily: true, slack: false, postmark: true },
    workspaceId: TENANT_WORKSPACE,
  });
  assert.equal(tenantWith.slack.ready, true);

  const internal = buildPartnerRuntimeStatus({
    connectedPartnerApps: [],
    nativeStatus: connectedNative,
    workspaceId: DEFAULT_WORKSPACE,
  });
  // The internal workspace still delivers through the server bot.
  assert.equal(internal.slack.ready, true);
  assert.equal(internal.slack.detail, 'Slack delivery is configured on the server.');
});
