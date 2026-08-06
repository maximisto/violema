import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'violema-business-context-plan-'));
process.chdir(tempDir);
process.env.VIOLEMA_DISABLE_AUTOMATION_SCHEDULER = '1';

const CONTEXT_AUTOMATION = {
  id: 'auto_test_espresso',
  name: 'Competitor monitor',
  workspaceId: 'workspace_test_espresso',
  actions: [],
  notify: '#violema-demo',
  steps: [
    {
      id: 'step_competitor_search',
      kind: 'search' as const,
      title: 'Search competitor moves',
      objective: 'Find pricing, launch, and positioning changes from key competitors.',
      inputs: { use_business_context: true, query_suffix: 'competitor pricing launches positioning', num_results: 8 },
    },
    {
      id: 'step_competitor_memo',
      kind: 'summarize' as const,
      title: 'Draft competitor memo',
      objective: 'Create a concise founder memo.',
      inputs: { use_business_context: true, instruction: 'Draft the competitor memo.' },
    },
  ],
};

test('plan building resolves opted-in steps from the workspace business context', async () => {
  const workspace = await import('../src/platform/workspace');
  const serverModule = await import('../src/server');

  workspace.setBusinessContext('workspace_test_espresso', {
    summary: 'An AI-powered espresso machine company.',
    marketKeywords: ['AI-powered espresso machine', 'smart coffee machine'],
    competitors: ['decenttespresso.com'],
  });

  const plan = serverModule.buildAutomationExecutionPlan(CONTEXT_AUTOMATION);
  const search = plan.steps.find((step) => step.id === 'step_competitor_search');
  assert.ok(search);
  assert.equal(
    search.inputs?.query,
    'AI-powered espresso machine smart coffee machine competitor pricing launches positioning decenttespresso.com',
  );

  const memo = plan.steps.find((step) => step.id === 'step_competitor_memo');
  assert.match(String(memo?.inputs?.instruction), /^Business context for this account:/);
});

test('without context the opted-in step falls back to the inferred query, not a hardcoded market', async () => {
  const serverModule = await import('../src/server');
  const plan = serverModule.buildAutomationExecutionPlan({
    ...CONTEXT_AUTOMATION,
    id: 'auto_test_no_context',
    workspaceId: 'workspace_without_context',
  });
  const search = plan.steps.find((step) => step.id === 'step_competitor_search');
  assert.ok(search);
  const query = String(search.inputs?.query || '');
  assert.ok(!query.includes('AI agent automation'), 'no hardcoded market can appear');
});
