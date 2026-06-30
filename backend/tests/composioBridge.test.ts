import assert from 'node:assert/strict';
import Module from 'node:module';
import test from 'node:test';

interface FetchRequest {
  url: URL;
  init: RequestInit | undefined;
  body: unknown;
}

type ComposioBridgeModule = typeof import('../src/composioBridge');
type ModuleLoader = (request: string, parent: NodeModule | null | undefined, isMain: boolean) => unknown;

const ORIGINAL_ENV = {
  COMPOSIO_API_KEY: process.env.COMPOSIO_API_KEY,
  COMPOSIO_BASE_URL: process.env.COMPOSIO_BASE_URL,
  COMPOSIO_AUTH_CONFIG_ID_GOOGLEDRIVE: process.env.COMPOSIO_AUTH_CONFIG_ID_GOOGLEDRIVE,
};

function resetComposioBridge(): ComposioBridgeModule {
  const modulePath = require.resolve('../src/composioBridge');
  delete require.cache[modulePath];
  return require('../src/composioBridge') as ComposioBridgeModule;
}

function restoreEnvVar(name: string, value: string | undefined) {
  if (value === undefined) {
    delete process.env[name];
    return;
  }
  process.env[name] = value;
}

async function withBridge<T>(
  fn: (bridge: ComposioBridgeModule, requests: FetchRequest[]) => Promise<T>,
): Promise<T> {
  process.env.COMPOSIO_API_KEY = 'cmp_test_key';
  process.env.COMPOSIO_BASE_URL = 'https://composio.test';
  delete process.env.COMPOSIO_AUTH_CONFIG_ID_GOOGLEDRIVE;

  const requests: FetchRequest[] = [];
  const originalFetch = globalThis.fetch;
  const moduleWithLoader = Module as unknown as { _load: ModuleLoader };
  const originalLoad = moduleWithLoader._load;

  (globalThis as unknown as { fetch: typeof fetch }).fetch = async (input, init) => {
    const url = input instanceof URL
      ? input
      : new URL(typeof input === 'string' ? input : input.url);
    const body = typeof init?.body === 'string' ? JSON.parse(init.body) : init?.body;
    requests.push({ url, init, body });

    if (url.pathname === '/api/v3.1/tools/execute/GMAIL_FETCH_EMAILS') {
      return Response.json({ data: { threads: [] }, error: null, successful: true });
    }

    if (url.pathname === '/api/v3.1/tools/execute/GOOGLEDRIVE_LIST_FILES') {
      return Response.json({
        data: null,
        error: {
          message: 'Request had insufficient authentication scopes. ACCESS_TOKEN_SCOPE_INSUFFICIENT raw-provider-body',
        },
        successful: false,
      });
    }

    if (url.pathname === '/api/v3.1/connected_accounts') {
      return Response.json({
        items: [
          { status: 'ACTIVE', is_disabled: false, toolkit: { slug: 'gmail' } },
          { status: 'ACTIVE', is_disabled: false, toolkit: { slug: 'googlecalendar' } },
          { status: 'FAILED', is_disabled: false, toolkit: { slug: 'slack' } },
          { status: 'ACTIVE', is_disabled: true, toolkit: { slug: 'googledrive' } },
        ],
        total_pages: 1,
      });
    }

    if (url.pathname === '/api/v3.1/auth_configs' && init?.method === 'GET') {
      return Response.json({ items: [{ id: 'auth_drive' }], total_pages: 1 });
    }

    if (url.pathname === '/api/v3.1/connected_accounts/link') {
      return Response.json({
        connected_account_id: 'ca_drive',
        expires_at: '2026-07-01T00:00:00.000Z',
        link_token: 'link_test',
        redirect_url: 'https://dashboard.composio.dev/link/link_test',
      });
    }

    return Response.json({ error: `Unexpected ${init?.method || 'GET'} ${url.pathname}` }, { status: 500 });
  };

  moduleWithLoader._load = function patchedLoad(
    this: unknown,
    request: string,
    parent: NodeModule | null | undefined,
    isMain: boolean,
  ) {
    if (request === 'composio-core') {
      return {
        ComposioToolSet: class LegacyComposioToolSet {
          client = {
            getEntity: async () => ({
              getConnections: async () => [{ appName: 'legacy_gmail' }],
              initiateConnection: async () => ({ redirectUrl: 'https://legacy.composio.test/connect' }),
            }),
          };

          async executeAction() {
            return { legacy: true };
          }
        },
      };
    }
    return Reflect.apply(originalLoad, this, [request, parent, isMain]);
  };

  const bridge = resetComposioBridge();
  try {
    return await fn(bridge, requests);
  } finally {
    resetComposioBridge();
    (globalThis as unknown as { fetch: typeof fetch }).fetch = originalFetch;
    moduleWithLoader._load = originalLoad;
    restoreEnvVar('COMPOSIO_API_KEY', ORIGINAL_ENV.COMPOSIO_API_KEY);
    restoreEnvVar('COMPOSIO_BASE_URL', ORIGINAL_ENV.COMPOSIO_BASE_URL);
    restoreEnvVar('COMPOSIO_AUTH_CONFIG_ID_GOOGLEDRIVE', ORIGINAL_ENV.COMPOSIO_AUTH_CONFIG_ID_GOOGLEDRIVE);
  }
}

test('executeComposioAction calls the current v3.1 tool execution endpoint', async () => {
  await withBridge(async (bridge, requests) => {
    const result = await bridge.executeComposioAction(
      'GMAIL_FETCH_EMAILS',
      { query: 'from:founder@example.com', maxResults: 10 },
      { entityId: 'workspace_test' },
    );

    assert.deepEqual(result, { threads: [] });
    assert.equal(requests.length, 1);
    assert.equal(requests[0].url.pathname, '/api/v3.1/tools/execute/GMAIL_FETCH_EMAILS');
    assert.equal(requests[0].init?.method, 'POST');
    assert.equal(requests[0].init?.headers && (requests[0].init.headers as Record<string, string>)['x-api-key'], 'cmp_test_key');
    assert.deepEqual(requests[0].body, {
      arguments: { query: 'from:founder@example.com', maxResults: 10 },
      user_id: 'workspace_test',
      version: 'latest',
    });
  });
});

test('executeComposioAction classifies insufficient OAuth scopes without leaking provider error text', async () => {
  await withBridge(async (bridge) => {
    await assert.rejects(
      () => bridge.executeComposioAction(
        'GOOGLEDRIVE_LIST_FILES',
        { pageSize: 1 },
        { entityId: 'workspace_test' },
      ),
      (err: unknown) => {
        const typed = err as Error & { code?: string };
        assert.equal(typed.message, 'Composio action failed.');
        assert.equal(typed.code, 'insufficient_scope');
        assert.doesNotMatch(JSON.stringify(typed), /raw-provider-body|ACCESS_TOKEN_SCOPE_INSUFFICIENT/);
        return true;
      },
    );
  });
});

test('listConnectedApps lists active Composio toolkit slugs for the workspace user', async () => {
  await withBridge(async (bridge, requests) => {
    const apps = await bridge.listConnectedApps({ entityId: 'workspace_test' });

    assert.deepEqual(apps, ['gmail', 'googlecalendar']);
    assert.equal(requests.length, 1);
    assert.equal(requests[0].url.pathname, '/api/v3.1/connected_accounts');
    assert.equal(requests[0].url.searchParams.get('user_ids'), 'workspace_test');
    assert.equal(requests[0].url.searchParams.get('statuses'), 'ACTIVE');
  });
});

test('getComposioConnectionUrl starts OAuth through auth configs and connected account links', async () => {
  await withBridge(async (bridge, requests) => {
    const redirectUrl = await bridge.getComposioConnectionUrl('google_drive', {
      entityId: 'workspace_test',
    });

    assert.equal(redirectUrl, 'https://dashboard.composio.dev/link/link_test');
    assert.equal(requests.length, 2);
    assert.equal(requests[0].url.pathname, '/api/v3.1/auth_configs');
    assert.equal(requests[0].url.searchParams.get('toolkit_slug'), 'googledrive');
    assert.equal(requests[1].url.pathname, '/api/v3.1/connected_accounts/link');
    assert.deepEqual(requests[1].body, {
      auth_config_id: 'auth_drive',
      user_id: 'workspace_test',
    });
  });
});

test('getComposioConnectionUrl can use a configured custom auth config id', async () => {
  await withBridge(async (bridge, requests) => {
    process.env.COMPOSIO_AUTH_CONFIG_ID_GOOGLEDRIVE = 'auth_custom_drive';

    const redirectUrl = await bridge.getComposioConnectionUrl('google_drive', {
      entityId: 'workspace_test',
    });

    assert.equal(redirectUrl, 'https://dashboard.composio.dev/link/link_test');
    assert.equal(requests.length, 1);
    assert.equal(requests[0].url.pathname, '/api/v3.1/connected_accounts/link');
    assert.deepEqual(requests[0].body, {
      auth_config_id: 'auth_custom_drive',
      user_id: 'workspace_test',
    });
  });
});
