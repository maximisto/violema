import { useEffect, useRef, type ReactNode } from 'react';
import X from 'lucide-react/dist/esm/icons/x.js';
import type { MissionWorkspaceTab, MissionWorkspaceView } from './types';

const MISSION_WORKSPACE_TABS: Array<{ id: MissionWorkspaceTab; label: string }> = [
  { id: 'mission', label: 'Mission' },
  { id: 'artifact', label: 'Artifact' },
  { id: 'agents', label: 'Agents' },
  { id: 'board', label: 'Board' },
  { id: 'map', label: 'Map' },
  { id: 'reviews', label: 'Reviews' },
  { id: 'lessons', label: 'Lessons' },
  { id: 'calendar', label: 'Calendar' },
  { id: 'analytics', label: 'Analytics' },
];

interface MissionWorkspacePanelProps {
  mission: MissionWorkspaceView;
  activeTab: MissionWorkspaceTab;
  onTabChange: (tab: MissionWorkspaceTab) => void;
  onClose: () => void;
  isModal?: boolean;
  children: ReactNode;
}

export function MissionWorkspacePanel({
  mission,
  activeTab,
  onTabChange,
  onClose,
  isModal = false,
  children,
}: MissionWorkspacePanelProps) {
  const activeTabLabel = MISSION_WORKSPACE_TABS.find((tab) => tab.id === activeTab)?.label || 'Mission';
  const activeTabId = `context-inspector-tab-${activeTab}`;
  const activePanelId = 'context-inspector-panel';
  const panelRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!isModal) return;
    panelRef.current?.focus();
  }, [isModal]);

  useEffect(() => {
    if (!isModal) return undefined;
    const panel = panelRef.current;
    if (!panel) return undefined;

    const getFocusableItems = () => Array.from(
      panel.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
      )
    ).filter((item) => item.offsetParent !== null);

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return;
      const focusableItems = getFocusableItems();
      if (focusableItems.length === 0) {
        event.preventDefault();
        panel.focus();
        return;
      }

      const firstItem = focusableItems[0];
      const lastItem = focusableItems[focusableItems.length - 1];
      const activeElement = document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;

      if (event.shiftKey && (!activeElement || activeElement === firstItem || !panel.contains(activeElement))) {
        event.preventDefault();
        lastItem.focus();
        return;
      }

      if (!event.shiftKey && activeElement === lastItem) {
        event.preventDefault();
        firstItem.focus();
      }
    };

    panel.addEventListener('keydown', handleKeyDown);
    return () => panel.removeEventListener('keydown', handleKeyDown);
  }, [isModal]);

  return (
    <aside
      ref={panelRef}
      role={isModal ? 'dialog' : undefined}
      aria-modal={isModal ? true : undefined}
      aria-labelledby="context-inspector-title"
      tabIndex={isModal ? -1 : undefined}
      className="fixed inset-x-2 bottom-2 top-24 z-40 flex min-h-0 flex-col overflow-hidden rounded-[1.5rem] border border-navy-800/90 bg-gradient-to-b from-navy-900/90 via-navy-950/95 to-black/80 shadow-[0_24px_64px_rgba(2,6,23,0.58),inset_1px_0_0_rgba(255,255,255,0.03)] backdrop-blur-md lg:static lg:inset-auto lg:z-auto lg:w-[24rem] lg:flex-shrink-0 lg:rounded-none lg:border-y-0 lg:border-r-0 lg:border-l xl:w-[28rem] 2xl:w-[32rem]"
    >
      <header className="border-b border-navy-800/80 bg-gradient-to-r from-violet-500/10 via-navy-950/40 to-cyan-500/10 px-4 py-3.5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-violet-300/80">
              Context inspector
            </p>
            <h2 id="context-inspector-title" className="mt-1 truncate text-sm font-semibold text-white">{mission.title}</h2>
            <p className="mt-1 text-[11px] text-slate-500">{mission.statusLabel}</p>
          </div>
          <div className="flex flex-shrink-0 items-center gap-1.5">
            <button
              type="button"
              onClick={onClose}
              aria-label="Close context inspector"
              className="rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-navy-900/70 hover:text-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      <div className="border-b border-navy-800/80 bg-navy-950/60">
        <div
          role="tablist"
          aria-label="Context inspector sections"
          className="panel-scroll flex min-w-0 gap-1.5 overflow-x-auto px-3 py-2"
        >
          {MISSION_WORKSPACE_TABS.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                id={`context-inspector-tab-${tab.id}`}
                type="button"
                role="tab"
                aria-selected={isActive}
                aria-controls={activePanelId}
                onClick={() => onTabChange(tab.id)}
                className={`whitespace-nowrap rounded-lg border px-3 py-1.5 text-[11px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 ${
                  isActive
                    ? 'border-violet-400/55 bg-violet-500/22 text-white shadow-sm'
                    : 'border-navy-700/60 bg-navy-900/48 text-slate-300 hover:border-navy-600 hover:bg-navy-800/82 hover:text-white'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      <div
        id={activePanelId}
        role="tabpanel"
        aria-labelledby={activeTabId}
        aria-label={`${activeTabLabel} context inspector content`}
        className="panel-scroll min-h-0 flex-1 overflow-y-auto px-4 py-4"
      >
        {children}
      </div>
    </aside>
  );
}
