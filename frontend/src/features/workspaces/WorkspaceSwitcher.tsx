import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Building2 from 'lucide-react/dist/esm/icons/building-2.js';
import Check from 'lucide-react/dist/esm/icons/check.js';
import ChevronDown from 'lucide-react/dist/esm/icons/chevron-down.js';
import { persistWorkspaceContext, resolveWorkspaceContext } from '../../lib/workspace';

/**
 * Workspace indicator + switcher for the shell header.
 *
 * Why it exists: an admin session and a stale `violema_workspace_id` in
 * localStorage point at two different workspaces, and nothing on screen ever
 * said which one the dashboard was reading. Runs landed in a workspace the
 * founder was not looking at, and looked like they had never happened. The
 * active workspace name is now always visible, and anyone with access to more
 * than one can move between them deliberately.
 *
 * Feature-detected end to end: if `/api/workspaces/mine` is missing, refuses
 * auth, or returns nothing usable, this renders null rather than leaving broken
 * chrome in the header for ordinary single-workspace users.
 */

export interface AccessibleWorkspace {
  id: string;
  name: string;
  role?: 'member' | 'admin';
  isDefault?: boolean;
}

function readWorkspaceItems(payload: unknown): AccessibleWorkspace[] {
  const items = (payload as { items?: unknown } | null)?.items;
  if (!Array.isArray(items)) return [];

  return items
    .map((item): AccessibleWorkspace | null => {
      const record = item as Record<string, unknown> | null;
      const id = typeof record?.id === 'string' ? record.id.trim() : '';
      if (!id) return null;
      const name = typeof record?.name === 'string' && record.name.trim() ? record.name.trim() : id;
      return {
        id,
        name,
        role: record?.role === 'admin' ? 'admin' : 'member',
        isDefault: record?.isDefault === true,
      };
    })
    .filter((item): item is AccessibleWorkspace => Boolean(item));
}

export function WorkspaceSwitcher({ className = '' }: { className?: string }) {
  const active = useMemo(() => resolveWorkspaceContext(), []);
  const [workspaces, setWorkspaces] = useState<AccessibleWorkspace[] | null>(null);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    fetch('/api/workspaces/mine', { credentials: 'same-origin', signal: controller.signal })
      .then(async (response) => {
        // 401/403/404 all mean "this build or this session has no workspace
        // directory" -- stay silent rather than guess.
        if (!response.ok) return null;
        return response.json();
      })
      .then((payload) => {
        if (payload === null) return;
        setWorkspaces(readWorkspaceItems(payload));
      })
      .catch(() => {
        // Network failure is indistinguishable from an absent endpoint here.
      });

    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!open) return undefined;

    const handlePointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  const selectWorkspace = useCallback(
    (workspace: AccessibleWorkspace) => {
      setOpen(false);
      if (workspace.id === active.workspaceId) return;
      persistWorkspaceContext({ workspaceId: workspace.id, workspaceName: workspace.name });
      // Missions, runs, credits, conversations, and the mission selection key
      // are all workspace-scoped and fetched from several independent effects.
      // A reload is the one refetch that cannot leave half the shell pointing
      // at the previous workspace.
      window.location.reload();
    },
    [active.workspaceId],
  );

  if (workspaces === null || workspaces.length === 0) return null;

  const activeEntry = workspaces.find((workspace) => workspace.id === active.workspaceId);
  const activeName = activeEntry?.name || active.workspaceName;
  const canSwitch = workspaces.length > 1;

  const label = (
    <>
      <Building2 className="h-3.5 w-3.5 flex-shrink-0 text-slate-400" />
      <span className="max-w-[9rem] truncate">{activeName}</span>
    </>
  );

  if (!canSwitch) {
    return (
      <div
        className={`hidden shrink-0 items-center gap-1.5 rounded-lg border border-navy-700 bg-navy-800/80 px-3 py-1.5 text-xs text-slate-400 lg:flex ${className}`}
        title={`Workspace: ${activeName}`}
      >
        {label}
      </div>
    );
  }

  return (
    <div ref={containerRef} className={`relative hidden shrink-0 lg:block ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-haspopup="menu"
        aria-expanded={open}
        title={`Workspace: ${activeName}`}
        className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 ${
          open
            ? 'border-violet-700/50 bg-violet-900/30 text-violet-200'
            : 'border-navy-700 bg-navy-800/80 text-slate-400 hover:text-slate-200'
        }`}
      >
        {label}
        <ChevronDown className={`h-3 w-3 flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute right-0 z-50 mt-1.5 w-64 overflow-hidden rounded-xl border border-navy-700/80 bg-navy-950/96 p-1.5 shadow-[0_24px_48px_rgba(2,6,23,0.45)] backdrop-blur-md"
        >
          <p className="px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-600">
            Workspaces
          </p>
          {workspaces.map((workspace) => {
            const isActive = workspace.id === active.workspaceId;
            return (
              <button
                key={workspace.id}
                type="button"
                role="menuitem"
                onClick={() => selectWorkspace(workspace)}
                className={`flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 ${
                  isActive ? 'bg-violet-500/14 text-white' : 'text-slate-300 hover:bg-navy-800/80 hover:text-white'
                }`}
              >
                <span className="min-w-0">
                  <span className="block truncate text-[12px] font-medium">{workspace.name}</span>
                  <span className="mt-0.5 block truncate text-[10px] text-slate-500">
                    {workspace.role === 'admin' ? 'Admin' : 'Member'}
                    {workspace.isDefault ? ' · Default' : ''}
                  </span>
                </span>
                {isActive ? <Check className="h-3.5 w-3.5 flex-shrink-0 text-violet-200" /> : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
