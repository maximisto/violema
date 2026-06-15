import ClipboardCheck from 'lucide-react/dist/esm/icons/clipboard-check.js';
import Coins from 'lucide-react/dist/esm/icons/coins.js';
import GitBranch from 'lucide-react/dist/esm/icons/git-branch.js';
import LockKeyhole from 'lucide-react/dist/esm/icons/lock-keyhole.js';
import Route from 'lucide-react/dist/esm/icons/route.js';
import Send from 'lucide-react/dist/esm/icons/send.js';
import type { MissionControlPrimitiveView } from './types';

interface MissionControlDeckProps {
  items: MissionControlPrimitiveView[];
}

const toneClasses: Record<MissionControlPrimitiveView['tone'], string> = {
  violet: 'border-violet-400/24 bg-violet-400/10 text-violet-100',
  cyan: 'border-cyan-400/24 bg-cyan-400/10 text-cyan-100',
  green: 'border-green-400/24 bg-green-400/10 text-green-100',
  amber: 'border-amber-400/26 bg-amber-400/10 text-amber-100',
  slate: 'border-slate-500/18 bg-slate-500/8 text-slate-200',
};

const iconById: Record<MissionControlPrimitiveView['id'], typeof ClipboardCheck> = {
  plan: Route,
  trust: LockKeyhole,
  trace: GitBranch,
  playbook: ClipboardCheck,
  delivery: Send,
  cost: Coins,
};

export function MissionControlDeck({ items }: MissionControlDeckProps) {
  return (
    <section className="rounded-xl border border-navy-700/70 bg-navy-950/45 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.025)]">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-violet-300/80">
            Control layer
          </p>
          <h4 className="mt-1 text-[13px] font-semibold text-white">Plan, trust, trace, reuse</h4>
        </div>
        <span className="rounded-full border border-navy-700/80 bg-navy-900/60 px-2 py-0.5 text-[10px] font-medium text-slate-300">
          {items.length} signals
        </span>
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-1 2xl:grid-cols-2">
        {items.map((item) => {
          const Icon = iconById[item.id];
          return (
            <article
              key={item.id}
              className={`min-w-0 rounded-lg border p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.025)] ${toneClasses[item.tone]}`}
            >
              <div className="flex items-start gap-2.5">
                <span className="mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg border border-current/20 bg-black/10">
                  <Icon className="h-3.5 w-3.5" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex min-w-0 items-start justify-between gap-2">
                    <p className="truncate text-[11px] font-semibold text-slate-100" title={item.label}>
                      {item.label}
                    </p>
                    <span className="flex-shrink-0 rounded-full border border-current/20 bg-black/10 px-1.5 py-0.5 text-[9px] font-medium">
                      {item.value}
                    </span>
                  </div>
                  <p className="mt-1 line-clamp-2 text-[10px] leading-4 text-slate-400">{item.detail}</p>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
