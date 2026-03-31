import path from 'path';
import { readJsonFile, writeJsonFile } from './jsonStore';
import type { WorkspaceProfile } from './types';

export const WORKSPACES_FILE = path.join(process.cwd(), 'platform-workspaces.json');
export const DEFAULT_WORKSPACE_ID = 'purpleorangehq';

function toSlug(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) || 'workspace';
}

export function listWorkspaces(): WorkspaceProfile[] {
  return readJsonFile<WorkspaceProfile[]>(WORKSPACES_FILE, []);
}

function saveWorkspaces(items: WorkspaceProfile[]) {
  writeJsonFile(WORKSPACES_FILE, items);
}

export function getDefaultWorkspaceProfile(workspaceId = DEFAULT_WORKSPACE_ID): WorkspaceProfile {
  const now = new Date().toISOString();
  return {
    id: workspaceId,
    slug: workspaceId === DEFAULT_WORKSPACE_ID ? 'purpleorangehq' : toSlug(workspaceId),
    name: workspaceId === DEFAULT_WORKSPACE_ID ? 'Purple Orange HQ' : `Workspace ${workspaceId.slice(-4).toUpperCase()}`,
    createdAt: now,
    updatedAt: now,
  };
}

export function getWorkspaceProfile(workspaceId = DEFAULT_WORKSPACE_ID): WorkspaceProfile {
  const items = listWorkspaces();
  const existing = items.find((item) => item.id === workspaceId);
  if (existing) return existing;

  const created = getDefaultWorkspaceProfile(workspaceId);
  saveWorkspaces([created, ...items]);
  return created;
}

export function upsertWorkspaceProfile(
  workspaceId: string,
  patch: Partial<Pick<WorkspaceProfile, 'name' | 'slug' | 'ownerEmail' | 'metadata'>>
): WorkspaceProfile {
  const current = getWorkspaceProfile(workspaceId);
  const next: WorkspaceProfile = {
    ...current,
    ...patch,
    slug: patch.slug ? toSlug(patch.slug) : current.slug,
    updatedAt: new Date().toISOString(),
  };

  const items = listWorkspaces();
  const index = items.findIndex((item) => item.id === workspaceId);
  if (index === -1) {
    items.unshift(next);
  } else {
    items[index] = next;
  }
  saveWorkspaces(items);
  return next;
}
