import assert from 'node:assert/strict';
import test from 'node:test';
import { buildWeeklyFounderRuntimeStatus } from '../src/integrationGateway/workflowRuntimeStatus';

test('weekly founder runtime status maps partner accounts and native services', () => {
  const status = buildWeeklyFounderRuntimeStatus({
    connectedPartnerApps: [
      'GMAIL',
      'googlecalendar',
      'googledrive',
      'linear',
      'github',
    ],
    nativeStatus: {
      tavily: true,
      slack: true,
      postmark: true,
    },
  });

  assert.deepEqual(status, {
    email: { ready: true, detail: 'Gmail is connected to this workspace.' },
    calendar: { ready: true, detail: 'Google Calendar is connected to this workspace.' },
    google_drive: { ready: true, detail: 'Google Drive is connected to this workspace.' },
    linear: { ready: true, detail: 'Linear is connected to this workspace.' },
    github: { ready: true, detail: 'GitHub is connected to this workspace.' },
    tavily: { ready: true, detail: 'Web search is configured on the server.' },
    slack: { ready: true, detail: 'Slack delivery is configured on the server.' },
    postmark: { ready: true, detail: 'Email delivery is configured on the server.' },
  });
});

test('weekly founder runtime status exposes missing connection repair details', () => {
  const status = buildWeeklyFounderRuntimeStatus({
    connectedPartnerApps: ['gmail', 'google_calendar'],
    nativeStatus: {
      tavily: false,
      slack: false,
      postmark: false,
    },
  });

  assert.equal(status.email.ready, true);
  assert.equal(status.calendar.ready, true);
  assert.deepEqual(status.github, {
    ready: false,
    code: 'integration_not_ready',
    detail: 'GitHub is not connected to this workspace.',
  });
  assert.deepEqual(status.google_drive, {
    ready: false,
    code: 'integration_not_ready',
    detail: 'Google Drive is not connected to this workspace.',
  });
  assert.deepEqual(status.tavily, {
    ready: false,
    code: 'integration_not_ready',
    detail: 'Web search is not configured on the server.',
  });
});
