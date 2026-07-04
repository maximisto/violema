import {
  executeComposioAction,
  normalizeComposioAppName,
  resolveComposioEntityId,
} from '../../composioBridge';
import type {
  IntegrationQueryResult,
  IntegrationReadinessError,
} from '../types';

export type FounderToolSource = 'linear' | 'notion';
export type FounderToolQueryType =
  | 'delivery_backlog'
  | 'blockers'
  | 'sprint'
  | 'operating_context'
  | 'investor_notes'
  | 'decision_log';

export const FOUNDER_TOOL_PROVIDER_ALIASES: Record<FounderToolSource, string[]> = {
  linear: ['linear'],
  notion: ['notion'],
};

const FOUNDER_TOOL_ACTIONS: Record<
  FounderToolSource,
  Partial<Record<FounderToolQueryType, string>>
> = {
  linear: {
    delivery_backlog: 'LINEAR_LIST_LINEAR_ISSUES',
    blockers: 'LINEAR_SEARCH_ISSUES',
    sprint: 'LINEAR_LIST_LINEAR_ISSUES',
  },
  notion: {
    operating_context: 'NOTION_SEARCH_NOTION_PAGE',
    investor_notes: 'NOTION_SEARCH_NOTION_PAGE',
    decision_log: 'NOTION_SEARCH_NOTION_PAGE',
  },
};

type FounderToolExecutor = (
  actionName: string,
  input: Record<string, unknown>,
  ctx: { entityId: string },
) => Promise<unknown>;

export interface FounderToolQueryItem {
  [key: string]: unknown;
}

export interface FounderToolQueryData {
  providerRoute: string;
  total: number;
  items: FounderToolQueryItem[];
}

export interface QueryFounderToolInput {
  workspaceId: string;
  workflowId?: string;
  source: FounderToolSource;
  queryType: FounderToolQueryType;
  connectedPartnerApps?: string[];
  filters?: Record<string, unknown>;
  now?: Date;
  executor?: FounderToolExecutor;
}

interface LinearIssueRecord {
  id?: string;
  identifier?: string;
  title?: string;
  url?: string;
  state?: string | { name?: string } | null;
  priority?: number | string | null;
  assignee?: string | { name?: string } | null;
  updatedAt?: string;
  updated_at?: string;
}

interface NotionSearchRecord {
  id?: string;
  object?: string;
  title?: string;
  name?: string;
  url?: string;
  last_edited_time?: string;
  lastEditedTime?: string;
  properties?: Record<string, unknown>;
}

const defaultExecutor: FounderToolExecutor = (actionName, input, ctx) =>
  executeComposioAction(actionName, input, ctx);

const NOTION_QUERY_HINTS: Record<
  Extract<FounderToolQueryType, 'operating_context' | 'investor_notes' | 'decision_log'>,
  string
> = {
  operating_context: 'strategy operating review',
  investor_notes: 'investor update board fundraising',
  decision_log: 'decision log strategy',
};

function readWorkflowId(value?: string) {
  return typeof value === 'string' && value.trim() ? value.trim() : 'weekly-founder-brief';
}

function providerRoute(source: FounderToolSource, workflowId = 'weekly-founder-brief') {
  return `/integrations?provider=${source}&workflow=${encodeURIComponent(readWorkflowId(workflowId))}`;
}

function missingConnection(source: FounderToolSource, workflowId: string): IntegrationReadinessError {
  const labels: Record<FounderToolSource, string> = {
    linear: 'Connect Linear',
    notion: 'Connect Notion',
  };

  return {
    ok: false,
    code: 'integration_not_ready',
    source,
    workflowId,
    message: `${labels[source].replace('Connect ', '')} is required before this workflow can read live partner data.`,
    nextAction: {
      label: labels[source],
      route: providerRoute(source, workflowId),
    },
  };
}

function unsupportedQuery(
  source: FounderToolSource,
  queryType: string,
  workflowId: string,
): IntegrationReadinessError {
  return {
    ok: false,
    code: 'unsupported_query',
    source,
    workflowId,
    message: `Partner query "${queryType}" is not supported for ${source}.`,
    nextAction: {
      label: 'Manage integrations',
      route: providerRoute(source, workflowId),
    },
  };
}

function queryFailed(source: FounderToolSource, workflowId: string): IntegrationReadinessError {
  return {
    ok: false,
    code: 'integration_query_failed',
    source,
    workflowId,
    message: 'Partner query failed. Review the integration connection and try again.',
    nextAction: {
      label: 'Review integration',
      route: providerRoute(source, workflowId),
    },
  };
}

function isConnected(source: FounderToolSource, connectedPartnerApps: string[] = []) {
  const normalized = new Set(connectedPartnerApps.map((value) => normalizeComposioAppName(value)));
  return FOUNDER_TOOL_PROVIDER_ALIASES[source].some((alias) => normalized.has(alias));
}

function readActionName(source: FounderToolSource, queryType: FounderToolQueryType) {
  return FOUNDER_TOOL_ACTIONS[source][queryType];
}

function readPositiveInteger(value: unknown, max: number) {
  if (typeof value !== 'number' || !Number.isInteger(value) || value <= 0) return undefined;
  return Math.min(value, max);
}

function readSafeString(value: unknown, maxLength: number) {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > maxLength) return undefined;
  return trimmed;
}

function buildLinearInput(
  queryType: FounderToolQueryType,
  filters?: Record<string, unknown>,
): Record<string, unknown> {
  const first = readPositiveInteger(filters?.first ?? filters?.limit, 50) || 25;
  if (queryType === 'blockers') {
    return {
      query: 'blocked blocker urgent',
      first,
      include_archived: false,
    };
  }

  const projectId = readSafeString(filters?.project_id ?? filters?.projectId, 128);
  const assigneeId = readSafeString(filters?.assignee_id ?? filters?.assigneeId, 128);
  return {
    first,
    ...(projectId ? { project_id: projectId } : {}),
    ...(assigneeId ? { assignee_id: assigneeId } : {}),
    include_transitions: false,
  };
}

function buildNotionInput(
  queryType: FounderToolQueryType,
  filters?: Record<string, unknown>,
): Record<string, unknown> {
  const pageSize = readPositiveInteger(filters?.pageSize ?? filters?.page_size ?? filters?.limit, 25) || 10;
  const query = NOTION_QUERY_HINTS[queryType as keyof typeof NOTION_QUERY_HINTS] || '';
  return {
    query,
    page_size: pageSize,
    filter_value: 'page',
    timestamp: 'last_edited_time',
    direction: 'descending',
  };
}

function buildActionInput(
  source: FounderToolSource,
  queryType: FounderToolQueryType,
  filters?: Record<string, unknown>,
) {
  return source === 'linear'
    ? buildLinearInput(queryType, filters)
    : buildNotionInput(queryType, filters);
}

function readRecords(payload: unknown, ...fields: string[]) {
  if (Array.isArray(payload)) return payload;
  if (!payload || typeof payload !== 'object') return [];

  const record = payload as Record<string, unknown>;
  for (const field of fields) {
    const value = record[field];
    if (Array.isArray(value)) return value;
  }

  const data = record.data;
  if (data && typeof data === 'object' && !Array.isArray(data)) {
    for (const field of fields) {
      const value = (data as Record<string, unknown>)[field];
      if (Array.isArray(value)) return value;
    }
  }

  return [];
}

function readNestedName(value: unknown) {
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const name = (value as { name?: unknown }).name;
    return typeof name === 'string' ? name : '';
  }
  return '';
}

function normalizeLinearIssue(item: LinearIssueRecord) {
  return {
    id: item.id || '',
    identifier: item.identifier || '',
    title: item.title || '',
    url: item.url || '',
    state: readNestedName(item.state),
    priority: item.priority ?? null,
    assignee: readNestedName(item.assignee),
    updatedAt: item.updatedAt || item.updated_at || null,
  };
}

function readPlainTextFromProperty(value: unknown): string {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return '';
  const title = (value as { title?: unknown }).title;
  if (Array.isArray(title)) {
    return title
      .map((item) => item && typeof item === 'object' ? (item as { plain_text?: unknown }).plain_text : '')
      .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
      .join(' ')
      .trim();
  }
  return '';
}

function readNotionTitle(item: NotionSearchRecord) {
  if (item.title) return item.title;
  if (item.name) return item.name;

  const properties = item.properties;
  if (!properties) return '';

  for (const key of ['title', 'Title', 'Name']) {
    const text = readPlainTextFromProperty(properties[key]);
    if (text) return text;
  }

  return '';
}

function normalizeNotionItem(item: NotionSearchRecord) {
  return {
    id: item.id || '',
    object: item.object || '',
    title: readNotionTitle(item),
    url: item.url || '',
    lastEditedTime: item.lastEditedTime || item.last_edited_time || null,
  };
}

function normalizeItems(source: FounderToolSource, payload: unknown): FounderToolQueryItem[] {
  if (source === 'linear') {
    return readRecords(payload, 'issues', 'nodes').map((item) => normalizeLinearIssue(item as LinearIssueRecord));
  }

  return readRecords(payload, 'results', 'pages', 'items').map((item) => normalizeNotionItem(item as NotionSearchRecord));
}

export async function queryFounderTool(
  input: QueryFounderToolInput,
): Promise<IntegrationQueryResult<FounderToolQueryData>> {
  const workflowId = readWorkflowId(input.workflowId);
  if (!isConnected(input.source, input.connectedPartnerApps)) {
    return missingConnection(input.source, workflowId);
  }

  const actionName = readActionName(input.source, input.queryType);
  if (!actionName) {
    return unsupportedQuery(input.source, input.queryType, workflowId);
  }

  const now = input.now || new Date();
  const startedAt = Date.now();
  const executor = input.executor || defaultExecutor;

  try {
    const raw = await executor(
      actionName,
      buildActionInput(input.source, input.queryType, input.filters),
      { entityId: resolveComposioEntityId(input.workspaceId) },
    );
    const items = normalizeItems(input.source, raw);

    return {
      ok: true,
      source: input.source,
      query_type: input.queryType,
      data: {
        providerRoute: providerRoute(input.source, workflowId),
        total: items.length,
        items,
      },
      fetched_at: now.toISOString(),
      latency_ms: Date.now() - startedAt,
      cache_hit: false,
      live: true,
    };
  } catch {
    return queryFailed(input.source, workflowId);
  }
}
