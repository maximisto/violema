import assert from 'node:assert/strict';
import test from 'node:test';
import { queryGoogleDrive } from '../src/integrationGateway/adapters/nativeGoogleDrive';

test('queryGoogleDrive lists Drive metadata without document text', async () => {
  let requestedUrl = '';
  let requestedAuth = '';
  const result = await queryGoogleDrive({
    workspaceId: 'workspace_test',
    queryType: 'board_packet_sources',
    accessToken: 'ya29.test-token',
    now: new Date('2026-06-30T12:00:00.000Z'),
    filters: {
      includeText: true,
      fields: '*',
      pageSize: 5,
    },
    fetchLike: async (url, init) => {
      requestedUrl = url;
      requestedAuth = init?.headers?.Authorization || '';
      return {
        ok: true,
        status: 200,
        async json() {
          return {
            files: [
              {
                id: 'drive_doc_1',
                name: 'Board packet draft',
                mimeType: 'application/vnd.google-apps.document',
                webViewLink: 'https://docs.google.com/document/d/drive_doc_1',
                modifiedTime: '2026-06-29T12:00:00.000Z',
                text: 'Raw board packet body must not be returned.',
              },
            ],
          };
        },
        async text() {
          return '{}';
        },
      };
    },
  });

  if (!result.ok) throw new Error(result.message);
  assert.equal(result.source, 'google_drive');
  assert.equal(result.live, true);
  assert.equal(result.data.items.length, 1);
  assert.deepEqual(result.data.items[0], {
    id: 'drive_doc_1',
    name: 'Board packet draft',
    mimeType: 'application/vnd.google-apps.document',
    url: 'https://docs.google.com/document/d/drive_doc_1',
    modifiedTime: '2026-06-29T12:00:00.000Z',
  });
  assert.equal(requestedAuth, 'Bearer ya29.test-token');
  assert.match(requestedUrl, /^https:\/\/www\.googleapis\.com\/drive\/v3\/files\?/);
  const params = new URL(requestedUrl).searchParams;
  assert.equal(params.get('pageSize'), '5');
  assert.equal(params.get('fields'), 'files(id,name,mimeType,webViewLink,modifiedTime),nextPageToken');
  assert.equal(params.get('orderBy'), 'modifiedTime desc');
  assert.equal(params.get('q'), '(name contains "board packet" or name contains "board deck" or name contains "investor update" or name contains "meeting prep") and trashed = false');
  assert.doesNotMatch(requestedUrl, /includeText|raw|body|\*/i);
  assert.doesNotMatch(JSON.stringify(result), /Raw board packet body/);
});

test('queryGoogleDrive refreshes access tokens without returning secrets', async () => {
  const calls: Array<{ url: string; body?: string; auth?: string }> = [];
  const result = await queryGoogleDrive({
    workspaceId: 'workspace_test',
    queryType: 'recent_docs',
    refreshToken: 'refresh_secret',
    clientId: 'client_id',
    clientSecret: 'client_secret',
    now: new Date('2026-06-30T12:00:00.000Z'),
    fetchLike: async (url, init) => {
      calls.push({
        url,
        body: typeof init?.body === 'string' ? init.body : undefined,
        auth: init?.headers?.Authorization,
      });
      if (url === 'https://oauth2.googleapis.com/token') {
        return {
          ok: true,
          status: 200,
          async json() {
            return { access_token: 'ya29.refreshed', expires_in: 3600 };
          },
          async text() {
            return '{}';
          },
        };
      }
      return {
        ok: true,
        status: 200,
        async json() {
          return { files: [] };
        },
        async text() {
          return '{}';
        },
      };
    },
  });

  if (!result.ok) throw new Error(result.message);
  assert.equal(calls.length, 2);
  assert.equal(calls[1].auth, 'Bearer ya29.refreshed');
  assert.doesNotMatch(JSON.stringify(result), /refresh_secret|client_secret|ya29\.refreshed/);
});

test('queryGoogleDrive classifies auth and scope failures safely', async () => {
  for (const [status, code] of [
    [401, 'integration_auth_expired'],
    [403, 'integration_scope_missing'],
    [429, 'integration_rate_limited'],
    [503, 'integration_unavailable'],
  ] as const) {
    const result = await queryGoogleDrive({
      workspaceId: 'workspace_test',
      queryType: 'recent_docs',
      accessToken: 'ya29.test-token',
      fetchLike: async () => ({
        ok: false,
        status,
        async json() {
          return { error: { message: 'raw Google provider body with token ya29.secret' } };
        },
        async text() {
          return 'raw Google provider body with token ya29.secret';
        },
      }),
    });

    assert.equal(result.ok, false);
    if (result.ok) throw new Error('expected failure');
    assert.equal(result.code, code);
    assert.doesNotMatch(JSON.stringify(result), /ya29\.secret|raw Google provider body/);
  }
});
