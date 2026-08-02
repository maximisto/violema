import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createComposioBridge,
  invalidatePartnerConnectionCache,
  readConnectedAppsWithCache,
  type ComposioClientAdapter,
  type ComposioExecutionContext,
} from '../src/composioBridge';

test('Composio bridge uses the current SDK surfaces for execution and connections', async () => {
  const calls: Array<{ operation: string; payload: unknown }> = [];
  const client: ComposioClientAdapter = {
    tools: {
      async execute(slug, body) {
        calls.push({ operation: 'execute', payload: { slug, body } });
        return { successful: true };
      },
    },
    authConfigs: {
      async list(query) {
        calls.push({ operation: 'list-auth-configs', payload: query });
        return { items: [{ id: 'auth-github' }] };
      },
      async create(toolkitSlug, options) {
        calls.push({ operation: 'create-auth-config', payload: { toolkitSlug, options } });
        return { id: 'auth-created' };
      },
    },
    connectedAccounts: {
      async link(userId, authConfigId, options) {
        calls.push({ operation: 'link', payload: { userId, authConfigId, options } });
        return { id: 'conn_req_1', redirectUrl: 'https://auth.example/connect' };
      },
      async list(query) {
        calls.push({ operation: 'list-connected-accounts', payload: query });
        return {
          items: [
            { id: 'ca_1', toolkit: { slug: 'github' } },
            { id: 'ca_2', toolkit: { slug: 'slack' } },
            { id: 'ca_3', toolkit: null },
          ],
        };
      },
      async delete(nanoid) {
        calls.push({ operation: 'delete-connected-account', payload: nanoid });
        return {};
      },
    },
  };
  const bridge = createComposioBridge(client);

  assert.equal(bridge.isEnabled(), true);
  assert.deepEqual(
    await bridge.executeAction(
      'GITHUB_CREATE_ISSUE',
      { title: 'Ship it' },
      { entityId: 'workspace-123' },
    ),
    { successful: true },
  );
  assert.deepEqual(
    await bridge.startConnection('GitHub', { entityId: 'workspace-123' }),
    {
      redirectUrl: 'https://auth.example/connect',
      connectionRequestId: 'conn_req_1',
      // Reported back so the caller can record *which* auth config a user
      // authorised against rather than inferring it later from a scope error.
      authConfig: { id: 'auth-github', name: null, managed: false, reason: 'first_available' },
    },
  );
  assert.deepEqual(
    await bridge.listConnectedApps({ entityId: 'workspace-123' }),
    ['github', 'slack'],
  );
  assert.deepEqual(calls, [
    {
      operation: 'execute',
      payload: {
        slug: 'GITHUB_CREATE_ISSUE',
        body: {
          userId: 'workspace-123',
          arguments: { title: 'Ship it' },
          dangerouslySkipVersionCheck: true,
        },
      },
    },
    {
      operation: 'list-auth-configs',
      payload: {
        toolkit: 'github',
      },
    },
    {
      operation: 'link',
      payload: {
        userId: 'workspace-123',
        authConfigId: 'auth-github',
        options: {
          allowMultiple: true,
        },
      },
    },
    {
      operation: 'list-connected-accounts',
      payload: {
        userIds: ['workspace-123'],
        statuses: ['ACTIVE'],
      },
    },
  ]);
});

test('Composio bridge forwards a server-derived callback URL to link()', async () => {
  let linkOptions: unknown = null;
  const client: ComposioClientAdapter = {
    tools: {
      async execute() {
        return {};
      },
    },
    authConfigs: {
      async list() {
        return { items: [{ id: 'auth-gmail' }] };
      },
      async create() {
        return { id: 'auth-created' };
      },
    },
    connectedAccounts: {
      async link(_userId, _authConfigId, options) {
        linkOptions = options;
        return { id: 'conn_req_2', redirectUrl: 'https://auth.example/gmail' };
      },
      async list() {
        return { items: [] };
      },
      async delete() {
        return {};
      },
    },
  };

  const connection = await createComposioBridge(client).startConnection(
    'gmail',
    { entityId: 'workspace-123' },
    { callbackUrl: 'https://violema.com/integrations?connected=gmail' },
  );

  assert.deepEqual(connection, {
    redirectUrl: 'https://auth.example/gmail',
    connectionRequestId: 'conn_req_2',
    authConfig: { id: 'auth-gmail', name: null, managed: false, reason: 'first_available' },
  });
  assert.deepEqual(linkOptions, {
    allowMultiple: true,
    callbackUrl: 'https://violema.com/integrations?connected=gmail',
  });
});

test('Composio bridge creates a managed auth config when a toolkit has none', async () => {
  const calls: string[] = [];
  const client: ComposioClientAdapter = {
    tools: {
      async execute() {
        return {};
      },
    },
    authConfigs: {
      async list() {
        calls.push('list');
        return { items: [] };
      },
      async create(toolkitSlug, options) {
        calls.push(`create:${toolkitSlug}:${options.type}`);
        return { id: 'auth-created' };
      },
    },
    connectedAccounts: {
      async link(_userId, authConfigId) {
        calls.push(`link:${authConfigId}`);
        return { redirectUrl: 'https://auth.example/new' };
      },
      async list() {
        return { items: [] };
      },
      async delete() {
        return {};
      },
    },
  };
  const bridge = createComposioBridge(client);

  assert.deepEqual(
    await bridge.startConnection('Slack', { entityId: 'workspace-123' }),
    // No ConnectionRequest id came back, so none is invented.
    {
      redirectUrl: 'https://auth.example/new',
      // Managed by construction — `use_composio_managed_auth` is what we asked for.
      authConfig: {
        id: 'auth-created',
        name: 'slack Auth Config',
        managed: true,
        reason: 'created',
      },
    },
  );
  assert.deepEqual(calls, [
    'list',
    'create:slack:use_composio_managed_auth',
    'link:auth-created',
  ]);
});

/**
 * The founder's real Google Drive account, as diagnosed in production: a custom
 * auth config on his own Google Cloud OAuth client — `drive.metadata.readonly`,
 * so no file contents and no writes — sorts ahead of the Composio-managed one.
 * `credentials` is included because the SDK genuinely returns it on list items.
 */
function googleDriveClient(record: { linkedAuthConfigId?: string }): ComposioClientAdapter {
  return {
    tools: {
      async execute() {
        return {};
      },
    },
    authConfigs: {
      async list() {
        return {
          items: [
            {
              id: 'ac_custom_readonly',
              name: 'Google Drive TechChicago Read Only',
              isComposioManaged: false,
              status: 'ENABLED',
              credentials: {
                client_id: 'SHOULD-NEVER-BE-LOGGED',
                client_secret: 'SHOULD-NEVER-BE-LOGGED',
              },
            },
            {
              id: 'ac_managed',
              name: 'googledrive-ksbv93',
              isComposioManaged: true,
              status: 'ENABLED',
            },
          ],
        };
      },
      async create() {
        throw new Error('must not create an auth config when usable ones exist');
      },
    },
    connectedAccounts: {
      async link(_userId, authConfigId) {
        record.linkedAuthConfigId = authConfigId;
        return { id: 'conn_req_drive', redirectUrl: 'https://auth.example/drive' };
      },
      async list() {
        return { items: [] };
      },
      async delete() {
        return {};
      },
    },
  };
}

test('Composio bridge links Google Drive against the managed config, not the read-only one', async () => {
  // The production defect verbatim: items[0] was the read-only custom config,
  // so every new connection could list filenames but never read or write files.
  const record: { linkedAuthConfigId?: string } = {};

  const connection = await createComposioBridge(googleDriveClient(record)).startConnection(
    'googledrive',
    { entityId: 'workspace-123' },
  );

  assert.equal(record.linkedAuthConfigId, 'ac_managed');
  assert.deepEqual(connection.authConfig, {
    id: 'ac_managed',
    name: 'googledrive-ksbv93',
    managed: true,
    reason: 'composio_managed',
  });
});

test('Composio bridge logs the chosen auth config and never its credentials', async () => {
  const record: { linkedAuthConfigId?: string } = {};
  const logged: unknown[][] = [];
  const originalLog = console.log;
  console.log = (...args: unknown[]) => {
    logged.push(args);
  };
  try {
    await createComposioBridge(googleDriveClient(record)).startConnection('googledrive', {
      entityId: 'workspace-123',
    });
  } finally {
    console.log = originalLog;
  }

  const selectionLog = logged.find((args) => args[0] === '[composio] auth config selected');
  assert.ok(selectionLog, 'the chosen auth config must be observable in the logs');
  assert.deepEqual(selectionLog[1], {
    toolkit: 'googledrive',
    authConfigId: 'ac_managed',
    authConfigName: 'googledrive-ksbv93',
    composioManaged: true,
    reason: 'composio_managed',
  });
  // Nothing anywhere in the log stream may carry the OAuth client secret that
  // rode along on the sibling auth config's `credentials`.
  assert.ok(!JSON.stringify(logged).includes('SHOULD-NEVER-BE-LOGGED'));
});

test('Composio bridge fails closed when the pinned auth config is missing', async () => {
  const record: { linkedAuthConfigId?: string } = {};
  const original = process.env.COMPOSIO_AUTH_CONFIG_GOOGLEDRIVE;
  process.env.COMPOSIO_AUTH_CONFIG_GOOGLEDRIVE = 'ac_wrong';
  try {
    // Falling back to some other auth config is exactly the bug being fixed, so
    // a bad override must break the connect rather than quietly succeed.
    await assert.rejects(
      createComposioBridge(googleDriveClient(record)).startConnection('googledrive', {
        entityId: 'workspace-123',
      }),
      /COMPOSIO_AUTH_CONFIG_GOOGLEDRIVE/,
    );
  } finally {
    if (typeof original === 'string') process.env.COMPOSIO_AUTH_CONFIG_GOOGLEDRIVE = original;
    else delete process.env.COMPOSIO_AUTH_CONFIG_GOOGLEDRIVE;
  }

  assert.equal(record.linkedAuthConfigId, undefined, 'nothing may be linked on a failed override');
});

test('Composio bridge disconnects every active account for a toolkit', async () => {
  const deleted: string[] = [];
  const client: ComposioClientAdapter = {
    tools: {
      async execute() {
        return {};
      },
    },
    authConfigs: {
      async list() {
        return { items: [{ id: 'auth-gmail' }] };
      },
      async create() {
        return { id: 'auth-created' };
      },
    },
    connectedAccounts: {
      async link() {
        return { redirectUrl: null };
      },
      async list() {
        return {
          items: [
            { id: 'ca_gmail_1', toolkit: { slug: 'gmail' } },
            { id: 'ca_gmail_2', toolkit: { slug: 'gmail' } },
            { id: 'ca_github', toolkit: { slug: 'github' } },
          ],
        };
      },
      async delete(nanoid) {
        deleted.push(nanoid);
        return {};
      },
    },
  };
  const bridge = createComposioBridge(client);

  assert.deepEqual(await bridge.disconnectApp('Gmail', { entityId: 'workspace-123' }), {
    status: 'disconnected',
    toolkit: 'gmail',
    removed: 2,
  });
  assert.deepEqual(deleted, ['ca_gmail_1', 'ca_gmail_2']);
});

type FakeConnectedAccount = { id?: string | null; toolkit?: { slug?: string } | null };

/**
 * A fake whose `connectedAccounts.list` is paginated the way the SDK's
 * `ConnectedAccountListResponseSchema` is: `items` plus `nextCursor`, with
 * `nextCursor` absent on the final page. Page N is requested with
 * `cursor: 'page-N'`; page 0 is requested with no cursor at all.
 */
function pagedConnectedAccountsClient(
  pages: FakeConnectedAccount[][],
  record: { cursors: Array<string | undefined>; deleted: string[] },
): ComposioClientAdapter {
  return {
    tools: {
      async execute() {
        return {};
      },
    },
    authConfigs: {
      async list() {
        return { items: [{ id: 'auth-gmail' }] };
      },
      async create() {
        return { id: 'auth-created' };
      },
    },
    connectedAccounts: {
      async link() {
        return { redirectUrl: null };
      },
      async list(query) {
        record.cursors.push(query.cursor);
        const index = query.cursor ? Number(query.cursor.replace('page-', '')) : 0;
        const items = pages[index];
        if (!items) throw new Error(`fake client has no page ${index}`);
        const hasNext = index + 1 < pages.length;
        return {
          items,
          ...(hasNext ? { nextCursor: `page-${index + 1}` } : {}),
          totalPages: pages.length,
        };
      },
      async delete(nanoid) {
        record.deleted.push(nanoid);
        return {};
      },
    },
  };
}

test('Composio bridge reads connected accounts across every page', async () => {
  const record = { cursors: [] as Array<string | undefined>, deleted: [] as string[] };
  const client = pagedConnectedAccountsClient(
    [
      [{ id: 'ca_1', toolkit: { slug: 'github' } }],
      [{ id: 'ca_2', toolkit: { slug: 'linear' } }, { id: 'ca_3', toolkit: null }],
      [{ id: 'ca_4', toolkit: { slug: 'notion' } }],
    ],
    record,
  );

  // A single-page read would have reported only github.
  assert.deepEqual(
    await createComposioBridge(client).listConnectedApps({ entityId: 'workspace-123' }),
    ['github', 'linear', 'notion'],
  );
  // Page 1 goes out with no cursor; each later page carries the previous
  // response's nextCursor. Four calls would mean the terminal page was refetched.
  assert.deepEqual(record.cursors, [undefined, 'page-1', 'page-2']);
});

test('Composio bridge disconnects accounts that live on later pages', async () => {
  const record = { cursors: [] as Array<string | undefined>, deleted: [] as string[] };
  const client = pagedConnectedAccountsClient(
    [
      [{ id: 'ca_gmail_1', toolkit: { slug: 'gmail' } }, { id: 'ca_github', toolkit: { slug: 'github' } }],
      [{ id: 'ca_gmail_2', toolkit: { slug: 'gmail' } }],
    ],
    record,
  );

  // The second Gmail account is only reachable via the cursor. Missing it would
  // leave the workspace still able to read Gmail while the route said ok: true.
  assert.deepEqual(await createComposioBridge(client).disconnectApp('Gmail', { entityId: 'w1' }), {
    status: 'disconnected',
    toolkit: 'gmail',
    removed: 2,
  });
  assert.deepEqual(record.deleted, ['ca_gmail_1', 'ca_gmail_2']);
});

test('Composio bridge refuses to act on a partial list when the cursor never ends', async () => {
  let listCalls = 0;
  const client: ComposioClientAdapter = {
    tools: {
      async execute() {
        return {};
      },
    },
    authConfigs: {
      async list() {
        return { items: [{ id: 'auth-gmail' }] };
      },
      async create() {
        return { id: 'auth-created' };
      },
    },
    connectedAccounts: {
      async link() {
        return { redirectUrl: null };
      },
      async list() {
        listCalls += 1;
        // Always another page — a runaway or looping cursor.
        return { items: [{ id: `ca_${listCalls}`, toolkit: { slug: 'gmail' } }], nextCursor: 'page-0' };
      },
      async delete() {
        return {};
      },
    },
  };

  // Throwing keeps every caller fail-closed rather than letting a truncated
  // read masquerade as the workspace's full connection set.
  await assert.rejects(
    createComposioBridge(client).listConnectedApps({ entityId: 'workspace-123' }),
    /more than 25 pages/,
  );
  assert.equal(listCalls, 25);
});

test('Composio bridge reports a missing connection instead of faking a disconnect', async () => {
  let deleteCalls = 0;
  const client: ComposioClientAdapter = {
    tools: {
      async execute() {
        return {};
      },
    },
    authConfigs: {
      async list() {
        return { items: [] };
      },
      async create() {
        return { id: 'auth-created' };
      },
    },
    connectedAccounts: {
      async link() {
        return { redirectUrl: null };
      },
      async list() {
        return { items: [{ id: 'ca_github', toolkit: { slug: 'github' } }] };
      },
      async delete() {
        deleteCalls += 1;
        return {};
      },
    },
  };

  assert.deepEqual(
    await createComposioBridge(client).disconnectApp('linear', { entityId: 'workspace-123' }),
    { status: 'not_connected', toolkit: 'linear' },
  );
  assert.equal(deleteCalls, 0);
});

test('Composio bridge surfaces connection-lookup failures to the caller', async () => {
  const client: ComposioClientAdapter = {
    tools: {
      async execute() {
        return {};
      },
    },
    authConfigs: {
      async list() {
        return { items: [] };
      },
      async create() {
        return { id: 'auth-created' };
      },
    },
    connectedAccounts: {
      async link() {
        return { redirectUrl: null };
      },
      async list() {
        throw new Error('composio upstream 503');
      },
      async delete() {
        return {};
      },
    },
  };

  // The bridge must not swallow this — the module-level wrapper decides whether
  // the caller sees [] or a degraded flag.
  await assert.rejects(
    createComposioBridge(client).listConnectedApps({ entityId: 'workspace-123' }),
    /composio upstream 503/,
  );
});

test('Composio bridge remains disabled without a configured client', async () => {
  const bridge = createComposioBridge(null);

  assert.equal(bridge.isEnabled(), false);
  assert.deepEqual(
    await bridge.startConnection('github', { entityId: 'workspace-123' }),
    { redirectUrl: null },
  );
  assert.deepEqual(
    await bridge.listConnectedApps({ entityId: 'workspace-123' }),
    [],
  );
  assert.deepEqual(await bridge.disconnectApp('github', { entityId: 'workspace-123' }), {
    status: 'failed',
    toolkit: 'github',
    message: 'Composio is not configured.',
  });
  await assert.rejects(
    bridge.executeAction('GITHUB_CREATE_ISSUE', {}, { entityId: 'workspace-123' }),
    /Composio is not configured/,
  );
});

// ── Connected-apps memo ───────────────────────────────────────────────────────
// The readiness endpoint refires on every keystroke in the mission-name field,
// so an uncached read turns normal typing into a burst against one shared API
// key. These cases pin the memo's rules: hit within the window, never memoise
// an outage, keyed per workspace, and dropped on any connection mutation.

/** Run one case against a known TTL, leaving no memo behind for the next. */
async function withStatusCacheEnv(ttlMs: string | undefined, run: () => Promise<void>) {
  const original = process.env.COMPOSIO_STATUS_CACHE_MS;
  if (ttlMs === undefined) delete process.env.COMPOSIO_STATUS_CACHE_MS;
  else process.env.COMPOSIO_STATUS_CACHE_MS = ttlMs;
  invalidatePartnerConnectionCache();
  try {
    await run();
  } finally {
    invalidatePartnerConnectionCache();
    if (typeof original === 'string') process.env.COMPOSIO_STATUS_CACHE_MS = original;
    else delete process.env.COMPOSIO_STATUS_CACHE_MS;
  }
}

function countingReader(apps: string[]) {
  const state = { calls: 0 };
  return {
    state,
    read: async (_ctx: ComposioExecutionContext) => {
      state.calls += 1;
      return [...apps];
    },
  };
}

test('repeat connection reads inside the TTL answer from the memo', async () => {
  await withStatusCacheEnv(undefined, async () => {
    const reader = countingReader(['gmail', 'linear']);
    const ctx = { entityId: 'ws-memo-hit' };

    const first = await readConnectedAppsWithCache(ctx, reader.read);
    assert.deepEqual(first, { apps: ['gmail', 'linear'], ok: true });

    // A caller mutating what it got back must not corrupt the memo.
    first.apps.push('github');

    for (let i = 0; i < 5; i += 1) {
      assert.deepEqual(await readConnectedAppsWithCache(ctx, reader.read), {
        apps: ['gmail', 'linear'],
        ok: true,
      });
    }
    assert.equal(reader.state.calls, 1, 'six reads should cost one upstream call');
  });
});

test('the connection memo is keyed per workspace', async () => {
  await withStatusCacheEnv(undefined, async () => {
    const reader = countingReader(['gmail']);
    await readConnectedAppsWithCache({ entityId: 'ws-a' }, reader.read);
    await readConnectedAppsWithCache({ entityId: 'ws-b' }, reader.read);
    await readConnectedAppsWithCache({ entityId: 'ws-a' }, reader.read);

    // One call per workspace — a shared entry would leak one tenant's
    // connections into another's readiness report.
    assert.equal(reader.state.calls, 2);
  });
});

test('invalidating one workspace leaves its neighbours memoised', async () => {
  await withStatusCacheEnv(undefined, async () => {
    const reader = countingReader(['gmail']);
    await readConnectedAppsWithCache({ entityId: 'ws-a' }, reader.read);
    await readConnectedAppsWithCache({ entityId: 'ws-b' }, reader.read);
    assert.equal(reader.state.calls, 2);

    // What connect/disconnect do on the workspace they touched.
    invalidatePartnerConnectionCache('ws-a');

    await readConnectedAppsWithCache({ entityId: 'ws-a' }, reader.read);
    assert.equal(reader.state.calls, 3, 'the invalidated workspace must refetch');
    await readConnectedAppsWithCache({ entityId: 'ws-b' }, reader.read);
    assert.equal(reader.state.calls, 3, 'an untouched workspace must stay memoised');
  });
});

test('COMPOSIO_STATUS_CACHE_MS=0 disables the connection memo', async () => {
  await withStatusCacheEnv('0', async () => {
    const reader = countingReader(['gmail']);
    const ctx = { entityId: 'ws-no-cache' };
    await readConnectedAppsWithCache(ctx, reader.read);
    await readConnectedAppsWithCache(ctx, reader.read);
    assert.equal(reader.state.calls, 2);
  });
});

test('a non-numeric COMPOSIO_STATUS_CACHE_MS falls back to the default TTL', async () => {
  await withStatusCacheEnv('twenty seconds', async () => {
    const reader = countingReader(['gmail']);
    const ctx = { entityId: 'ws-bad-ttl' };
    await readConnectedAppsWithCache(ctx, reader.read);
    await readConnectedAppsWithCache(ctx, reader.read);
    // Garbage configuration must not silently mean "cache forever" or "never".
    assert.equal(reader.state.calls, 1);
  });
});

test('an expired memo is refetched rather than served stale', async () => {
  await withStatusCacheEnv('1', async () => {
    const reader = countingReader(['gmail']);
    const ctx = { entityId: 'ws-expiry' };
    await readConnectedAppsWithCache(ctx, reader.read);
    await new Promise((resolve) => setTimeout(resolve, 10));
    await readConnectedAppsWithCache(ctx, reader.read);
    assert.equal(reader.state.calls, 2);
  });
});

test('an unreachable Composio is reported degraded and never memoised', async () => {
  await withStatusCacheEnv(undefined, async () => {
    let calls = 0;
    const ctx = { entityId: 'ws-outage' };
    const read = async () => {
      calls += 1;
      if (calls === 1) throw new Error('composio upstream 503');
      return ['gmail'];
    };

    assert.deepEqual(await readConnectedAppsWithCache(ctx, read), { apps: [], ok: false });
    // A memoised outage would keep the UI degraded after Composio recovered.
    assert.deepEqual(await readConnectedAppsWithCache(ctx, read), { apps: ['gmail'], ok: true });
    assert.equal(calls, 2);
  });
});

test('a failed read clears a memo taken before the outage', async () => {
  await withStatusCacheEnv(undefined, async () => {
    let calls = 0;
    const ctx = { entityId: 'ws-outage-after-hit' };
    const read = async () => {
      calls += 1;
      if (calls === 2) throw new Error('composio upstream 503');
      return ['gmail'];
    };

    assert.deepEqual(await readConnectedAppsWithCache(ctx, read), { apps: ['gmail'], ok: true });
    // Force the second (failing) read.
    invalidatePartnerConnectionCache(ctx.entityId);
    assert.deepEqual(await readConnectedAppsWithCache(ctx, read), { apps: [], ok: false });
    // The third read must go upstream, not resurrect the pre-outage entry.
    assert.deepEqual(await readConnectedAppsWithCache(ctx, read), { apps: ['gmail'], ok: true });
    assert.equal(calls, 3);
  });
});
