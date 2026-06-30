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

test('Weekly Founder Brief requires Stripe GitHub Gmail and Calendar with Drive optional', () => {
  const report = checkWorkflowReadiness({
    workflowId: 'weekly-founder-brief',
    workspaceId: 'workspace_test',
    deliveryTarget: '#all-purple-orange',
    connectedPartnerApps: ['gmail', 'google_calendar'],
    env: { GITHUB_DEFAULT_REPOSITORY: 'maximisto/violema' },
    settingsView: {
      integrations: {
        stripe: { configured: true },
        github: { configured: true },
        gmail: { configured: false },
        google_calendar: { configured: false },
        google_drive: { configured: false },
      },
    },
  });

  assert.equal(report.ready, true);
  assert.deepEqual(report.requiredIntegrationIds, ['stripe', 'github', 'gmail', 'google_calendar']);
  assert.deepEqual(report.optionalIntegrationIds, ['google_drive', 'linear', 'notion', 'web_search']);
  assert.equal(report.firstRunRequiresApproval, true);
  assert.equal(
    report.summary,
    'Weekly Founder Brief is ready for a sandbox run. First live delivery requires approval.',
  );
  assert.doesNotMatch(report.summary, /Revenue Watch/i);
});

test('Weekly Founder Brief blocks GitHub when repository scope is missing', () => {
  const report = checkWorkflowReadiness({
    workflowId: 'weekly-founder-brief',
    workspaceId: 'workspace_test',
    deliveryTarget: '#all-purple-orange',
    connectedPartnerApps: ['gmail', 'google_calendar'],
    env: {},
    settingsView: {
      integrations: {
        stripe: { configured: true },
        github: { configured: true },
        gmail: { configured: false },
        google_calendar: { configured: false },
      },
    },
  });

  assert.equal(report.ready, false);
  const repo = report.blockers.find((item) => item.key === 'github_repository');
  assert.equal(repo?.label, 'Select GitHub repository');
  assert.equal(repo?.route, '/settings#integration-github');
});

test('Weekly Founder Brief accepts GitHub readiness with a valid default repository', () => {
  const report = checkWorkflowReadiness({
    workflowId: 'weekly-founder-brief',
    workspaceId: 'workspace_test',
    deliveryTarget: '#all-purple-orange',
    connectedPartnerApps: ['gmail', 'google_calendar'],
    env: { GITHUB_DEFAULT_REPOSITORY: 'maximisto/violema' },
    settingsView: {
      integrations: {
        stripe: { configured: true },
        github: { configured: true },
        gmail: { configured: false },
        google_calendar: { configured: false },
      },
    },
  });

  assert.equal(report.ready, true);
  assert.equal(report.blockers.find((item) => item.key === 'github_repository'), undefined);
});

test('Weekly Founder Brief normalizes spaced and hyphenated partner app aliases', () => {
  const report = checkWorkflowReadiness({
    workflowId: 'weekly-founder-brief',
    workspaceId: 'workspace_test',
    deliveryTarget: '#all-purple-orange',
    connectedPartnerApps: ['Gmail', 'Google Calendar'],
    env: { GITHUB_DEFAULT_REPOSITORY: 'maximisto/violema' },
    settingsView: {
      integrations: {
        stripe: { configured: true },
        github: { configured: true },
        gmail: { configured: false },
        google_calendar: { configured: false },
      },
    },
  });

  assert.equal(report.ready, true);
});

test('Investor Follow-up blocks missing Gmail and routes to partner setup', () => {
  const report = checkWorkflowReadiness({
    workflowId: 'investor-follow-up',
    workspaceId: 'workspace_test',
    connectedPartnerApps: ['google_calendar'],
    settingsView: {
      integrations: {
        gmail: { configured: false },
        google_calendar: { configured: false },
        google_drive: { configured: false },
      },
    },
  });

  assert.equal(report.ready, false);
  const gmail = report.blockers.find((item) => item.key === 'gmail');
  assert.equal(gmail?.label, 'Connect Gmail');
  assert.equal(gmail?.route, '/integrations?provider=gmail&workflow=investor-follow-up');
});

test('Monthly Investor Update requires Stripe GitHub and Drive', () => {
  const report = checkWorkflowReadiness({
    workflowId: 'monthly-investor-update',
    workspaceId: 'workspace_test',
    connectedPartnerApps: [],
    env: {
      GITHUB_DEFAULT_REPOSITORY: 'maximisto/violema',
      GOOGLE_CLIENT_ID: 'google_client',
      GOOGLE_CLIENT_SECRET: 'google_secret',
    },
    settingsView: {
      integrations: {
        stripe: { configured: true },
        github: { configured: true },
        gmail: { configured: false },
        google_drive: {
          configured: true,
          fields: {
            refreshToken: { configured: true },
          },
        },
      },
    },
  });

  assert.equal(report.ready, true);
  assert.deepEqual(report.requiredIntegrationIds, ['stripe', 'github', 'google_drive']);
  assert.deepEqual(report.optionalIntegrationIds, ['gmail']);
});

test('Monthly Investor Update blocks Drive refresh token without Google client credentials', () => {
  const report = checkWorkflowReadiness({
    workflowId: 'monthly-investor-update',
    workspaceId: 'workspace_test',
    connectedPartnerApps: [],
    env: { GITHUB_DEFAULT_REPOSITORY: 'maximisto/violema' },
    settingsView: {
      integrations: {
        stripe: { configured: true },
        github: { configured: true },
        google_drive: {
          configured: true,
          fields: {
            refreshToken: { configured: true },
          },
        },
      },
    },
  });

  assert.equal(report.ready, false);
  const drive = report.blockers.find((item) => item.key === 'google_drive_client');
  assert.equal(drive?.label, 'Add Google OAuth client');
  assert.equal(drive?.route, '/settings#integration-google_drive');
});

test('Monthly Investor Update blocks Drive when only a partner Drive app is connected', () => {
  const report = checkWorkflowReadiness({
    workflowId: 'monthly-investor-update',
    workspaceId: 'workspace_test',
    connectedPartnerApps: ['google_drive'],
    env: { GITHUB_DEFAULT_REPOSITORY: 'maximisto/violema' },
    settingsView: {
      integrations: {
        stripe: { configured: true },
        github: { configured: true },
        google_drive: { configured: false },
      },
    },
  });

  assert.equal(report.ready, false);
  const drive = report.blockers.find((item) => item.key === 'google_drive');
  assert.equal(drive?.label, 'Connect Google Drive');
  assert.equal(drive?.route, '/integrations?provider=google_drive&workflow=monthly-investor-update');
});

test('Shipping and Revenue Pulse requires Stripe and GitHub', () => {
  const report = checkWorkflowReadiness({
    workflowId: 'shipping-revenue-pulse',
    workspaceId: 'workspace_test',
    settingsView: {
      integrations: {
        stripe: { configured: true },
        github: { configured: false },
      },
    },
  });

  assert.equal(report.ready, false);
  assert.deepEqual(report.requiredIntegrationIds, ['stripe', 'github']);
  assert.deepEqual(report.optionalIntegrationIds, ['linear', 'web_search']);
  assert.equal(report.blockers.find((item) => item.key === 'github')?.route, '/settings#integration-github');
});

test('Shipping and Revenue Pulse blocks invalid default GitHub repository', () => {
  const report = checkWorkflowReadiness({
    workflowId: 'shipping-revenue-pulse',
    workspaceId: 'workspace_test',
    env: { GITHUB_DEFAULT_REPOSITORY: 'maximisto/violema/issues?state=all' },
    settingsView: {
      integrations: {
        stripe: { configured: true },
        github: { configured: true },
      },
    },
  });

  assert.equal(report.ready, false);
  assert.ok(report.blockers.some((item) => item.key === 'github_repository'));
});

test('Board Packet Prep requires Drive and Calendar while Stripe and GitHub are optional', () => {
  const report = checkWorkflowReadiness({
    workflowId: 'board-packet-prep',
    workspaceId: 'workspace_test',
    connectedPartnerApps: ['google_calendar'],
    env: {
      GOOGLE_CLIENT_ID: 'google_client',
      GOOGLE_CLIENT_SECRET: 'google_secret',
    },
    settingsView: {
      integrations: {
        google_drive: {
          configured: true,
          fields: {
            refreshToken: { configured: true },
          },
        },
        google_calendar: { configured: false },
        stripe: { configured: false },
        github: { configured: false },
      },
    },
  });

  assert.equal(report.ready, true);
  assert.deepEqual(report.requiredIntegrationIds, ['google_drive', 'google_calendar']);
  assert.deepEqual(report.optionalIntegrationIds, ['stripe', 'github']);
});
