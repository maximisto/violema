import Sparkles from 'lucide-react/dist/esm/icons/sparkles.js';

interface OptimizationRecommendation {
  title: string;
  body: string;
  action: 'lean_ops' | 'raise_review' | 'match_lanes' | 'trim_lanes' | 'none';
}

interface LiveOptimizationLoopSectionProps {
  items: OptimizationRecommendation[];
  actionBusy: boolean;
  onApplyRecommendation: (action: OptimizationRecommendation['action']) => void;
}

export function LiveOptimizationLoopSection({
  items,
  actionBusy,
  onApplyRecommendation,
}: LiveOptimizationLoopSectionProps) {
  return (
    <div className="rounded-[1.8rem] border border-navy-800/80 bg-gradient-to-b from-navy-900/72 via-navy-900/56 to-navy-950/88 p-5">
      <div className="flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-violet-300" />
        <div>
          <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Optimization loop</p>
          <h3 className="text-sm font-semibold text-white">What to change next</h3>
        </div>
      </div>
      <div className="mt-4 space-y-3">
        {items.map((item) => (
          <div key={item.title} className="rounded-2xl border border-violet-500/14 bg-violet-500/6 p-4">
            <p className="text-sm font-medium text-white">{item.title}</p>
            <p className="mt-2 text-sm leading-relaxed text-slate-400">{item.body}</p>
            {item.action !== 'none' ? (
              <button
                type="button"
                disabled={actionBusy}
                onClick={() => onApplyRecommendation(item.action)}
                className="mt-3 ui-pill px-3 py-1.5 text-[11px] normal-case tracking-normal text-violet-100 disabled:opacity-60"
              >
                Apply recommendation
              </button>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}
