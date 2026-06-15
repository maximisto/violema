import CalendarDays from 'lucide-react/dist/esm/icons/calendar-days.js';
import Clock3 from 'lucide-react/dist/esm/icons/clock-3.js';
import Pause from 'lucide-react/dist/esm/icons/pause.js';
import Play from 'lucide-react/dist/esm/icons/play.js';
import type { ReactNode } from 'react';
import type { MissionWorkspaceView } from './types';

interface MissionCalendarProps {
  mission: MissionWorkspaceView;
  onRunNow: () => void;
  onPauseToggle: () => void;
  disabled?: boolean;
}

function ScheduleTile({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: ReactNode;
}) {
  return (
    <div className="rounded-lg border border-navy-700/70 bg-navy-950/50 p-3">
      <div className="flex items-center gap-2 text-[10px] font-medium text-slate-500">
        {icon}
        {label}
      </div>
      <p className="mt-2 text-[13px] font-semibold leading-snug text-slate-100">{value}</p>
    </div>
  );
}

export function MissionCalendar({
  mission,
  onRunNow,
  onPauseToggle,
  disabled = false,
}: MissionCalendarProps) {
  const pauseLabel = mission.status === 'paused' ? 'Resume' : 'Pause';
  const PauseIcon = mission.status === 'paused' ? Play : Pause;

  return (
    <section className="space-y-4">
      <div>
        <p className="text-[10px] font-medium text-violet-300/80">Mission calendar</p>
        <h3 className="mt-1 text-base font-semibold leading-snug text-white">{mission.title}</h3>
        <p className="mt-2 text-sm leading-6 text-slate-500">{mission.description}</p>
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-1 2xl:grid-cols-2">
        <ScheduleTile
          label="Cadence"
          value={mission.scheduleLabel}
          icon={<CalendarDays className="h-3.5 w-3.5 text-violet-300" />}
        />
        <ScheduleTile
          label="Next run"
          value={mission.nextRunLabel}
          icon={<Clock3 className="h-3.5 w-3.5 text-cyan-300" />}
        />
      </div>

      <div className="rounded-lg border border-navy-700/70 bg-navy-950/50 p-3">
        <p className="text-[10px] font-medium text-slate-500">Credit summary</p>
        <p className="mt-2 text-[12px] leading-5 text-slate-200">{mission.analyticsSummary}</p>
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-1 2xl:grid-cols-2">
        <button
          type="button"
          onClick={onRunNow}
          disabled={disabled}
          title={disabled ? 'Available for live automations when no action is already running.' : 'Trigger this live automation once now.'}
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-violet-400/30 bg-violet-400/10 px-3 py-2 text-[11px] font-semibold text-violet-100 transition-colors hover:bg-violet-400/20 disabled:cursor-not-allowed disabled:border-navy-700/70 disabled:bg-navy-950/40 disabled:text-slate-600 disabled:opacity-70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400"
        >
          <Play className="h-3.5 w-3.5" />
          Run once now
        </button>
        <button
          type="button"
          onClick={onPauseToggle}
          disabled={disabled}
          title={disabled ? 'Available for live automations when no action is already running.' : `${pauseLabel} this automation cadence.`}
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-navy-700/70 bg-navy-950/50 px-3 py-2 text-[11px] font-semibold text-slate-200 transition-colors hover:border-cyan-400/30 hover:bg-cyan-400/10 hover:text-cyan-100 disabled:cursor-not-allowed disabled:border-navy-700/70 disabled:bg-navy-950/40 disabled:text-slate-600 disabled:opacity-70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
        >
          <PauseIcon className="h-3.5 w-3.5" />
          {pauseLabel}
        </button>
      </div>
    </section>
  );
}
