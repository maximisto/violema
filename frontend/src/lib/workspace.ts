export interface WorkspaceContext {
  workspaceId: string;
  workspaceName: string;
}

const DEFAULT_WORKSPACE: WorkspaceContext = {
  workspaceId: 'purpleorangehq',
  workspaceName: 'Purple Orange HQ',
};

function normalizeWorkspaceId(value: string | null): string | null {
  if (!value) return null;
  return value === 'workspace_default' ? DEFAULT_WORKSPACE.workspaceId : value;
}

function normalizeWorkspaceName(value: string | null): string | null {
  if (!value) return null;
  if (value === 'Nexus HQ' || value === 'Default Workspace') return DEFAULT_WORKSPACE.workspaceName;
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
    safeReadLocalStorage('nexus_workspace_id') ||
    safeReadLocalStorage('nexus_workspace')
  ) || DEFAULT_WORKSPACE.workspaceId;

  const workspaceName = normalizeWorkspaceName(
    safeReadSearchParam('workspace_name') ||
    safeReadLocalStorage('nexus_workspace_name')
  ) || DEFAULT_WORKSPACE.workspaceName;

  try {
    localStorage.setItem('nexus_workspace_id', workspaceId);
    localStorage.setItem('nexus_workspace_name', workspaceName);
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
    localStorage.setItem('nexus_workspace_id', workspace.workspaceId);
    localStorage.setItem('nexus_workspace_name', workspace.workspaceName);
  } catch {
    // Ignore localStorage write failures.
  }
}
