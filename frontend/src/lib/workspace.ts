export interface WorkspaceContext {
  workspaceId: string;
  workspaceName: string;
}

const DEFAULT_WORKSPACE: WorkspaceContext = {
  workspaceId: 'purpleorangehq',
  workspaceName: 'Purple Orange HQ',
};

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

export function persistWorkspaceContext(workspace: WorkspaceContext = DEFAULT_WORKSPACE) {
  try {
    localStorage.setItem(WORKSPACE_ID_KEY, workspace.workspaceId);
    localStorage.setItem(WORKSPACE_NAME_KEY, workspace.workspaceName);
  } catch {
    // Ignore localStorage write failures.
  }
}
