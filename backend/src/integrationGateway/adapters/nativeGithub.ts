import { getIntegrationCredential } from '../../settingsStore';
import type { IntegrationQueryResult, IntegrationReadinessError } from '../types';

export type GithubQueryType = 'delivery_risk' | 'open_issues' | 'merged_prs';

export type GithubFetchLike = (url: string, init?: {
  headers?: Record<string, string>;
}) => Promise<{
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
  text(): Promise<string>;
}>;

export interface QueryGithubInput {
  workspaceId: string;
  queryType: string;
  filters?: Record<string, unknown>;
  token?: string;
  fetchLike?: GithubFetchLike;
  now?: Date;
}

export interface GithubIssueItem {
  number: number;
  title: string;
  url: string;
  labels: string[];
  author: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface GithubPullRequestItem extends GithubIssueItem {
}

export interface GithubOpenIssuesSummary {
  repository: string;
  total: number;
  items: GithubIssueItem[];
  generated_at: string;
  notes: string[];
}

export interface GithubMergedPullRequestsSummary {
  repository: string;
  total: number;
  merged_this_week: number;
  items: GithubPullRequestItem[];
  generated_at: string;
  notes: string[];
}

export interface GithubDeliveryRiskSummary {
  repository: string;
  open_issues: number;
  blockers: number;
  merged_this_week: number;
  risk_level: 'low' | 'medium' | 'high';
  issues: GithubIssueItem[];
  merged_pull_requests: GithubPullRequestItem[];
  generated_at: string;
  notes: string[];
}

export type GithubQueryData =
  | GithubDeliveryRiskSummary
  | GithubOpenIssuesSummary
  | GithubMergedPullRequestsSummary;

interface GithubApiIssue {
  number?: number;
  title?: string;
  html_url?: string;
  labels?: Array<string | { name?: string | null }>;
  user?: { login?: string | null } | null;
  created_at?: string | null;
  updated_at?: string | null;
  pull_request?: unknown;
}

interface GithubApiPullRequest {
  number?: number;
  title?: string;
  html_url?: string;
  labels?: Array<string | { name?: string | null }>;
  user?: { login?: string | null } | null;
  created_at?: string | null;
  updated_at?: string | null;
  merged_at?: string | null;
}

function readinessError(message: string): IntegrationReadinessError {
  return {
    ok: false,
    code: 'integration_not_ready',
    source: 'github',
    message,
    nextAction: {
      label: 'Connect GitHub',
      route: '/settings#integration-github',
    },
  };
}

function unsupportedQuery(queryType: string): IntegrationReadinessError {
  return {
    ok: false,
    code: 'unsupported_query',
    source: 'github',
    message: `GitHub query "${queryType}" is not supported yet. Use "delivery_risk", "open_issues", or "merged_prs".`,
    nextAction: {
      label: 'Connect GitHub',
      route: '/settings#integration-github',
    },
  };
}

function queryFailed(message: string): IntegrationReadinessError {
  return {
    ok: false,
    code: 'integration_query_failed',
    source: 'github',
    message,
    nextAction: {
      label: 'Connect GitHub',
      route: '/settings#integration-github',
    },
  };
}

function resolveRepository(input: QueryGithubInput): string | undefined {
  const repository = input.filters?.repository;
  if (typeof repository === 'string' && repository.trim()) return repository.trim();
  const fallback = process.env.GITHUB_DEFAULT_REPOSITORY;
  if (fallback && fallback.trim()) return fallback.trim();
  return undefined;
}

function resolveToken(input: QueryGithubInput) {
  return input.token || getIntegrationCredential(input.workspaceId, 'github', 'token') || undefined;
}

function normalizeLabels(labels: GithubApiIssue['labels']): string[] {
  return (labels || [])
    .map((label) => {
      if (typeof label === 'string') return label.trim();
      return label?.name?.trim() || '';
    })
    .filter((label) => Boolean(label));
}

function normalizeIssue(item: GithubApiIssue): GithubIssueItem {
  return {
    number: Number(item.number || 0),
    title: item.title || '',
    url: item.html_url || '',
    labels: normalizeLabels(item.labels),
    author: item.user?.login?.trim() || null,
    created_at: item.created_at || null,
    updated_at: item.updated_at || null,
  };
}

function normalizePullRequest(item: GithubApiPullRequest): GithubPullRequestItem {
  return {
    number: Number(item.number || 0),
    title: item.title || '',
    url: item.html_url || '',
    labels: normalizeLabels(item.labels),
    author: item.user?.login?.trim() || null,
    created_at: item.created_at || null,
    updated_at: item.updated_at || null,
  };
}

function buildHeaders(token: string) {
  return {
    Accept: 'application/vnd.github+json',
    Authorization: `Bearer ${token}`,
    'User-Agent': 'Violema-Workflow-Gateway',
    'X-GitHub-Api-Version': '2022-11-28',
  };
}

function parseGithubArray(body: unknown): unknown[] {
  return Array.isArray(body) ? body : [];
}

async function fetchGithubArray(
  fetchLike: GithubFetchLike,
  url: string,
  token: string,
): Promise<unknown[] | IntegrationReadinessError> {
  try {
    const response = await fetchLike(url, { headers: buildHeaders(token) });
    if (!response.ok) {
      const body = await response.text().catch(() => '');
      return queryFailed(`GitHub request failed with status ${response.status}${body ? `: ${body}` : ''}`);
    }
    return parseGithubArray(await response.json());
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown GitHub request failure.';
    return queryFailed(message);
  }
}

function countMergedThisWeek(items: GithubApiPullRequest[], now: Date) {
  const weekStart = now.getTime() - 7 * 24 * 60 * 60 * 1000;
  return items.filter((item) => Boolean(item.merged_at) && Date.parse(item.merged_at as string) >= weekStart).length;
}

function calculateRiskLevel(input: { blockers: number; mergedThisWeek: number; openIssues: number }): 'low' | 'medium' | 'high' {
  if (input.blockers >= 3 || input.openIssues >= 15 || (input.blockers > 0 && input.mergedThisWeek === 0)) {
    return 'high';
  }
  if (input.blockers > 0 || input.openIssues >= 5 || (input.mergedThisWeek < 3 && input.openIssues > 0)) {
    return 'medium';
  }
  return 'low';
}

export async function queryGithub(
  input: QueryGithubInput,
): Promise<IntegrationQueryResult<GithubQueryData>> {
  if (!['delivery_risk', 'open_issues', 'merged_prs'].includes(input.queryType)) {
    return unsupportedQuery(input.queryType);
  }

  const repository = resolveRepository(input);
  if (!repository) {
    return readinessError(
      'GitHub repository scope is required before this workflow can read delivery signals.',
    );
  }

  const token = resolveToken(input);
  if (!token) {
    return readinessError('GitHub token is required before this workflow can read delivery signals.');
  }

  const fetchLike = input.fetchLike || (globalThis.fetch as GithubFetchLike | undefined);
  if (!fetchLike) {
    return queryFailed('Fetch is not available in this runtime.');
  }

  const startedAt = Date.now();
  const now = input.now || new Date();
  const generatedAt = now.toISOString();
  const notes = ['Only safe GitHub list fields were normalized.'];

  const issuesUrl = `https://api.github.com/repos/${repository}/issues?state=open&per_page=50`;
  const pullsUrl = `https://api.github.com/repos/${repository}/pulls?state=closed&sort=updated&direction=desc&per_page=50`;

  const issueResponse = input.queryType === 'merged_prs'
    ? []
    : await fetchGithubArray(fetchLike, issuesUrl, token);
  if (!Array.isArray(issueResponse)) return issueResponse;

  const pullResponse = input.queryType === 'open_issues'
    ? []
    : await fetchGithubArray(fetchLike, pullsUrl, token);
  if (!Array.isArray(pullResponse)) return pullResponse;

  const issues = parseGithubArray(issueResponse)
    .filter((item): item is GithubApiIssue => Boolean(item && typeof item === 'object'))
    .filter((item) => !item.pull_request)
    .map(normalizeIssue);

  const rawPullRequests = parseGithubArray(pullResponse)
    .filter((item): item is GithubApiPullRequest => Boolean(item && typeof item === 'object'))
    .filter((item) => Boolean(item.merged_at));
  const pullRequests = rawPullRequests.map(normalizePullRequest);

  if (input.queryType === 'open_issues') {
    return {
      ok: true,
      source: 'github',
      query_type: 'open_issues',
      data: {
        repository,
        total: issues.length,
        items: issues,
        generated_at: generatedAt,
        notes,
      },
      fetched_at: generatedAt,
      latency_ms: Date.now() - startedAt,
      cache_hit: false,
      live: true,
    };
  }

  const mergedThisWeek = countMergedThisWeek(rawPullRequests, now);

  if (input.queryType === 'merged_prs') {
    return {
      ok: true,
      source: 'github',
      query_type: 'merged_prs',
      data: {
        repository,
        total: pullRequests.length,
        merged_this_week: mergedThisWeek,
        items: pullRequests,
        generated_at: generatedAt,
        notes,
      },
      fetched_at: generatedAt,
      latency_ms: Date.now() - startedAt,
      cache_hit: false,
      live: true,
    };
  }

  const blockers = issues.filter((item) => item.labels.some((label) => /blocker|critical|urgent/i.test(label))).length;
  const riskLevel = calculateRiskLevel({
    blockers,
    mergedThisWeek,
    openIssues: issues.length,
  });

  return {
    ok: true,
    source: 'github',
    query_type: 'delivery_risk',
    data: {
      repository,
      open_issues: issues.length,
      blockers,
      merged_this_week: mergedThisWeek,
      risk_level: riskLevel,
      issues,
      merged_pull_requests: pullRequests,
      generated_at: generatedAt,
      notes,
    },
    fetched_at: generatedAt,
    latency_ms: Date.now() - startedAt,
    cache_hit: false,
    live: true,
  };
}
