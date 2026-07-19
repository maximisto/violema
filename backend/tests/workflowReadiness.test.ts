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

const readyWeeklyRuntime = {
  github: { ready: true },
  linear: { ready: true },
  email: { ready: true },
  calendar: { ready: true },
  google_drive: { ready: true },
  tavily: { ready: true },
  slack: { ready: true },
  postmark: { ready: true },
};

test('Weekly Founder Update readiness passes with all required live sources', () => {
  const report = checkWorkflowReadiness({
    workflowId: 'weekly-founder-update',
    workspaceId: 'purpleorangehq',
    deliveryTarget: '#all-purple-orange',
    settingsView: {
      integrations: {
        stripe: { configured: true },
      },
    },
    runtimeStatus: readyWeeklyRuntime,
  });

  assert.equal(report.ready, true);
  assert.deepEqual(report.requiredIntegrationIds, [
    'stripe',
    'github',
    'linear',
    'email',
    'calendar',
    'tavily',
    'slack',
  ]);
  assert.deepEqual(report.optionalIntegrationIds, ['google_drive', 'postmark']);
  assert.equal(report.firstRunRequiresApproval, true);
  assert.deepEqual(report.blockers, []);
  assert.deepEqual(report.warnings, []);
  assert.equal(
    report.summary,
    'Weekly Founder Update is ready for a sandbox run. Delivery requires approval.',
  );
});

test('Weekly Founder Update readiness blocks a missing required source', () => {
  const report = checkWorkflowReadiness({
    workflowId: 'weekly-founder-update',
    workspaceId: 'purpleorangehq',
    settingsView: {
      integrations: {
        stripe: { configured: true },
      },
    },
    runtimeStatus: {
      ...readyWeeklyRuntime,
      github: {
        ready: false,
        code: 'integration_not_ready',
        detail: 'GitHub is not connected.',
      },
    },
  });

  assert.equal(report.ready, false);
  assert.ok(report.blockers.some((item) => item.key === 'github'));
  assert.deepEqual(report.warnings, []);
});

test('Weekly Founder Update readiness discloses Drive degradation without blocking Slack delivery', () => {
  const report = checkWorkflowReadiness({
    workflowId: 'weekly-founder-update',
    workspaceId: 'purpleorangehq',
    settingsView: {
      integrations: {
        stripe: { configured: true },
      },
    },
    runtimeStatus: {
      ...readyWeeklyRuntime,
      google_drive: {
        ready: false,
        code: 'integration_scope_insufficient',
        detail: 'Google Drive needs read-only metadata scope.',
      },
    },
  });

  assert.equal(report.ready, true);
  assert.deepEqual(report.blockers, []);
  assert.equal(report.warnings.length, 1);
  assert.deepEqual(report.warnings[0], {
    key: 'google_drive',
    label: 'Reauthorize Google Drive',
    detail: 'Google Drive needs read-only metadata scope.',
    route: '/integrations?provider=google_drive&workflow=weekly-founder-update',
  });
  assert.match(report.summary, /ready.*1 supporting integration warning/i);
});
