import ArrowRight from 'lucide-react/dist/esm/icons/arrow-right.js';
import CheckCircle2 from 'lucide-react/dist/esm/icons/check-circle-2.js';
import Circle from 'lucide-react/dist/esm/icons/circle.js';
import CircleDot from 'lucide-react/dist/esm/icons/circle-dot.js';
import Compass from 'lucide-react/dist/esm/icons/compass.js';
import type { GuidedStartActionKind, GuidedStartState, GuidedStartStep } from './guidedStart';

interface GuidedStartPanelProps {
  /** 'checklist' renders the five rows; 'operating' renders the closing line. */
  variant: 'checklist' | 'operating';
  state: GuidedStartState;
  onAction: (kind: GuidedStartActionKind) => void;
  onDismiss: () => void;
}

/**
 * The guided-start card on the workspace home surface.
 *
 * Deliberately quiet. It is a checklist, not a celebration: no confetti, no
 * completion meter, no bar filling up. Rows carry three things -- where the
 * workspace actually stands, what the step is, and (on the step you are on) the
 * one control that advances it.
 *
 * Every row is a button, including the ones ahead of you. An operator who wants
 * to look at Reviews before their first run is not doing it wrong, and a
 * checklist that disables navigation is a wizard tunnel with better manners.
 *
 * All state arrives derived; this component never decides what is done.
 */
export function GuidedStartPanel({ variant, state, onAction, onDismiss }: GuidedStartPanelProps) {
  if (variant === 'operating') {
    return (
      <section
        aria-label="Guided start complete"
        className="rounded-2xl border border-navy-800/80 bg-navy-900/48 px-4 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]"
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <CheckCircle2 className="h-4 w-4 flex-shrink-0 text-emerald-400/80" />
            <p className="truncate text-[13px] font-semibold text-white">You’re operating.</p>
            <span className="hidden truncate text-[12px] text-slate-500 sm:inline">
              First mission delivered — the checklist is done.
            </span>
          </div>
          <button
            type="button"
            onClick={onDismiss}
            className="flex-shrink-0 rounded-lg border border-navy-700/60 bg-navy-950/34 px-2.5 py-1 text-[11px] font-semibold text-slate-400 transition-colors hover:border-navy-600 hover:text-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
          >
            Dismiss
          </button>
        </div>
      </section>
    );
  }

  return (
    <section
      aria-label="Guided start"
      className="rounded-2xl border border-navy-800/80 bg-navy-900/48 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg border border-violet-400/22 bg-violet-500/10 text-violet-200">
            <Compass className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-violet-300/80">
              Guided start
            </p>
            <h2 className="mt-1 text-[15px] font-semibold tracking-[-0.01em] text-white">
              Your first delivered mission, in five steps
            </h2>
          </div>
        </div>
        <div className="flex flex-shrink-0 items-center gap-2">
          <span className="hidden rounded-full border border-navy-700 bg-navy-950/55 px-2.5 py-1 text-[11px] font-medium text-slate-400 sm:inline-flex">
            {state.doneCount} of {state.steps.length} done
          </span>
          <button
            type="button"
            onClick={onDismiss}
            className="rounded-lg border border-navy-700/60 bg-navy-950/34 px-2.5 py-1 text-[11px] font-semibold text-slate-400 transition-colors hover:border-navy-600 hover:text-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
          >
            Dismiss
          </button>
        </div>
      </div>

      <ol className="mt-3 space-y-1.5">
        {state.steps.map((step) => (
          <li key={step.id}>
            <GuidedStartRow step={step} onAction={onAction} />
          </li>
        ))}
      </ol>
    </section>
  );
}

function GuidedStartRow({
  step,
  onAction,
}: {
  step: GuidedStartStep;
  onAction: (kind: GuidedStartActionKind) => void;
}) {
  const isCurrent = step.state === 'current';
  const isDone = step.state === 'done';

  // The current step carries the mission-collection violet; done steps go quiet
  // rather than loud, so the eye lands on the one thing left to do.
  const rowClass = isCurrent
    ? 'border-violet-400/38 bg-violet-500/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] hover:bg-violet-500/14'
    : isDone
      ? 'border-navy-800/70 bg-navy-950/30 hover:border-navy-700 hover:bg-navy-900/45'
      : 'border-navy-800/55 bg-navy-950/20 hover:border-navy-700 hover:bg-navy-900/45';

  return (
    <button
      type="button"
      onClick={() => onAction(step.action.kind)}
      aria-current={isCurrent ? 'step' : undefined}
      aria-label={`${step.name} — ${isDone ? 'done' : isCurrent ? 'current step' : 'not started'}`}
      className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 ${rowClass}`}
    >
      <span className="flex-shrink-0">
        {isDone ? (
          <CheckCircle2 className="h-4 w-4 text-emerald-400/80" />
        ) : isCurrent ? (
          <CircleDot className="h-4 w-4 text-violet-300" />
        ) : (
          <Circle className="h-4 w-4 text-slate-600" />
        )}
      </span>

      <span className="min-w-0 flex-1">
        <span className={`block truncate text-[13px] font-semibold ${isDone ? 'text-slate-300' : 'text-white'}`}>
          {step.name}
        </span>
        {/* A blocked mission says why, verbatim, instead of a generic "not ready". */}
        <span
          className={`mt-0.5 block truncate text-[11px] ${
            step.blockerSummary ? 'text-amber-200/75' : 'text-slate-500'
          }`}
        >
          {step.blockerSummary || step.description}
        </span>
      </span>

      {/* Unreadable connection state reads as unknown, never as "not connected". */}
      {step.statusUnknown ? (
        <span className="hidden flex-shrink-0 rounded-full border border-navy-700 bg-navy-950/55 px-2 py-0.5 text-[10px] font-medium text-slate-400 sm:inline-flex">
          Status unavailable
        </span>
      ) : null}

      {step.state === 'current' ? (
        <span className="inline-flex flex-shrink-0 items-center gap-1 rounded-full border border-violet-400/35 bg-violet-500/16 px-2.5 py-1 text-[11px] font-semibold text-violet-100">
          <span className="hidden sm:inline">{step.action.label}</span>
          <ArrowRight className="h-3 w-3" />
        </span>
      ) : null}
    </button>
  );
}
