import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { inferWorkflowIdFromAutomation } from '../src/integrationGateway/workflowPolicy';

test('automation records persist explicit workflow and template identity', async () => {
  const originalCwd = process.cwd();
  const tempDir = mkdtempSync(path.join(tmpdir(), 'violema-workflow-identity-'));

  try {
    process.chdir(tempDir);
    const scheduler = await import('../src/scheduler');
    const record = scheduler.createAutomation({
      workspaceId: 'workspace_test',
      workflowId: 'weekly-founder-brief',
      templateId: 'weekly-founder-brief',
      name: 'Weekly founder brief',
      description: 'Founder operating brief',
      authoring_mode: 'guided',
      workflow_prompt: 'Check Stripe\nCheck GitHub\nDraft brief',
      schedule: 'every monday at 9am',
      timezone: 'America/Chicago',
      actions: ['Check Stripe revenue', 'Scan GitHub delivery', 'Draft founder brief'],
      steps: [
        { id: 'step_stripe', kind: 'query', title: 'Check Stripe', objective: 'Read revenue.', inputs: { source: 'stripe', query_type: 'revenue_summary' } },
        { id: 'step_github', kind: 'query', title: 'Check GitHub', objective: 'Read delivery.', inputs: { source: 'github', query_type: 'delivery_risk' } },
      ],
      notify: '#all-purple-orange',
    }, async () => ({ ok: true }));

    assert.equal(record.workflowId, 'weekly-founder-brief');
    assert.equal(record.templateId, 'weekly-founder-brief');
    assert.equal(inferWorkflowIdFromAutomation(record), 'weekly-founder-brief');
    assert.equal(scheduler.getAutomationById(record.id)?.workflowId, 'weekly-founder-brief');
    scheduler.deleteAutomation(record.id);
  } finally {
    process.chdir(originalCwd);
    rmSync(tempDir, { recursive: true, force: true });
  }
});
