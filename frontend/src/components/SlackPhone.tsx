import ChevronLeft from 'lucide-react/dist/esm/icons/chevron-left.js';
import Hash from 'lucide-react/dist/esm/icons/hash.js';
import Plus from 'lucide-react/dist/esm/icons/plus.js';
import Search from 'lucide-react/dist/esm/icons/search.js';
import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * A built (not screenshotted) iPhone running Slack dark mode that plays the
 * Violema reviewable-approval loop live: Violema posts the weekly update card →
 * the founder approves → Violema confirms delivery. Messages populate with
 * typing indicators so the hero feels alive. The Approve button is clickable;
 * the loop auto-plays when in view and collapses to the delivered state under
 * reduced motion.
 */
type Phase = 'typing1' | 'card' | 'approved' | 'typing2' | 'delivered';

const SEQUENCE: { phase: Phase; ms: number }[] = [
  { phase: 'typing1', ms: 1400 },
  { phase: 'card', ms: 3200 },
  { phase: 'approved', ms: 1500 },
  { phase: 'typing2', ms: 1400 },
  { phase: 'delivered', ms: 4400 },
];
const APPROVED_INDEX = SEQUENCE.findIndex((s) => s.phase === 'approved');

function prefersReducedMotion() {
  return typeof window !== 'undefined'
    && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

const TypingBubble = ({ initial }: { initial: string }) => (
  <div className="slackphone-in flex items-center gap-2">
    <span className="flex h-6 w-6 flex-none items-center justify-center rounded-md bg-gradient-to-br from-violet-500 to-[#7c3cff] text-[0.6rem] font-black text-white">{initial}</span>
    <span className="flex items-center gap-1 rounded-2xl rounded-bl-md bg-white/[0.06] px-2.5 py-2">
      {[0, 0.16, 0.32].map((d) => (
        <span key={d} className="slackphone-dot h-1 w-1 rounded-full bg-[#7c8aa3]" style={{ animationDelay: `${d}s` }} />
      ))}
    </span>
  </div>
);

export default function SlackPhone({ className = '' }: { className?: string }) {
  const [index, setIndex] = useState(0);
  const [active, setActive] = useState(false);
  const reduced = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    reduced.current = prefersReducedMotion();
    const node = rootRef.current;
    if (!node || typeof IntersectionObserver === 'undefined') {
      setActive(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => entries.forEach((e) => e.isIntersecting && setActive(true)),
      { threshold: 0.35 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!active) return;
    if (reduced.current) {
      setIndex(SEQUENCE.length - 1);
      return;
    }
    timer.current = setTimeout(
      () => setIndex((i) => (i + 1) % SEQUENCE.length),
      SEQUENCE[index].ms,
    );
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [active, index]);

  const phase = SEQUENCE[index].phase;
  const showCard = phase !== 'typing1';
  const approvedState = phase === 'approved' || phase === 'typing2' || phase === 'delivered';
  const showReply = approvedState;
  const showDelivered = phase === 'delivered';

  const approve = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    setIndex(APPROVED_INDEX);
  }, []);

  return (
    <div ref={rootRef} className={`relative mx-auto w-[19rem] ${className}`}>
      {/* titanium frame */}
      <div className="relative rounded-[3rem] bg-gradient-to-b from-[#52555d] via-[#26282d] to-[#0f1014] p-[3px] shadow-[0_50px_110px_-34px_rgba(0,0,0,0.78),inset_0_1px_1.5px_rgba(255,255,255,0.28),inset_0_0_0_1px_rgba(124,58,237,0.10)]">
        {/* violet rim glow */}
        <div aria-hidden className="pointer-events-none absolute -inset-px z-0 rounded-[3rem] bg-[linear-gradient(140deg,rgba(167,139,250,0.35),transparent_30%,transparent_72%,rgba(255,122,60,0.18))] opacity-60 blur-[2px]" />
        <div className="relative rounded-[2.85rem] bg-[#0a0b0e] p-[2px]">
          <div className="relative flex aspect-[9/19.5] flex-col overflow-hidden rounded-[2.7rem] bg-[#0b0e14]">
            {/* dynamic island */}
            <div className="absolute left-1/2 top-[0.7rem] z-30 h-[1.5rem] w-[5.6rem] -translate-x-1/2 rounded-full bg-black shadow-[inset_0_0_0_1px_rgba(255,255,255,0.04)]" />
            {/* screen glass: layered sheen for a wet-glass read */}
            <div aria-hidden className="pointer-events-none absolute inset-0 z-20 rounded-[2.7rem] bg-[linear-gradient(122deg,rgba(255,255,255,0.18)_0%,transparent_20%,transparent_68%,rgba(255,255,255,0.08)_100%)] mix-blend-screen" />
            <div aria-hidden className="pointer-events-none absolute inset-0 z-20 rounded-[2.7rem] bg-[radial-gradient(120%_60%_at_15%_-5%,rgba(255,255,255,0.14),transparent_55%)] mix-blend-screen" />

            {/* status bar */}
            <div className="flex items-center justify-between px-6 pb-1.5 pt-3.5 text-[0.62rem] font-semibold text-white">
              <span className="tabular">9:41</span>
              <div className="flex items-center gap-1.5">
                <span className="flex items-end gap-[1.5px]">
                  {[3, 5, 7, 9].map((h) => (
                    <span key={h} className="w-[2px] rounded-[1px] bg-white" style={{ height: h }} />
                  ))}
                </span>
                <svg viewBox="0 0 16 12" className="h-2.5 w-3.5 fill-white">
                  <path d="M8 2.5c2.1 0 4 .8 5.4 2.2l1-1A9 9 0 0 0 8 .5 9 9 0 0 0 1.6 3.7l1 1A7.6 7.6 0 0 1 8 2.5Zm0 3c1.2 0 2.4.5 3.3 1.4l1-1A6.1 6.1 0 0 0 8 3.5a6.1 6.1 0 0 0-4.3 2.4l1 1A4.7 4.7 0 0 1 8 5.5Zm0 3c.6 0 1.2.3 1.6.7L8 11l-1.6-1.8c.4-.4 1-.7 1.6-.7Z" />
                </svg>
                <span className="flex h-2.5 w-5 items-center rounded-[3px] border border-white/70 px-[1.5px]">
                  <span className="h-1.5 w-[70%] rounded-[1px] bg-white" />
                </span>
              </div>
            </div>

            {/* channel header */}
            <div className="flex items-center justify-between border-b border-white/[0.07] px-3.5 pb-2.5 pt-1.5">
              <div className="flex min-w-0 items-center gap-1.5">
                <ChevronLeft className="h-4 w-4 flex-none text-[#aab2c5]" />
                <Hash className="h-3 w-3 flex-none text-[#7c8aa3]" />
                <span className="truncate text-[0.82rem] font-bold text-white">founder-ops</span>
                <span className="ml-1 rounded bg-white/8 px-1 py-px text-[0.5rem] font-semibold text-[#9aa4ba]">12</span>
              </div>
              <Search className="h-3.5 w-3.5 flex-none text-[#7c8aa3]" />
            </div>

            {/* thread */}
            <div className="flex flex-1 flex-col justify-end gap-3 overflow-hidden px-3.5 py-3.5">
              <div className="flex items-center gap-2">
                <span className="h-px flex-1 bg-white/8" />
                <span className="text-[0.5rem] font-bold uppercase tracking-[0.12em] text-[#7c8aa3]">Today</span>
                <span className="h-px flex-1 bg-white/8" />
              </div>

              {phase === 'typing1' && <TypingBubble initial="V" />}

              {/* Violema app message + approval card */}
              {showCard && (
                <div className="slackphone-in">
                  <div className="flex items-center gap-2">
                    <span className="flex h-6 w-6 flex-none items-center justify-center rounded-md bg-gradient-to-br from-violet-500 to-[#7c3cff] text-[0.6rem] font-black text-white">V</span>
                    <span className="text-[0.68rem] font-bold text-white">Violema</span>
                    <span className="rounded bg-white/10 px-1 text-[0.42rem] font-bold uppercase tracking-[0.08em] text-[#aab2c5]">App</span>
                    <span className="text-[0.5rem] text-[#7c8aa3]">9:05 AM</span>
                  </div>

                  <div className="mt-2 overflow-hidden rounded-lg border border-white/10 bg-white/[0.035]">
                    <div className="flex">
                      <span className="w-[3px] flex-none bg-gradient-to-b from-violet-400 to-signal-500" />
                      <div className="min-w-0 flex-1 p-3">
                        <p className="text-[0.72rem] font-bold leading-tight text-white">Weekly founder update — ready for review</p>
                        <p className="mt-0.5 text-[0.56rem] text-violet-200">Run #7241 · 12 sources · 38 credits</p>

                        <div className="mt-2.5 grid gap-1.5">
                          {[
                            ['Revenue', '▲ 18% WoW', 'text-emerald-300'],
                            ['Churn', 'Steady', 'text-[#c2cadb]'],
                            ['Signals', '2 enterprise wins', 'text-[#c2cadb]'],
                          ].map(([label, value, color]) => (
                            <div key={label} className="flex items-center justify-between text-[0.56rem]">
                              <span className="text-[#8793ad]">{label}</span>
                              <span className={`font-semibold ${color}`}>{value}</span>
                            </div>
                          ))}
                        </div>

                        <div className="mt-2.5 flex items-center gap-2">
                          <span className="text-[0.5rem] font-semibold text-[#8793ad]">Sources</span>
                          <div className="flex -space-x-1">
                            {['S', 'P', 'C', 'A'].map((s, i) => (
                              <span
                                key={s}
                                className={`flex h-4 w-4 items-center justify-center rounded-[4px] border border-[#0b0e14] text-[0.42rem] font-black text-white ${
                                  ['bg-violet-500', 'bg-slate-600', 'bg-blue-500', 'bg-sky-500'][i]
                                }`}
                              >
                                {s}
                              </span>
                            ))}
                            <span className="flex h-4 w-4 items-center justify-center rounded-[4px] border border-[#0b0e14] bg-white/12 text-[0.42rem] font-black text-white">+9</span>
                          </div>
                        </div>

                        <div className="mt-3 grid grid-cols-2 gap-1.5">
                          <button
                            type="button"
                            onClick={approve}
                            className={`rounded-md px-2 py-1.5 text-[0.56rem] font-bold transition-colors ${
                              approvedState
                                ? 'bg-[#1aa172]/15 text-emerald-300'
                                : 'bg-[#1aa172] text-white shadow-[0_4px_14px_-4px_rgba(26,161,114,0.8)] hover:bg-[#15875f]'
                            }`}
                          >
                            {approvedState ? '✓ Approved' : 'Approve & deliver'}
                          </button>
                          {!approvedState && (
                            <button type="button" className="rounded-md border border-white/14 bg-white/[0.04] px-2 py-1.5 text-[0.56rem] font-bold text-[#dbe2f4]">
                              Request changes
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* human reply */}
              {showReply && (
                <div className="slackphone-in flex items-start gap-2">
                  <span className="flex h-6 w-6 flex-none items-center justify-center rounded-md bg-gradient-to-br from-signal-500 to-[#cf4a10] text-[0.6rem] font-black text-white">M</span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[0.68rem] font-bold text-white">Max</span>
                      <span className="text-[0.5rem] text-[#7c8aa3]">9:06 AM</span>
                    </div>
                    <p className="mt-0.5 text-[0.62rem] leading-snug text-[#c2cadb]">Approved ✅ ship it to #founder-updates</p>
                  </div>
                </div>
              )}

              {phase === 'typing2' && <TypingBubble initial="V" />}

              {/* delivery confirmation */}
              {showDelivered && (
                <div className="slackphone-in flex items-start gap-2">
                  <span className="flex h-6 w-6 flex-none items-center justify-center rounded-md bg-gradient-to-br from-violet-500 to-[#7c3cff] text-[0.6rem] font-black text-white">V</span>
                  <div className="min-w-0">
                    <p className="text-[0.62rem] leading-snug text-[#c2cadb]">
                      <span className="font-semibold text-emerald-300">Delivered</span> to <span className="font-semibold text-white">#founder-updates</span> · run logged with 12 sources.
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* composer */}
            <div className="border-t border-white/[0.07] px-3 py-2.5">
              <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-2.5 py-2">
                <Plus className="h-3.5 w-3.5 flex-none text-[#7c8aa3]" />
                <span className="text-[0.6rem] text-[#6f7a91]">Message #founder-ops</span>
              </div>
              <div className="mx-auto mt-2 h-1 w-24 rounded-full bg-white/25" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
