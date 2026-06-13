import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';

test('admin dashboard summarizes users, workspaces, and run performance', async () => {
  const originalCwd = process.cwd();
  const tempDir = mkdtempSync(path.join(tmpdir(), 'violema-admin-dashboard-'));

  try {
    process.chdir(tempDir);
    const auth = await import('../src/auth');
    const access = await import('../src/adminAccessStore');
    const workspace = await import('../src/platform/workspace');
    const billing = await import('../src/platform/billing');
    const store = await import('../src/platform/store');
    const dashboard = await import('../src/adminDashboard');

    access.setAccessStatus({
      email: 'client@example.com',
      status: 'approved',
      role: 'user',
      note: 'Client beta',
      updatedBy: 'max@violema.com',
    });
    auth.upsertAuthUser({
      email: 'client@example.com',
      name: 'Client User',
      role: 'user',
      method: 'email',
      acceptedTerms: true,
      acceptedEducation: true,
    });
    auth.createAuthSession(auth.listAuthUsers()[0].id);
    workspace.upsertWorkspaceProfile('client-acme', {
      name: 'Acme',
      ownerEmail: 'client@example.com',
      slug: 'acme',
    });
    assert.equal(billing.listBillingConfigs().length, 0);
    const starterWorkspaces = dashboard.buildAdminWorkspaces();
    assert.equal(starterWorkspaces[0].planId, 'starter');
    assert.equal(billing.listBillingConfigs().length, 0);

    billing.upsertBillingConfig('client-acme', {
      planId: 'pro',
      subscriptionStatus: 'active',
    });
    const task = store.createTask({
      workspaceId: 'client-acme',
      title: 'Revenue digest',
      kind: 'report',
    });
    const run = store.createTaskRun({
      workspaceId: 'client-acme',
      taskId: task.id,
      agentRole: 'analyst',
      modelTier: 'default',
      estimatedCredits: 12,
    });
    store.finalizeTaskRun(run.id, {
      status: 'succeeded',
      actualCredits: 10,
      metadata: { title: 'Revenue digest' },
    });

    const overview = dashboard.buildAdminOverview();
    assert.equal(overview.metrics.approvedUsers, 1);
    assert.equal(overview.metrics.workspaces, 1);
    assert.equal(overview.metrics.totalRuns, 1);
    assert.equal(overview.metrics.runSuccessRate, 100);

    const users = dashboard.buildAdminUsers();
    assert.equal(users[0].email, 'client@example.com');
    assert.equal(users[0].activeSessionCount, 1);
    assert.equal(users[0].approvedAccess, true);

    const workspaces = dashboard.buildAdminWorkspaces();
    assert.equal(workspaces[0].workspaceId, 'client-acme');
    assert.equal(workspaces[0].planId, 'pro');
    assert.equal(workspaces[0].runSuccessRate, 100);

    dashboard.buildWorkspaceAdminDetail('missing-workspace');
    assert.equal(workspace.listWorkspaces().length, 1);
    assert.equal(billing.listBillingConfigs().length, 1);

    const createFailedRun = (workspaceId: string, title: string, finishedAt: string) => {
      const failedTask = store.createTask({
        workspaceId,
        title,
        kind: 'report',
      });
      const failedRun = store.createTaskRun({
        workspaceId,
        taskId: failedTask.id,
        agentRole: 'analyst',
        modelTier: 'default',
        estimatedCredits: 5,
      });
      store.updateTaskRun(failedRun.id, {
        status: 'failed',
        actualCredits: 5,
        finishedAt,
        metadata: { title },
      });
      return failedRun.id;
    };

    workspace.upsertWorkspaceProfile('client-newer', {
      name: 'Newer Client',
      ownerEmail: 'newer@example.com',
      slug: 'newer-client',
    });
    const newestFailureId = createFailedRun('client-newer', 'Newest failure', '2026-06-13T16:00:00.000Z');

    workspace.upsertWorkspaceProfile('client-older', {
      name: 'Older Client',
      ownerEmail: 'older@example.com',
      slug: 'older-client',
    });
    for (let index = 0; index < 8; index += 1) {
      createFailedRun('client-older', `Older failure ${index}`, `2026-06-12T0${index}:00:00.000Z`);
    }

    const overviewWithFailures = dashboard.buildAdminOverview();
    assert.equal(overviewWithFailures.recentFailedRuns[0].id, newestFailureId);
    assert.ok(overviewWithFailures.recentFailedRuns.some((failedRun) => failedRun.id === newestFailureId));
    assert.equal(overviewWithFailures.recentFailedRuns.length, 8);
  } finally {
    process.chdir(originalCwd);
    rmSync(tempDir, { recursive: true, force: true });
  }
});
