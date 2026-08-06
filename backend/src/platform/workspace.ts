import path from 'path';
import { readJsonFile, writeJsonFile } from './jsonStore';
import type { WorkspaceProfile } from './types';
import {
  validateBusinessContextInput,
  isBusinessContextSet,
  type BusinessContextInput,
} from './businessContext';
import type { WorkspaceBusinessContext } from './types';

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
  if (existing) {
    if (
      workspaceId === DEFAULT_WORKSPACE_ID
      && (existing.name !== 'Purple Orange HQ' || existing.slug !== 'purpleorangehq')
    ) {
      const normalized: WorkspaceProfile = {
        ...existing,
        name: 'Purple Orange HQ',
        slug: 'purpleorangehq',
        updatedAt: new Date().toISOString(),
      };
      saveWorkspaces(items.map((item) => (item.id === workspaceId ? normalized : item)));
      return normalized;
    }
    return existing;
  }

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

export function getBusinessContext(
  workspaceId = DEFAULT_WORKSPACE_ID,
): WorkspaceBusinessContext | null {
  // listWorkspaces, not getWorkspaceProfile: a read must never mint a profile.
  const profile = listWorkspaces().find((item) => item.id === workspaceId);
  const ctx = profile?.businessContext;
  return isBusinessContextSet(ctx) ? ctx : null;
}

export function setBusinessContext(
  workspaceId: string,
  input: BusinessContextInput,
  updatedBy?: string,
): { ok: true; context: WorkspaceBusinessContext } | { ok: false; errors: string[] } {
  const validation = validateBusinessContextInput(input);
  if (!validation.ok) return validation;

  const context: WorkspaceBusinessContext = {
    ...validation.value,
    updatedAt: new Date().toISOString(),
    updatedBy,
  };

  const current = getWorkspaceProfile(workspaceId);
  const items = listWorkspaces();
  const next = { ...current, businessContext: context, updatedAt: context.updatedAt };
  const index = items.findIndex((item) => item.id === workspaceId);
  if (index === -1) items.unshift(next);
  else items[index] = next;
  saveWorkspaces(items);
  return { ok: true, context };
}
