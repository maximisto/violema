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
    assert.ok(weekly.steps?.some((step) => step.inputs?.source === 'stripe'), 'Expected Stripe revenue step.');
    assert.ok(weekly.steps?.some((step) => step.inputs?.source === 'github'), 'Expected GitHub delivery/risk step.');
    assert.ok(weekly.steps?.some((step) => step.inputs?.source === 'calendar'), 'Expected calendar step.');
    assert.ok(weekly.steps?.some((step) => step.deliveryTarget?.channel === 'slack'), 'Expected Slack delivery step.');

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
  } finally {
    scheduler?.deleteAutomation('auto_weekly_founder_update');
    process.chdir(originalCwd);
  }
});
