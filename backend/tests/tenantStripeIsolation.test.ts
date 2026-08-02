import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test, { after } from 'node:test';

// Both the settings store and the workspace store resolve their file paths from
// process.cwd() at import time, so the temp cwd has to exist first.
const originalCwd = process.cwd();
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'violema-tenant-stripe-'));
process.chdir(tempDir);

const originalSettingsSecret = process.env.WORKSPACE_SETTINGS_SECRET;
const originalStripeKey = process.env.STRIPE_SECRET_KEY;
const originalDemoIds = process.env.DEMO_WORKSPACE_IDS;

process.env.WORKSPACE_SETTINGS_SECRET = 'test-settings-secret';
// Stands in for Violema's own account being configured on the server. Synthetic
// and non-functional — the point is that nobody but the default workspace may
// reach it.
process.env.STRIPE_SECRET_KEY = 'sk_test_violema_server_fake';
process.env.DEMO_WORKSPACE_IDS = 'workspace_demo_b';

const DEFAULT_WORKSPACE = 'purpleorangehq';
const TENANT_WORKSPACE = 'workspace_tenant_a';
const DEMO_WORKSPACE = 'workspace_demo_b';

after(() => {
  process.chdir(originalCwd);
  fs.rmSync(tempDir, { recursive: true, force: true });
  if (typeof originalSettingsSecret === 'string') process.env.WORKSPACE_SETTINGS_SECRET = originalSettingsSecret;
  else delete process.env.WORKSPACE_SETTINGS_SECRET;
  if (typeof originalStripeKey === 'string') process.env.STRIPE_SECRET_KEY = originalStripeKey;
  else delete process.env.STRIPE_SECRET_KEY;
  if (typeof originalDemoIds === 'string') process.env.DEMO_WORKSPACE_IDS = originalDemoIds;
  else delete process.env.DEMO_WORKSPACE_IDS;
});

test('only the default workspace resolves the server Stripe key', async () => {
  const { getWorkspaceScopedIntegrationCredential } = await import('../src/settingsStore');

  assert.equal(
    getWorkspaceScopedIntegrationCredential(DEFAULT_WORKSPACE, 'stripe', 'secretKey'),
    'sk_test_violema_server_fake',
  );
  // A tenant asking for Stripe gets nothing rather than our account.
  assert.equal(
    getWorkspaceScopedIntegrationCredential(TENANT_WORKSPACE, 'stripe', 'secretKey'),
    undefined,
  );
  // Demo workspaces are excluded too: labeled sample data is fine, a real read
  // of our revenue is not.
  assert.equal(
    getWorkspaceScopedIntegrationCredential(DEMO_WORKSPACE, 'stripe', 'secretKey'),
    undefined,
  );
});

test('a tenant that stored its own Stripe key resolves that key, not ours', async () => {
  const { getWorkspaceScopedIntegrationCredential, upsertWorkspaceSettings } = await import(
    '../src/settingsStore'
  );

  upsertWorkspaceSettings({
    workspaceId: TENANT_WORKSPACE,
    integrationCredentials: { stripe: { secretKey: 'sk_test_tenant_owned_fake' } },
  });

  assert.equal(
    getWorkspaceScopedIntegrationCredential(TENANT_WORKSPACE, 'stripe', 'secretKey'),
    'sk_test_tenant_owned_fake',
  );
  // And the default workspace is unaffected by the tenant's key.
  assert.equal(
    getWorkspaceScopedIntegrationCredential(DEFAULT_WORKSPACE, 'stripe', 'secretKey'),
    'sk_test_violema_server_fake',
  );
});

test('the unscoped lookup still falls back to the server key, and is why the scoped one exists', async () => {
  const { getIntegrationCredential } = await import('../src/settingsStore');

  // Documents the hazard this work fixed: the original resolver hands Violema's
  // own account to any workspace that asks. It is retained for operator-
  // configured surfaces, but never for reading customer-owned data.
  assert.equal(
    getIntegrationCredential('workspace_unrelated', 'stripe', 'secretKey'),
    'sk_test_violema_server_fake',
  );
});

test('a tenant revenue query with no own key is refused before any Stripe read', async () => {
  const { queryStripeRevenue } = await import('../src/integrationGateway/adapters/nativeStripe');

  const result = await queryStripeRevenue({
    workspaceId: 'workspace_tenant_without_key',
    queryType: 'revenue_summary',
  });

  assert.equal(result.ok, false);
  // 'integration_not_ready' is only reachable on the pre-read short circuit.
  // Had the env key been used, the outcome would be ok:true or
  // 'integration_query_failed' — both of which require a Stripe call to have
  // already been attempted. So this asserts no read happened.
  assert.equal(result.ok === false && result.code, 'integration_not_ready');
  assert.equal(result.ok === false && result.source, 'stripe');
  assert.equal(result.ok === false && result.nextAction?.label, 'Connect Stripe');
  assert.equal(
    result.ok === false && result.nextAction?.route,
    '/integrations?provider=stripe&workflow=revenue-watch',
  );
});

test('a demo workspace revenue query is refused before any Stripe read', async () => {
  const { queryStripeRevenue } = await import('../src/integrationGateway/adapters/nativeStripe');

  const result = await queryStripeRevenue({
    workspaceId: DEMO_WORKSPACE,
    queryType: 'revenue_summary',
  });

  assert.equal(result.ok, false);
  assert.equal(result.ok === false && result.code, 'integration_not_ready');
});

test('a tenant with its own key reaches the Stripe read path', async () => {
  const { queryStripeRevenue } = await import('../src/integrationGateway/adapters/nativeStripe');

  // The tenant stored a key in an earlier case, so readiness is satisfied and
  // the adapter proceeds to query — with a fake client, so no network happens.
  const result = await queryStripeRevenue({
    workspaceId: TENANT_WORKSPACE,
    queryType: 'revenue_summary',
    now: new Date('2026-08-01T12:00:00.000Z'),
    client: {
      subscriptions: { list: async () => ({ data: [], has_more: false }) },
      invoices: { list: async () => ({ data: [], has_more: false }) },
      charges: { list: async () => ({ data: [], has_more: false }) },
    },
  });

  assert.equal(result.ok, true);
});
