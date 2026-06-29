import assert from 'node:assert/strict';
import test from 'node:test';
import { checkWorkflowReadiness } from '../src/integrationGateway/workflowReadiness';

test('Revenue Watch readiness blocks missing Stripe and missing Slack target', () => {
  const report = checkWorkflowReadiness({
    workflowId: 'revenue-watch',
    workspaceId: 'workspace_test',
    deliveryTarget: '',
    settingsView: {
      integrations: {
        stripe: { configured: false },
      },
    },
  });

  assert.equal(report.ready, false);
  assert.deepEqual(report.requiredIntegrationIds, ['stripe']);
  assert.equal(report.firstRunRequiresApproval, true);
  assert.ok(report.blockers.some((item: { key: string }) => item.key === 'stripe'));
  assert.ok(report.blockers.some((item: { key: string }) => item.key === 'slack_target'));
});

test('Revenue Watch readiness passes with Stripe and Slack target', () => {
  const report = checkWorkflowReadiness({
    workflowId: 'revenue-watch',
    workspaceId: 'workspace_test',
    deliveryTarget: '#all-purple-orange',
    settingsView: {
      integrations: {
        stripe: { configured: true },
      },
    },
  });

  assert.equal(report.ready, true);
  assert.equal(report.blockers.length, 0);
  assert.equal(report.summary, 'Revenue Watch is ready for a sandbox run. First live delivery requires approval.');
});

test('Revenue Watch readiness uses the backend default Slack target when deliveryTarget is omitted', () => {
  const report = checkWorkflowReadiness({
    workflowId: 'revenue-watch',
    workspaceId: 'workspace_test',
    settingsView: {
      integrations: {
        stripe: { configured: true },
      },
    },
  });

  assert.equal(report.ready, true);
  assert.equal(report.blockers.length, 0);
  assert.equal(report.summary, 'Revenue Watch is ready for a sandbox run. First live delivery requires approval.');
});

test('Revenue Watch readiness still blocks an explicit empty delivery target', () => {
  const report = checkWorkflowReadiness({
    workflowId: 'revenue-watch',
    workspaceId: 'workspace_test',
    deliveryTarget: '',
    settingsView: {
      integrations: {
        stripe: { configured: true },
      },
    },
  });

  assert.equal(report.ready, false);
  assert.ok(report.blockers.some((item: { key: string }) => item.key === 'slack_target'));
});

test('unsupported workflow IDs are never reported as ready', () => {
  const report = checkWorkflowReadiness({
    workflowId: 'revenue-watch-typo',
    workspaceId: 'workspace_test',
    settingsView: {
      integrations: {
        stripe: { configured: true },
      },
    },
  });

  assert.equal(report.ready, false);
  assert.equal(report.requiredIntegrationIds.length, 0);
  assert.ok(report.blockers.some((item: { key: string }) => item.key === 'unsupported_workflow'));
  assert.match(report.summary, /unsupported workflow/i);
});
