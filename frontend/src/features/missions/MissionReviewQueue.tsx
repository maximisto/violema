import ShieldCheck from 'lucide-react/dist/esm/icons/shield-check.js';
import type { MissionReviewQueueEntry } from './reviewQueue';

interface MissionReviewQueueProps {
  entries: MissionReviewQueueEntry[];
  /** The mission whose approval gate is currently shown below the queue. */
  focusedId?: string | number | null;
  onFocus: (entry: MissionReviewQueueEntry) => void;
}

/**
 * The approval queue that sits above the focused mission's review gate.
 *
 * Its whole job is to make a pending approval visible without the founder
 * already having the right mission selected -- the failure mode that hid a
 * `waiting_review` mission behind a stale selection pointer. When nothing is
 * pending it says so explicitly rather than rendering nothing, so an empty
 * Reviews tab reads as "no approvals" instead of "something did not load".
 */
export function MissionReviewQueue({ entries, focusedId, onFocus }: MissionReviewQueueProps) {
  return (
    <section className="rounded-lg border border-navy-700/70 bg-navy-950/35 p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-300/80">Approval queue</p>
          <h3 className="mt-1 text-sm font-semibold text-white">
            {entries.length === 0
              ? 'Nothing is waiting for approval'
              : `${entries.length} mission${entries.length === 1 ? '' : 's'} waiting for approval`}
          </h3>
        </div>
        <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg border border-amber-300/22 bg-amber-300/10 text-amber-100">
          <ShieldCheck className="h-4 w-4" />
        </span>
      </div>

      {entries.length === 0 ? (
        <p className="mt-3 text-[12px] leading-5 text-slate-500">
          Every mission that finishes with a held delivery shows up here, whichever mission is open.
        </p>
      ) : (
        <div className="mt-3 space-y-2">
          {entries.map((entry) => {
            const isFocused = focusedId != null && String(entry.id) === String(focusedId);
            return (
              <button
                key={entry.key}
                type="button"
                onClick={() => onFocus(entry)}
                aria-pressed={isFocused}
                className={`flex w-full items-center justify-between gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 ${
                  isFocused
                    ? 'border-amber-300/45 bg-amber-300/12 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]'
                    : 'border-navy-800/80 bg-navy-950/42 hover:border-amber-400/25 hover:bg-amber-400/8'
                }`}
              >
                <span className="min-w-0">
                  <span className="block truncate text-[13px] font-semibold text-white">{entry.title}</span>
                  <span className="mt-0.5 block truncate text-[11px] text-slate-500">
                    Held for {entry.deliveryLabel}
                  </span>
                </span>
                <span className="flex-shrink-0 rounded-full border border-amber-300/25 bg-amber-300/10 px-2 py-0.5 text-[10px] font-semibold text-amber-100">
                  {isFocused ? 'Reviewing' : 'Review'}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}
