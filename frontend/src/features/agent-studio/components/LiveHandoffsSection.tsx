import { Workflow } from 'lucide-react';

interface LiveActivationTrailItem {
  id: string;
  title: string;
  connector: string;
  status: string;
  summary: string;
  modelSource?: string;
}

interface LiveHandoffsSectionProps {
  items: LiveActivationTrailItem[];
  getStatusTone: (status: string) => string;
}

export function LiveHandoffsSection({ items, getStatusTone }: LiveHandoffsSectionProps) {
  return (
    <div className="rounded-[1.8rem] border border-navy-800/80 bg-gradient-to-b from-navy-900/72 via-navy-900/56 to-navy-950/88 p-5">
      <div className="flex items-center gap-2">
        <Workflow className="h-4 w-4 text-cyan-300" />
        <div>
          <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Live handoffs</p>
          <h3 className="text-sm font-semibold text-white">Activation trail</h3>
        </div>
      </div>
      <div className="mt-4 space-y-3">
        {items.map((item, index) => (
          <div key={item.id} className="flex gap-3">
            <div className="flex flex-col items-center">
              <div className={`mt-1 h-3 w-3 rounded-full ${index === 0 ? 'bg-cyan-300 shadow-[0_0_18px_rgba(34,211,238,0.6)]' : 'bg-violet-300'}`} />
              {index < items.length - 1 ? <div className="mt-2 h-full w-px bg-gradient-to-b from-cyan-400/50 to-transparent" /> : null}
            </div>
            <div className="flex-1 rounded-2xl border border-navy-700/70 bg-navy-950/45 p-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-white">{item.title}</p>
                  <p className="mt-1 text-[11px] uppercase tracking-[0.14em] text-slate-500">{item.connector}</p>
                </div>
                <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${getStatusTone(item.status)}`}>
                  {item.status}
                </span>
              </div>
              <p className="mt-2 text-sm leading-relaxed text-slate-400">{item.summary}</p>
              {item.modelSource ? <p className="mt-2 text-[11px] text-slate-500">{item.modelSource}</p> : null}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
