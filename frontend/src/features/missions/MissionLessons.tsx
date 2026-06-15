import BrainCircuit from 'lucide-react/dist/esm/icons/brain-circuit.js';
import CheckCircle2 from 'lucide-react/dist/esm/icons/check-circle-2.js';
import Clock3 from 'lucide-react/dist/esm/icons/clock-3.js';
import Lightbulb from 'lucide-react/dist/esm/icons/lightbulb.js';
import type { MissionLessonStatus, MissionLessonView, MissionWorkspaceView } from './types';

interface MissionLessonsProps {
  mission: MissionWorkspaceView;
  savedLessonIds?: ReadonlySet<string>;
  onLessonAction?: (lesson: MissionLessonView) => void;
}

const lessonToneClasses: Record<MissionLessonStatus, string> = {
  saved: 'border-green-400/25 bg-green-400/10 text-green-100',
  proposed: 'border-violet-400/25 bg-violet-400/10 text-violet-100',
  waiting: 'border-slate-500/20 bg-slate-500/10 text-slate-200',
};

const lessonCopy: Record<MissionLessonStatus, string> = {
  saved: 'Saved',
  proposed: 'Proposed',
  waiting: 'Watching',
};

function LessonIcon({ status }: { status: MissionLessonStatus }) {
  if (status === 'saved') return <CheckCircle2 className="h-4 w-4 text-green-300" />;
  if (status === 'proposed') return <Lightbulb className="h-4 w-4 text-violet-300" />;
  return <Clock3 className="h-4 w-4 text-slate-500" />;
}

export function MissionLessons({ mission, savedLessonIds, onLessonAction }: MissionLessonsProps) {
  return (
    <section className="space-y-4">
      <div className="rounded-xl border border-navy-700/70 bg-navy-950/45 p-4">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl border border-cyan-300/25 bg-cyan-300/10 text-cyan-100">
            <BrainCircuit className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-cyan-300/80">
              Learning loop
            </p>
            <h3 className="mt-1 text-base font-semibold leading-snug text-white">{mission.title}</h3>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              Violema turns repeated edits, approvals, failures, and cost patterns into reusable mission memory.
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        {mission.lessons.map((lesson) => {
          const actionSaved = Boolean(savedLessonIds?.has(lesson.id));
          const status = actionSaved ? 'saved' : lesson.status;

          return (
            <article
              key={lesson.id}
              className={`rounded-lg border p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.025)] ${lessonToneClasses[status]}`}
            >
              <div className="flex items-start gap-3">
                <span className="mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg border border-current/20 bg-black/10">
                  <LessonIcon status={status} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-[13px] font-semibold text-white" title={lesson.title}>
                        {lesson.title}
                      </p>
                      <p className="mt-1 truncate text-[10px] text-slate-500" title={lesson.sourceLabel}>
                        {lesson.sourceLabel}
                      </p>
                    </div>
                    <span className="flex-shrink-0 rounded-full border border-current/20 bg-black/10 px-2 py-0.5 text-[10px] font-medium">
                      {lessonCopy[status]}
                    </span>
                  </div>
                  <p className="mt-2 text-[11px] leading-5 text-slate-500">{lesson.detail}</p>
                  {lesson.actionLabel ? (
                    <button
                      type="button"
                      onClick={() => onLessonAction?.(lesson)}
                      disabled={!onLessonAction}
                      title={actionSaved ? 'Saved to this mission learning loop.' : undefined}
                      className={`mt-3 rounded-lg border px-2.5 py-1.5 text-[10px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 ${
                        actionSaved
                          ? 'border-green-300/25 bg-green-300/12 text-green-100 hover:border-green-300/40 hover:bg-green-300/16'
                          : onLessonAction
                            ? 'border-current/20 bg-black/10 hover:bg-white/5'
                            : 'cursor-not-allowed border-current/20 bg-black/10 opacity-70'
                      }`}
                    >
                      {actionSaved ? 'Saved' : lesson.actionLabel}
                    </button>
                  ) : null}
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
