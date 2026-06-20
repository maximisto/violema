import type { ReactNode } from 'react';
import type {
  MissionAgentView,
  MissionIntegrationView,
  MissionStepView,
  MissionWorkspaceView,
} from './types';
import BrandIcon from '../../components/BrandIcon';

interface MissionMapProps {
  mission: MissionWorkspaceView;
}

function normalizeKey(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '');
}

function integrationForStep(step: MissionStepView, integrations: MissionIntegrationView[]) {
  const haystack = normalizeKey(`${step.title} ${step.objective} ${step.kind} ${step.toolLabel || ''}`);
  return integrations.find((integration) => {
    const id = normalizeKey(integration.id);
    const label = normalizeKey(integration.label);
    return (id && haystack.includes(id)) || (label && haystack.includes(label));
  });
}

function agentForStep(step: MissionStepView, agents: MissionAgentView[]) {
  const agentLabel = normalizeKey(step.agentLabel);
  return agents.find((agent) => {
    const label = normalizeKey(agent.label);
    const role = normalizeKey(agent.role);
    return label === agentLabel || role === agentLabel || agentLabel.includes(role) || role.includes(agentLabel);
  });
}

function Pill({ children, iconName }: { children: ReactNode; iconName?: string }) {
  return (
    <span className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-navy-700/70 bg-navy-950/70 px-2 py-0.5 text-[10px] font-medium text-slate-400">
      {iconName ? <BrandIcon name={iconName} className="h-3 w-3 flex-shrink-0 text-slate-300" /> : null}
      {children}
    </span>
  );
}

function IntegrationCard({ integration }: { integration: MissionIntegrationView }) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-violet-400/18 bg-violet-400/[0.07] px-2.5 py-2">
      <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md border border-white/10 bg-white/[0.04] text-slate-100">
        <BrandIcon name={integration.label} className="h-3.5 w-3.5" />
      </span>
      <div className="min-w-0">
        <p className="truncate text-[12px] font-semibold text-white" title={integration.label}>
          {integration.label}
        </p>
        <p className="truncate text-[10px] text-slate-500" title={integration.category}>
          {integration.category}
        </p>
      </div>
    </div>
  );
}

function AgentCard({ agent }: { agent: MissionAgentView }) {
  return (
    <div className="rounded-lg border border-cyan-400/20 bg-cyan-400/10 p-2.5">
      <div className="flex items-center gap-2">
        <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md border border-cyan-300/30 bg-cyan-300/10 font-mono text-[10px] font-semibold text-cyan-100">
          {agent.avatarLabel}
        </span>
        <div className="min-w-0">
          <p className="truncate text-[12px] font-semibold text-white" title={agent.label}>
            {agent.label}
          </p>
          <p className="truncate text-[10px] text-slate-500" title={agent.role}>
            {agent.role}
          </p>
        </div>
      </div>
      <p className="mt-2 line-clamp-2 text-[10px] leading-4 text-slate-500">{agent.detail}</p>
    </div>
  );
}

function StepAnatomyRow({
  step,
  index,
  agent,
  integration,
}: {
  step: MissionStepView;
  index: number;
  agent?: MissionAgentView;
  integration?: MissionIntegrationView;
}) {
  return (
    <article className="rounded-lg border border-navy-700/70 bg-navy-950/50 p-3">
      <div className="flex items-start gap-3">
        <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md border border-navy-700/70 bg-navy-900/80 font-mono text-[11px] font-semibold text-slate-300">
          {index + 1}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-semibold text-white" title={step.title}>
            {step.title}
          </p>
          <p className="mt-1 line-clamp-2 text-[11px] leading-5 text-slate-500">{step.objective}</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <Pill iconName={integration?.label}>{integration ? integration.label : 'No integration'}</Pill>
            <Pill>{agent ? agent.label : step.agentLabel}</Pill>
            <Pill>{step.kind}</Pill>
          </div>
        </div>
      </div>
    </article>
  );
}

const topologyStatusClasses: Record<MissionStepView['status'], string> = {
  planned: 'border-slate-600/30 bg-slate-500/10 text-slate-300',
  running: 'border-cyan-300/45 bg-cyan-400/15 text-cyan-100 shadow-[0_0_24px_rgba(34,211,238,0.14)]',
  waiting_review: 'border-amber-300/45 bg-amber-400/15 text-amber-100',
  failed: 'border-red-300/45 bg-red-400/15 text-red-100',
  completed: 'border-green-300/40 bg-green-400/14 text-green-100',
  paused: 'border-slate-500/30 bg-slate-500/10 text-slate-300',
};

function TopologyNode({
  step,
  index,
  total,
  agent,
  integration,
}: {
  step: MissionStepView;
  index: number;
  total: number;
  agent?: MissionAgentView;
  integration?: MissionIntegrationView;
}) {
  return (
    <div className="relative min-w-[10rem] flex-1">
      {index < total - 1 ? (
        <span className="absolute left-[calc(50%+2.25rem)] top-7 hidden h-px w-[calc(100%-4.5rem)] bg-gradient-to-r from-violet-400/55 via-cyan-300/35 to-transparent sm:block" />
      ) : null}
      <article className={`relative z-10 rounded-xl border p-3 ${topologyStatusClasses[step.status]}`}>
        <div className="flex items-start justify-between gap-2">
          <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg border border-white/12 bg-navy-950/55 font-mono text-[11px] font-semibold">
            {index + 1}
          </span>
          <span className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[10px] font-medium">
            {step.status.replace('_', ' ')}
          </span>
        </div>
        <p className="mt-3 line-clamp-2 text-[12px] font-semibold text-white">{step.title}</p>
        <div className="mt-3 flex flex-wrap gap-1.5">
          <Pill>{agent ? agent.label : step.agentLabel}</Pill>
          <Pill iconName={integration?.label}>{integration ? integration.shortLabel : step.toolLabel || step.kind}</Pill>
        </div>
      </article>
    </div>
  );
}

function MissionTopology({ mission }: { mission: MissionWorkspaceView }) {
  if (mission.steps.length === 0) return null;

  return (
    <div className="rounded-lg border border-violet-400/18 bg-[radial-gradient(circle_at_top_left,rgba(139,92,246,0.16),transparent_38%),rgba(2,6,23,0.42)] p-3">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-violet-200/80">Live topology</p>
          <h4 className="mt-1 text-[13px] font-semibold text-white">Step → agent → tool → review → delivery</h4>
        </div>
        <span className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-2 py-0.5 text-[10px] font-semibold text-cyan-100">
          {mission.steps.length} nodes
        </span>
      </div>
      <div className="panel-scroll -mx-1 flex gap-3 overflow-x-auto px-1 pb-1">
        {mission.steps.map((step, index) => (
          <TopologyNode
            key={step.id}
            step={step}
            index={index}
            total={mission.steps.length}
            agent={agentForStep(step, mission.agents)}
            integration={integrationForStep(step, mission.integrations)}
          />
        ))}
      </div>
    </div>
  );
}

export function MissionMap({ mission }: MissionMapProps) {
  const firstEvidence = mission.evidence[0];

  return (
    <section className="space-y-4">
      <div>
        <p className="text-[10px] font-medium text-violet-300/80">Mission map</p>
        <h3 className="mt-1 text-base font-semibold leading-snug text-white">{mission.title}</h3>
      </div>

      <MissionTopology mission={mission} />

      <div>
        <div className="mb-2 flex items-center justify-between gap-3">
          <h4 className="text-[12px] font-semibold text-slate-100">Integrations</h4>
          <span className="text-[11px] text-slate-600">{mission.integrations.length} sources</span>
        </div>
        {mission.integrations.length > 0 ? (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-1 2xl:grid-cols-2">
            {mission.integrations.map((integration) => (
              <IntegrationCard key={integration.id} integration={integration} />
            ))}
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-navy-700/70 bg-navy-950/40 p-3 text-[11px] leading-5 text-slate-500">
            No integrations are configured for this mission yet.
          </div>
        )}
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between gap-3">
          <h4 className="text-[12px] font-semibold text-slate-100">Agent handoff path</h4>
          <span className="text-[11px] text-slate-600">{mission.agents.length} agents</span>
        </div>
        {mission.agents.length > 0 ? (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-1 2xl:grid-cols-2">
            {mission.agents.map((agent) => (
              <AgentCard key={agent.id} agent={agent} />
            ))}
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-navy-700/70 bg-navy-950/40 p-3 text-[11px] leading-5 text-slate-500">
            No agents are assigned yet. The map will fill in once the mission is staffed.
          </div>
        )}
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between gap-3">
          <h4 className="text-[12px] font-semibold text-slate-100">Workflow anatomy</h4>
          <span className="text-[11px] text-slate-600">{mission.steps.length} steps</span>
        </div>
        {mission.steps.length > 0 ? (
          <div className="space-y-2">
            {mission.steps.map((step, index) => (
              <StepAnatomyRow
                key={step.id}
                step={step}
                index={index}
                agent={agentForStep(step, mission.agents)}
                integration={integrationForStep(step, mission.integrations)}
              />
            ))}
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-navy-700/70 bg-navy-950/40 p-3 text-[11px] leading-5 text-slate-500">
            No workflow steps exist yet.
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-1 2xl:grid-cols-2">
        <div className="rounded-lg border border-signal-400/30 bg-signal-400/10 p-3">
          <p className="text-[10px] font-medium text-signal-300">Review node</p>
          <p className="mt-2 text-[11px] leading-5 text-slate-200">{mission.reviewSummary}</p>
        </div>
        <div className="rounded-lg border border-green-400/30 bg-green-400/10 p-3">
          <p className="text-[10px] font-medium text-green-300">Delivery node</p>
          <p className="mt-2 text-[11px] leading-5 text-slate-200">{mission.deliveryLabel}</p>
          <p className="mt-2 text-[10px] leading-4 text-slate-500">
            Evidence: {firstEvidence ? firstEvidence.label : 'No stored evidence yet.'}
          </p>
        </div>
      </div>
    </section>
  );
}
