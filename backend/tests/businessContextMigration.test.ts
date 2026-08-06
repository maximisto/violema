import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'violema-business-context-migration-'));
process.chdir(tempDir);

const AUTOMATIONS_FILE = path.join(tempDir, 'automations.json');

const LEGACY_COMPETITOR_QUERY = 'AI agent automation platform competitor pricing launches positioning';
const LEGACY_FOUNDER_QUERY =
  'AI automation platform startup competitor pricing product launch founder update';
const ESPRESSO_QUERY =
  'AI-powered espresso machine competitors smart coffee machine pricing launches product announcements';

function writeAutomations(records: unknown[]) {
  fs.writeFileSync(AUTOMATIONS_FILE, JSON.stringify(records, null, 2));
}

/** Timestamped snapshots the migration takes before it rewrites the file. */
function listAutomationBackups() {
  return fs.readdirSync(tempDir).filter((name) => name.startsWith('automations.json.bak.'));
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

/** The weekly founder update's legacy shape: its own query and consumer title. */
function founderRecord(id: string, workspaceId: string | undefined) {
  return {
    id,
    workspaceId,
    version: 5,
    name: 'Weekly founder update',
    schedule: 'every monday at 9am',
    cron_expression: '0 9 * * 1',
    timezone: 'America/Chicago',
    actions: [],
    status: 'active',
    created_at: '2026-08-01T12:00:00.000Z',
    steps: [
      {
        id: 'step_market_scan',
        kind: 'search',
        title: 'Scan market signals',
        objective: 'Research meaningful market changes since the last update.',
        inputs: { query: LEGACY_FOUNDER_QUERY, num_results: 6 },
      },
      {
        id: 'step_founder_brief',
        kind: 'summarize',
        title: 'Draft founder brief',
        objective: 'Synthesize a founder-ready brief.',
        inputs: { instruction: 'Draft the weekly founder update.' },
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
    // The other legacy market string, on the founder update's own step titles.
    founderRecord('auto_weekly_founder_update', undefined),
  ]);

  const backupsBefore = listAutomationBackups().length;
  const first = scheduler.runBusinessContextMigration();
  assert.equal(first.rewrittenAutomations, 3);
  assert.deepEqual(
    [...first.rewrittenAutomationIds].sort(),
    ['auto_1754500000000', 'auto_competitor_monitor', 'auto_weekly_founder_update'],
    'the migration reports which automations it rewrote, for the audit trail',
  );
  assert.ok(first.backfilled >= 2, 'founder + espresso workspaces backfilled');

  // A rewriting run snapshots the file it is about to overwrite.
  assert.equal(
    listAutomationBackups().length,
    backupsBefore + 1,
    'a rewriting run leaves a timestamped .bak sibling',
  );

  // The espresso tenant's market moved INTO its workspace context…
  const espressoCtx = workspace.getBusinessContext('workspace_espresso_tenant');
  assert.ok(espressoCtx);
  assert.ok(espressoCtx.marketKeywords.some((keyword) => /espresso/i.test(keyword)));
  assert.equal(espressoCtx.updatedBy, 'migration:business-context', 'migration-authored, not operator-authored');

  // …the founder workspace got Violema's context, viktor.com included…
  const founderCtx = workspace.getBusinessContext('purpleorangehq');
  assert.ok(founderCtx);
  assert.ok(founderCtx.competitors.includes('viktor.com'));
  assert.equal(founderCtx.updatedBy, 'migration:business-context');

  // …and every legacy query is now the reference form with flags on consumers.
  const stored = JSON.parse(fs.readFileSync(AUTOMATIONS_FILE, 'utf8'));
  for (const record of stored.filter((item: { id: string }) => item.id !== 'auto_weekly_founder_update')) {
    const search = record.steps.find((step: { id: string }) => step.id === 'step_competitor_search');
    assert.equal(search.inputs.use_business_context, true);
    assert.equal(search.inputs.query, undefined);
    assert.equal(search.inputs.num_results, 8, 'num_results survives the rewrite');
    const analyze = record.steps.find((step: { id: string }) => step.id === 'step_delta_analysis');
    assert.equal(analyze.inputs.use_business_context, true);
    const memo = record.steps.find((step: { id: string }) => step.id === 'step_competitor_memo');
    assert.equal(memo.inputs.use_business_context, true);
  }

  const founderStored = stored.find((item: { id: string }) => item.id === 'auto_weekly_founder_update');
  const scan = founderStored.steps.find((step: { id: string }) => step.id === 'step_market_scan');
  assert.equal(scan.inputs.use_business_context, true);
  assert.equal(scan.inputs.query, undefined);
  assert.equal(scan.inputs.query_suffix, 'competitor pricing product launch news');
  assert.equal(scan.inputs.num_results, 6);
  const brief = founderStored.steps.find((step: { id: string }) => step.id === 'step_founder_brief');
  assert.equal(brief.inputs.use_business_context, true, "'Draft founder brief' is flagged as a context consumer");

  // Second run: nothing left to do, and nothing to back up.
  const backupsAfterFirst = listAutomationBackups().length;
  const second = scheduler.runBusinessContextMigration();
  assert.equal(second.rewrittenAutomations, 0);
  assert.deepEqual(second.rewrittenAutomationIds, []);
  assert.equal(second.backfilled, 0);
  assert.equal(listAutomationBackups().length, backupsAfterFirst, 'a no-op run writes no backup');
});

test('a query naming an Object.prototype member is not treated as a legacy query', async () => {
  const scheduler = await import('../src/scheduler');

  writeAutomations([legacyRecord('auto_prototype_probe', 'workspace_prototype', 'constructor')]);
  const backupsBefore = listAutomationBackups().length;

  const result = scheduler.runBusinessContextMigration();
  assert.equal(result.rewrittenAutomations, 0);
  assert.equal(listAutomationBackups().length, backupsBefore, 'a no-op run writes no backup');

  const stored = JSON.parse(fs.readFileSync(AUTOMATIONS_FILE, 'utf8'));
  assert.equal(stored[0].steps[0].inputs.query, 'constructor', 'inherited members are not suffixes');
  assert.equal(stored[0].steps[0].inputs.use_business_context, undefined);
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
