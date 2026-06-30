import assert from 'node:assert/strict';
import test from 'node:test';
import { queryGoogleWorkspace } from '../src/integrationGateway/adapters/partnerGoogleWorkspace';

test('queryGoogleWorkspace returns readiness error for missing partner connection', async () => {
  const result = await queryGoogleWorkspace({
    workspaceId: 'workspace_test',
    source: 'gmail',
    queryType: 'commitments',
    connectedPartnerApps: [],
    now: new Date('2026-06-30T12:00:00.000Z'),
    executor: async () => {
      throw new Error('should not execute');
    },
  });

  assert.equal(result.ok, false);
  if (result.ok) throw new Error('expected readiness error');
  assert.equal(result.code, 'integration_not_ready');
  assert.equal(result.nextAction.route, '/integrations?provider=gmail&workflow=weekly-founder-brief');
});

test('queryGoogleWorkspace normalizes Gmail commitments without raw email bodies', async () => {
  const result = await queryGoogleWorkspace({
    workspaceId: 'workspace_test',
    source: 'gmail',
    queryType: 'commitments',
    connectedPartnerApps: ['gmail'],
    now: new Date('2026-06-30T12:00:00.000Z'),
    executor: async () => ({
      threads: [
        {
          id: 'thread_1',
          subject: 'Investor materials',
          from: 'investor@example.com',
          snippet: 'Following up on the deck and June metrics.',
          body: 'Long raw body that should not be returned in the normalized payload.',
          date: '2026-06-29T15:00:00.000Z',
        },
      ],
    }),
  });

  assert.equal(result.ok, true);
  if (!result.ok) throw new Error('expected success');
  assert.equal(result.source, 'gmail');
  assert.equal(result.query_type, 'commitments');
  assert.equal(result.data.items.length, 1);
  assert.equal(result.data.items[0].id, 'thread_1');
  assert.doesNotMatch(JSON.stringify(result), /Long raw body/);
});

test('queryGoogleWorkspace normalizes Calendar meeting windows', async () => {
  const result = await queryGoogleWorkspace({
    workspaceId: 'workspace_test',
    source: 'google_calendar',
    queryType: 'weekly_commitments',
    connectedPartnerApps: ['googlecalendar'],
    now: new Date('2026-06-30T12:00:00.000Z'),
    executor: async () => ({
      events: [
        {
          id: 'event_1',
          summary: 'Investor sync',
          start: { dateTime: '2026-07-01T15:00:00.000Z' },
          end: { dateTime: '2026-07-01T15:30:00.000Z' },
          attendees: [{ email: 'investor@example.com' }],
        },
      ],
    }),
  });

  assert.equal(result.ok, true);
  if (!result.ok) throw new Error('expected success');
  assert.equal(result.data.items[0].title, 'Investor sync');
  assert.equal(result.data.items[0].attendee_count, 1);
});

test('queryGoogleWorkspace normalizes Drive docs without full document text', async () => {
  const result = await queryGoogleWorkspace({
    workspaceId: 'workspace_test',
    source: 'google_drive',
    queryType: 'board_packet_sources',
    connectedPartnerApps: ['googledrive'],
    now: new Date('2026-06-30T12:00:00.000Z'),
    executor: async () => ({
      files: [
        {
          id: 'doc_1',
          name: 'Board packet draft',
          mimeType: 'application/vnd.google-apps.document',
          webViewLink: 'https://docs.google.com/document/d/doc_1',
          modifiedTime: '2026-06-28T12:00:00.000Z',
          text: 'Full private board packet text should not be returned.',
        },
      ],
    }),
  });

  assert.equal(result.ok, true);
  if (!result.ok) throw new Error('expected success');
  assert.equal(result.data.items[0].id, 'doc_1');
  assert.doesNotMatch(JSON.stringify(result), /Full private board packet/);
});
