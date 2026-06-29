import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

test('workflow ledger persists and filters run events', async () => {
  const originalCwd = process.cwd();
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'violema-ledger-'));
  process.chdir(tempDir);

  try {
    const audit = await import('../src/integrationGateway/auditLog');
    const first = audit.appendWorkflowLedgerEvent({
      workspaceId: 'workspace_test',
      workflowId: 'revenue-watch',
      automationId: 'auto_revenue',
      taskId: 'task_revenue',
      taskRunId: 'run_revenue',
      type: 'data_read',
      summary: 'Read Stripe revenue summary.',
      metadata: { source: 'stripe', queryType: 'revenue_summary' },
      now: () => '2026-06-29T12:00:00.000Z',
    });
    audit.appendWorkflowLedgerEvent({
      workspaceId: 'workspace_test',
      workflowId: 'revenue-watch',
      taskRunId: 'run_other',
      type: 'draft_created',
      summary: 'Other run.',
      now: () => '2026-06-29T12:01:00.000Z',
    });

    const items = audit.listWorkflowLedgerEvents({
      workspaceId: 'workspace_test',
      taskRunId: 'run_revenue',
    });

    assert.equal(first.id, 'ledger_run_revenue_data_read_2026-06-29T12-00-00-000Z');
    assert.equal(items.length, 1);
    assert.equal(items[0].type, 'data_read');
    assert.equal(items[0].metadata?.source, 'stripe');
  } finally {
    process.chdir(originalCwd);
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});
