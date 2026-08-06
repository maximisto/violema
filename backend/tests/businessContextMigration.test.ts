import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'violema-business-context-migration-'));
process.chdir(tempDir);

const AUTOMATIONS_FILE = path.join(tempDir, 'automations.json');

const LEGACY_COMPETITOR_QUERY = 'AI agent automation platform competitor pricing launches positioning';
const ESPRESSO_QUERY =
  'AI-powered espresso machine competitors smart coffee machine pricing launches product announcements';

function writeAutomations(records: unknown[]) {
  fs.writeFileSync(AUTOMATIONS_FILE, JSON.stringify(records, null, 2));
}

function legacyRecord(id: string, workspaceId: string | undefined, query: string) {
  return {
    id,
    workspaceId,
    version: 2,
    name: 'Competitor monitor',
    schedule: 'every monday at 8am',
    cron_expression: '0 8 * * 1',
    timezone: 'America/Chicago',
    actions: [],
    status: 'active',
    created_at: '2026-08-01T12:00:00.000Z',
    steps: [
      {
        id: 'step_competitor_search',
        kind: 'search',
        title: 'Search competitor moves',
        objective: 'Find pricing, launch, and positioning changes.',
        inputs: { query, num_results: 8 },
      },
      {
        id: 'step_delta_analysis',
        kind: 'analyze',
        title: 'Extract what changed',
        objective: 'Compare against the library.',
        inputs: { instruction: 'Compare the evidence.' },
      },
      {
        id: 'step_competitor_memo',
        kind: 'summarize',
        title: 'Draft competitor memo',
        objective: 'Create the memo.',
        inputs: { instruction: 'Draft the memo.' },
      },
    ],
  };
}

test('migration rewrites legacy queries, backfills contexts, and is idempotent', async () => {
  const scheduler = await import('../src/scheduler');
  const workspace = await import('../src/platform/workspace');

  writeAutomations([
    // Seed-id shape in the default workspace.
    legacyRecord('auto_competitor_monitor', undefined, LEGACY_COMPETITOR_QUERY),
    // Template-copy shape in a tenant workspace, carrying the espresso patch.
    legacyRecord('auto_1754500000000', 'workspace_espresso_tenant', ESPRESSO_QUERY),
  ]);

  const first = scheduler.runBusinessContextMigration();
  assert.equal(first.rewrittenAutomations, 2);
  assert.ok(first.backfilled >= 2, 'founder + espresso workspaces backfilled');

  // The espresso tenant's market moved INTO its workspace context…
  const espressoCtx = workspace.getBusinessContext('workspace_espresso_tenant');
  assert.ok(espressoCtx);
  assert.ok(espressoCtx.marketKeywords.some((keyword) => /espresso/i.test(keyword)));

  // …the founder workspace got Violema's context, viktor.com included…
  const founderCtx = workspace.getBusinessContext('purpleorangehq');
  assert.ok(founderCtx);
  assert.ok(founderCtx.competitors.includes('viktor.com'));

  // …and every legacy query is now the reference form with flags on consumers.
  const stored = JSON.parse(fs.readFileSync(AUTOMATIONS_FILE, 'utf8'));
  for (const record of stored) {
    const search = record.steps.find((step: { id: string }) => step.id === 'step_competitor_search');
    assert.equal(search.inputs.use_business_context, true);
    assert.equal(search.inputs.query, undefined);
    assert.equal(search.inputs.num_results, 8, 'num_results survives the rewrite');
    const analyze = record.steps.find((step: { id: string }) => step.id === 'step_delta_analysis');
    assert.equal(analyze.inputs.use_business_context, true);
    const memo = record.steps.find((step: { id: string }) => step.id === 'step_competitor_memo');
    assert.equal(memo.inputs.use_business_context, true);
  }

  // Second run: nothing left to do.
  const second = scheduler.runBusinessContextMigration();
  assert.equal(second.rewrittenAutomations, 0);
  assert.equal(second.backfilled, 0);
});

test('migration leaves non-legacy queries and set contexts alone', async () => {
  const scheduler = await import('../src/scheduler');
  const workspace = await import('../src/platform/workspace');

  writeAutomations([
    legacyRecord('auto_custom', 'workspace_custom', 'my own handwritten espresso query'),
  ]);
  const before = workspace.getBusinessContext('purpleorangehq');

  const result = scheduler.runBusinessContextMigration();
  assert.equal(result.rewrittenAutomations, 0);

  const stored = JSON.parse(fs.readFileSync(AUTOMATIONS_FILE, 'utf8'));
  assert.equal(stored[0].steps[0].inputs.query, 'my own handwritten espresso query');
  assert.deepEqual(workspace.getBusinessContext('purpleorangehq'), before, 'existing context untouched');
});
