import {
  getDashboardReadinessBlockerAction,
  getSelectedRunLedgerId,
  getWorkflowReadinessDeliveryTarget,
  inferEditorWorkflowId,
} from '../src/features/integrations/workflowReadinessUi';

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
}

assert(
  inferEditorWorkflowId([
    { kind: 'query', inputs: { source: 'stripe', query_type: 'revenue_summary' } },
    { kind: 'analyze', inputs: {} },
    { kind: 'deliver', inputs: {} },
  ]) === 'revenue-watch',
  'Revenue Watch inference passes for Stripe-only revenue query workflows',
);

assert(
  inferEditorWorkflowId([
    { kind: 'analyze', inputs: {} },
    { kind: 'deliver', inputs: {} },
  ]) === '',
  'Revenue Watch inference stays off when there are no query steps',
);

assert(
  inferEditorWorkflowId([
    { kind: 'query', inputs: { source: 'github', query_type: 'revenue_summary' } },
  ]) === '',
  'Revenue Watch inference stays off for non-Stripe query workflows',
);

assert(
  inferEditorWorkflowId([
    { kind: 'query', inputs: { source: 'stripe', query_type: 'revenue_summary' } },
    { kind: 'query', inputs: { source: 'github', query_type: 'open_issues' } },
  ]) === '',
  'Revenue Watch inference stays off when any query source is non-Stripe',
);

assert(
  inferEditorWorkflowId([
    { kind: 'query', inputs: { source: 'stripe', query_type: 'failed_payments' } },
  ]) === '',
  'Revenue Watch inference stays off without a Stripe revenue query',
);

assert(
  inferEditorWorkflowId([
    { kind: 'query', inputs: { source: 'stripe', query_type: 'revenue_summary' } },
    { kind: 'query', inputs: { source: 'github', query_type: 'delivery_risk' } },
    { kind: 'query', inputs: { source: 'linear', query_type: 'delivery_status' } },
    { kind: 'query', inputs: { source: 'email', query_type: 'commitments' } },
    { kind: 'query', inputs: { source: 'calendar', query_type: 'weekly_commitments' } },
    { kind: 'query', inputs: { source: 'google_drive', query_type: 'recent_files' } },
    { kind: 'search', inputs: { query: 'market signals' } },
    { kind: 'deliver', inputs: {} },
  ]) === 'weekly-founder-update',
  'Weekly Founder Update inference recognizes the canonical live source set',
);

assert(
  inferEditorWorkflowId([
    { kind: 'query', inputs: { source: 'stripe', query_type: 'revenue_summary' } },
    { kind: 'query', inputs: { source: 'github', query_type: 'delivery_risk' } },
    { kind: 'query', inputs: { source: 'email', query_type: 'commitments' } },
  ]) === '',
  'Weekly Founder Update inference stays off for a partial source set',
);

assert(
  getWorkflowReadinessDeliveryTarget({
    notify: '  ',
    steps: [
      { kind: 'deliver', deliveryTarget: { channel: 'slack', target: '#ops' } },
    ],
  }) === '#ops',
  'Workflow readiness target falls back to the first deliver step target when notify is blank',
);

assert(
  getWorkflowReadinessDeliveryTarget({
    notify: ' founders@violema.com ',
    steps: [
      { kind: 'deliver', deliveryTarget: { channel: 'slack', target: '#ops' } },
    ],
  }) === 'founders@violema.com',
  'Workflow readiness target prefers notify when it is present',
);

assert(
  getSelectedRunLedgerId({
    selectedTaskRunId: '  run_task  ',
    selectedMissionTaskRunId: 'run_mission',
  }) === 'run_task',
  'Run ledger prefers the selected task run id and trims whitespace',
);

assert(
  getSelectedRunLedgerId({
    selectedTaskRunId: '   ',
    selectedMissionTaskRunId: ' run_mission ',
  }) === 'run_mission',
  'Run ledger falls back to the selected mission run id when task run id is empty',
);

const stripeAction = getDashboardReadinessBlockerAction({ key: 'stripe' });
assert(stripeAction?.kind === 'navigate', 'Stripe blocker maps to navigation');
assert(stripeAction?.label === 'Open Stripe settings', 'Stripe blocker uses a specific settings label');
assert(stripeAction?.kind === 'navigate' && stripeAction.href === '/settings#integration-stripe', 'Stripe blocker points to the real Stripe settings anchor');

const slackAction = getDashboardReadinessBlockerAction({ key: 'slack_target' });
assert(slackAction?.kind === 'editor', 'Slack target blocker stays in the editor');
assert(slackAction?.label === 'Set destination', 'Slack target blocker uses the destination-specific label');
assert(slackAction?.kind === 'editor' && slackAction.section === 'setup', 'Slack target blocker points to the setup section');

const githubAction = getDashboardReadinessBlockerAction({
  key: 'github',
  route: '/integrations?provider=github&workflow=weekly-founder-update',
});
assert(githubAction?.kind === 'navigate', 'partner blockers map to navigation');
assert(githubAction?.label === 'Open integration setup', 'partner blockers use a setup label');
assert(
  githubAction?.kind === 'navigate' &&
    githubAction.href === '/integrations?provider=github&workflow=weekly-founder-update',
  'partner blockers preserve the backend repair route',
);

assert(
  getDashboardReadinessBlockerAction({ key: 'unsupported_workflow' }) === null,
  'Unknown blockers do not get a synthetic dashboard action',
);

console.log('workflowReadinessUi.contract: workflow inference and run id selection verified');
