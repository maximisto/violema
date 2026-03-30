import { X, Sparkles } from 'lucide-react';
import { formatCredits, TOP_UP_OPTIONS, type TopUpOfferId } from '../lib/credits';

export default function TopUpChooser({
  open,
  recommendedOfferId,
  busyOfferId = null,
  onClose,
  onSelect,
}: {
  open: boolean;
  recommendedOfferId: TopUpOfferId;
  busyOfferId?: TopUpOfferId | null;
  onClose: () => void;
  onSelect: (offerId: TopUpOfferId) => void;
}) {
  if (!open) return null;

  return (
    <>
      <button
        type="button"
        aria-label="Close top-up chooser"
        onClick={onClose}
        className="fixed inset-0 z-40 bg-black/70 backdrop-blur-[2px]"
      />
      <div className="fixed inset-x-4 top-1/2 z-50 mx-auto flex w-auto max-w-[52rem] -translate-y-1/2 flex-col overflow-hidden rounded-[1.7rem] border border-navy-700/80 bg-gradient-to-b from-navy-900/98 via-navy-900/96 to-navy-950/98 shadow-[0_30px_90px_rgba(2,6,23,0.55)] max-h-[calc(100vh-2rem)]">
        <div className="flex items-start justify-between gap-4 border-b border-navy-800/80 px-5 py-4 sm:px-6">
          <div>
            <div className="ui-pill w-fit px-3 py-1 text-violet-300">
              <Sparkles className="h-3 w-3" />
              Add credits
            </div>
            <h3 className="mt-3 text-lg font-semibold text-white sm:text-xl">Choose a top-up</h3>
            <p className="mt-1 max-w-xl text-sm leading-relaxed text-slate-400">
              Top-ups are one-time credit packs. They add runway without changing your plan.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-navy-700/80 bg-navy-900/55 p-2 text-slate-400 transition-colors hover:text-white"
            aria-label="Close top-up chooser"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="overflow-y-auto px-5 py-5 sm:px-6 sm:py-6">
          <div className="grid gap-3 sm:grid-cols-3 sm:gap-4">
          {TOP_UP_OPTIONS.map((option) => {
            const isRecommended = option.id === recommendedOfferId;
            const isBusy = busyOfferId === option.id;

            return (
              <button
                key={option.id}
                type="button"
                onClick={() => onSelect(option.id)}
                disabled={Boolean(busyOfferId)}
                className={`group flex h-full flex-col rounded-[1.35rem] border px-4 py-4 text-left transition-all duration-200 ${
                  isRecommended
                    ? 'border-violet-500/40 bg-violet-500/10 shadow-[0_20px_50px_rgba(76,29,149,0.18)]'
                    : 'border-navy-700/80 bg-navy-950/55 hover:border-violet-600/40 hover:bg-navy-900/70'
                } ${busyOfferId ? 'cursor-wait' : ''}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-600">
                      {option.label}
                    </p>
                    <p className="mt-2 text-[2rem] font-semibold leading-none text-white sm:text-[2.15rem]">
                      {formatCredits(option.credits)}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">credits</p>
                  </div>
                  {isRecommended && (
                    <span className="rounded-full border border-violet-400/30 bg-violet-500/15 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-violet-200">
                      Recommended
                    </span>
                  )}
                </div>
                <p className="mt-3 text-sm leading-relaxed text-slate-400">{option.description}</p>
                <div className="mt-auto flex items-end justify-between gap-3 pt-5">
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.18em] text-slate-600">One-time</p>
                    <p className="mt-1 text-xl font-semibold text-white">${option.priceUsd}</p>
                  </div>
                  <span className={`rounded-full px-3 py-1.5 text-[11px] font-medium ${
                    isRecommended
                      ? 'bg-violet-500 text-white'
                      : 'border border-navy-700 bg-navy-900/80 text-slate-300 group-hover:border-violet-700/50 group-hover:text-white'
                  }`}>
                    {isBusy ? 'Opening…' : 'Choose'}
                  </span>
                </div>
              </button>
            );
          })}
          </div>
        </div>
      </div>
    </>
  );
}
