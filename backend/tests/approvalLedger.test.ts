import assert from 'node:assert/strict';
import test from 'node:test';

test('failed query plus prepared review gate does not commit approval_requested', async () => {
  const approvalLedger = await import('../src/integrationGateway/approvalLedger');
  const pending = approvalLedger.buildPendingApprovalRequestedLedgerEvent({
    workspaceId: 'workspace_test',
    workflowId: 'revenue-watch',
    automationId: 'auto_revenue',
    taskId: 'task_revenue',
    taskRunId: 'run_revenue',
    deliveryTarget: '#founders',
    channel: 'slack',
    draftMarkdown: '## Founder update\nStripe was not ready.',
  });

  const items = approvalLedger.finalizePendingApprovalRequestedLedgerEvents({
    outcome: { reviewRequired: false },
    pendingEvents: [pending],
  });

  assert.equal(items.length, 0);
});

test('clean review-gated run commits approval_requested', async () => {
  const approvalLedger = await import('../src/integrationGateway/approvalLedger');
  const pending = approvalLedger.buildPendingApprovalRequestedLedgerEvent({
    workspaceId: 'workspace_test',
    workflowId: 'revenue-watch',
    automationId: 'auto_revenue',
    taskId: 'task_revenue',
    taskRunId: 'run_revenue',
    deliveryTarget: '#founders',
    channel: 'slack',
    draftMarkdown: '## Founder update\nRevenue is steady.',
  });

  const items = approvalLedger.finalizePendingApprovalRequestedLedgerEvents({
    outcome: { reviewRequired: true },
    pendingEvents: [pending],
  });

  assert.equal(items.length, 1);
  assert.equal(items[0].type, 'approval_requested');
  assert.equal(items[0].summary, 'Prepared delivery for approval before sending to #founders.');
});

test('approval_requested metadata excludes full draft markdown', async () => {
  const approvalLedger = await import('../src/integrationGateway/approvalLedger');
  const pending = approvalLedger.buildPendingApprovalRequestedLedgerEvent({
    workspaceId: 'workspace_test',
    workflowId: 'revenue-watch',
    automationId: 'auto_revenue',
    taskId: 'task_revenue',
    taskRunId: 'run_revenue',
    deliveryTarget: '#founders',
    channel: 'slack',
    draftMarkdown: '## Founder update\nDo not store this whole draft in the ledger.',
  });

  const items = approvalLedger.finalizePendingApprovalRequestedLedgerEvents({
    outcome: { reviewRequired: true },
    pendingEvents: [pending],
  });

  assert.deepEqual(items[0].metadata, {
    deliveryTarget: '#founders',
    channel: 'slack',
  });
  assert.equal('draftMarkdown' in (items[0].metadata || {}), false);
});
