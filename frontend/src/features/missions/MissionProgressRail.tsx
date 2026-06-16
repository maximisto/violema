import AlertTriangle from 'lucide-react/dist/esm/icons/alert-triangle.js';
import CheckCircle2 from 'lucide-react/dist/esm/icons/check-circle-2.js';
import Circle from 'lucide-react/dist/esm/icons/circle.js';
import Clock3 from 'lucide-react/dist/esm/icons/clock-3.js';
import Zap from 'lucide-react/dist/esm/icons/zap.js';
import {
  buildCompactMissionProgressPhases,
  buildMissionProgressPhases,
  type MissionProgressPhase,
  type MissionProgressTone,
} from './missionProgress';
import type { MissionStepView, MissionWorkspaceView } from './types';

interface MissionProgressRailProps {
  mission?: MissionWorkspaceView;
  steps?: MissionStepView[];
  phases?: MissionProgressPhase[];
  variant?: 'full' | 'compact';
  className?: string;
}

const toneClasses: Record<MissionProgressTone, {
  dot: string;
  icon: string;
  connector: string;
  label: string;
  meta: string;
  glow?: string;
}> = {
  muted: {
    dot: 'border-slate-600/45 bg-navy-950 text-slate-600',
    icon: 'text-slate-600',
    connector: 'bg-navy-700/70',
    label: 'text-slate-500',
    meta: 'text-slate-600',
  },
  done: {
    dot: 'border-green-300/40 bg-green-300/14 text-green-100',
    icon: 'text-green-200',
    connector: 'bg-green-300/45',
    label: 'text-slate-200',
    meta: 'text-green-200/80',
  },
  live: {
    dot: 'border-violet-200/60 bg-violet-400/22 text-violet-50 shadow-[0_0_24px_rgba(124,92,255,0.32)]',
    icon: 'text-cyan-100',
    connector: 'bg-gradient-to-r from-violet-300/75 to-cyan-300/65',
    label: 'text-white',
    meta: 'text-cyan-100',
    glow: 'ring-4 ring-cyan-300/10',
  },
  amber: {
    dot: 'border-amber-300/45 bg-amber-300/14 text-amber-50',
    icon: 'text-amber-100',
    connector: 'bg-amber-300/42',
    label: 'text-amber-50',
    meta: 'text-amber-200/85',
  },
  red: {
    dot: 'border-red-300/45 bg-red-400/14 text-red-50',
    icon: 'text-red-100',
    connector: 'bg-red-300/42',
    label: 'text-red-50',
    meta: 'text-red-200/85',
  },
};

function classes(...values: Array<string | false | undefined>) {
  return values.filter(Boolean).join(' ');
}

function IconForPhase({ phase }: { phase: MissionProgressPhase }) {
  const iconClassName = classes('h-3.5 w-3.5', toneClasses[phase.tone].icon);

  if (phase.status === 'completed') return <CheckCircle2 className={iconClassName} />;
  if (phase.status === 'running') return <Zap className={iconClassName} />;
  if (phase.status === 'waiting_review' || phase.status === 'paused') return <Clock3 className={iconClassName} />;
  if (phase.status === 'failed') return <AlertTriangle className={iconClassName} />;
  return <Circle className={iconClassName} />;
}

function resolvePhases({ mission, steps, phases, variant }: MissionProgressRailProps) {
  if (phases) return phases;
  if (variant === 'compact') return buildCompactMissionProgressPhases(mission || steps || []);
  return buildMissionProgressPhases(mission || steps || []);
}

function connectorTone(current: MissionProgressPhase, next?: MissionProgressPhase) {
  if (!next) return undefined;
  if (current.tone === 'red' || next.tone === 'red') return toneClasses.red.connector;
  if (current.tone === 'live' || next.tone === 'live') return toneClasses.live.connector;
  if (current.tone === 'amber' || next.tone === 'amber') return toneClasses.amber.connector;
  if (current.tone === 'done' && next.tone === 'done') return toneClasses.done.connector;
  if (current.tone === 'done') return 'bg-gradient-to-r from-green-300/45 to-navy-700/70';
  return toneClasses.muted.connector;
}

function FullRail({ phases, className }: { phases: MissionProgressPhase[]; className?: string }) {
  return (
    <div className={classes('rounded-xl border border-navy-700/70 bg-navy-950/42 px-3 py-3', className)}>
      <div className="flex items-center justify-between gap-3">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-violet-200/80">Run progress</p>
        <p className="text-[10px] text-slate-600">live mission state</p>
      </div>
      <ol className="mt-3 grid grid-cols-6 gap-0">
        {phases.map((phase, index) => {
          const tone = toneClasses[phase.tone];
          const next = phases[index + 1];

          return (
            <li key={phase.id} className="relative min-w-0 px-0.5">
              {next ? (
                <span
                  className={classes(
                    'absolute left-1/2 right-[-50%] top-4 z-0 h-[2px] rounded-full',
                    connectorTone(phase, next),
                  )}
                />
              ) : null}
              <div className="relative z-10 flex flex-col items-center text-center">
                <span
                  className={classes(
                    'relative flex h-8 w-8 items-center justify-center rounded-full border backdrop-blur',
                    tone.dot,
                    tone.glow,
                  )}
                  title={`${phase.label}: ${phase.metaLabel}`}
                >
                  <IconForPhase phase={phase} />
                </span>
                <span className={classes('mt-2 max-w-full truncate text-[11px] font-semibold', tone.label)}>
                  {phase.label}
                </span>
                <span className={classes('mt-0.5 max-w-full truncate text-[10px] font-medium', tone.meta)}>
                  {phase.metaLabel}
                </span>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function CompactRail({ phases, className }: { phases: MissionProgressPhase[]; className?: string }) {
  return (
    <div className={classes('flex min-w-0 items-center gap-1.5', className)} aria-label="Mission progress">
      {phases.map((phase, index) => {
        const tone = toneClasses[phase.tone];
        const next = phases[index + 1];

        return (
          <span key={phase.id} className="flex min-w-0 flex-1 items-center gap-1">
            <span
              className={classes(
                'flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border',
                tone.dot,
              )}
              title={`${phase.label}: ${phase.metaLabel}`}
            >
              <IconForPhase phase={phase} />
            </span>
            <span className={classes('hidden min-w-0 truncate text-[9px] font-semibold sm:inline', tone.label)}>
              {phase.compactLabel}
            </span>
            {next ? (
              <span className={classes('h-px min-w-2 flex-1 rounded-full', connectorTone(phase, next))} />
            ) : null}
          </span>
        );
      })}
    </div>
  );
}

export function MissionProgressRail(props: MissionProgressRailProps) {
  const variant = props.variant || 'full';
  const phases = resolvePhases(props);

  if (variant === 'compact') {
    return <CompactRail phases={phases} className={props.className} />;
  }

  return <FullRail phases={phases} className={props.className} />;
}
