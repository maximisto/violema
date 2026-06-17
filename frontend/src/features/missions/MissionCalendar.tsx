import ArrowRight from 'lucide-react/dist/esm/icons/arrow-right.js';
import CalendarDays from 'lucide-react/dist/esm/icons/calendar-days.js';
import CheckCircle2 from 'lucide-react/dist/esm/icons/check-circle-2.js';
import Clock3 from 'lucide-react/dist/esm/icons/clock-3.js';
import Pause from 'lucide-react/dist/esm/icons/pause.js';
import Play from 'lucide-react/dist/esm/icons/play.js';
import Sparkles from 'lucide-react/dist/esm/icons/sparkles.js';
import Zap from 'lucide-react/dist/esm/icons/zap.js';
import BrandIcon from '../../components/BrandIcon';
import { buildFounderOpsCalendar, type FounderCalendarAgendaItem, type FounderCalendarApp, type FounderCalendarDay, type FounderCalendarStatus, type FounderCalendarTone } from './missionCalendarSchedule';
import type { MissionWorkspaceView } from './types';
import { MissionProgressRail } from './MissionProgressRail';

interface MissionCalendarProps {
  mission: MissionWorkspaceView;
  onRunNow: () => void;
  onPauseToggle: () => void;
  disabled?: boolean;
  selectedAgendaId?: string;
  onSelectAgenda?: (item: FounderCalendarAgendaItem) => void;
}

const toneClasses: Record<FounderCalendarTone, {
  card: string;
  chip: string;
  dot: string;
  glow: string;
  text: string;
}> = {
  strategy: {
    card: 'border-violet-300/24 bg-violet-400/[0.075]',
    chip: 'border-violet-300/24 bg-violet-300/10 text-violet-100',
    dot: 'bg-violet-300',
    glow: 'from-violet-400/18',
    text: 'text-violet-100',
  },
  research: {
    card: 'border-cyan-300/22 bg-cyan-300/[0.07]',
    chip: 'border-cyan-300/22 bg-cyan-300/10 text-cyan-100',
    dot: 'bg-cyan-300',
    glow: 'from-cyan-300/18',
    text: 'text-cyan-100',
  },
  revenue: {
    card: 'border-emerald-300/24 bg-emerald-300/[0.075]',
    chip: 'border-emerald-300/24 bg-emerald-300/10 text-emerald-100',
    dot: 'bg-emerald-300',
    glow: 'from-emerald-300/18',
    text: 'text-emerald-100',
  },
  product: {
    card: 'border-sky-300/24 bg-sky-300/[0.075]',
    chip: 'border-sky-300/24 bg-sky-300/10 text-sky-100',
    dot: 'bg-sky-300',
    glow: 'from-sky-300/18',
    text: 'text-sky-100',
  },
  delivery: {
    card: 'border-blue-300/24 bg-blue-300/[0.075]',
    chip: 'border-blue-300/24 bg-blue-300/10 text-blue-100',
    dot: 'bg-blue-300',
    glow: 'from-blue-300/18',
    text: 'text-blue-100',
  },
  approval: {
    card: 'border-amber-300/24 bg-amber-300/[0.075]',
    chip: 'border-amber-300/24 bg-amber-300/10 text-amber-100',
    dot: 'bg-amber-300',
    glow: 'from-amber-300/18',
    text: 'text-amber-100',
  },
  people: {
    card: 'border-rose-300/24 bg-rose-300/[0.075]',
    chip: 'border-rose-300/24 bg-rose-300/10 text-rose-100',
    dot: 'bg-rose-300',
    glow: 'from-rose-300/18',
    text: 'text-rose-100',
  },
};

const statusCopy: Record<FounderCalendarStatus, string> = {
  live: 'Live',
  queued: 'Queued',
  review: 'Review',
  scheduled: 'Scheduled',
  done: 'Done',
  paused: 'Paused',
};

const statusClasses: Record<FounderCalendarStatus, string> = {
  live: 'border-green-300/30 bg-green-300/12 text-green-100',
  queued: 'border-cyan-300/24 bg-cyan-300/10 text-cyan-100',
  review: 'border-amber-300/30 bg-amber-300/12 text-amber-100',
  scheduled: 'border-violet-300/24 bg-violet-300/10 text-violet-100',
  done: 'border-slate-400/20 bg-slate-400/8 text-slate-300',
  paused: 'border-slate-400/20 bg-slate-400/8 text-slate-400',
};

function AppChip({ app, compact = false }: { app: FounderCalendarApp; compact?: boolean }) {
  return (
    <span
      className={`inline-flex min-w-0 items-center gap-1.5 rounded-full border ${toneClasses[app.tone].chip} ${
        compact ? 'px-1.5 py-1' : 'px-2 py-1'
      }`}
      title={app.label}
    >
      <span className="flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full bg-white/10 text-current">
        <BrandIcon name={app.label} className="h-2.5 w-2.5" />
      </span>
      <span className="truncate text-[9px] font-semibold">{app.logoLabel}</span>
    </span>
  );
}

function AgentStack({ agents }: { agents: FounderCalendarAgendaItem['agents'] }) {
  return (
    <div className="flex -space-x-1.5">
      {agents.slice(0, 4).map((agent) => (
        <span
          key={agent.id}
          title={agent.label}
          className={`flex h-6 w-6 items-center justify-center rounded-full border border-navy-950 text-[8px] font-black ${toneClasses[agent.tone].chip}`}
        >
          {agent.avatarLabel}
        </span>
      ))}
    </div>
  );
}

function DayCell({ day }: { day: FounderCalendarDay }) {
  return (
    <div
      className={`min-w-0 rounded-xl border px-1.5 py-2 text-center ${
        day.isToday
          ? 'border-violet-300/38 bg-violet-300/12 shadow-[0_0_24px_rgba(124,92,255,0.12)]'
          : 'border-navy-700/70 bg-navy-950/44'
      }`}
    >
      <p className="truncate text-[9px] font-semibold uppercase tracking-[0.12em] text-slate-500">{day.weekdayLabel}</p>
      <p className={`mt-1 text-sm font-black ${day.isToday ? 'text-white' : 'text-slate-300'}`}>{day.dateLabel}</p>
      <div className="mt-1.5 flex h-2 items-center justify-center gap-0.5">
        {day.tones.length > 0 ? (
          day.tones.slice(0, 4).map((tone) => (
            <span key={tone} className={`h-1.5 w-1.5 rounded-full ${toneClasses[tone].dot}`} />
          ))
        ) : (
          <span className="h-1 w-4 rounded-full bg-slate-700/70" />
        )}
      </div>
      <p className="mt-1 truncate text-[9px] text-slate-600">{day.loadLabel}</p>
    </div>
  );
}

function AgendaCard({
  item,
  disabled,
  progressSteps,
  selected,
  onSelect,
}: {
  item: FounderCalendarAgendaItem;
  disabled: boolean;
  progressSteps?: MissionWorkspaceView['steps'];
  selected?: boolean;
  onSelect?: (item: FounderCalendarAgendaItem) => void;
}) {
  const tone = toneClasses[item.tone];

  return (
    <article
      role="button"
      tabIndex={0}
      onClick={onSelect ? () => onSelect(item) : undefined}
      onKeyDown={(event) => {
        if (!onSelect) return;
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onSelect(item);
        }
      }}
      aria-pressed={selected}
      className={`relative overflow-hidden rounded-xl border p-3 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 ${
        selected
          ? 'border-violet-200/48 bg-violet-300/12 shadow-[0_0_30px_rgba(124,92,255,0.16)]'
          : tone.card
      } ${onSelect ? 'cursor-pointer hover:border-violet-200/38 hover:bg-white/[0.055]' : ''}`}
    >
      <div className={`pointer-events-none absolute inset-y-0 left-0 w-20 bg-gradient-to-r ${tone.glow} to-transparent`} />
      <div className="relative flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[9px] font-bold ${statusClasses[item.status]}`}>
              {item.status === 'live' ? <Zap className="h-2.5 w-2.5" /> : null}
              {item.status === 'done' ? <CheckCircle2 className="h-2.5 w-2.5" /> : null}
              {statusCopy[item.status]}
            </span>
            <span className="inline-flex items-center gap-1 text-[10px] font-medium text-slate-500">
              <Clock3 className="h-3 w-3" />
              {item.timeLabel}
            </span>
          </div>
          <h4 className="mt-2 text-[13px] font-semibold leading-snug text-white">{item.title}</h4>
          <p className="mt-1 line-clamp-2 text-[11px] leading-5 text-slate-400">{item.detail}</p>
          {progressSteps?.length ? (
            <MissionProgressRail steps={progressSteps} variant="compact" className="mt-3" />
          ) : null}
        </div>
        <AgentStack agents={item.agents} />
      </div>

      <div className="relative mt-3 flex flex-wrap gap-1.5">
        {item.apps.slice(0, 4).map((app) => (
          <AppChip key={`${item.id}_${app.id}`} app={app} compact />
        ))}
      </div>

      <div className="relative mt-3 flex items-center justify-between gap-2 border-t border-white/8 pt-2">
        <div className="min-w-0">
          <p className={`truncate text-[10px] font-semibold ${tone.text}`}>{item.recurrenceLabel}</p>
          <p className="truncate text-[9px] text-slate-600">{item.durationLabel} · {item.creditLabel}</p>
        </div>
        <button
          type="button"
          disabled={disabled}
          onClick={(event) => {
            event.stopPropagation();
            onSelect?.(item);
          }}
          className="inline-flex h-8 flex-shrink-0 items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.045] px-2.5 text-[10px] font-semibold text-slate-200 transition-colors hover:bg-white/[0.075] hover:text-white disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400"
        >
          {item.actionLabel}
          <ArrowRight className="h-3 w-3" />
        </button>
      </div>
    </article>
  );
}

function StackStrip({ apps }: { apps: FounderCalendarApp[] }) {
  return (
    <div className="rounded-xl border border-navy-700/70 bg-navy-950/46 p-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">Connected stack</p>
        <span className="text-[10px] text-slate-600">{apps.length} apps</span>
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {apps.map((app) => (
          <AppChip key={app.id} app={app} />
        ))}
      </div>
    </div>
  );
}

export function MissionCalendar({
  mission,
  onRunNow,
  onPauseToggle,
  disabled = false,
  selectedAgendaId,
  onSelectAgenda,
}: MissionCalendarProps) {
  const pauseLabel = mission.status === 'paused' ? 'Resume' : 'Pause';
  const PauseIcon = mission.status === 'paused' ? Play : Pause;
  const calendar = buildFounderOpsCalendar(mission);
  const primaryItem = calendar.agenda[0];

  return (
    <section className="space-y-4">
      <div className="relative overflow-hidden rounded-2xl border border-violet-300/18 bg-[radial-gradient(circle_at_18%_0%,rgba(167,139,250,0.22),transparent_34%),radial-gradient(circle_at_92%_20%,rgba(34,211,238,0.14),transparent_32%),linear-gradient(135deg,rgba(15,23,42,0.72),rgba(2,6,23,0.92))] p-4">
        <div className="pointer-events-none absolute inset-x-5 top-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent" />
        <div className="relative flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.045] px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-violet-100">
              <CalendarDays className="h-3 w-3" />
              Founder ops
            </p>
            <h3 className="mt-3 text-base font-semibold leading-snug text-white">{mission.title}</h3>
            <p className="mt-1 line-clamp-2 text-[12px] leading-5 text-slate-400">{mission.description}</p>
          </div>
          <span className={`flex flex-shrink-0 items-center gap-1 rounded-full border px-2 py-1 text-[10px] font-bold ${statusClasses[primaryItem.status]}`}>
            <Sparkles className="h-3 w-3" />
            {statusCopy[primaryItem.status]}
          </span>
        </div>

        {mission.steps.length > 0 ? (
          <MissionProgressRail mission={mission} variant="compact" className="relative mt-4 rounded-xl border border-white/8 bg-white/[0.035] px-2.5 py-2" />
        ) : null}

        <div className="relative mt-4 grid grid-cols-2 gap-2">
          <div className="rounded-xl border border-white/8 bg-white/[0.035] p-2.5">
            <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-slate-500">Cadence</p>
            <p className="mt-1 truncate text-[12px] font-semibold text-slate-100">{mission.scheduleLabel}</p>
          </div>
          <div className="rounded-xl border border-white/8 bg-white/[0.035] p-2.5">
            <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-slate-500">Next run</p>
            <p className="mt-1 truncate text-[12px] font-semibold text-slate-100">{mission.nextRunLabel}</p>
          </div>
        </div>

        <div className="relative mt-3 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={onRunNow}
            disabled={disabled}
            title={disabled ? 'Available for live automations when no action is already running.' : 'Trigger this live automation once now.'}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-violet-300/26 bg-violet-300/12 px-3 py-2 text-[11px] font-semibold text-violet-100 transition-colors hover:bg-violet-300/18 disabled:cursor-not-allowed disabled:border-navy-700/70 disabled:bg-navy-950/40 disabled:text-slate-600 disabled:opacity-70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400"
          >
            <Play className="h-3.5 w-3.5" />
            Run
          </button>
          <button
            type="button"
            onClick={onPauseToggle}
            disabled={disabled}
            title={disabled ? 'Available for live automations when no action is already running.' : `${pauseLabel} this automation cadence.`}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-cyan-300/22 bg-cyan-300/10 px-3 py-2 text-[11px] font-semibold text-cyan-100 transition-colors hover:bg-cyan-300/16 disabled:cursor-not-allowed disabled:border-navy-700/70 disabled:bg-navy-950/40 disabled:text-slate-600 disabled:opacity-70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
          >
            <PauseIcon className="h-3.5 w-3.5" />
            {pauseLabel}
          </button>
        </div>
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between gap-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">This week</p>
          <span className="text-[10px] text-slate-600">credits · reviews · delivery</span>
        </div>
        <div className="grid gap-1.5" style={{ gridTemplateColumns: 'repeat(7, minmax(0, 1fr))' }}>
          {calendar.weekDays.map((day) => (
            <DayCell key={day.id} day={day} />
          ))}
        </div>
      </div>

      <StackStrip apps={calendar.stack} />

      <div>
        <div className="mb-2 flex items-center justify-between gap-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">Scheduled missions</p>
          <span className="text-[10px] text-slate-600">{calendar.agenda.length} runs</span>
        </div>
        <div className="grid grid-cols-1 gap-2 xl:grid-cols-2">
          {calendar.agenda.map((item) => (
            <AgendaCard
              key={item.id}
              item={item}
              disabled={disabled}
              progressSteps={item.id === `${mission.id}_primary` ? mission.steps : undefined}
              selected={selectedAgendaId === item.id}
              onSelect={onSelectAgenda}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
