import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test, { after } from 'node:test';

// The workspace store resolves its file path from process.cwd() at import time,
// so the temp workspace has to be in place before any platform module loads.
const originalCwd = process.cwd();
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'violema-tenancy-'));
process.chdir(tempDir);

const FIXTURE_TIMESTAMP = '2026-08-01T12:00:00.000Z';

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

async function withDemoEnv<T>(value: string | undefined, run: () => Promise<T> | T): Promise<T> {
  const previous = process.env.DEMO_WORKSPACE_IDS;
  if (typeof value === 'string') process.env.DEMO_WORKSPACE_IDS = value;
  else delete process.env.DEMO_WORKSPACE_IDS;
  try {
    return await run();
  } finally {
    if (typeof previous === 'string') process.env.DEMO_WORKSPACE_IDS = previous;
    else delete process.env.DEMO_WORKSPACE_IDS;
  }
}

test('internal demo routing covers the default workspace and unattributed work', async () => {
  writeWorkspaces([]);
  const { usesInternalDemoRouting } = await import('../src/platform/tenancy');
  const { DEFAULT_WORKSPACE_ID } = await import('../src/platform/workspace');

  await withDemoEnv(undefined, () => {
    assert.equal(usesInternalDemoRouting(DEFAULT_WORKSPACE_ID), true);
    // Seeded automations carry no workspaceId; they are Max's.
    assert.equal(usesInternalDemoRouting(undefined), true);
    assert.equal(usesInternalDemoRouting(null), true);
    assert.equal(usesInternalDemoRouting(''), true);
    assert.equal(usesInternalDemoRouting('   '), true);
  });
});

test('internal demo routing never covers a tenant workspace', async () => {
  writeWorkspaces([workspaceFixture('workspace_abc123')]);
  const { usesInternalDemoRouting, isTenantWorkspace } = await import('../src/platform/tenancy');
  const { DEFAULT_WORKSPACE_ID } = await import('../src/platform/workspace');

  await withDemoEnv(undefined, () => {
    assert.equal(usesInternalDemoRouting('workspace_abc123'), false);
    assert.equal(isTenantWorkspace('workspace_abc123'), true);
    assert.equal(isTenantWorkspace(DEFAULT_WORKSPACE_ID), false);
  });
});

test('internal demo routing covers workspaces flagged demo via env', async () => {
  writeWorkspaces([]);
  const { usesInternalDemoRouting } = await import('../src/platform/tenancy');

  await withDemoEnv('workspace_demo_one, workspace_demo_two', () => {
    assert.equal(usesInternalDemoRouting('workspace_demo_one'), true);
    assert.equal(usesInternalDemoRouting('workspace_demo_two'), true);
    assert.equal(usesInternalDemoRouting('workspace_not_demo'), false);
  });
});

test('internal demo routing covers workspaces flagged demo via profile metadata', async () => {
  writeWorkspaces([
    workspaceFixture('workspace_meta_demo', { demo: true }),
    workspaceFixture('workspace_real_tenant'),
  ]);
  const { usesInternalDemoRouting } = await import('../src/platform/tenancy');

  await withDemoEnv(undefined, () => {
    assert.equal(usesInternalDemoRouting('workspace_meta_demo'), true);
    assert.equal(usesInternalDemoRouting('workspace_real_tenant'), false);
  });
});

test('only the default workspace may use server integration credentials', async () => {
  writeWorkspaces([]);
  const { canUseServerIntegrationCredentials } = await import('../src/platform/tenancy');
  const { DEFAULT_WORKSPACE_ID } = await import('../src/platform/workspace');

  assert.equal(canUseServerIntegrationCredentials(DEFAULT_WORKSPACE_ID), true);
  assert.equal(canUseServerIntegrationCredentials('workspace_abc123'), false);
  // No unattributed allowance here: an empty id fails closed rather than
  // inheriting the default workspace's credentials.
  assert.equal(canUseServerIntegrationCredentials(''), false);
  assert.equal(canUseServerIntegrationCredentials(undefined), false);
  assert.equal(canUseServerIntegrationCredentials(null), false);
});

test('demo workspaces may not use server integration credentials', async () => {
  writeWorkspaces([workspaceFixture('workspace_meta_demo', { demo: true })]);
  const { usesInternalDemoRouting, canUseServerIntegrationCredentials } = await import(
    '../src/platform/tenancy'
  );

  await withDemoEnv('workspace_demo_one', () => {
    // Demo workspaces get labeled sample data, never our live Stripe account.
    assert.equal(usesInternalDemoRouting('workspace_demo_one'), true);
    assert.equal(canUseServerIntegrationCredentials('workspace_demo_one'), false);

    assert.equal(usesInternalDemoRouting('workspace_meta_demo'), true);
    assert.equal(canUseServerIntegrationCredentials('workspace_meta_demo'), false);
  });
});
