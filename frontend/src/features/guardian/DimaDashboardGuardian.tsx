import { useEffect, useMemo, useState } from 'react';
import Shield from 'lucide-react/dist/esm/icons/shield.js';
import X from 'lucide-react/dist/esm/icons/x.js';
import Sparkles from 'lucide-react/dist/esm/icons/sparkles.js';
import EyeOff from 'lucide-react/dist/esm/icons/eye-off.js';
import type { MissionWorkspaceView } from '../missions/types';
import type { WorkspaceAreaId, WorkspaceTabId } from '../missions/workspaceShell';
import {
  getDimaHiddenStorageKey,
  getDimaMischiefStorageKey,
  getDimaSpritePath,
  selectDimaCue,
} from './dashboardGuardian';

interface DashboardGuardianProps {
  workspaceId: string;
  area: WorkspaceAreaId;
  tab: WorkspaceTabId;
  mission: MissionWorkspaceView;
  lowCreditRunway?: boolean;
  panelOffset?: boolean;
}

function readBooleanPreference(key: string, fallback: boolean) {
  try {
    const value = window.localStorage.getItem(key);
    if (value === null) return fallback;
    return value === 'true';
  } catch {
    return fallback;
  }
}

function writeBooleanPreference(key: string, value: boolean) {
  try {
    window.localStorage.setItem(key, String(value));
  } catch {
    // Best-effort preference only.
  }
}

export function DashboardGuardian({
  workspaceId,
  area,
  tab,
  mission,
  lowCreditRunway = false,
  panelOffset = false,
}: DashboardGuardianProps) {
  const isChatSurface = area === 'home' && tab === 'chat';
  const hiddenKey = useMemo(() => getDimaHiddenStorageKey(workspaceId), [workspaceId]);
  const mischiefKey = useMemo(() => getDimaMischiefStorageKey(workspaceId), [workspaceId]);
  const [hidden, setHidden] = useState(() => readBooleanPreference(hiddenKey, false));
  const [mischiefEnabled, setMischiefEnabled] = useState(() => readBooleanPreference(mischiefKey, true));
  const [bubbleOpen, setBubbleOpen] = useState(() => {
    if (typeof window === 'undefined') return true;
    return isChatSurface && !panelOffset && window.matchMedia('(min-width: 640px)').matches;
  });
  const dockPositionClass = `${isChatSurface ? 'bottom-[7.25rem] sm:bottom-[7.25rem]' : 'bottom-3 sm:bottom-4'} ${panelOffset ? 'right-3 lg:right-[23.25rem]' : 'right-3 sm:right-4'}`;

  useEffect(() => {
    setHidden(readBooleanPreference(hiddenKey, false));
  }, [hiddenKey]);

  useEffect(() => {
    setMischiefEnabled(readBooleanPreference(mischiefKey, true));
  }, [mischiefKey]);

  useEffect(() => {
    const query = window.matchMedia('(min-width: 640px)');
    const syncBubbleState = () => setBubbleOpen(isChatSurface && !panelOffset && query.matches);
    syncBubbleState();
    query.addEventListener('change', syncBubbleState);
    return () => query.removeEventListener('change', syncBubbleState);
  }, [isChatSurface, panelOffset]);

  const activeAgent = mission.agents.find((agent) => agent.id === mission.activeAgentId) || mission.agents[0];
  const completedSteps = mission.steps.filter((step) => step.status === 'completed').length;
  const failedSteps = mission.steps.filter((step) => step.status === 'failed').length;
  const reviewWaiting = mission.steps.some((step) => step.status === 'waiting_review');

  const cue = selectDimaCue({
    area,
    tab,
    missionStatus: mission.status,
    activeAgentLabel: activeAgent?.label,
    lowCreditRunway,
    hasEvidence: mission.evidence.length > 0,
    reviewWaiting,
    completedSteps,
    failedSteps,
    totalSteps: mission.steps.length,
    mischiefEnabled,
  });

  const updateHidden = (next: boolean) => {
    setHidden(next);
    writeBooleanPreference(hiddenKey, next);
  };

  const toggleMischief = () => {
    const next = !mischiefEnabled;
    setMischiefEnabled(next);
    writeBooleanPreference(mischiefKey, next);
  };

  if (hidden) {
    return (
      <div className={`pointer-events-none fixed z-40 ${dockPositionClass}`}>
        <button
          type="button"
          onClick={() => updateHidden(false)}
          className="pointer-events-auto inline-flex h-10 items-center gap-2 rounded-xl border border-slate-600/40 bg-navy-950/84 px-3 text-[11px] font-semibold text-slate-200 shadow-[0_18px_48px_rgba(2,6,23,0.34)] backdrop-blur-md transition-colors hover:border-violet-400/45 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
          aria-label="Show Dima guardian"
          title="Show Dima guardian"
        >
          <Shield className="h-3.5 w-3.5 text-slate-300" />
          Dima
        </button>
      </div>
    );
  }

  return (
    <div
      className={`dima-guardian dima-guardian--${cue.ritual} pointer-events-none fixed z-40 w-[18rem] max-w-[calc(100vw-1.5rem)] ${dockPositionClass}`}
      aria-live="polite"
    >
      {!bubbleOpen ? (
        <button
          type="button"
          onClick={() => setBubbleOpen(true)}
          className="pointer-events-auto ml-auto flex h-9 w-fit items-center gap-2 rounded-xl border border-slate-500/24 bg-navy-950/84 px-3 text-[11px] font-semibold text-slate-200 shadow-[0_18px_48px_rgba(2,6,23,0.32)] backdrop-blur-md transition-colors hover:border-violet-400/45 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 sm:hidden"
          aria-label="Open Dima advice"
          title="Open Dima advice"
        >
          <Shield className="h-3.5 w-3.5" />
          Dima
        </button>
      ) : null}

      {bubbleOpen ? (
        <div className={`pointer-events-auto rounded-2xl border px-3 py-3 shadow-[0_22px_70px_rgba(2,6,23,0.44)] backdrop-blur-xl ${
        cue.tone === 'success'
          ? 'border-green-300/24 bg-green-400/[0.08]'
          : cue.tone === 'warning'
            ? 'border-amber-300/24 bg-amber-400/[0.08]'
            : cue.tone === 'mischief'
              ? 'border-cyan-200/20 bg-cyan-300/[0.07]'
              : 'border-slate-500/20 bg-navy-950/82'
      }`}
        >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="inline-flex h-6 w-6 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] text-slate-200">
                <Shield className="h-3.5 w-3.5" />
              </span>
              <div className="min-w-0">
                <p className="truncate text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Dima</p>
                <p className="truncate text-sm font-semibold text-white">{cue.title}</p>
              </div>
            </div>
            <p className="mt-2 text-[12px] leading-5 text-slate-300">{cue.message}</p>
          </div>
          <button
            type="button"
            onClick={() => updateHidden(true)}
            className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg border border-white/8 bg-white/[0.03] text-slate-500 transition-colors hover:bg-white/[0.06] hover:text-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
            aria-label="Hide Dima"
            title="Hide Dima"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
        <div className="mt-3 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={toggleMischief}
            className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[10px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 ${
              mischiefEnabled
                ? 'border-cyan-300/22 bg-cyan-300/10 text-cyan-100 hover:bg-cyan-300/14'
                : 'border-slate-500/18 bg-slate-500/8 text-slate-300 hover:bg-slate-500/12'
            }`}
            aria-pressed={mischiefEnabled}
          >
            {mischiefEnabled ? <Sparkles className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
            {mischiefEnabled ? 'Mischief on' : 'Professional'}
          </button>
          <span className="text-[10px] font-medium text-slate-600">Guardian layer</span>
        </div>
      </div>
      ) : null}

      <div className={`relative ml-auto mt-1 h-20 w-32 overflow-visible sm:h-28 sm:w-48 ${!bubbleOpen ? 'hidden sm:block' : ''}`}>
        {cue.ritual === 'chew' ? (
          <div className="dima-code-scrap pointer-events-none absolute bottom-3 left-2 rounded-md border border-slate-500/25 bg-navy-950/88 px-2 py-1 font-mono text-[10px] text-slate-400 shadow-[0_10px_28px_rgba(2,6,23,0.28)]">
            bad_step()
          </div>
        ) : null}
        {cue.ritual === 'mark' ? (
          <div className="dima-mark-splash pointer-events-none absolute bottom-1 left-5 h-5 w-12 rounded-[50%] border border-amber-200/22 bg-amber-300/12 blur-[0.2px]" />
        ) : null}
        {cue.ritual === 'kiss' ? (
          <div className="dima-kiss-signal pointer-events-none absolute right-3 top-0 flex h-8 w-8 items-center justify-center rounded-full border border-rose-200/20 bg-rose-300/10 text-[13px] font-bold text-rose-100 shadow-[0_0_26px_rgba(251,113,133,0.18)]">
            OK
          </div>
        ) : null}
        <img
          src={getDimaSpritePath(cue.sprite)}
          alt="Dima, Violema's gray Cane Corso guardian"
          className="dima-dog-image pointer-events-none absolute bottom-0 right-0 h-20 w-[12.5rem] max-w-none object-contain object-right opacity-95 sm:h-28 sm:w-[17.5rem]"
          draggable={false}
        />
      </div>
    </div>
  );
}
