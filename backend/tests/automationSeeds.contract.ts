import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { buildMissionRecords } from '../src/platform/missions';

test('ensureCoreAutomationSeeds creates the weekly founder update mission workflow once', async () => {
  const originalCwd = process.cwd();
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'violema-automation-seeds-'));
  let scheduler: typeof import('../src/scheduler') | null = null;
  process.chdir(tempDir);

  try {
    scheduler = await import('../src/scheduler');

    scheduler.ensureCoreAutomationSeeds(async () => ({ ok: true }));
    scheduler.ensureCoreAutomationSeeds(async () => ({ ok: true }));

    const automations = scheduler.listAutomations();
    const weekly = automations.find((item) => item.id === 'auto_weekly_founder_update');

    assert.ok(weekly, 'Expected weekly founder update seed.');
    assert.equal(automations.filter((item) => item.id === 'auto_weekly_founder_update').length, 1);
    assert.equal(weekly.name, 'Weekly founder update');
    assert.equal(weekly.status, 'active');
    assert.equal(weekly.schedule, 'every monday at 9am');
    assert.equal(weekly.cron_expression, '0 9 * * 1');
    assert.equal(weekly.timezone, 'America/Chicago');
    assert.equal(weekly.execution_policy?.reviewPolicy, 'standard');
    assert.equal(weekly.notify, '#all-purple-orange');
    assert.equal(weekly.version, 3);
    assert.deepEqual(
      weekly.steps
        ?.filter((step) => step.kind === 'query')
        .map((step) => step.inputs?.source),
      ['stripe', 'github', 'linear', 'email', 'calendar', 'google_drive'],
    );
    assert.ok(weekly.steps?.some((step) => step.kind === 'search'), 'Expected Tavily market-search step.');
    assert.ok(weekly.steps?.some((step) => step.kind === 'summarize'), 'Expected founder brief step.');
    assert.ok(
      weekly.steps?.some(
        (step) =>
          step.deliveryTarget?.channel === 'slack' &&
          step.deliveryTarget.target === '#all-purple-orange' &&
          step.inputs?.approval_required === true,
      ),
      'Expected approval-gated Slack delivery step.',
    );

    const missions = buildMissionRecords({
      workspaceId: 'purpleorangehq',
      automations,
      tasks: [],
      taskRuns: [],
    });
    const mission = missions.find((item) => item.automationId === 'auto_weekly_founder_update');
    assert.ok(mission, 'Expected seed to produce a mission record.');
    assert.equal(mission.workflowTemplateId, 'weekly-founder-update');
    assert.equal(mission.review.policy, 'before_delivery');
    assert.equal(mission.review.approvalChannel, 'slack');

    const legacy = {
      ...weekly,
      version: 2,
      created_at: '2026-06-01T12:00:00.000Z',
      last_run_at: '2026-07-18T12:00:00.000Z',
      last_run_status: 'succeeded' as const,
      consecutive_failures: 0,
      steps: weekly.steps?.filter(
        (step) => !['linear', 'google_drive'].includes(String(step.inputs?.source || '')),
      ),
    };
    fs.writeFileSync(
      path.join(tempDir, 'automations.json'),
      JSON.stringify([legacy], null, 2),
    );

    scheduler.ensureCoreAutomationSeeds(async () => ({ ok: true }));
    const upgraded = scheduler.listAutomations().find(
      (item) => item.id === 'auto_weekly_founder_update',
    );

    assert.ok(upgraded, 'Expected upgraded weekly founder seed.');
    assert.equal(upgraded.version, 3);
    assert.equal(upgraded.created_at, '2026-06-01T12:00:00.000Z');
    assert.equal(upgraded.last_run_at, '2026-07-18T12:00:00.000Z');
    assert.equal(upgraded.last_run_status, 'succeeded');
    assert.deepEqual(
      upgraded.steps
        ?.filter((step) => step.kind === 'query')
        .map((step) => step.inputs?.source),
      ['stripe', 'github', 'linear', 'email', 'calendar', 'google_drive'],
    );
  } finally {
    scheduler?.deleteAutomation('auto_weekly_founder_update');
    process.chdir(originalCwd);
  }
});

test('createAutomation persists optional workspaceId without forcing a default', async () => {
  const originalCwd = process.cwd();
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'violema-automation-workspace-'));
  let scheduler: typeof import('../src/scheduler') | null = null;
  process.chdir(tempDir);

  try {
    scheduler = await import('../src/scheduler');

    const workspaceScoped = scheduler.createAutomation({
      workspaceId: 'workspace_acme',
      name: 'Workspace scoped automation',
      schedule: 'daily at 9am',
      actions: ['Check Stripe revenue'],
    }, async () => ({ ok: true }));

    const legacyShaped = scheduler.createAutomation({
      name: 'Legacy shaped automation',
      schedule: 'daily at 10am',
      actions: ['Check GitHub delivery'],
    }, async () => ({ ok: true }));

    const stored = scheduler.listAutomations();
    const scopedRecord = stored.find((item) => item.id === workspaceScoped.id);
    const legacyRecord = stored.find((item) => item.id === legacyShaped.id);

    assert.equal(scopedRecord?.workspaceId, 'workspace_acme');
    assert.equal(legacyRecord?.workspaceId, undefined);
  } finally {
    scheduler?.listAutomations().forEach((item) => {
      scheduler?.deleteAutomation(item.id);
    });
    process.chdir(originalCwd);
  }
});
