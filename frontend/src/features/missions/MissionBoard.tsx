import type {
  MissionEvidenceItem,
  MissionStatus,
  MissionStepView,
  MissionWorkspaceView,
} from './types';
import { MissionProgressRail } from './MissionProgressRail';

interface MissionBoardProps {
  mission: MissionWorkspaceView;
  selectedStepId?: string;
  selectedEvidenceId?: string;
  onSelectStep?: (step: MissionStepView) => void;
  onSelectEvidence?: (item: MissionEvidenceItem) => void;
}

type StepLane = {
  id: string;
  label: string;
  statuses: MissionStatus[];
  emptyLabel: string;
  tone: string;
};

const STEP_LANES: StepLane[] = [
  {
    id: 'planned',
    label: 'Planned',
    statuses: ['planned'],
    emptyLabel: 'Nothing queued.',
    tone: 'border-slate-500/20 bg-slate-500/10 text-slate-300',
  },
  {
    id: 'running',
    label: 'Running',
    statuses: ['running'],
    emptyLabel: 'No step is running.',
    tone: 'border-cyan-400/30 bg-cyan-400/10 text-cyan-200',
  },
  {
    id: 'review',
    label: 'Review',
    statuses: ['waiting_review'],
    emptyLabel: 'No review hold.',
    tone: 'border-signal-400/30 bg-signal-400/10 text-signal-300',
  },
  {
    id: 'needs-attention',
    label: 'Needs attention',
    statuses: ['failed', 'paused'],
    emptyLabel: 'No blocked steps.',
    tone: 'border-amber-400/30 bg-amber-400/10 text-amber-200',
  },
  {
    id: 'done',
    label: 'Done',
    statuses: ['completed'],
    emptyLabel: 'Nothing finished yet.',
    tone: 'border-green-400/30 bg-green-400/10 text-green-200',
  },
];

const STEP_STATUS_COPY: Record<MissionStatus, string> = {
  planned: 'Planned',
  running: 'Running',
  waiting_review: 'Review',
  failed: 'Failed',
  completed: 'Done',
  paused: 'Paused',
};

function StepCard({
  step,
  selected,
  onSelect,
}: {
  step: MissionStepView;
  selected?: boolean;
  onSelect?: (step: MissionStepView) => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect ? () => onSelect(step) : undefined}
      aria-pressed={selected}
      className={`w-full rounded-lg border p-2.5 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 ${
        selected
          ? 'border-violet-300/45 bg-violet-400/12 shadow-[0_0_26px_rgba(124,92,255,0.14)]'
          : 'border-navy-700/70 bg-navy-950/50 hover:border-violet-400/24 hover:bg-navy-900/62'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="min-w-0 flex-1 truncate text-[12px] font-semibold text-white" title={step.title}>
          {step.title}
        </p>
        <span className="flex-shrink-0 rounded-full border border-navy-700/70 bg-navy-900/70 px-1.5 py-0.5 text-[9px] font-medium text-slate-400">
          {STEP_STATUS_COPY[step.status]}
        </span>
      </div>
      <p className="mt-1 line-clamp-2 text-[10px] leading-4 text-slate-500">{step.objective}</p>
      <MissionProgressRail steps={[step]} variant="compact" className="mt-2" />
      <div className="mt-2 flex flex-wrap gap-1.5">
        <span className="rounded-full border border-violet-400/20 bg-violet-400/10 px-1.5 py-0.5 text-[9px] font-medium text-violet-200">
          {step.agentLabel}
        </span>
        {step.toolLabel ? (
          <span className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-1.5 py-0.5 text-[9px] font-medium text-cyan-200">
            {step.toolLabel}
          </span>
        ) : null}
      </div>
    </button>
  );
}

function EvidenceCard({
  item,
  selected,
  onSelect,
}: {
  item: MissionEvidenceItem;
  selected?: boolean;
  onSelect?: (item: MissionEvidenceItem) => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect ? () => onSelect(item) : undefined}
      aria-pressed={selected}
      className={`w-full rounded-lg border p-2.5 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 ${
        selected
          ? 'border-cyan-200/45 bg-cyan-300/14 shadow-[0_0_24px_rgba(34,211,238,0.12)]'
          : 'border-cyan-400/20 bg-cyan-400/10 hover:border-cyan-300/35 hover:bg-cyan-400/14'
      }`}
    >
      <p className="truncate text-[12px] font-semibold text-white" title={item.label}>
        {item.label}
      </p>
      <p className="mt-1 truncate text-[10px] text-cyan-200/80" title={item.source}>
        {item.source}
      </p>
      <p className="mt-1 line-clamp-2 text-[10px] leading-4 text-slate-500">{item.detail}</p>
    </button>
  );
}

export function MissionBoard({
  mission,
  selectedStepId,
  selectedEvidenceId,
  onSelectStep,
  onSelectEvidence,
}: MissionBoardProps) {
  const followUpEvidence = mission.evidence.slice(0, 2);

  return (
    <section className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-medium text-violet-300/80">Mission board</p>
          <h3 className="mt-1 text-base font-semibold leading-snug text-white">{mission.title}</h3>
        </div>
        <span className="flex-shrink-0 rounded-full border border-navy-700/70 bg-navy-950/60 px-2 py-1 text-[10px] font-medium text-slate-400">
          {mission.steps.length} steps
        </span>
      </div>

      {mission.steps.length > 0 ? (
        <MissionProgressRail mission={mission} variant="compact" className="rounded-lg border border-navy-800/80 bg-navy-950/35 px-2.5 py-2" />
      ) : null}

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 2xl:grid-cols-3">
        {STEP_LANES.map((lane) => {
          const laneSteps = mission.steps.filter((step) => lane.statuses.includes(step.status));

          return (
            <div key={lane.id} className="min-w-0 rounded-lg border border-navy-700/70 bg-navy-950/40 p-2.5">
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${lane.tone}`}>
                  {lane.label}
                </span>
                <span className="text-[10px] text-slate-600">{laneSteps.length}</span>
              </div>
              {laneSteps.length > 0 ? (
                <div className="space-y-2">
                  {laneSteps.map((step) => (
                    <StepCard
                      key={step.id}
                      step={step}
                      selected={selectedStepId === step.id}
                      onSelect={onSelectStep}
                    />
                  ))}
                </div>
              ) : (
                <p className="rounded-lg border border-dashed border-navy-700/70 bg-navy-950/40 px-2.5 py-2 text-[10px] leading-4 text-slate-500">
                  {lane.emptyLabel}
                </p>
              )}
            </div>
          );
        })}

        <div className="min-w-0 rounded-lg border border-navy-700/70 bg-navy-950/40 p-2.5">
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="rounded-full border border-violet-400/20 bg-violet-400/10 px-2 py-0.5 text-[10px] font-medium text-violet-200">
              Follow-up
            </span>
            <span className="text-[10px] text-slate-600">{followUpEvidence.length}</span>
          </div>
          {followUpEvidence.length > 0 ? (
            <div className="space-y-2">
              {followUpEvidence.map((item) => (
                <EvidenceCard
                  key={item.id}
                  item={item}
                  selected={selectedEvidenceId === item.id}
                  onSelect={onSelectEvidence}
                />
              ))}
            </div>
          ) : (
            <p className="rounded-lg border border-dashed border-navy-700/70 bg-navy-950/40 px-2.5 py-2 text-[10px] leading-4 text-slate-500">
              No evidence queued for follow-up.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
