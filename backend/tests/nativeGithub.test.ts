import assert from 'node:assert/strict';
import test from 'node:test';
import {
  queryGithub,
  type GithubFetchLike,
} from '../src/integrationGateway/adapters/nativeGithub';

function jsonResponse(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async json() {
      return body;
    },
    async text() {
      return JSON.stringify(body);
    },
  };
}

function textResponse(text: string, status: number) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async json() {
      return text;
    },
    async text() {
      return text;
    },
  };
}

test('queryGithub returns readiness error when token is missing', async () => {
  const result = await queryGithub({
    workspaceId: 'workspace_test',
    queryType: 'delivery_risk',
    filters: { repository: 'maximisto/violema' },
    now: new Date('2026-06-30T12:00:00.000Z'),
  });

  assert.equal(result.ok, false);
  if (result.ok) throw new Error('expected readiness error');
  assert.equal(result.code, 'integration_not_ready');
  assert.equal(result.nextAction.route, '/settings#integration-github');
});

test('queryGithub normalizes open issue data without code or secrets', async () => {
  const fetchLike: GithubFetchLike = async (url: string) => {
    assert.match(String(url), /issues/);
    return jsonResponse([
      {
        id: 1,
        number: 42,
        title: 'Fix billing smoke',
        html_url: 'https://github.com/maximisto/violema/issues/42',
        state: 'open',
        labels: [{ name: 'high' }],
        user: { login: 'max' },
        created_at: '2026-06-20T12:00:00.000Z',
        updated_at: '2026-06-29T12:00:00.000Z',
      },
      {
        id: 2,
        number: 43,
        title: 'PR shaped as issue should be ignored',
        html_url: 'https://github.com/maximisto/violema/pull/43',
        pull_request: {},
        state: 'open',
        labels: [],
        user: { login: 'bot' },
        created_at: '2026-06-21T12:00:00.000Z',
        updated_at: '2026-06-29T12:00:00.000Z',
      },
    ]);
  };

  const result = await queryGithub({
    workspaceId: 'workspace_test',
    queryType: 'open_issues',
    filters: { repository: 'maximisto/violema' },
    token: 'ghp_test',
    fetchLike,
    now: new Date('2026-06-30T12:00:00.000Z'),
  });

  assert.equal(result.ok, true);
  if (!result.ok) throw new Error('expected success');
  assert.equal(result.live, true);
  assert.equal(result.source, 'github');
  assert.equal(result.query_type, 'open_issues');
  const data = result.data as { repository: string; total: number; items: Array<{ number: number }> };
  assert.equal(data.repository, 'maximisto/violema');
  assert.equal(data.total, 1);
  assert.equal(data.items[0].number, 42);
  assert.doesNotMatch(JSON.stringify(result), /secret|contents|patch|diff/i);
});

test('queryGithub derives delivery risk from issues and pull requests', async () => {
  const fetchLike: GithubFetchLike = async (url: string) => {
    const value = String(url);
    if (value.includes('/issues')) {
      return jsonResponse([
        {
          number: 1,
          title: 'Blocked onboarding',
          html_url: 'https://github.com/maximisto/violema/issues/1',
          labels: [{ name: 'blocker' }],
          updated_at: '2026-06-01T12:00:00.000Z',
          created_at: '2026-05-25T12:00:00.000Z',
        },
      ]);
    }
    return jsonResponse([
      {
        number: 7,
        title: 'Ship founder brief',
        html_url: 'https://github.com/maximisto/violema/pull/7',
        state: 'closed',
        merged_at: '2026-06-29T12:00:00.000Z',
        updated_at: '2026-06-29T12:00:00.000Z',
        user: { login: 'max' },
      },
    ]);
  };

  const result = await queryGithub({
    workspaceId: 'workspace_test',
    queryType: 'delivery_risk',
    filters: { repository: 'maximisto/violema' },
    token: 'ghp_test',
    fetchLike,
    now: new Date('2026-06-30T12:00:00.000Z'),
  });

  assert.equal(result.ok, true);
  if (!result.ok) throw new Error('expected success');
  const data = result.data as { blockers: number; merged_this_week: number; risk_level: 'low' | 'medium' | 'high' };
  assert.equal(data.blockers, 1);
  assert.equal(data.merged_this_week, 1);
  assert.equal(data.risk_level, 'medium');
});

test('queryGithub classifies non-2xx GitHub responses without leaking upstream bodies', async () => {
  const cases = [
    { status: 401, code: 'integration_auth_expired' },
    { status: 403, code: 'integration_scope_missing' },
    { status: 429, code: 'integration_rate_limited' },
    { status: 503, code: 'integration_unavailable' },
    { status: 418, code: 'integration_query_failed' },
  ] as const;

  for (const testCase of cases) {
    const rawBody = `secret upstream payload ${testCase.status}`;
    const fetchLike: GithubFetchLike = async () => textResponse(rawBody, testCase.status);

    const result = await queryGithub({
      workspaceId: 'workspace_test',
      queryType: 'open_issues',
      filters: { repository: 'maximisto/violema' },
      token: 'ghp_test',
      fetchLike,
      now: new Date('2026-06-30T12:00:00.000Z'),
    });

    assert.equal(result.ok, false);
    if (result.ok) throw new Error('expected error');
    assert.equal(result.code, testCase.code);
    assert.doesNotMatch(result.message, new RegExp(rawBody));
    assert.doesNotMatch(JSON.stringify(result), new RegExp(rawBody));
  }
});
