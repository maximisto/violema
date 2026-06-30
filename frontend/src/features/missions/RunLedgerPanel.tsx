import CheckCircle2 from 'lucide-react/dist/esm/icons/check-circle-2.js';
import Clock3 from 'lucide-react/dist/esm/icons/clock-3.js';
import Send from 'lucide-react/dist/esm/icons/send.js';
import ShieldCheck from 'lucide-react/dist/esm/icons/shield-check.js';
import XCircle from 'lucide-react/dist/esm/icons/x-circle.js';

export interface WorkflowLedgerEvent {
  id: string;
  type: string;
  summary: string;
  createdAt: string;
}

function EventIcon({ type }: { type: string }) {
  const className = 'h-4 w-4';
  if (type === 'connector_failed' || type === 'approval_denied') return <XCircle className={className} />;
  if (type === 'approval_requested' || type === 'approval_granted') return <ShieldCheck className={className} />;
  if (type === 'external_action_executed') return <Send className={className} />;
  if (type === 'draft_created') return <Clock3 className={className} />;
  return <CheckCircle2 className={className} />;
}

export function RunLedgerPanel({ events }: { events: WorkflowLedgerEvent[] }) {
  return (
    <section className="rounded-2xl border border-navy-700/70 bg-navy-950/35 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[10px] uppercase tracking-[0.18em] text-slate-600">Run ledger</p>
          <h3 className="mt-1 text-sm font-semibold text-white">What Violema read, drafted, approved, and sent</h3>
        </div>
      </div>
      {events.length === 0 ? (
        <p className="mt-3 text-sm leading-6 text-slate-400">No ledger events are attached to this run yet.</p>
      ) : (
        <div className="mt-4 space-y-3">
          {events.map((event) => (
            <div key={event.id} className="flex gap-3 rounded-xl border border-white/8 bg-white/[0.03] px-3 py-2.5">
              <span className="mt-0.5 text-cyan-200">
                <EventIcon type={event.type} />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-medium text-white">{event.summary}</p>
                <p className="mt-1 text-[11px] uppercase tracking-[0.14em] text-slate-600">{event.type}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
