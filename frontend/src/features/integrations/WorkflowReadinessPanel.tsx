import AlertTriangle from 'lucide-react/dist/esm/icons/alert-triangle.js';
import CheckCircle2 from 'lucide-react/dist/esm/icons/check-circle-2.js';
import ShieldCheck from 'lucide-react/dist/esm/icons/shield-check.js';
import { Link } from 'react-router-dom';

export interface WorkflowReadinessBlocker {
  key: string;
  label: string;
  detail: string;
  route?: string;
}

export interface WorkflowReadinessReport {
  workflowId: string;
  ready: boolean;
  summary: string;
  requiredIntegrationIds: string[];
  optionalIntegrationIds: string[];
  firstRunRequiresApproval: boolean;
  blockers: WorkflowReadinessBlocker[];
  warnings?: WorkflowReadinessBlocker[];
}

export interface WorkflowReadinessBlockerAction {
  label: string;
  onClick?: () => void;
  route?: string;
}

export function WorkflowReadinessPanel({
  report,
  getBlockerAction,
}: {
  report: WorkflowReadinessReport | null;
  getBlockerAction?: (blocker: WorkflowReadinessBlocker) => WorkflowReadinessBlockerAction | null;
}) {
  if (!report) return null;

  return (
    <div
      className={`rounded-2xl border p-3 ${
        report.ready
          ? 'border-green-500/20 bg-green-500/8'
          : 'border-amber-500/20 bg-amber-500/8'
      }`}
    >
      <div className="flex items-start gap-3">
        <span className={`mt-0.5 ${report.ready ? 'text-green-300' : 'text-amber-300'}`}>
          {report.ready ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Workflow readiness</p>
          <p className="mt-1 text-sm font-semibold text-white">{report.summary}</p>
          {report.firstRunRequiresApproval ? (
            <p className="mt-2 inline-flex items-center gap-1.5 text-[11px] text-cyan-200">
              <ShieldCheck className="h-3.5 w-3.5" />
              First live delivery stays behind approval.
            </p>
          ) : null}
          {report.blockers.length > 0 ? (
            <div className="mt-3 space-y-2">
              {report.blockers.map((blocker) => {
                const action = getBlockerAction?.(blocker) || (!getBlockerAction && blocker.route
                  ? { label: 'Open setup', route: blocker.route }
                  : null);

                return (
                  <div key={blocker.key} className="rounded-xl border border-white/8 bg-navy-950/35 px-3 py-2">
                    <p className="text-xs font-semibold text-white">{blocker.label}</p>
                    <p className="mt-1 text-[11px] leading-5 text-slate-400">{blocker.detail}</p>
                    {action?.onClick ? (
                      <button
                        type="button"
                        onClick={action.onClick}
                        className="mt-2 inline-flex text-[11px] font-semibold text-cyan-200 hover:text-cyan-100"
                      >
                        {action.label}
                      </button>
                    ) : action?.route ? (
                      <Link
                        to={action.route}
                        className="mt-2 inline-flex text-[11px] font-semibold text-cyan-200 hover:text-cyan-100"
                      >
                        {action.label}
                      </Link>
                    ) : null}
                  </div>
                );
              })}
            </div>
          ) : null}
          {report.warnings && report.warnings.length > 0 ? (
            <div className="mt-3 space-y-2">
              {report.warnings.map((warning) => {
                const action = getBlockerAction?.(warning) || (!getBlockerAction && warning.route
                  ? { label: 'Open setup', route: warning.route }
                  : null);

                return (
                  <div key={warning.key} className="rounded-xl border border-amber-500/15 bg-amber-500/5 px-3 py-2">
                    <p className="text-xs font-semibold text-amber-100">{warning.label}</p>
                    <p className="mt-1 text-[11px] leading-5 text-slate-400">{warning.detail}</p>
                    {action?.onClick ? (
                      <button
                        type="button"
                        onClick={action.onClick}
                        className="mt-2 inline-flex text-[11px] font-semibold text-cyan-200 hover:text-cyan-100"
                      >
                        {action.label}
                      </button>
                    ) : action?.route ? (
                      <Link
                        to={action.route}
                        className="mt-2 inline-flex text-[11px] font-semibold text-cyan-200 hover:text-cyan-100"
                      >
                        {action.label}
                      </Link>
                    ) : null}
                  </div>
                );
              })}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
