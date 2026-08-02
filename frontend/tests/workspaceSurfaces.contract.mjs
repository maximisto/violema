// Workspace-shell surface contract: the Missions collection tab and the
// workspace switcher.
//
// Both exist because of the same founder session. Mission cards lived only on
// the Chat/Dashboard activity surface, so the Missions tab opened straight into
// one mission's detail with no way to see the others. And nothing in the shell
// ever named the active workspace, so an admin session pointed at a stale
// `violema_workspace_id` read an empty workspace and the runs looked missing.
//
// These are composition assertions on source text -- the same shape as the
// brand-bleed and integrations gates -- because what regressed was wiring, not
// arithmetic.

import { readFileSync } from 'node:fs';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const read = (relativePath) => readFileSync(new URL(relativePath, import.meta.url), 'utf8');

const shell = read('../src/features/missions/workspaceShell.ts');
const dashboard = read('../src/pages/Dashboard.tsx');
const switcher = read('../src/features/workspaces/WorkspaceSwitcher.tsx');

// --- Missions tab leads with the mission card collection ---------------------

assert(shell.includes("| 'collection'"), 'WorkspaceTabId includes the collection tab');

const missionsArea = shell.split("id: 'missions',")[1]?.split("id: 'board',")[0] || '';
assert(missionsArea.length > 0, 'the missions workspace area is defined');
assert(
  missionsArea.includes("defaultTab: 'collection'"),
  'opening Missions lands on the mission card collection, not one mission detail',
);
assert(
  missionsArea.includes("{ id: 'collection', label: 'Collection' }"),
  'the Missions area exposes a Collection tab',
);
assert(
  missionsArea.includes("{ id: 'overview', label: 'Overview' }"),
  'the Missions area keeps its per-mission Overview tab',
);

assert(
  dashboard.includes('const renderMissionCollection'),
  'Dashboard has one shared mission-collection renderer',
);
assert(
  (dashboard.match(/<WorkflowTemplateGallery/g) || []).length === 1,
  'the gallery is composed once and reused, not duplicated per surface',
);
assert(
  (dashboard.match(/\{renderMissionCollection\(\)\}/g) || []).length >= 2,
  'the collection renders on both the Chat/Dashboard activity surface and the Missions tab',
);

const missionsCollectionBranch =
  dashboard.split("workspaceArea === 'missions' && activeWorkspaceTab === 'collection'")[1] || '';
assert(
  missionsCollectionBranch.slice(0, 400).includes('renderMissionCollection()'),
  'the Missions > Collection branch renders the collection',
);
// The collection is useful with nothing selected -- it must not sit behind the
// "no mission selected" bail-out.
assert(
  dashboard.indexOf("workspaceArea === 'missions' && activeWorkspaceTab === 'collection'") <
    dashboard.indexOf('if (!selectedTask) return renderEmptyWorkspaceMain();'),
  'the Missions collection renders before the no-mission-selected bail-out',
);
assert(
  dashboard.includes('onRunMission={(key) => {'),
  'live mission cards keep their Run action',
);

// --- Workspace switcher ------------------------------------------------------

assert(dashboard.includes('<WorkspaceSwitcher />'), 'the shell header mounts the workspace switcher');
assert(
  dashboard.indexOf('<WorkspaceSwitcher />') < dashboard.indexOf('<ThemeToggle className="hidden h-8 w-8'),
  'the switcher sits in the header control cluster',
);

assert(
  switcher.includes("fetch('/api/workspaces/mine'"),
  'the switcher reads the accessible-workspace directory',
);
assert(
  switcher.includes("credentials: 'same-origin'"),
  'the directory request carries the session',
);
assert(
  switcher.includes('if (!response.ok) return null;'),
  'a missing or unauthorized endpoint is treated as "no directory"',
);
assert(
  switcher.includes('if (workspaces === null || workspaces.length === 0) return null;'),
  'the switcher renders nothing when there is no usable directory',
);
assert(
  switcher.includes('const canSwitch = workspaces.length > 1;') && switcher.includes('if (!canSwitch)'),
  'a single-workspace user still sees the name but gets no menu',
);
assert(
  switcher.includes('persistWorkspaceContext({ workspaceId: workspace.id, workspaceName: workspace.name })'),
  'selecting a workspace writes the persisted context through lib/workspace',
);
assert(
  switcher.includes('window.location.reload()'),
  'switching refetches every workspace-scoped surface rather than half of them',
);

console.log(
  'workspaceSurfaces.contract: Missions leads with the card collection; the switcher names the active workspace and feature-detects',
);
