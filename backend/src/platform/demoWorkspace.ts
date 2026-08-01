import { listWorkspaces } from './workspace';

/**
 * Demo scoping for fabricated data.
 *
 * Violema ships labeled sample data for demo surfaces, but a real customer
 * workspace must never receive invented numbers inside a successful run. This
 * module is the single place that decides which workspaces are allowed to see
 * simulated output.
 *
 * A workspace is a demo workspace when EITHER:
 *   - its id appears in the comma-separated `DEMO_WORKSPACE_IDS` env var
 *     (entries are trimmed, matching is case-sensitive), or
 *   - its stored workspace profile carries `metadata.demo === true`.
 *
 * Default is closed: with no env var and no metadata flag, nothing is a demo
 * workspace — including DEFAULT_WORKSPACE_ID, which runs real internal missions.
 */
export function listDemoWorkspaceIds(): string[] {
  const raw = process.env.DEMO_WORKSPACE_IDS;
  if (!raw) return [];
  return raw
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function hasDemoMetadata(workspaceId: string): boolean {
  try {
    // Read-only lookup on purpose: getWorkspaceProfile() creates missing
    // profiles, and a provenance check must never write to the store.
    const profile = listWorkspaces().find((item) => item.id === workspaceId);
    return profile?.metadata?.demo === true;
  } catch {
    return false;
  }
}

export function isDemoWorkspace(workspaceId: string): boolean {
  const id = typeof workspaceId === 'string' ? workspaceId.trim() : '';
  if (!id) return false;
  if (listDemoWorkspaceIds().includes(id)) return true;
  return hasDemoMetadata(id);
}
