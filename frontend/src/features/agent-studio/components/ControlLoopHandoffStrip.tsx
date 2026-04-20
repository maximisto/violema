import { ArrowRight, Activity, LineChart, Target } from 'lucide-react';
import type { StudioRoom } from '../types';

interface ControlLoopSignal {
  label: string;
  value: string;
  tone?: 'default' | 'accent';
}

interface ControlLoopHandoffStripProps {
  currentRoom: StudioRoom;
  nextRoom: StudioRoom;
  title: string;
  body: string;
  signals?: ControlLoopSignal[];
  actionLabel?: string;
  onAction?: () => void;
  secondaryLabel?: string;
  onSecondary?: () => void;
}

const ROOM_META: Record<StudioRoom, { label: string; icon: typeof Activity; tone: string }> = {
  live: { label: 'Live', icon: Activity, tone: 'text-cyan-200' },
  optimize: { label: 'Optimize', icon: Target, tone: 'text-violet-200' },
  replay: { label: 'Replay', icon: LineChart, tone: 'text-emerald-200' },
};

export function ControlLoopHandoffStrip({
  currentRoom,
  nextRoom,
  title,
  body,
  signals,
  actionLabel,
  onAction,
  secondaryLabel,
  onSecondary,
}: ControlLoopHandoffStripProps) {
  const CurrentIcon = ROOM_META[currentRoom].icon;
  const NextIcon = ROOM_META[nextRoom].icon;

  return (
    <div className="mt-4 rounded-[1.35rem] border border-white/6 bg-white/[0.03] px-4 py-3.5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2 text-[10px] uppercase tracking-[0.18em] text-slate-500">
            <span>Control loop</span>
            <span className="inline-flex items-center gap-1 rounded-full border border-white/8 bg-white/[0.03] px-2 py-0.5 normal-case tracking-normal text-slate-300">
              <CurrentIcon className={`h-3.5 w-3.5 ${ROOM_META[currentRoom].tone}`} />
              {ROOM_META[currentRoom].label}
            </span>
            <ArrowRight className="h-3.5 w-3.5 text-slate-500" />
            <span className="inline-flex items-center gap-1 rounded-full border border-white/8 bg-white/[0.03] px-2 py-0.5 normal-case tracking-normal text-slate-300">
              <NextIcon className={`h-3.5 w-3.5 ${ROOM_META[nextRoom].tone}`} />
              {ROOM_META[nextRoom].label}
            </span>
          </div>
          <p className="mt-2 text-sm font-medium text-white">{title}</p>
          <p className="mt-1 text-[12px] leading-relaxed text-slate-400">{body}</p>
          {signals?.length ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {signals.map((signal) => (
                <span
                  key={`${signal.label}-${signal.value}`}
                  className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] ${
                    signal.tone === 'accent'
                      ? 'border-violet-500/20 bg-violet-500/10 text-violet-100'
                      : 'border-white/8 bg-white/[0.03] text-slate-300'
                  }`}
                >
                  <span className="uppercase tracking-[0.16em] text-slate-500">{signal.label}</span>
                  <span className="max-w-[15rem] truncate text-slate-200">{signal.value}</span>
                </span>
              ))}
            </div>
          ) : null}
        </div>
        {(actionLabel || secondaryLabel) ? (
          <div className="flex flex-wrap items-center gap-2 pt-0.5">
            {actionLabel && onAction ? (
              <button
                type="button"
                onClick={onAction}
                className="rounded-xl border border-violet-500/24 bg-violet-500/10 px-4 py-2 text-sm font-medium text-violet-100 transition-colors hover:bg-violet-500/14"
              >
                {actionLabel}
              </button>
            ) : null}
            {secondaryLabel && onSecondary ? (
              <button
                type="button"
                onClick={onSecondary}
                className="ui-pill px-3 py-1.5 text-[11px] normal-case tracking-normal text-slate-300"
              >
                {secondaryLabel}
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
