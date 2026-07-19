import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createComposioBridge,
  type ComposioClientAdapter,
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
        return { redirectUrl: 'https://auth.example/connect' };
      },
      async list(query) {
        calls.push({ operation: 'list-connected-accounts', payload: query });
        return {
          items: [
            { toolkit: { slug: 'github' } },
            { toolkit: { slug: 'slack' } },
            { toolkit: null },
          ],
        };
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
  assert.equal(
    await bridge.getConnectionUrl('GitHub', { entityId: 'workspace-123' }),
    'https://auth.example/connect',
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
    },
  };
  const bridge = createComposioBridge(client);

  assert.equal(
    await bridge.getConnectionUrl('Slack', { entityId: 'workspace-123' }),
    'https://auth.example/new',
  );
  assert.deepEqual(calls, [
    'list',
    'create:slack:use_composio_managed_auth',
    'link:auth-created',
  ]);
});

test('Composio bridge remains disabled without a configured client', async () => {
  const bridge = createComposioBridge(null);

  assert.equal(bridge.isEnabled(), false);
  assert.equal(
    await bridge.getConnectionUrl('github', { entityId: 'workspace-123' }),
    null,
  );
  assert.deepEqual(
    await bridge.listConnectedApps({ entityId: 'workspace-123' }),
    [],
  );
  await assert.rejects(
    bridge.executeAction('GITHUB_CREATE_ISSUE', {}, { entityId: 'workspace-123' }),
    /Composio is not configured/,
  );
});
