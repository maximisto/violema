import ChevronLeft from 'lucide-react/dist/esm/icons/chevron-left.js';
import Hash from 'lucide-react/dist/esm/icons/hash.js';
import Plus from 'lucide-react/dist/esm/icons/plus.js';
import Search from 'lucide-react/dist/esm/icons/search.js';
import { useCallback, useEffect, useRef, useState } from 'react';
import BrandIcon from './BrandIcon';

/**
 * A built (not screenshotted) iPhone running Slack dark mode that plays a full,
 * live Violema run: the founder asks → Violema pulls the stack (source logos) →
 * posts the branded chart card (mirroring the real PNG Violema now delivers) →
 * the reviewable update card → the review gate holds delivery → the founder
 * approves → Violema confirms delivery. Messages populate with typing
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
const HERO_DURATIONS: Record<Phase, number> = {
  ask: 900,
  typing1: 650,
  sources: 950,
  chart: 1100,
  card: 1400,
  guard: 1200,
  approved: 950,
  typing2: 650,
  delivered: 2600,
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

type SlackPhoneVariant = 'standard' | 'hero';

/** The branded chart card Violema now really delivers, as the hero stage art. */
function ChartCardArt({ compact = false }: { compact?: boolean }) {
  const rows: Array<[string, number, string]> = [
    ['MRR', 100, '8.2k'],
    ['Expansion', 62, '1.4k'],
    ['New logos', 44, '6'],
  ];
  return (
    <div className={`overflow-hidden rounded-xl bg-[#faf7f2] shadow-[0_10px_28px_-10px_rgba(0,0,0,0.55)] ${compact ? 'p-2.5' : 'p-3.5'}`}>
      <div className="flex items-center gap-1.5">
        <span className="relative h-3.5 w-[5px] overflow-hidden rounded-full bg-[#7c3aed]">
          <span className="absolute inset-x-0 top-0 h-1/2 bg-[#f59e0b]" />
        </span>
        <span className={`font-bold text-[#14110e] ${compact ? 'text-[0.6rem]' : 'text-[0.78rem]'}`}>Revenue snapshot</span>
        <span className={`ml-auto font-bold text-emerald-600 ${compact ? 'text-[0.54rem]' : 'text-[0.66rem]'}`}>▲ 18% WoW</span>
      </div>
      <div className={compact ? 'mt-1.5 grid gap-1' : 'mt-2.5 grid gap-2'}>
        {rows.map(([label, width, value]) => (
          <div key={label} className="flex items-center gap-1.5">
            <span className={`w-14 flex-none text-right font-semibold text-[#14110e] ${compact ? 'text-[0.5rem]' : 'text-[0.6rem]'}`}>{label}</span>
            <span className={`${compact ? 'h-1.5' : 'h-2'} rounded-full bg-gradient-to-r from-[#7c3aed] to-[#a78bfa]`} style={{ width: `${width * 0.52}%` }} />
            <span className={`font-semibold text-[#6b6253] ${compact ? 'text-[0.5rem]' : 'text-[0.6rem]'}`}>{value}</span>
          </div>
        ))}
      </div>
      <p className={`text-[#6b6253] ${compact ? 'mt-1.5 text-[0.44rem]' : 'mt-2.5 text-[0.52rem]'}`}>Violema · evidence-linked run data</p>
    </div>
  );
}

export default function SlackPhone({
  className = '',
  variant = 'standard',
}: {
  className?: string;
  variant?: SlackPhoneVariant;
}) {
  const isHero = variant === 'hero';
  const [index, setIndex] = useState(0);
  const [active, setActive] = useState(false);
  const reduced = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const threadRef = useRef<HTMLDivElement | null>(null);

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
    const duration = isHero ? HERO_DURATIONS[ORDER[index]] : DURATIONS[ORDER[index]];
    timer.current = setTimeout(() => setIndex((i) => (i + 1) % ORDER.length), duration);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [active, index, isHero]);

  const phase = ORDER[index];
  const showSources = index >= at('sources');
  const showChart = index >= at('chart');
  const showCard = index >= at('card');
  const showGuard = index >= at('guard');
  const approvedState = index >= at('approved');
  const showDelivered = index >= at('delivered');

  useEffect(() => {
    if (!isHero) return;
    const node = threadRef.current;
    if (!node) return;

    const frame = window.requestAnimationFrame(() => {
      const isStartingOver = phase === 'ask' || phase === 'typing1';
      node.scrollTo({
        top: isStartingOver ? 0 : node.scrollHeight,
        behavior: reduced.current || isStartingOver ? 'auto' : 'smooth',
      });
    });

    return () => window.cancelAnimationFrame(frame);
  }, [index, isHero, phase]);

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


            {/* thread (bottom-anchored by default; scrollable under the hero Dima stage) */}
            <div
              ref={threadRef}
              data-hero-phone-thread={isHero ? 'true' : undefined}
              className="flex flex-1 flex-col justify-end gap-2.5 overflow-hidden px-3.5 pb-3 pt-3"
            >
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

              {/* branded chart card — the PNG Violema now actually posts */}
              {showChart && (
                <div className="slackphone-in ml-8">
                  <ChartCardArt compact />
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

              {/* review gate holds delivery */}
              {showGuard && (
                <div className="slackphone-in flex items-start gap-2">
                  <span className="flex h-6 w-6 flex-none items-center justify-center rounded-md border border-violet-400/30 bg-violet-500/15 text-[0.7rem]">🛡</span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[0.66rem] font-bold text-white">Review gate</span>
                      <span className="rounded bg-violet-500/15 px-1 text-[0.4rem] font-bold uppercase tracking-[0.08em] text-violet-300">Held</span>
                    </div>
                    <p className="mt-0.5 text-[0.6rem] leading-snug text-[#c2cadb]">Nothing ships until you say so — the churn risk is flagged for your eyes.</p>
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
                      <span className="font-semibold text-emerald-300">Delivered</span> to <span className="font-semibold text-white">#founder-updates</span> · chart card + every source attached.
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
