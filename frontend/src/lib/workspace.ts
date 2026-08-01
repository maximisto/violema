export interface WorkspaceContext {
  workspaceId: string;
  workspaceName: string;
}

const DEFAULT_WORKSPACE: WorkspaceContext = {
  workspaceId: 'purpleorangehq',
  workspaceName: 'Purple Orange HQ',
};

// The founder's own workspace doubles as the investor-demo surface: it keeps
// demo delivery defaults (#violema-demo, max@violema.com) that would be wrong
// — and in Slack's case undeliverable — for every other workspace.
export const FOUNDER_WORKSPACE_ID = 'purpleorangehq';

export function isFounderWorkspace(workspaceId: string | null | undefined): boolean {
  return workspaceId === FOUNDER_WORKSPACE_ID;
}

const WORKSPACE_ID_KEY = 'violema_workspace_id';
const WORKSPACE_NAME_KEY = 'violema_workspace_name';
const LEGACY_WORKSPACE_ID_KEYS = ['nexus_workspace_id', 'nexus_workspace'];
const LEGACY_WORKSPACE_NAME_KEY = 'nexus_workspace_name';

function normalizeWorkspaceId(value: string | null): string | null {
  if (!value) return null;
  return value === 'workspace_default' ? DEFAULT_WORKSPACE.workspaceId : value;
}

function normalizeWorkspaceName(value: string | null): string | null {
  if (!value) return null;
  if (value === 'Default Workspace' || value === 'Workspace Default') return DEFAULT_WORKSPACE.workspaceName;
  return value;
}

function safeReadLocalStorage(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeReadSearchParam(name: string): string | null {
  try {
    return new URLSearchParams(window.location.search).get(name);
  } catch {
    return null;
  }
}

export function resolveWorkspaceContext(): WorkspaceContext {
  if (typeof window === 'undefined') return DEFAULT_WORKSPACE;

  const workspaceId = normalizeWorkspaceId(
    safeReadSearchParam('workspace_id') ||
    safeReadSearchParam('workspace') ||
    safeReadLocalStorage(WORKSPACE_ID_KEY) ||
    LEGACY_WORKSPACE_ID_KEYS.map((key) => safeReadLocalStorage(key)).find(Boolean) ||
    null
  ) || DEFAULT_WORKSPACE.workspaceId;

  const workspaceName = normalizeWorkspaceName(
    safeReadSearchParam('workspace_name') ||
    safeReadLocalStorage(WORKSPACE_NAME_KEY) ||
    safeReadLocalStorage(LEGACY_WORKSPACE_NAME_KEY)
  ) || DEFAULT_WORKSPACE.workspaceName;

  try {
    localStorage.setItem(WORKSPACE_ID_KEY, workspaceId);
    localStorage.setItem(WORKSPACE_NAME_KEY, workspaceName);
  } catch {
    // Ignore localStorage write failures.
  }

  return {
    workspaceId,
    workspaceName,
  };
}

export interface WorkspaceRequest {
  url: string;
  headers: Record<string, string>;
}

/**
 * Scope a request to a workspace the same way on every surface: query params
 * for logs and caches, headers for the server's own resolution. Callers that
 * hit several endpoints in a row pass one already-resolved context so a
 * mid-loop workspace switch cannot split a batch across two workspaces.
 */
export function buildWorkspaceRequest(endpoint: string, context: WorkspaceContext): WorkspaceRequest {
  const url = new URL(endpoint, window.location.origin);
  url.searchParams.set('workspace_id', context.workspaceId);
  url.searchParams.set('workspace_name', context.workspaceName);
  return {
    url: url.toString(),
    headers: {
      'X-Workspace-Id': context.workspaceId,
      'X-Workspace-Name': context.workspaceName,
    },
  };
}

export function getWorkspaceRequest(endpoint: string): WorkspaceRequest {
  return buildWorkspaceRequest(endpoint, resolveWorkspaceContext());
}

export function persistWorkspaceContext(workspace: WorkspaceContext = DEFAULT_WORKSPACE) {
  try {
    localStorage.setItem(WORKSPACE_ID_KEY, workspace.workspaceId);
    localStorage.setItem(WORKSPACE_NAME_KEY, workspace.workspaceName);
  } catch {
    // Ignore localStorage write failures.
  }
}

// Adopts the server-assigned workspace after authentication. Keeps a name the
// user already chose for the same workspace; only falls back to the provided
// name when the workspace actually changes.
export function adoptAuthWorkspace(workspaceId: string, fallbackName: string) {
  const storedId = safeReadLocalStorage(WORKSPACE_ID_KEY);
  const storedName = safeReadLocalStorage(WORKSPACE_NAME_KEY);
  const workspaceName = storedId === workspaceId && storedName ? storedName : fallbackName;
  persistWorkspaceContext({ workspaceId, workspaceName });
}
