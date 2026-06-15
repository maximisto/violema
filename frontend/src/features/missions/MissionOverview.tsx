import type { MissionAgentView, MissionStatus, MissionWorkspaceView } from './types';
import { MissionControlDeck } from './MissionControlDeck';

interface MissionOverviewProps {
  mission: MissionWorkspaceView;
  focus?: 'mission' | 'agents';
}

const missionStatusTone: Record<MissionStatus, string> = {
  planned: 'border-slate-500/20 bg-slate-500/10 text-slate-300',
  running: 'border-cyan-400/30 bg-cyan-400/10 text-cyan-200',
  waiting_review: 'border-signal-400/30 bg-signal-400/10 text-signal-300',
  failed: 'border-red-400/30 bg-red-400/10 text-red-200',
  completed: 'border-green-400/30 bg-green-400/10 text-green-200',
  paused: 'border-amber-400/30 bg-amber-400/10 text-amber-200',
};

const stepDotTone: Record<MissionStatus, string> = {
  planned: 'bg-slate-600',
  running: 'bg-cyan-300 shadow-[0_0_0_4px_rgba(34,211,238,0.08)]',
  waiting_review: 'bg-signal-300 shadow-[0_0_0_4px_rgba(255,154,92,0.08)]',
  failed: 'bg-red-300 shadow-[0_0_0_4px_rgba(248,113,113,0.08)]',
  completed: 'bg-green-300 shadow-[0_0_0_4px_rgba(74,222,128,0.08)]',
  paused: 'bg-amber-300 shadow-[0_0_0_4px_rgba(251,191,36,0.08)]',
};

const agentStatusTone: Record<MissionAgentView['status'], string> = {
  done: 'border-green-400/25 bg-green-400/10 text-green-200',
  working: 'border-cyan-400/30 bg-cyan-400/10 text-cyan-200',
  queued: 'border-violet-400/20 bg-violet-400/10 text-violet-200',
  waiting: 'border-slate-500/20 bg-slate-500/10 text-slate-300',
  review: 'border-signal-400/30 bg-signal-400/10 text-signal-300',
  ready: 'border-cyan-400/20 bg-cyan-400/10 text-cyan-200',
};

function statusCopy(status: MissionStatus) {
  if (status === 'waiting_review') return 'Needs review';
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function agentStatusCopy(status: MissionAgentView['status']) {
  if (status === 'done') return 'Done';
  if (status === 'working') return 'Working';
  if (status === 'queued') return 'Queued';
  if (status === 'waiting') return 'Waiting';
  if (status === 'review') return 'Needs review';
  return 'Ready';
}

function InfoTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-lg border border-navy-700/70 bg-navy-950/50 p-3">
      <p className="text-[10px] font-medium text-slate-500">{label}</p>
      <p className="mt-1 truncate text-[12px] font-semibold leading-snug text-slate-100" title={value}>
        {value}
      </p>
    </div>
  );
}

export function MissionOverview({ mission, focus = 'mission' }: MissionOverviewProps) {
  const infoTiles = [
    { label: 'Next run', value: mission.nextRunLabel },
    { label: 'Delivery', value: mission.deliveryLabel },
    { label: 'Last run', value: mission.lastRunLabel },
  ];
  const showMissionDetails = focus !== 'agents';

  return (
    <div className="space-y-5">
      {showMissionDetails ? (
        <>
          <section className="border-b border-navy-800/80 pb-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[10px] font-medium text-violet-300/80">Mission summary</p>
                <h3 className="mt-1 text-base font-semibold leading-snug text-white">{mission.title}</h3>
              </div>
              <span className={`flex-shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-medium ${missionStatusTone[mission.status]}`}>
                {mission.statusLabel}
              </span>
            </div>
            <p className="mt-2 text-sm leading-6 text-slate-400">{mission.description}</p>
            <p className="mt-2 text-[11px] leading-5 text-slate-500">Schedule: {mission.scheduleLabel}</p>
            <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3 lg:grid-cols-1 2xl:grid-cols-3">
              {infoTiles.map((tile) => (
                <InfoTile key={tile.label} label={tile.label} value={tile.value} />
              ))}
            </div>
            <div className="mt-3">
              <MissionControlDeck items={mission.controlPrimitives} />
            </div>
            <div className="mt-3 rounded-lg border border-violet-400/20 bg-violet-400/10 p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[10px] font-medium text-violet-200/80">Living artifact</p>
                  <p className="mt-1 truncate text-[13px] font-semibold text-white" title={mission.artifact.title}>
                    {mission.artifact.title}
                  </p>
                  <p className="mt-1 line-clamp-2 text-[11px] leading-5 text-slate-500">
                    {mission.artifact.summary}
                  </p>
                </div>
                <span className="flex-shrink-0 rounded-full border border-violet-300/25 bg-violet-300/10 px-2 py-0.5 text-[10px] font-medium text-violet-100">
                  {mission.artifact.statusLabel}
                </span>
              </div>
            </div>
          </section>

          <section>
            <div className="mb-2 flex items-center justify-between gap-3">
              <h4 className="text-[12px] font-semibold text-slate-100">Mission plan</h4>
              <span className="text-[11px] text-slate-600">{mission.steps.length} steps</span>
            </div>

            {mission.steps.length > 0 ? (
              <div className="space-y-2">
                {mission.steps.map((step, index) => (
                  <article
                    key={step.id}
                    className="rounded-lg border border-navy-700/70 bg-navy-950/40 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.025)]"
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md border border-navy-700/80 bg-navy-900/75 font-mono text-[11px] font-semibold text-slate-300">
                        {index + 1}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="truncate text-[13px] font-semibold leading-snug text-white" title={step.title}>
                              {step.title}
                            </p>
                            <p className="mt-1 line-clamp-2 text-[11px] leading-5 text-slate-500">{step.objective}</p>
                          </div>
                          <span className={`mt-1 h-2 w-2 flex-shrink-0 rounded-full ${stepDotTone[step.status]}`} />
                        </div>
                        <div className="mt-2 flex flex-wrap items-center gap-1.5">
                          <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${missionStatusTone[step.status]}`}>
                            {statusCopy(step.status)}
                          </span>
                          <span className="rounded-full border border-navy-700/80 bg-navy-900/60 px-2 py-0.5 text-[10px] font-medium text-slate-400">
                            {step.agentLabel}
                          </span>
                          {step.toolLabel ? (
                            <span className="rounded-full border border-cyan-500/20 bg-cyan-500/10 px-2 py-0.5 text-[10px] font-medium text-cyan-200/90">
                              {step.toolLabel}
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-navy-700/80 bg-navy-950/40 p-4 text-sm leading-6 text-slate-500">
                No mission steps yet. The plan will appear after this mission is authored or run.
              </div>
            )}
          </section>
        </>
      ) : (
        <section className="border-b border-navy-800/80 pb-4">
          <p className="text-[10px] font-medium text-violet-300/80">Agent floor</p>
          <h3 className="mt-1 text-base font-semibold leading-snug text-white">{mission.title}</h3>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            Agents, tools, and live status for the selected mission.
          </p>
        </section>
      )}

      <section>
        <div className="mb-2 flex items-center justify-between gap-3">
          <h4 className="text-[12px] font-semibold text-slate-100">Agent floor</h4>
          <span className="text-[11px] text-slate-600">{mission.agents.length} agents</span>
        </div>

        {mission.agents.length > 0 ? (
          <div className="grid grid-cols-1 gap-2">
            {mission.agents.map((agent) => {
              const isActive = agent.id === mission.activeAgentId || agent.status === 'working';
              return (
                <article
                  key={agent.id}
                  className={`rounded-lg border p-3 transition-colors ${
                    isActive
                      ? 'border-cyan-400/30 bg-cyan-400/10 shadow-[0_12px_30px_rgba(6,182,212,0.08),inset_0_1px_0_rgba(255,255,255,0.04)]'
                      : 'border-navy-700/70 bg-navy-950/40 shadow-[inset_0_1px_0_rgba(255,255,255,0.025)]'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg border font-mono text-[12px] font-semibold ${
                        isActive
                          ? 'border-cyan-300/30 bg-cyan-300/10 text-cyan-100'
                          : 'border-violet-400/20 bg-violet-400/10 text-violet-200'
                      }`}
                    >
                      {agent.avatarLabel}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-[13px] font-semibold leading-snug text-white" title={agent.label}>
                            {agent.label}
                          </p>
                          <p className="mt-1 line-clamp-2 text-[11px] leading-5 text-slate-500">{agent.detail}</p>
                        </div>
                        <span className={`flex-shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-medium ${agentStatusTone[agent.status]}`}>
                          {agentStatusCopy(agent.status)}
                        </span>
                      </div>
                      {(agent.sourceLabel || agent.creditsLabel) ? (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {agent.sourceLabel ? (
                            <span className="rounded-full border border-navy-700/80 bg-navy-900/60 px-2 py-0.5 text-[10px] font-medium text-slate-400">
                              {agent.sourceLabel}
                            </span>
                          ) : null}
                          {agent.creditsLabel ? (
                            <span className="rounded-full border border-violet-400/20 bg-violet-400/10 px-2 py-0.5 text-[10px] font-medium text-violet-200">
                              {agent.creditsLabel}
                            </span>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-navy-700/80 bg-navy-950/40 p-4 text-sm leading-6 text-slate-500">
            No agents assigned yet. Agent staffing will appear when the mission plan is prepared.
          </div>
        )}
      </section>
    </div>
  );
}
