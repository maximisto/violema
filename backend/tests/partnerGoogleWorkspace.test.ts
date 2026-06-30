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
  let receivedInput: Record<string, unknown> | undefined;
  const result = await queryGoogleWorkspace({
    workspaceId: 'workspace_test',
    source: 'gmail',
    queryType: 'commitments',
    connectedPartnerApps: ['gmail'],
    now: new Date('2026-06-30T12:00:00.000Z'),
    filters: { includeBody: true },
    executor: async (_actionName, input) => {
      receivedInput = input;
      return {
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
      };
    },
  });

  assert.equal(result.ok, true);
  if (!result.ok) throw new Error('expected success');
  assert.equal(result.source, 'gmail');
  assert.equal(result.query_type, 'commitments');
  assert.equal(result.data.items.length, 1);
  assert.equal(result.data.items[0].id, 'thread_1');
  assert.equal(receivedInput?.includeBody, false);
  assert.equal(receivedInput?.query, '("follow up" OR "following up" OR deadline OR due OR send)');
  assert.doesNotMatch(JSON.stringify(result), /Long raw body/);
});

test('queryGoogleWorkspace ignores unsafe Gmail filters and keeps canonical windows', async () => {
  let receivedInput: Record<string, unknown> | undefined;
  const result = await queryGoogleWorkspace({
    workspaceId: 'workspace_test',
    source: 'gmail',
    queryType: 'commitments',
    connectedPartnerApps: ['gmail'],
    now: new Date('2026-06-30T12:00:00.000Z'),
    filters: {
      start: '1999-01-01T00:00:00.000Z',
      end: '2099-01-01T00:00:00.000Z',
      include_body: true,
      include_text: true,
      includeBody: true,
      includeText: true,
      bodyFormat: 'full',
      fields: 'raw,body,text',
      fullText: true,
      text: 'raw private body',
      query: 'newer_than:10y',
      maxResults: 10,
    },
    executor: async (_actionName, input) => {
      receivedInput = input;
      return { threads: [] };
    },
  });

  assert.equal(result.ok, true);
  assert.equal(receivedInput?.start, '2026-06-23T12:00:00.000Z');
  assert.equal(receivedInput?.end, '2026-06-30T12:00:00.000Z');
  assert.equal(receivedInput?.includeBody, false);
  assert.equal(receivedInput?.maxResults, 10);
  assert.equal(receivedInput?.query, '("follow up" OR "following up" OR deadline OR due OR send)');
  for (const key of ['include_body', 'include_text', 'includeText', 'bodyFormat', 'fields', 'fullText', 'text']) {
    assert.equal(Object.prototype.hasOwnProperty.call(receivedInput || {}, key), false, `${key} should not reach Composio`);
  }
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
  let receivedInput: Record<string, unknown> | undefined;
  const result = await queryGoogleWorkspace({
    workspaceId: 'workspace_test',
    source: 'google_drive',
    queryType: 'board_packet_sources',
    connectedPartnerApps: ['googledrive'],
    now: new Date('2026-06-30T12:00:00.000Z'),
    filters: { includeText: true },
    executor: async (_actionName, input) => {
      receivedInput = input;
      return {
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
      };
    },
  });

  assert.equal(result.ok, true);
  if (!result.ok) throw new Error('expected success');
  assert.equal(result.data.items[0].id, 'doc_1');
  assert.equal(receivedInput?.includeText, false);
  assert.equal(receivedInput?.query, '"board packet" OR board deck OR investor update OR meeting prep');
  assert.doesNotMatch(JSON.stringify(result), /Full private board packet/);
});

test('queryGoogleWorkspace ignores unsafe Drive filters and redacts executor errors', async () => {
  let receivedInput: Record<string, unknown> | undefined;
  const secret = 'sk_live_google_secret raw private board body';
  const result = await queryGoogleWorkspace({
    workspaceId: 'workspace_test',
    source: 'google_drive',
    queryType: 'recent_docs',
    connectedPartnerApps: ['google_drive'],
    now: new Date('2026-06-30T12:00:00.000Z'),
    filters: {
      pageSize: 12,
      includeText: true,
      include_text: true,
      fullText: true,
      text: 'raw document text',
      fields: '*',
      start: '1999-01-01T00:00:00.000Z',
      end: '2099-01-01T00:00:00.000Z',
    },
    executor: async (_actionName, input) => {
      receivedInput = input;
      throw new Error(`Composio failed with ${secret}`);
    },
  });

  assert.equal(receivedInput?.start, '2026-06-16T12:00:00.000Z');
  assert.equal(receivedInput?.end, '2026-06-30T12:00:00.000Z');
  assert.equal(receivedInput?.includeText, false);
  assert.equal(receivedInput?.pageSize, 12);
  for (const key of ['include_text', 'fullText', 'text', 'fields']) {
    assert.equal(Object.prototype.hasOwnProperty.call(receivedInput || {}, key), false, `${key} should not reach Composio`);
  }
  assert.equal(result.ok, false);
  assert.doesNotMatch(JSON.stringify(result), /sk_live_google_secret|raw private board body/);
});
