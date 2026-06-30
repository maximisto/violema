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
    preparedAt: '2026-06-29T12:03:00.000Z',
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
    preparedAt: '2026-06-29T12:04:00.000Z',
  });

  const items = approvalLedger.finalizePendingApprovalRequestedLedgerEvents({
    outcome: { reviewRequired: true },
    pendingEvents: [pending],
  });

  assert.equal(items.length, 1);
  assert.equal(items[0].type, 'approval_requested');
  assert.equal(items[0].summary, 'Prepared delivery for approval before sending to #founders.');
});

test('approval_requested preserves the original prepared timestamp', async () => {
  const approvalLedger = await import('../src/integrationGateway/approvalLedger');
  const pending = approvalLedger.buildPendingApprovalRequestedLedgerEvent({
    workspaceId: 'workspace_test',
    workflowId: 'revenue-watch',
    automationId: 'auto_revenue',
    taskId: 'task_revenue',
    taskRunId: 'run_revenue',
    deliveryTarget: '#founders',
    channel: 'slack',
    preparedAt: '2026-06-29T12:05:00.000Z',
  });

  const items = approvalLedger.finalizePendingApprovalRequestedLedgerEvents({
    outcome: { reviewRequired: true },
    pendingEvents: [pending],
  });

  assert.equal(typeof items[0].now, 'function');
  assert.equal(items[0].now?.(), '2026-06-29T12:05:00.000Z');
});

test('approval_requested metadata stays lean', async () => {
  const approvalLedger = await import('../src/integrationGateway/approvalLedger');
  const pending = approvalLedger.buildPendingApprovalRequestedLedgerEvent({
    workspaceId: 'workspace_test',
    workflowId: 'revenue-watch',
    automationId: 'auto_revenue',
    taskId: 'task_revenue',
    taskRunId: 'run_revenue',
    deliveryTarget: '#founders',
    channel: 'slack',
    preparedAt: '2026-06-29T12:06:00.000Z',
  });

  const items = approvalLedger.finalizePendingApprovalRequestedLedgerEvents({
    outcome: { reviewRequired: true },
    pendingEvents: [pending],
  });

  assert.deepEqual(items[0].metadata, {
    deliveryTarget: '#founders',
    channel: 'slack',
  });
  assert.deepEqual(Object.keys(items[0].metadata || {}).sort(), ['channel', 'deliveryTarget']);
});

test('data_read metadata helper redacts raw provider payloads', async () => {
  const auditLog = await import('../src/integrationGateway/auditLog');

  const metadata = auditLog.buildSafeDataReadLedgerMetadata({
    ok: true,
    source: 'gmail',
    query_type: 'commitments',
    live: true,
    data: {
      total: 1,
      window: { start: '2026-06-23T00:00:00.000Z', end: '2026-06-30T00:00:00.000Z' },
      providerRoute: 'gmail.commitments',
      items: [
        { id: 'thread_1', subject: 'Investor update', body: 'private raw body' },
      ],
    },
  });

  assert.deepEqual(metadata, {
    source: 'gmail',
    queryType: 'commitments',
    resultCount: 1,
    window: { start: '2026-06-23T00:00:00.000Z', end: '2026-06-30T00:00:00.000Z' },
    live: true,
    providerRoute: 'gmail.commitments',
  });
  assert.doesNotMatch(JSON.stringify(metadata), /private raw body/);
});
