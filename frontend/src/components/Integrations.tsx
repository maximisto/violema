import ArrowRight from 'lucide-react/dist/esm/icons/arrow-right.js';
import ShieldCheck from 'lucide-react/dist/esm/icons/shield-check.js';
import { useNavigate } from 'react-router-dom';
import { connectedSystems, type ConnectedSystem } from '../content/homepage';
import BrandIcon from './BrandIcon';
import Reveal from './Reveal';

const statusTheme = {
  live: { label: 'Live', dot: 'bg-emerald-400', text: 'text-emerald-200', ring: 'border-emerald-300/30 bg-emerald-300/10', ping: true },
  ready: { label: 'Ready', dot: 'bg-violet-400', text: 'text-violet-200', ring: 'border-violet-300/28 bg-violet-300/10', ping: false },
  planned: { label: 'Planned', dot: 'bg-slate-400', text: 'text-[#9aa4ba]', ring: 'border-white/12 bg-white/[0.04]', ping: false },
} as const;

const toneBadge: Record<ConnectedSystem['tone'], string> = {
  violet: 'from-violet-400/30 to-violet-700/10 text-violet-100',
  cyan: 'from-cyan-400/26 to-cyan-700/10 text-cyan-100',
  emerald: 'from-emerald-400/26 to-emerald-700/10 text-emerald-100',
  amber: 'from-amber-400/26 to-amber-700/10 text-amber-100',
  slate: 'from-slate-300/20 to-slate-600/14 text-slate-100',
};

function StatusPill({ status }: { status: ConnectedSystem['status'] }) {
  const theme = statusTheme[status];
  return (
    <span className={`inline-flex flex-none items-center gap-1.5 rounded-full border px-2 py-1 ${theme.ring}`}>
      <span className="relative flex h-1.5 w-1.5 items-center justify-center">
        {theme.ping ? <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" /> : null}
        <span className={`relative h-1.5 w-1.5 rounded-full ${theme.dot}`} />
      </span>
      <span className={`text-telemetry text-[0.5rem] ${theme.text}`}>{theme.label}</span>
    </span>
  );
}

function SystemNode({ system }: { system: ConnectedSystem }) {
  return (
    <article className="surface-lift group flex items-center gap-3 rounded-xl border border-white/10 bg-ink-850/90 px-3 py-2.5">
      <span
        className={`flex h-9 w-9 flex-none items-center justify-center rounded-lg bg-gradient-to-br ${toneBadge[system.tone]} shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]`}
      >
        <BrandIcon name={system.name} className="h-[1.15rem] w-[1.15rem]" />
      </span>
      <div className="min-w-0 flex-1">
        <h4 className="truncate text-sm font-semibold text-white">{system.name}</h4>
        <p className="truncate text-xs text-[#8793ad]">{system.category}</p>
      </div>
      <StatusPill status={system.status} />
    </article>
  );
}

function Lane({ hint, title, systems }: { hint: string; title: string; systems: ConnectedSystem[] }) {
  return (
    <div className="flex flex-col gap-4 p-5 sm:p-6">
      <div>
        <p className="text-telemetry text-[0.56rem] text-[#6f7a91]">{hint}</p>
        <h3 className="mt-2 font-display text-2xl font-semibold tracking-[-0.02em] text-white">{title}</h3>
      </div>
      <div className="grid gap-2.5">
        {systems.slice(0, 5).map((system, index) => (
          <Reveal key={system.name} delay={index * 70}>
            <SystemNode system={system} />
          </Reveal>
        ))}
      </div>
    </div>
  );
}

function OperatorCore() {
  const steps = ['Read source context', 'Run the workflow', 'Pause for judgment', 'Deliver approved output'];

  return (
    <div className="relative flex flex-col overflow-hidden bg-gradient-to-b from-ink-800 to-ink-900 p-5 sm:p-6">
      <span className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-signal-500/60 to-transparent" />
      <div aria-hidden className="absolute -left-16 top-10 h-44 w-44 rounded-full bg-violet-500/22 blur-3xl" />
      <div aria-hidden className="absolute -right-16 bottom-4 h-48 w-48 rounded-full bg-signal-500/12 blur-3xl" />

      <div className="relative flex flex-1 flex-col">
        <div className="flex items-center justify-between gap-3">
          <p className="text-telemetry text-[0.58rem] text-signal-300">Violema · operator layer</p>
          <span className="flex h-10 w-10 flex-none items-center justify-center rounded-xl border border-signal-500/25 bg-signal-500/10 text-signal-300">
            <ShieldCheck className="h-5 w-5" />
          </span>
        </div>

        <h3 className="mt-4 font-display text-[2rem] font-semibold leading-[1] tracking-[-0.03em] text-white">
          The reviewable operator layer
        </h3>
        <p className="mt-3 text-sm leading-6 text-[#c2cadb]">
          Runs start from the web platform or Slack. The same run keeps schedules, sources, approvals, output, and cost visible end to end.
        </p>

        <div className="relative mt-6 grid gap-2.5">
          <span aria-hidden className="absolute bottom-4 left-[0.95rem] top-4 w-px bg-gradient-to-b from-violet-400/50 via-violet-400/20 to-signal-500/40" />
          {steps.map((step, index) => (
            <div key={step} className="relative flex items-center gap-3 rounded-xl border border-white/10 bg-black/25 px-3 py-2.5">
              <span className="flex h-8 w-8 flex-none items-center justify-center rounded-lg bg-violet-500 text-xs font-black text-white shadow-[0_0_18px_rgba(139,92,246,0.4)]">
                {index + 1}
              </span>
              <span className="text-sm font-semibold text-white">{step}</span>
            </div>
          ))}
        </div>

        <div className="mt-auto pt-6">
          <p className="rounded-xl border border-white/10 bg-white/[0.04] p-3 text-xs leading-5 text-[#8793ad]">
            Product names show possible workflow surfaces and statuses. They don&apos;t imply sponsorship, customer relationships, or partnership.
          </p>
        </div>
      </div>
    </div>
  );
}

export default function Integrations() {
  const navigate = useNavigate();
  const inputs = connectedSystems.filter((system) => system.lane === 'input');
  const delivery = connectedSystems.filter((system) => system.lane === 'delivery');
  const featured = connectedSystems.filter((system) => ['live', 'ready'].includes(system.status)).slice(0, 8);

  return (
    <section id="integrations" className="scroll-mt-24 border-t border-white/10 bg-ink-900 py-20 text-white sm:py-28">
      <div className="mx-auto max-w-[88rem] px-4 sm:px-6 lg:px-8">
        <Reveal className="max-w-3xl">
          <p className="text-telemetry text-[0.62rem] text-signal-400">// connected systems</p>
          <h2 className="mt-4 font-display text-[2.6rem] font-semibold leading-[0.98] tracking-[-0.03em] sm:text-[3.6rem]">
            One operator layer across the tools founders already use.
          </h2>
          <p className="mt-5 max-w-2xl text-lg leading-8 text-[#aeb7cd]">
            Violema connects work signals, runs recurring tasks, and routes only reviewed output back to the right channel.
          </p>
        </Reveal>

        <Reveal delay={80} className="mt-10 flex items-center gap-4">
          <span className="text-telemetry whitespace-nowrap text-[0.58rem] text-violet-200">Signals in</span>
          <span className="signal-rail relative h-px flex-1 bg-white/10" />
          <span className="text-telemetry whitespace-nowrap text-[0.58rem] text-signal-300">Operator layer</span>
          <span className="signal-rail relative h-px flex-1 bg-white/10" />
          <span className="text-telemetry whitespace-nowrap text-[0.58rem] text-violet-200">Approved out</span>
        </Reveal>

        <Reveal delay={120} className="mt-6">
          <div className="overflow-hidden rounded-[1.75rem] border border-white/10 bg-ink-900 shadow-[0_40px_120px_-40px_rgba(0,0,0,0.9)]">
            <div className="grid gap-px bg-white/10 lg:grid-cols-[1fr_0.96fr_1fr]">
              <div className="bg-ink-900">
                <Lane hint="Revenue · product · engineering · knowledge" title="Signals in" systems={inputs} />
              </div>
              <div className="bg-ink-900">
                <OperatorCore />
              </div>
              <div className="bg-ink-900">
                <Lane hint="Slack live today · more by status" title="Approved work out" systems={delivery} />
              </div>
            </div>
          </div>
        </Reveal>

        <Reveal delay={160} className="mt-8 flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap gap-2">
            {featured.map((system) => (
              <span
                key={system.name}
                className="surface-lift inline-flex items-center gap-2 rounded-full border border-white/10 bg-ink-850/80 py-1.5 pl-1.5 pr-3.5"
              >
                <span className={`flex h-6 w-6 items-center justify-center rounded-md bg-gradient-to-br ${toneBadge[system.tone]}`}>
                  <BrandIcon name={system.name} className="h-[0.85rem] w-[0.85rem]" />
                </span>
                <span className="text-xs font-semibold text-[#cbd5e1]">{system.name}</span>
              </span>
            ))}
          </div>

          <button
            type="button"
            onClick={() => navigate('/integrations')}
            className="group inline-flex min-h-[3rem] flex-none items-center justify-center gap-2 rounded-2xl border border-white/12 bg-white/[0.04] px-5 text-sm font-semibold text-white transition duration-200 hover:border-signal-500/40 hover:bg-signal-500/[0.08] active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300"
          >
            Open integrations map
            <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" />
          </button>
        </Reveal>
      </div>
    </section>
  );
}
