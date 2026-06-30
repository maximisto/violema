import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
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

test('approved delivery metadata stores only a safe body summary', async () => {
  const { approveAutomationReview } = await import('../src/platform/automationLifecycle');
  const body = 'Approved investor update body with private details.';
  const result = await approveAutomationReview({
    task: ({
      id: 'task_review',
      title: 'Review investor update',
      status: 'waiting_review',
      metadata: {
        automationId: 'auto_review',
        latestArtifacts: [
          {
            kind: 'review_gate',
            title: 'Investor update',
            payload: {
              markdown: body,
              deliveryTarget: '#founders',
              approvalRequired: true,
            },
          },
        ],
      },
    } as unknown) as Parameters<typeof approveAutomationReview>[0]['task'],
    taskRun: ({
      id: 'run_review',
      metadata: {},
    } as unknown) as Parameters<typeof approveAutomationReview>[0]['taskRun'],
    reviewer: 'Max',
    now: () => '2026-06-30T12:00:00.000Z',
    send: async () => ({
      id: 'msg_123',
      channel: 'slack',
      target: '#founders',
      status: 'delivered',
      ts: '2026-06-30T12:01:00.000Z',
      body: 'provider echoed private body',
    }),
  });

  const expectedHash = createHash('sha256').update(body).digest('hex');
  const expectedDelivery = {
    id: 'msg_123',
    channel: 'slack',
    target: '#founders',
    status: 'delivered',
    ts: '2026-06-30T12:01:00.000Z',
    bodyLength: body.length,
    bodyHash: expectedHash,
  };

  assert.equal(result.delivery.body, body);
  assert.deepEqual(result.taskPatch.metadata.latestDelivery, expectedDelivery);
  assert.deepEqual(result.runPatch.metadata.delivery, expectedDelivery);
  assert.deepEqual(result.receipt.delivery, expectedDelivery);
  assert.doesNotMatch(JSON.stringify(result.taskPatch.metadata), /Approved investor update body|provider echoed private body/);
  assert.doesNotMatch(JSON.stringify(result.runPatch.metadata), /Approved investor update body|provider echoed private body/);
  assert.doesNotMatch(JSON.stringify(result.receipt), /Approved investor update body|provider echoed private body/);
});
