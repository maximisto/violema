import assert from 'node:assert/strict';
import test from 'node:test';
import {
  inferWorkflowIdFromAutomation,
  isWorkflowDeliveryApprovalRequired,
  resolveWorkflowDeliveryTarget,
} from '../src/integrationGateway/workflowPolicy';

test('Revenue Watch inference accepts an explicit workflow id when present', () => {
  assert.equal(
    inferWorkflowIdFromAutomation({
      name: 'Any name',
      workflowId: 'revenue-watch',
      steps: [],
    }),
    'revenue-watch',
  );
});

test('Weekly founder brief does not infer as Revenue Watch from mixed query steps', () => {
  assert.equal(
    inferWorkflowIdFromAutomation({
      name: 'Weekly founder brief',
      steps: [
        { id: 'stripe', kind: 'query', objective: 'Check Stripe revenue', inputs: { source: 'stripe', query_type: 'revenue_summary' } },
        { id: 'github', kind: 'query', objective: 'Check GitHub delivery', inputs: { source: 'github', query_type: 'delivery_risk' } },
        { id: 'deliver', kind: 'deliver', objective: 'Deliver to Slack', deliveryTarget: { channel: 'slack', target: '#founders' } },
      ],
    }),
    'custom-workflow',
  );
});

test('Revenue Watch inference requires Stripe-only revenue query steps', () => {
  assert.equal(
    inferWorkflowIdFromAutomation({
      name: 'Revenue watch',
      steps: [
        { id: 'q1', kind: 'query', objective: 'Check revenue', inputs: { source: 'stripe', query_type: 'revenue_summary' } },
        { id: 'q2', kind: 'query', objective: 'Check failed payments', inputs: { source: 'stripe', query_type: 'failed_payments' } },
      ],
    }),
    'revenue-watch',
  );
});

test('Revenue Watch Slack delivery requires approval even without step metadata', () => {
  assert.equal(
    isWorkflowDeliveryApprovalRequired({
      workflowId: 'revenue-watch',
      notify: '',
      step: {
        kind: 'deliver',
        title: 'Send revenue update',
        objective: 'Send the latest revenue summary to Slack.',
        inputs: {},
        deliveryTarget: { channel: 'slack', target: '#finance' },
      },
    }),
    true,
  );
});

test('Revenue Watch email delivery does not force approval without review metadata', () => {
  assert.equal(
    isWorkflowDeliveryApprovalRequired({
      workflowId: 'revenue-watch',
      notify: '',
      step: {
        kind: 'deliver',
        title: 'Email revenue update',
        objective: 'Send the latest revenue summary by email.',
        inputs: {},
        deliveryTarget: { channel: 'email', target: 'finance@violema.com' },
      },
    }),
    false,
  );
});

test('explicit review metadata still requires approval for non Revenue Watch workflows', () => {
  assert.equal(
    isWorkflowDeliveryApprovalRequired({
      workflowId: 'custom-workflow',
      notify: '',
      step: {
        kind: 'deliver',
        title: 'Deliver after approval',
        objective: 'Deliver the reviewed draft after approval.',
        inputs: {},
        deliveryTarget: { channel: 'slack', target: '#ops' },
      },
    }),
    true,
  );
});

test('delivery target resolution falls back from notify to the deliver step target', () => {
  assert.deepEqual(
    resolveWorkflowDeliveryTarget({
      notify: '',
      step: {
        kind: 'deliver',
        title: 'Deliver',
        objective: 'Deliver the latest result.',
        deliveryTarget: { channel: 'slack', target: '#ops' },
      },
    }),
    { channel: 'slack', target: '#ops' },
  );
});
