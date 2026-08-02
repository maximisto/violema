import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

// `AUTOMATIONS_FILE` is bound from `process.cwd()` when the scheduler is first
// imported, so this file owns its own store: chdir at module scope, then import
// dynamically. (`automationSeeds.contract.ts` claims its own temp dir the same
// way, which is why these tests cannot live there.)
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'violema-seed-merge-'));
process.chdir(tempDir);

const AUTOMATIONS_FILE = path.join(tempDir, 'automations.json');
const FOUNDER_SEED_ID = 'auto_weekly_founder_update';
const LEARNING_BRIEF_SEED_ID = 'auto_platform_learning_brief';

function writeAutomations(records: unknown[]) {
  fs.writeFileSync(AUTOMATIONS_FILE, JSON.stringify(records, null, 2));
}

test('the Platform learning brief seed is internal, weekly, and review-gated', async () => {
  const scheduler = await import('../src/scheduler');
  const { PLATFORM_TELEMETRY_SOURCE, PLATFORM_LEARNING_BRIEF_WORKFLOW_ID } =
    await import('../src/platform/platformTelemetry');

  scheduler.ensureCoreAutomationSeeds(async () => ({ ok: true }));
  const brief = scheduler.listAutomations().find((item) => item.id === LEARNING_BRIEF_SEED_ID);

  assert.ok(brief, 'Expected the Platform learning brief seed.');
  assert.equal(brief.name, 'Platform learning brief');
  assert.equal(brief.status, 'active');
  assert.equal(brief.workflowId, PLATFORM_LEARNING_BRIEF_WORKFLOW_ID);
  // Friday 16:00 UTC.
  assert.equal(brief.cron_expression, '0 16 * * 5');
  assert.equal(brief.timezone, 'UTC');
  assert.equal(brief.notify, '#violema-demo');
  // Unattributed on purpose: internal work, which resolves to the default
  // workspace at run time — the only one platform_telemetry answers for.
  assert.equal(brief.workspaceId, undefined);
  assert.equal(brief.execution_policy?.optimizationGoal, 'quality_first');

  assert.deepEqual(
    brief.steps?.map((step) => step.kind),
    ['query', 'analyze', 'summarize', 'deliver'],
  );

  const querySteps = brief.steps?.filter((step) => step.kind === 'query') || [];
  assert.deepEqual(querySteps.map((step) => step.inputs?.source), [PLATFORM_TELEMETRY_SOURCE]);

  const analyzeStep = brief.steps?.find((step) => step.kind === 'analyze');
  const instruction = String(analyzeStep?.inputs?.instruction || '');
  assert.match(instruction, /WHAT IMPROVED/);
  assert.match(instruction, /BLOCKING ACTIVATION/);
  assert.match(instruction, /CORRECT MOST/);
  assert.match(instruction, /TOP 3 RECOMMENDED PLATFORM CHANGES/);
  assert.match(instruction, /cite the specific metric/i);

  // Review-gated like the founder update: nothing sends without approval.
  assert.ok(
    brief.steps?.some(
      (step) =>
        step.kind === 'deliver' &&
        step.inputs?.approval_required === true &&
        step.deliveryTarget?.channel === 'slack' &&
        step.deliveryTarget.target === '#violema-demo',
    ),
    'Expected an approval-gated Slack delivery step.',
  );
});

test('a seed version bump preserves operator-owned status, cadence, and destination', async () => {
  const scheduler = await import('../src/scheduler');

  scheduler.ensureCoreAutomationSeeds(async () => ({ ok: true }));
  const seeded = scheduler.listAutomations().find((item) => item.id === FOUNDER_SEED_ID);
  assert.ok(seeded, 'Expected the weekly founder update seed.');

  // What the store looks like after an operator paused the automation, moved it
  // off the seed's cadence, and redirected delivery — on an older seed version,
  // so the next boot will try to upgrade it.
  writeAutomations([
    {
      ...seeded,
      version: 3,
      status: 'paused',
      schedule: 'every friday at 5pm',
      cron_expression: '0 17 * * 5',
      timezone: 'America/New_York',
      notify: '#operator-picked',
      condition: 'only when revenue moved',
      created_at: '2026-06-01T12:00:00.000Z',
      last_run_at: '2026-07-18T12:00:00.000Z',
      last_run_status: 'succeeded',
      consecutive_failures: 0,
      next_run_at: undefined,
      // Older seed content, so the upgrade has something to re-propagate.
      steps: seeded.steps?.filter((step) => step.inputs?.source !== 'google_drive'),
    },
  ]);

  scheduler.ensureCoreAutomationSeeds(async () => ({ ok: true }));
  const upgraded = scheduler.listAutomations().find((item) => item.id === FOUNDER_SEED_ID);
  assert.ok(upgraded, 'Expected the upgraded founder seed.');

  // Operator-owned: untouched by the upgrade. A paused automation that silently
  // resumes on deploy is the bug this guards.
  assert.equal(upgraded.status, 'paused');
  assert.equal(upgraded.next_run_at, undefined, 'A paused automation must not be rescheduled.');
  assert.equal(upgraded.schedule, 'every friday at 5pm');
  assert.equal(upgraded.cron_expression, '0 17 * * 5');
  assert.equal(upgraded.timezone, 'America/New_York');
  assert.equal(upgraded.notify, '#operator-picked');
  assert.equal(upgraded.condition, 'only when revenue moved');
  assert.equal(upgraded.created_at, '2026-06-01T12:00:00.000Z');
  assert.equal(upgraded.last_run_at, '2026-07-18T12:00:00.000Z');
  assert.equal(upgraded.last_run_status, 'succeeded');

  // Seed-owned: the definition of the work did propagate.
  assert.equal(upgraded.version, seeded.version);
  assert.equal(upgraded.name, seeded.name);
  assert.equal(upgraded.workflowId, seeded.workflowId);
  assert.deepEqual(
    upgraded.steps?.filter((step) => step.kind === 'query').map((step) => step.inputs?.source),
    ['stripe', 'github', 'linear', 'email', 'calendar', 'google_drive'],
  );
});

test('an already-current seed is left exactly as the operator stored it', async () => {
  const scheduler = await import('../src/scheduler');

  scheduler.ensureCoreAutomationSeeds(async () => ({ ok: true }));
  const seeded = scheduler.listAutomations().find((item) => item.id === LEARNING_BRIEF_SEED_ID);
  assert.ok(seeded, 'Expected the Platform learning brief seed.');

  writeAutomations([{ ...seeded, status: 'paused', notify: '#somewhere-else', next_run_at: undefined }]);
  scheduler.ensureCoreAutomationSeeds(async () => ({ ok: true }));

  const after = scheduler.listAutomations().find((item) => item.id === LEARNING_BRIEF_SEED_ID);
  assert.equal(after?.status, 'paused');
  assert.equal(after?.notify, '#somewhere-else');
});
