import { getSelectedRunLedgerId, inferEditorWorkflowId } from '../src/features/integrations/workflowReadinessUi';

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

console.log('workflowReadinessUi.contract: workflow inference and run id selection verified');
