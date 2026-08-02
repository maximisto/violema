import assert from 'node:assert/strict';
import test from 'node:test';

/**
 * Part C (channel picker) and Part E (posting as Violema).
 *
 * Both incidents are about a customer discovering something only after a send
 * failed. Every Slack and Composio call here is injected, so nothing in this
 * file can reach either service; `COMPOSIO_API_KEY` is force-unset for the same
 * reason. No file I/O, so the platform store's load-time cwd binding is not in
 * play.
 */

delete process.env.COMPOSIO_API_KEY;

const TENANT = 'workspace_synthetic_tenant';
const INTERNAL = 'purpleorangehq';

function slackPayload(channels: Array<Record<string, unknown>>) {
  return { successful: true, data: { channels } };
}

// ── C. Channel picker ─────────────────────────────────────────────────────────

test('a tenant channel list comes back with membership and privacy flags', async () => {
  const { listSlackChannels, invalidateSlackChannelCache } =
    await import('../src/integrationGateway/slackChannels');
  invalidateSlackChannelCache();

  const calls: Array<{ actionName: string; entityId: string }> = [];
  const result = await listSlackChannels(TENANT, {
    listConnectedApps: async () => ({ apps: ['slackbot'], ok: true }),
    execute: async (actionName, _input, ctx) => {
      calls.push({ actionName, entityId: ctx.entityId });
      return slackPayload([
        { id: 'C0SYNTH1', name: 'founder-updates', is_private: false, is_member: true },
        { id: 'C0SYNTH2', name: 'board-private', is_private: true, is_member: false },
        { id: 'C0SYNTH3', name: 'archived-room', is_member: true, is_archived: true },
      ]);
    },
    now: () => new Date('2099-01-01T00:00:00.000Z'),
  });

  assert.equal(result.ok, true);
  if (!result.ok) return;

  // Verified action slug, and the tenant's own entity — never ours.
  assert.deepEqual(calls, [{ actionName: 'SLACKBOT_LIST_ALL_CHANNELS', entityId: TENANT }]);
  assert.equal(result.source, 'composio');
  assert.deepEqual(result.channels, [
    { id: 'C0SYNTH1', name: 'founder-updates', isPrivate: false, isMember: true },
    { id: 'C0SYNTH2', name: 'board-private', isPrivate: true, isMember: false },
  ]);
  // The archived channel is dropped: offering it guarantees a failed send.
  assert.equal(result.channels.some((channel) => channel.name === 'archived-room'), false);
});

test('a channel Violema has not been invited to is listed but flagged, not hidden', async () => {
  // Hiding it would leave the founder wondering why a channel they can see in
  // Slack is missing here. Flagging it tells them exactly what to do: invite.
  const { listSlackChannels, invalidateSlackChannelCache } =
    await import('../src/integrationGateway/slackChannels');
  invalidateSlackChannelCache();

  const result = await listSlackChannels(TENANT, {
    listConnectedApps: async () => ({ apps: ['slackbot'], ok: true }),
    execute: async () => slackPayload([{ id: 'C0SYNTH9', name: 'exec', is_member: false }]),
  });

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.deepEqual(result.channels, [
    { id: 'C0SYNTH9', name: 'exec', isPrivate: false, isMember: false },
  ]);
});

test('a missing is_member field is treated as not-a-member, never assumed', async () => {
  const { normalizeSlackChannels } = await import('../src/integrationGateway/slackChannels');
  const { channels } = normalizeSlackChannels({ channels: [{ id: 'C0SYNTH', name: 'general' }] });
  assert.equal(channels[0].isMember, false);
});

test('an unconnected workspace gets an honest refusal, never an empty list', async () => {
  const { listSlackChannels, invalidateSlackChannelCache } =
    await import('../src/integrationGateway/slackChannels');
  invalidateSlackChannelCache();

  const result = await listSlackChannels(TENANT, {
    listConnectedApps: async () => ({ apps: [], ok: true }),
    execute: async () => {
      throw new Error('must not be called when Slack is not connected');
    },
  });

  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.code, 'slack_not_connected');
  assert.match(result.reason, /not connected/i);
  assert.equal(result.nextAction?.label, 'Connect Slack');
});

test('an outage reports unavailable rather than "you have no channels"', async () => {
  const { listSlackChannels, invalidateSlackChannelCache } =
    await import('../src/integrationGateway/slackChannels');
  invalidateSlackChannelCache();

  const result = await listSlackChannels(TENANT, {
    listConnectedApps: async () => ({ apps: [], ok: false }),
  });

  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.code, 'slack_lookup_unavailable');
});

test('a missing_scope rejection is reported as re-authorisation, not an outage', async () => {
  const { listSlackChannels, invalidateSlackChannelCache } =
    await import('../src/integrationGateway/slackChannels');
  invalidateSlackChannelCache();

  const result = await listSlackChannels(TENANT, {
    listConnectedApps: async () => ({ apps: ['slackbot'], ok: true }),
    execute: async () => ({ successful: false, error: 'missing_scope: channels:read' }),
  });

  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.code, 'slack_scope_insufficient');
  assert.match(result.reason, /channels:read/);
});

test('the picker never throws — a rejected call becomes a reported failure', async () => {
  const { listSlackChannels, invalidateSlackChannelCache } =
    await import('../src/integrationGateway/slackChannels');
  invalidateSlackChannelCache();

  const result = await listSlackChannels(TENANT, {
    listConnectedApps: async () => ({ apps: ['slackbot'], ok: true }),
    execute: async () => {
      throw new Error('socket hang up');
    },
  });

  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.code, 'slack_lookup_unavailable');
});

test('the internal workspace reads channels over the native bot token', async () => {
  const { listSlackChannels, invalidateSlackChannelCache } =
    await import('../src/integrationGateway/slackChannels');
  invalidateSlackChannelCache();
  const originalToken = process.env.SLACK_BOT_TOKEN;
  process.env.SLACK_BOT_TOKEN = 'xoxb-SYNTHETIC-NOT-REAL';

  try {
    const result = await listSlackChannels(INTERNAL, {
      execute: async () => {
        throw new Error('the internal workspace must not route through Composio');
      },
      fetchNativeChannels: async () => ({
        ok: true,
        channels: [{ id: 'C0INTERNAL', name: 'ops', is_member: true }],
      }),
    });

    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.source, 'native');
    assert.deepEqual(result.channels, [
      { id: 'C0INTERNAL', name: 'ops', isPrivate: false, isMember: true },
    ]);
  } finally {
    if (originalToken === undefined) delete process.env.SLACK_BOT_TOKEN;
    else process.env.SLACK_BOT_TOKEN = originalToken;
    invalidateSlackChannelCache();
  }
});

test('successful reads are cached, failures are not', async () => {
  const { listSlackChannels, invalidateSlackChannelCache } =
    await import('../src/integrationGateway/slackChannels');
  invalidateSlackChannelCache();

  let calls = 0;
  const deps = {
    listConnectedApps: async () => ({ apps: ['slackbot'], ok: true }),
    execute: async () => {
      calls += 1;
      return slackPayload([{ id: 'C0SYNTH', name: 'general', is_member: true }]);
    },
  };

  await listSlackChannels(TENANT, deps);
  await listSlackChannels(TENANT, deps);
  assert.equal(calls, 1, 'a second open within the TTL must not re-hit Slack');

  invalidateSlackChannelCache(TENANT);

  // A failure must never be memoised, or the picker stays broken after Slack
  // recovers.
  let failing = 0;
  const failingDeps = {
    listConnectedApps: async () => ({ apps: [], ok: false }),
    execute: async () => {
      failing += 1;
      return slackPayload([]);
    },
  };
  await listSlackChannels(TENANT, failingDeps);
  const second = await listSlackChannels(TENANT, failingDeps);
  assert.equal(second.ok, false);
  assert.equal(failing, 0);

  invalidateSlackChannelCache();
});

// ── E. Posting as Violema ─────────────────────────────────────────────────────

test('a connection with chat:write.customize posts as Violema', async () => {
  const { sendTenantSlackMessage, VIOLEMA_SLACK_USERNAME } =
    await import('../src/integrationGateway/slackDelivery');

  const calls: Array<Record<string, unknown>> = [];
  const result = await sendTenantSlackMessage(
    { workspaceId: TENANT, to: '#founders', body: 'Weekly update.' },
    {
      listConnectedApps: async () => ({ apps: ['slackbot'], ok: true }),
      readIdentityCapability: async () => 'yes',
      iconUrl: 'https://violema.com/brand/violema-slack-avatar.png',
      execute: async (_actionName, input) => {
        calls.push(input);
        return { successful: true, data: { ts: '1700000000.000100' } };
      },
    },
  );

  assert.equal(calls.length, 1);
  assert.equal(calls[0].username, VIOLEMA_SLACK_USERNAME);
  assert.equal(calls[0].icon_url, 'https://violema.com/brand/violema-slack-avatar.png');
  assert.equal((result as Record<string, unknown>).posted_as_violema, true);
});

test('a connection without the scope still delivers, just unbranded', async () => {
  // The whole point: branding must never be the reason an update fails to land.
  const { sendTenantSlackMessage } = await import('../src/integrationGateway/slackDelivery');

  const calls: Array<Record<string, unknown>> = [];
  const result = await sendTenantSlackMessage(
    { workspaceId: TENANT, to: '#founders', body: 'Weekly update.' },
    {
      listConnectedApps: async () => ({ apps: ['slackbot'], ok: true }),
      readIdentityCapability: async () => 'no',
      execute: async (_actionName, input) => {
        calls.push(input);
        return { successful: true, data: { ts: '1700000000.000100' } };
      },
    },
  );

  assert.equal(calls.length, 1);
  assert.equal(calls[0].username, undefined);
  assert.equal(calls[0].icon_url, undefined);
  assert.equal(calls[0].markdown_text, 'Weekly update.');
  assert.equal((result as Record<string, unknown>).success, true);
  assert.equal((result as Record<string, unknown>).posted_as_violema, false);
});

test('an unknown scope state tries branded, then falls back on Slack refusing', async () => {
  const { sendTenantSlackMessage } = await import('../src/integrationGateway/slackDelivery');

  const calls: Array<Record<string, unknown>> = [];
  const result = await sendTenantSlackMessage(
    { workspaceId: TENANT, to: '#founders', body: 'Weekly update.' },
    {
      listConnectedApps: async () => ({ apps: ['slackbot'], ok: true }),
      readIdentityCapability: async () => 'unknown',
      execute: async (_actionName, input) => {
        calls.push(input);
        if (input.username) {
          return { successful: false, error: 'missing_scope: chat:write.customize' };
        }
        return { successful: true, data: { ts: '1700000000.000100' } };
      },
    },
  );

  // One branded attempt, one plain retry — and the message got through.
  assert.equal(calls.length, 2);
  assert.equal(calls[0].username, 'Violema');
  assert.equal(calls[1].username, undefined);
  assert.equal((result as Record<string, unknown>).success, true);
  assert.equal((result as Record<string, unknown>).posted_as_violema, false);
  assert.equal((result as Record<string, unknown>).identity_downgraded, true);
});

test('a non-scope failure is never retried — a retry could double-post', async () => {
  const { sendTenantSlackMessage } = await import('../src/integrationGateway/slackDelivery');

  let calls = 0;
  await assert.rejects(
    () => sendTenantSlackMessage(
      { workspaceId: TENANT, to: '#founders', body: 'Weekly update.' },
      {
        listConnectedApps: async () => ({ apps: ['slackbot'], ok: true }),
        readIdentityCapability: async () => 'yes',
        execute: async () => {
          calls += 1;
          return { successful: false, error: 'channel_not_found' };
        },
      },
    ),
    /channel_not_found/,
  );
  assert.equal(calls, 1);
});

test('the icon URL rejects anything that is not plain https', async () => {
  const { resolveSlackIconUrl, DEFAULT_VIOLEMA_SLACK_ICON_URL } =
    await import('../src/integrationGateway/slackDelivery');

  assert.equal(resolveSlackIconUrl(undefined), DEFAULT_VIOLEMA_SLACK_ICON_URL);
  assert.equal(resolveSlackIconUrl('   '), DEFAULT_VIOLEMA_SLACK_ICON_URL);
  assert.equal(
    resolveSlackIconUrl('https://cdn.example.com/mark.png'),
    'https://cdn.example.com/mark.png',
  );
  // No http, no file, no javascript: — an outbound payload is not a place to
  // forward whatever an env var happens to contain.
  assert.equal(resolveSlackIconUrl('http://violema.com/brand/mark.png'), undefined);
  assert.equal(resolveSlackIconUrl('file:///etc/passwd'), undefined);
  assert.equal(resolveSlackIconUrl('not-a-url'), undefined);
});
