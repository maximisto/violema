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
  ], 'weekly-founder-brief') === 'weekly-founder-brief',
  'explicit workflow identity wins over mixed-step inference',
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

const githubAction = getDashboardReadinessBlockerAction({ key: 'github', route: '/settings#integration-github' });
assert(githubAction?.kind === 'navigate', 'GitHub blocker maps to navigation');
assert(githubAction?.kind === 'navigate' && githubAction.href === '/settings#integration-github', 'GitHub blocker points to settings anchor');

const gmailAction = getDashboardReadinessBlockerAction({ key: 'gmail', route: '/integrations?provider=gmail&workflow=investor-follow-up' });
assert(gmailAction?.kind === 'navigate', 'Gmail blocker maps to navigation');
assert(gmailAction?.kind === 'navigate' && gmailAction.href === '/integrations?provider=gmail&workflow=investor-follow-up', 'Gmail blocker preserves partner setup route');

const driveAction = getDashboardReadinessBlockerAction({ key: 'google_drive', route: '/integrations?provider=google_drive&workflow=board-packet-prep' });
assert(driveAction?.kind === 'navigate', 'Drive blocker maps to navigation');
assert(driveAction?.kind === 'navigate' && driveAction.href.includes('provider=google_drive'), 'Drive blocker points to Drive setup');

assert(
  getDashboardReadinessBlockerAction({ key: 'unsupported_workflow' }) === null,
  'Unknown blockers do not get a synthetic dashboard action',
);

console.log('workflowReadinessUi.contract: workflow inference and run id selection verified');
