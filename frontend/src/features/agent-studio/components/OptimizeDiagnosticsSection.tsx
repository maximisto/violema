import { Flame, Target } from 'lucide-react';

type RecommendationAction = 'lean_ops' | 'raise_review' | 'match_lanes' | 'trim_lanes' | 'none';
type Severity = 'low' | 'medium' | 'high';

interface DiagnosticItem {
  title: string;
  body: string;
  severity: Severity;
  action: RecommendationAction;
}

interface OptimizeDiagnosticsSectionProps {
  wasteItems: DiagnosticItem[];
  riskItems: DiagnosticItem[];
  actionBusy: boolean;
  onApplyRecommendationAction: (action: RecommendationAction) => void;
}

export function OptimizeDiagnosticsSection({
  wasteItems,
  riskItems,
  actionBusy,
  onApplyRecommendationAction,
}: OptimizeDiagnosticsSectionProps) {
  return (
    <div className="grid gap-4">
      <div className="rounded-[1.8rem] border border-navy-800/80 bg-gradient-to-b from-navy-900/72 via-navy-900/56 to-navy-950/88 p-5">
        <div className="flex items-center gap-2">
          <Flame className="h-4 w-4 text-amber-300" />
          <div>
            <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Waste diagnostics</p>
            <h3 className="text-sm font-semibold text-white">Where the setup is overspending</h3>
          </div>
        </div>
        <div className="mt-4 space-y-3">
          {wasteItems.map((item) => (
            <div key={item.title} className="rounded-2xl border border-amber-500/14 bg-amber-500/6 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-white">{item.title}</p>
                  <p className="mt-2 text-sm leading-relaxed text-slate-300">{item.body}</p>
                </div>
                <span className="ui-pill px-2 py-0.5 normal-case tracking-normal text-amber-200">{item.severity}</span>
              </div>
              {item.action !== 'none' ? (
                <button
                  type="button"
                  disabled={actionBusy}
                  onClick={() => onApplyRecommendationAction(item.action)}
                  className="mt-3 ui-pill px-3 py-1.5 text-[11px] normal-case tracking-normal text-amber-100 disabled:opacity-60"
                >
                  Apply fix
                </button>
              ) : null}
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-[1.8rem] border border-navy-800/80 bg-gradient-to-b from-navy-900/72 via-navy-900/56 to-navy-950/88 p-5">
        <div className="flex items-center gap-2">
          <Target className="h-4 w-4 text-rose-300" />
          <div>
            <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Risk diagnostics</p>
            <h3 className="text-sm font-semibold text-white">Where the workflow needs protection</h3>
          </div>
        </div>
        <div className="mt-4 space-y-3">
          {riskItems.map((item) => (
            <div key={item.title} className="rounded-2xl border border-rose-500/14 bg-rose-500/6 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-white">{item.title}</p>
                  <p className="mt-2 text-sm leading-relaxed text-slate-300">{item.body}</p>
                </div>
                <span className="ui-pill px-2 py-0.5 normal-case tracking-normal text-rose-200">{item.severity}</span>
              </div>
              {item.action !== 'none' ? (
                <button
                  type="button"
                  disabled={actionBusy}
                  onClick={() => onApplyRecommendationAction(item.action)}
                  className="mt-3 ui-pill px-3 py-1.5 text-[11px] normal-case tracking-normal text-rose-100 disabled:opacity-60"
                >
                  Tighten policy
                </button>
              ) : null}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
