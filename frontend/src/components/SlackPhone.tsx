import ChevronLeft from 'lucide-react/dist/esm/icons/chevron-left.js';
import Hash from 'lucide-react/dist/esm/icons/hash.js';
import Plus from 'lucide-react/dist/esm/icons/plus.js';
import Search from 'lucide-react/dist/esm/icons/search.js';
import type { CSSProperties } from 'react';

function delay(ms: number): CSSProperties {
  return { animationDelay: `${ms}ms` };
}

/**
 * A built (not screenshotted) iPhone running Slack dark mode, showing the
 * Violema run-approval card. Reused in the hero and the light showcase.
 */
export default function SlackPhone({ className = '' }: { className?: string }) {
  return (
    <div className={`relative mx-auto w-full max-w-[19.5rem] ${className}`}>
      {/* titanium frame */}
      <div className="relative rounded-[3rem] bg-gradient-to-b from-[#45474e] via-[#26282d] to-[#141519] p-[3px] shadow-[0_50px_110px_-34px_rgba(0,0,0,0.75)]">
        <div className="rounded-[2.85rem] bg-[#0a0b0e] p-[2px]">
          <div className="relative overflow-hidden rounded-[2.7rem] bg-[#0b0e14]">
            {/* dynamic island */}
            <div className="absolute left-1/2 top-[0.7rem] z-30 h-[1.5rem] w-[5.6rem] -translate-x-1/2 rounded-full bg-black shadow-[inset_0_0_0_1px_rgba(255,255,255,0.04)]" />
            {/* screen gloss */}
            <div aria-hidden className="pointer-events-none absolute inset-0 z-20 rounded-[2.7rem] bg-[linear-gradient(125deg,rgba(255,255,255,0.10),transparent_18%,transparent_70%,rgba(255,255,255,0.05))] mix-blend-screen" />

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
            <div className="space-y-3 px-3.5 py-3.5">
              <div className="flex items-center gap-2">
                <span className="h-px flex-1 bg-white/8" />
                <span className="text-[0.5rem] font-bold uppercase tracking-[0.12em] text-[#7c8aa3]">Today</span>
                <span className="h-px flex-1 bg-white/8" />
              </div>

              {/* Violema app message */}
              <div className="founder-chat-message">
                <div className="flex items-center gap-2">
                  <span className="flex h-6 w-6 flex-none items-center justify-center rounded-md bg-gradient-to-br from-violet-500 to-[#7c3cff] text-[0.6rem] font-black text-white">V</span>
                  <span className="text-[0.68rem] font-bold text-white">Violema</span>
                  <span className="rounded bg-white/10 px-1 text-[0.42rem] font-bold uppercase tracking-[0.08em] text-[#aab2c5]">App</span>
                  <span className="text-[0.5rem] text-[#7c8aa3]">9:05 AM</span>
                </div>

                {/* approval attachment card */}
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
                        <button type="button" className="rounded-md bg-[#1aa172] px-2 py-1.5 text-[0.56rem] font-bold text-white shadow-[0_4px_14px_-4px_rgba(26,161,114,0.8)]">
                          Approve &amp; deliver
                        </button>
                        <button type="button" className="rounded-md border border-white/14 bg-white/[0.04] px-2 py-1.5 text-[0.56rem] font-bold text-[#dbe2f4]">
                          Request changes
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* human reply */}
              <div className="founder-chat-message flex items-start gap-2" style={delay(420)}>
                <span className="flex h-6 w-6 flex-none items-center justify-center rounded-md bg-gradient-to-br from-signal-500 to-[#cf4a10] text-[0.6rem] font-black text-white">M</span>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[0.68rem] font-bold text-white">Max</span>
                    <span className="text-[0.5rem] text-[#7c8aa3]">9:06 AM</span>
                  </div>
                  <p className="mt-0.5 text-[0.62rem] leading-snug text-[#c2cadb]">Approved ✅ ship it to #founder-updates</p>
                </div>
              </div>
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
