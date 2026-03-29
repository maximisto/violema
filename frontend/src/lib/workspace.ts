export interface WorkspaceContext {
  workspaceId: string;
  workspaceName: string;
}

const DEFAULT_WORKSPACE: WorkspaceContext = {
  workspaceId: 'workspace_default',
  workspaceName: 'Nexus HQ',
};

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

  const workspaceId =
    safeReadSearchParam('workspace_id') ||
    safeReadSearchParam('workspace') ||
    safeReadLocalStorage('nexus_workspace_id') ||
    safeReadLocalStorage('nexus_workspace') ||
    DEFAULT_WORKSPACE.workspaceId;

  const workspaceName =
    safeReadSearchParam('workspace_name') ||
    safeReadLocalStorage('nexus_workspace_name') ||
    DEFAULT_WORKSPACE.workspaceName;

  return {
    workspaceId,
    workspaceName,
  };
}
