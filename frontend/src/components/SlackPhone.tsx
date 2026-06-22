import ChevronLeft from 'lucide-react/dist/esm/icons/chevron-left.js';
import Hash from 'lucide-react/dist/esm/icons/hash.js';
import Plus from 'lucide-react/dist/esm/icons/plus.js';
import Search from 'lucide-react/dist/esm/icons/search.js';
import { useCallback, useEffect, useRef, useState } from 'react';
import BrandIcon from './BrandIcon';

/**
 * A built (not screenshotted) iPhone running Slack dark mode that plays a full,
 * live Violema run: the founder asks → Violema pulls the stack (source logos) →
 * posts a trend chart → the reviewable update card → Dima guards a risk → the
 * founder approves → Violema confirms delivery. Messages populate with typing
 * indicators so it feels alive; the Approve button is clickable. Auto-plays in
 * view; collapses to the delivered state under reduced motion.
 */
const ORDER = ['ask', 'typing1', 'sources', 'chart', 'card', 'guard', 'approved', 'typing2', 'delivered'] as const;
type Phase = (typeof ORDER)[number];

const DURATIONS: Record<Phase, number> = {
  ask: 1500,
  typing1: 1200,
  sources: 1900,
  chart: 2300,
  card: 3000,
  guard: 2300,
  approved: 1600,
  typing2: 1100,
  delivered: 4600,
};
const at = (phase: Phase) => ORDER.indexOf(phase);
const SOURCE_LOGOS = ['stripe', 'github', 'posthog', 'gmail'];

function prefersReducedMotion() {
  return typeof window !== 'undefined'
    && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

const ViAvatar = () => (
  <span className="flex h-6 w-6 flex-none items-center justify-center rounded-md bg-gradient-to-br from-violet-500 to-[#7c3cff] text-[0.6rem] font-black text-white">V</span>
);

const TypingBubble = () => (
  <div className="slackphone-in flex items-center gap-2">
    <ViAvatar />
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
      { threshold: 0.3 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!active) return;
    if (reduced.current) {
      setIndex(ORDER.length - 1);
      return;
    }
    timer.current = setTimeout(() => setIndex((i) => (i + 1) % ORDER.length), DURATIONS[ORDER[index]]);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [active, index]);

  const phase = ORDER[index];
  const showSources = index >= at('sources');
  const showChart = index >= at('chart');
  const showCard = index >= at('card');
  const showGuard = index >= at('guard');
  const approvedState = index >= at('approved');
  const showDelivered = index >= at('delivered');

  const approve = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    setIndex(at('approved'));
  }, []);

  return (
    <div ref={rootRef} className={`relative mx-auto w-[19rem] ${className}`}>
      {/* titanium frame */}
      <div className="relative rounded-[3rem] bg-gradient-to-b from-[#52555d] via-[#26282d] to-[#0f1014] p-[3px] shadow-[0_50px_110px_-34px_rgba(0,0,0,0.78),inset_0_1px_1.5px_rgba(255,255,255,0.28),inset_0_0_0_1px_rgba(124,58,237,0.10)]">
        <div aria-hidden className="pointer-events-none absolute -inset-px z-0 rounded-[3rem] bg-[linear-gradient(140deg,rgba(167,139,250,0.35),transparent_30%,transparent_72%,rgba(255,122,60,0.18))] opacity-60 blur-[2px]" />
        <div className="relative rounded-[2.85rem] bg-[#0a0b0e] p-[2px]">
          <div className="relative flex aspect-[9/19.5] flex-col overflow-hidden rounded-[2.7rem] bg-[#0b0e14]">
            {/* dynamic island */}
            <div className="absolute left-1/2 top-[0.7rem] z-30 h-[1.5rem] w-[5.6rem] -translate-x-1/2 rounded-full bg-black shadow-[inset_0_0_0_1px_rgba(255,255,255,0.04)]" />
            {/* screen glass */}
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

            {/* thread (bottom-anchored, like a real chat) */}
            <div className="flex flex-1 flex-col justify-end gap-2.5 overflow-hidden px-3.5 pb-3 pt-3">
              <div className="flex items-center gap-2">
                <span className="h-px flex-1 bg-white/8" />
                <span className="text-[0.5rem] font-bold uppercase tracking-[0.12em] text-[#7c8aa3]">Today</span>
                <span className="h-px flex-1 bg-white/8" />
              </div>

              {/* founder request */}
              <div className="slackphone-in flex items-start gap-2">
                <span className="flex h-6 w-6 flex-none items-center justify-center rounded-md bg-gradient-to-br from-signal-500 to-[#cf4a10] text-[0.6rem] font-black text-white">M</span>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[0.66rem] font-bold text-white">Max</span>
                    <span className="text-[0.46rem] text-[#7c8aa3]">9:11 AM</span>
                  </div>
                  <p className="mt-0.5 text-[0.62rem] leading-snug text-[#c2cadb]">Run the weekly founder update 🙏</p>
                </div>
              </div>

              {phase === 'typing1' && <TypingBubble />}

              {/* Violema pulls the stack (source logos) */}
              {showSources && (
                <div className="slackphone-in flex items-start gap-2">
                  <ViAvatar />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[0.66rem] font-bold text-white">Violema</span>
                      <span className="rounded bg-white/10 px-1 text-[0.4rem] font-bold uppercase tracking-[0.08em] text-[#aab2c5]">App</span>
                    </div>
                    <p className="mt-0.5 text-[0.6rem] leading-snug text-[#c2cadb]">On it — pulling your stack.</p>
                    <div className="mt-1.5 flex items-center gap-1.5">
                      {SOURCE_LOGOS.map((n) => (
                        <span key={n} className="flex h-5 w-5 items-center justify-center rounded-md border border-white/10 bg-white/[0.06]">
                          <BrandIcon name={n} className="h-3 w-3" />
                        </span>
                      ))}
                      <span className="text-[0.5rem] text-[#7c8aa3]">+8 sources</span>
                    </div>
                  </div>
                </div>
              )}

              {/* trend chart */}
              {showChart && (
                <div className="slackphone-in ml-8 overflow-hidden rounded-lg border border-white/10 bg-white/[0.035] p-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[0.56rem] font-semibold text-[#dbe2f4]">MRR · last 6 weeks</span>
                    <span className="text-[0.56rem] font-bold text-emerald-300">▲ 18% WoW</span>
                  </div>
                  <svg viewBox="0 0 124 36" className="mt-1.5 h-9 w-full" preserveAspectRatio="none">
                    <defs>
                      <linearGradient id="mrrbars" x1="0" y1="1" x2="0" y2="0">
                        <stop offset="0" stopColor="#7c3aed" />
                        <stop offset="1" stopColor="#22d3ee" />
                      </linearGradient>
                    </defs>
                    {[13, 17, 15, 23, 21, 32].map((h, i) => (
                      <rect key={i} x={i * 21 + 2} y={36 - h} width="13" height={h} rx="2.5" fill="url(#mrrbars)" />
                    ))}
                  </svg>
                </div>
              )}

              {/* reviewable update card */}
              {showCard && (
                <div className="slackphone-in ml-8 overflow-hidden rounded-lg border border-white/10 bg-white/[0.035]">
                  <div className="flex">
                    <span className="w-[3px] flex-none bg-gradient-to-b from-violet-400 to-signal-500" />
                    <div className="min-w-0 flex-1 p-2.5">
                      <p className="text-[0.7rem] font-bold leading-tight text-white">Weekly founder update — ready for review</p>
                      <p className="mt-0.5 text-[0.54rem] text-violet-200">Run #7241 · 12 sources · 38 credits</p>
                      <div className="mt-2 grid gap-1">
                        {[
                          ['Revenue', '▲ 18% WoW', 'text-emerald-300'],
                          ['Churn', '1 at-risk account', 'text-amber-300'],
                          ['Signals', '2 enterprise wins', 'text-[#c2cadb]'],
                        ].map(([label, value, color]) => (
                          <div key={label} className="flex items-center justify-between text-[0.54rem]">
                            <span className="text-[#8793ad]">{label}</span>
                            <span className={`font-semibold ${color}`}>{value}</span>
                          </div>
                        ))}
                      </div>
                      <div className="mt-2.5 grid grid-cols-2 gap-1.5">
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
              )}

              {/* Dima guards a risk */}
              {showGuard && (
                <div className="slackphone-in flex items-start gap-2">
                  <img src="/brand/dima/dima-mark.png" alt="" className="h-6 w-6 flex-none rounded-md border border-white/10 bg-ink-900 object-cover" decoding="async" loading="lazy" />
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[0.66rem] font-bold text-white">Dima</span>
                      <span className="rounded bg-signal-500/15 px-1 text-[0.4rem] font-bold uppercase tracking-[0.08em] text-signal-300">Guardian</span>
                    </div>
                    <p className="mt-0.5 text-[0.6rem] leading-snug text-[#c2cadb]">🛡 Held the churn risk for your eyes before anything shipped.</p>
                  </div>
                </div>
              )}

              {/* founder approves */}
              {approvedState && (
                <div className="slackphone-in flex items-start gap-2">
                  <span className="flex h-6 w-6 flex-none items-center justify-center rounded-md bg-gradient-to-br from-signal-500 to-[#cf4a10] text-[0.6rem] font-black text-white">M</span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[0.66rem] font-bold text-white">Max</span>
                      <span className="text-[0.46rem] text-[#7c8aa3]">9:12 AM</span>
                    </div>
                    <p className="mt-0.5 text-[0.62rem] leading-snug text-[#c2cadb]">Approved ✅ ship it to #founder-updates</p>
                  </div>
                </div>
              )}

              {phase === 'typing2' && <TypingBubble />}

              {/* delivery */}
              {showDelivered && (
                <div className="slackphone-in flex items-start gap-2">
                  <ViAvatar />
                  <div className="min-w-0">
                    <p className="text-[0.62rem] leading-snug text-[#c2cadb]">
                      <span className="font-semibold text-emerald-300">Delivered</span> to <span className="font-semibold text-white">#founder-updates</span> · logged with every source.
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
