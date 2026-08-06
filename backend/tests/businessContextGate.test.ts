import assert from 'node:assert/strict';
import test from 'node:test';
import {
  BUSINESS_CONTEXT_BLOCKER,
  evaluateRunReadiness,
  stepsRequireBusinessContext,
} from '../src/integrationGateway/runReadinessGate';

const CONTEXT_STEPS = [
  {
    kind: 'search',
    title: 'Search competitor moves',
    inputs: { use_business_context: true, query_suffix: 'competitor pricing launches positioning', num_results: 8 },
  },
];

test('stepsRequireBusinessContext detects the opt-in flag', () => {
  assert.equal(stepsRequireBusinessContext(CONTEXT_STEPS), true);
  assert.equal(stepsRequireBusinessContext([{ kind: 'search', inputs: { query: 'plain' } }]), false);
  assert.equal(stepsRequireBusinessContext(undefined), false);
});

test('a context-requiring run with no context blocks honestly on every tier', () => {
  // Tier 3 (custom workflow).
  const custom = evaluateRunReadiness({
    workflowId: 'competitor-monitor',
    workspaceId: 'workspace_test',
    isDemoWorkspace: false,
    steps: CONTEXT_STEPS,
    businessContextSet: false,
  });
  assert.equal(custom.allowed, false);
  assert.equal(custom.blockers[0]?.key, 'business_context_missing');
  assert.equal(custom.blockers[0]?.route, '/settings#business');

  // Tier 2 (supported workflow table).
  const supported = evaluateRunReadiness({
    workflowId: 'weekly-founder-update',
    workspaceId: 'workspace_test',
    isDemoWorkspace: false,
    steps: CONTEXT_STEPS,
    businessContextSet: false,
  });
  assert.equal(supported.allowed, false);
  assert.ok(supported.blockers.some((blocker) => blocker.key === 'business_context_missing'));
});

test('with context set the gate result carries no business-context blocker', () => {
  const decision = evaluateRunReadiness({
    workflowId: 'competitor-monitor',
    workspaceId: 'workspace_test',
    isDemoWorkspace: false,
    steps: CONTEXT_STEPS,
    businessContextSet: true,
  });
  assert.ok(!decision.blockers.some((blocker) => blocker.key === 'business_context_missing'));
});

test('demo workspaces bypass the business-context rule like every other rule', () => {
  const demo = evaluateRunReadiness({
    workflowId: 'competitor-monitor',
    workspaceId: 'workspace_demo',
    isDemoWorkspace: true,
    steps: CONTEXT_STEPS,
    businessContextSet: false,
  });
  assert.equal(demo.allowed, true);
  assert.equal(demo.blockers.length, 0);
});

test('steps without the flag never trip the rule regardless of businessContextSet', () => {
  const decision = evaluateRunReadiness({
    workflowId: 'competitor-monitor',
    workspaceId: 'workspace_test',
    isDemoWorkspace: false,
    steps: [{ kind: 'summarize', inputs: { instruction: 'Draft memo.' } }],
    businessContextSet: false,
  });
  assert.ok(!decision.blockers.some((blocker) => blocker.key === 'business_context_missing'));
});

test('BUSINESS_CONTEXT_BLOCKER copy is honest and routed to settings', () => {
  assert.equal(BUSINESS_CONTEXT_BLOCKER.label, 'Tell Violema about your business');
  assert.match(BUSINESS_CONTEXT_BLOCKER.detail, /doesn't know your business yet/);
  assert.equal(BUSINESS_CONTEXT_BLOCKER.route, '/settings#business');
});
