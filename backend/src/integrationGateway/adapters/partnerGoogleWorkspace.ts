import {
  executeComposioAction,
  normalizeComposioAppName,
} from '../../composioBridge';
import type {
  IntegrationQueryResult,
  IntegrationReadinessError,
} from '../types';

export type GoogleWorkspaceSource = 'gmail' | 'google_calendar' | 'google_drive';
export type GoogleWorkspaceQueryType =
  | 'commitments'
  | 'unreplied_threads'
  | 'investor_threads'
  | 'weekly_commitments'
  | 'upcoming_meetings'
  | 'recent_meetings'
  | 'recent_docs'
  | 'investor_materials'
  | 'board_packet_sources';

export const GOOGLE_WORKSPACE_PROVIDER_ALIASES: Record<GoogleWorkspaceSource, string[]> = {
  gmail: ['gmail'],
  google_calendar: ['google_calendar', 'googlecalendar'],
  google_drive: ['google_drive', 'googledrive'],
};

const GOOGLE_WORKSPACE_ACTIONS: Record<
  GoogleWorkspaceSource,
  Partial<Record<GoogleWorkspaceQueryType, string>>
> = {
  gmail: {
    commitments: 'GMAIL_FETCH_EMAILS',
    unreplied_threads: 'GMAIL_FETCH_EMAILS',
    investor_threads: 'GMAIL_FETCH_EMAILS',
  },
  google_calendar: {
    weekly_commitments: 'GOOGLECALENDAR_FIND_EVENT',
    upcoming_meetings: 'GOOGLECALENDAR_FIND_EVENT',
    recent_meetings: 'GOOGLECALENDAR_FIND_EVENT',
  },
  google_drive: {
    recent_docs: 'GOOGLEDRIVE_LIST_FILES',
    investor_materials: 'GOOGLEDRIVE_LIST_FILES',
    board_packet_sources: 'GOOGLEDRIVE_LIST_FILES',
  },
};

type GoogleWorkspaceExecutor = (
  actionName: string,
  input: Record<string, unknown>,
  ctx: { entityId: string },
) => Promise<unknown>;

export interface GoogleWorkspaceWindow {
  start: string;
  end: string;
}

export interface GoogleWorkspaceQueryItem {
  [key: string]: unknown;
}

export interface GoogleWorkspaceQueryData {
  window: GoogleWorkspaceWindow;
  providerRoute: string;
  total: number;
  items: GoogleWorkspaceQueryItem[];
  warnings?: string[];
}

export interface QueryGoogleWorkspaceInput {
  workspaceId: string;
  workflowId?: string;
  source: GoogleWorkspaceSource;
  queryType: GoogleWorkspaceQueryType;
  connectedPartnerApps?: string[];
  filters?: Record<string, unknown>;
  now?: Date;
  executor?: GoogleWorkspaceExecutor;
}

interface RelativeWindow {
  startOffsetDays: number;
  endOffsetDays: number;
}

interface GmailThreadRecord {
  id?: string;
  subject?: string;
  from?: string;
  date?: string;
  snippet?: string;
}

interface CalendarEventRecord {
  id?: string;
  summary?: string;
  start?: { dateTime?: string; date?: string } | null;
  end?: { dateTime?: string; date?: string } | null;
  attendees?: unknown[];
}

interface DriveFileRecord {
  id?: string;
  name?: string;
  mimeType?: string;
  webViewLink?: string;
  modifiedTime?: string;
}

const defaultExecutor: GoogleWorkspaceExecutor = (actionName, input, ctx) =>
  executeComposioAction(actionName, input, ctx);

const WINDOW_BY_QUERY_TYPE: Record<GoogleWorkspaceQueryType, RelativeWindow> = {
  commitments: { startOffsetDays: -7, endOffsetDays: 0 },
  unreplied_threads: { startOffsetDays: -14, endOffsetDays: 0 },
  investor_threads: { startOffsetDays: -30, endOffsetDays: 0 },
  weekly_commitments: { startOffsetDays: 0, endOffsetDays: 7 },
  upcoming_meetings: { startOffsetDays: 0, endOffsetDays: 14 },
  recent_meetings: { startOffsetDays: -14, endOffsetDays: 0 },
  recent_docs: { startOffsetDays: -14, endOffsetDays: 0 },
  investor_materials: { startOffsetDays: -30, endOffsetDays: 0 },
  board_packet_sources: { startOffsetDays: -30, endOffsetDays: 0 },
};

const GMAIL_QUERY_HINTS: Record<
  Extract<GoogleWorkspaceQueryType, 'commitments' | 'unreplied_threads' | 'investor_threads'>,
  string
> = {
  commitments: '("follow up" OR "following up" OR deadline OR due OR send)',
  unreplied_threads: '("awaiting reply" OR "following up" OR unanswered OR "circling back")',
  investor_threads: '(investor OR fund OR partner OR deck OR update)',
};

const CALENDAR_INTENTS: Record<
  Extract<GoogleWorkspaceQueryType, 'weekly_commitments' | 'upcoming_meetings' | 'recent_meetings'>,
  string
> = {
  weekly_commitments: 'weekly_commitments_window',
  upcoming_meetings: 'upcoming_meetings_window',
  recent_meetings: 'recent_meetings_window',
};

const DRIVE_QUERY_HINTS: Record<
  Extract<GoogleWorkspaceQueryType, 'recent_docs' | 'investor_materials' | 'board_packet_sources'>,
  string
> = {
  recent_docs: [
    "mimeType = 'application/vnd.google-apps.document'",
    "mimeType = 'application/vnd.google-apps.spreadsheet'",
    "mimeType = 'application/vnd.google-apps.presentation'",
  ].join(' or '),
  investor_materials: [
    'name contains "investor"',
    'name contains "fundraising"',
    'name contains "deck"',
    'name contains "metrics"',
    'name contains "update"',
  ].join(' or '),
  board_packet_sources: [
    'name contains "board packet"',
    'name contains "board deck"',
    'name contains "investor update"',
    'name contains "meeting prep"',
  ].join(' or '),
};

const DRIVE_METADATA_FIELDS = 'files(id,name,mimeType,webViewLink,modifiedTime),nextPageToken';

function readWorkflowId(value?: string) {
  return typeof value === 'string' && value.trim() ? value.trim() : 'weekly-founder-brief';
}

function providerRoute(source: GoogleWorkspaceSource, workflowId = 'weekly-founder-brief') {
  return `/integrations?provider=${source}&workflow=${encodeURIComponent(readWorkflowId(workflowId))}`;
}

function missingConnection(source: GoogleWorkspaceSource, workflowId: string): IntegrationReadinessError {
  const labels: Record<GoogleWorkspaceSource, string> = {
    gmail: 'Connect Gmail',
    google_calendar: 'Connect Google Calendar',
    google_drive: 'Connect Google Drive',
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
  source: GoogleWorkspaceSource,
  queryType: string,
  workflowId: string,
): IntegrationReadinessError {
  return {
    ok: false,
    code: 'unsupported_query',
    source,
    workflowId,
    message: `Google Workspace query "${queryType}" is not supported for ${source}.`,
    nextAction: {
      label: 'Manage integrations',
      route: providerRoute(source, workflowId),
    },
  };
}

function queryFailed(
  source: GoogleWorkspaceSource,
  workflowId: string,
): IntegrationReadinessError {
  return {
    ok: false,
    code: 'integration_query_failed',
    source,
    workflowId,
    message: 'Google Workspace partner query failed. Review the integration connection and try again.',
    nextAction: {
      label: 'Review integration',
      route: providerRoute(source, workflowId),
    },
  };
}

function addDays(date: Date, days: number) {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

function readWindow(now: Date, queryType: GoogleWorkspaceQueryType): GoogleWorkspaceWindow {
  const range = WINDOW_BY_QUERY_TYPE[queryType];
  return {
    start: addDays(now, range.startOffsetDays).toISOString(),
    end: addDays(now, range.endOffsetDays).toISOString(),
  };
}

function isConnected(source: GoogleWorkspaceSource, connectedPartnerApps: string[] = []) {
  const normalized = new Set(connectedPartnerApps.map((value) => normalizeComposioAppName(value)));
  return GOOGLE_WORKSPACE_PROVIDER_ALIASES[source].some((alias) => normalized.has(alias));
}

function readActionName(
  source: GoogleWorkspaceSource,
  queryType: GoogleWorkspaceQueryType,
) {
  return GOOGLE_WORKSPACE_ACTIONS[source][queryType];
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

function buildAllowedFilters(
  source: GoogleWorkspaceSource,
  filters?: Record<string, unknown>,
): Record<string, unknown> {
  if (!filters) return {};

  if (source === 'gmail') {
    const maxResults = readPositiveInteger(filters.maxResults ?? filters.limit, 50);
    return maxResults ? { maxResults } : {};
  }

  if (source === 'google_calendar') {
    const calendarId = readSafeString(filters.calendarId, 256);
    return calendarId ? { calendarId } : {};
  }

  const pageSize = readPositiveInteger(filters.pageSize ?? filters.limit, 50);
  return pageSize ? { pageSize } : {};
}

function normalizeGmailItem(item: GmailThreadRecord) {
  return {
    id: item.id || '',
    subject: item.subject || '',
    from: item.from || '',
    date: item.date || null,
    snippet: item.snippet || '',
  };
}

function normalizeCalendarItem(item: CalendarEventRecord) {
  return {
    id: item.id || '',
    title: item.summary || '',
    start: item.start?.dateTime || item.start?.date || null,
    end: item.end?.dateTime || item.end?.date || null,
    attendee_count: Array.isArray(item.attendees) ? item.attendees.length : 0,
  };
}

function normalizeDriveItem(item: DriveFileRecord) {
  return {
    id: item.id || '',
    name: item.name || '',
    mimeType: item.mimeType || '',
    url: item.webViewLink || '',
    modifiedTime: item.modifiedTime || null,
  };
}

function normalizeItems(
  source: GoogleWorkspaceSource,
  payload: unknown,
): GoogleWorkspaceQueryItem[] {
  if (!payload || typeof payload !== 'object') return [];

  if (source === 'gmail') {
    const threads = Array.isArray((payload as { threads?: unknown[] }).threads)
      ? (payload as { threads: GmailThreadRecord[] }).threads
      : [];
    return threads.map(normalizeGmailItem);
  }

  if (source === 'google_calendar') {
    const events = Array.isArray((payload as { events?: unknown[] }).events)
      ? (payload as { events: CalendarEventRecord[] }).events
      : [];
    return events.map(normalizeCalendarItem);
  }

  const files = Array.isArray((payload as { files?: unknown[] }).files)
    ? (payload as { files: DriveFileRecord[] }).files
    : [];
  return files.map(normalizeDriveItem);
}

function buildActionInput(
  source: GoogleWorkspaceSource,
  queryType: GoogleWorkspaceQueryType,
  window: GoogleWorkspaceWindow,
  filters?: Record<string, unknown>,
): Record<string, unknown> {
  const baseInput: Record<string, unknown> = {
    queryType,
    start: window.start,
    end: window.end,
  };
  const safeFilters = buildAllowedFilters(source, filters);

  if (source === 'gmail') {
    return {
      ...baseInput,
      maxResults: 25,
      query: GMAIL_QUERY_HINTS[queryType as keyof typeof GMAIL_QUERY_HINTS] || '',
      ...safeFilters,
      includeBody: false,
    };
  }

  if (source === 'google_calendar') {
    return {
      ...baseInput,
      calendarId: 'primary',
      intent: CALENDAR_INTENTS[queryType as keyof typeof CALENDAR_INTENTS] || 'calendar_window',
      ...safeFilters,
    };
  }

  return {
    ...baseInput,
    pageSize: 25,
    q: DRIVE_QUERY_HINTS[queryType as keyof typeof DRIVE_QUERY_HINTS] || '',
    fields: DRIVE_METADATA_FIELDS,
    ...safeFilters,
    includeText: false,
  };
}

export async function queryGoogleWorkspace(
  input: QueryGoogleWorkspaceInput,
): Promise<IntegrationQueryResult<GoogleWorkspaceQueryData>> {
  const workflowId = readWorkflowId(input.workflowId);
  if (!isConnected(input.source, input.connectedPartnerApps)) {
    return missingConnection(input.source, workflowId);
  }

  const actionName = readActionName(input.source, input.queryType);
  if (!actionName) {
    return unsupportedQuery(input.source, input.queryType, workflowId);
  }

  const now = input.now || new Date();
  const window = readWindow(now, input.queryType);
  const startedAt = Date.now();
  const executor = input.executor || defaultExecutor;

  try {
    const raw = await executor(
      actionName,
      buildActionInput(input.source, input.queryType, window, input.filters),
      { entityId: input.workspaceId },
    );
    const items = normalizeItems(input.source, raw);

    return {
      ok: true,
      source: input.source,
      query_type: input.queryType,
      data: {
        window,
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
