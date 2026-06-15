import ArrowRight from 'lucide-react/dist/esm/icons/arrow-right.js';
import Check from 'lucide-react/dist/esm/icons/check.js';
import Clock3 from 'lucide-react/dist/esm/icons/clock-3.js';
import Cpu from 'lucide-react/dist/esm/icons/cpu.js';
import FileText from 'lucide-react/dist/esm/icons/file-text.js';
import Inbox from 'lucide-react/dist/esm/icons/inbox.js';
import Link2 from 'lucide-react/dist/esm/icons/link-2.js';
import Lock from 'lucide-react/dist/esm/icons/lock.js';
import Monitor from 'lucide-react/dist/esm/icons/monitor.js';
import RefreshCcw from 'lucide-react/dist/esm/icons/refresh-ccw.js';
import Send from 'lucide-react/dist/esm/icons/send.js';
import ShieldCheck from 'lucide-react/dist/esm/icons/shield-check.js';
import UserCheck from 'lucide-react/dist/esm/icons/user-check.js';
import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import {
  comparisonRows,
  controls,
  workflowDemos,
  workflowExamples,
  type WorkflowDemoMessage,
} from '../content/homepage';
import BrandIcon from './BrandIcon';
import Reveal from './Reveal';

const buildSteps = [
  { title: 'Build the run', body: 'Recurring work with agents, source inputs, approval gates, and delivery rules.', Icon: Monitor },
  { title: 'Approve the judgment', body: 'Review sensitive language and evidence before anything leaves the workspace.', Icon: ShieldCheck },
  { title: 'Deliver the artifact', body: 'Send the approved brief, follow-up, or report with proof attached.', Icon: Send },
];

const controlIcons = [ShieldCheck, FileText, RefreshCcw, Link2];

function MessageAvatar({ message }: { message: WorkflowDemoMessage }) {
  if (message.from === 'violema') {
    return (
      <span className="flex h-7 w-7 flex-none items-center justify-center rounded-lg bg-violet-500/20 text-[0.62rem] font-black text-violet-100">
        V
      </span>
    );
  }
  if (message.from === 'human') {
    return (
      <span className="flex h-7 w-7 flex-none items-center justify-center rounded-lg border border-signal-500/30 bg-signal-500/12 text-[0.62rem] font-black text-signal-200">
        {message.label.slice(0, 1).toUpperCase()}
      </span>
    );
  }
  return (
    <span className="flex h-7 w-7 flex-none items-center justify-center rounded-lg border border-white/12 bg-white/[0.05] text-[0.5rem] font-black text-[#9aa4ba]">
      SYS
    </span>
  );
}

function RunTheatre() {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const demo = workflowDemos[active];

  const motionAllowed = useMemo(() => {
    if (typeof window === 'undefined') return false;
    return !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }, []);

  useEffect(() => {
    if (!motionAllowed || paused) return;
    const timer = window.setInterval(() => {
      setActive((index) => (index + 1) % workflowDemos.length);
    }, 6000);
    return () => window.clearInterval(timer);
  }, [motionAllowed, paused]);

  return (
    <section id="how-it-works" className="scroll-mt-24 border-t border-white/10 bg-ink-950 py-20 text-white sm:py-28">
      <div id="product-demo" className="mx-auto max-w-[88rem] scroll-mt-28 px-4 sm:px-6 lg:px-8">
        <div className="grid gap-x-12 gap-y-12 lg:grid-cols-[0.82fr_1.18fr] lg:items-center">
          <Reveal className="min-w-0">
            <p className="text-telemetry text-[0.62rem] text-signal-400">// how it works</p>
            <h2 className="mt-4 font-display text-[2.6rem] font-semibold leading-[0.98] tracking-[-0.03em] sm:text-[3.5rem]">
              Two surfaces. One reviewable run.
            </h2>
            <p className="mt-5 max-w-xl text-lg leading-8 text-[#aeb7cd]">
              Build and inspect in the web command center. Approve in seconds from Slack. The same run keeps its agents, evidence, and budget intact.
            </p>

            <div className="mt-8 grid gap-3">
              {buildSteps.map(({ title, body, Icon }, index) => (
                <Reveal key={title} delay={index * 90}>
                  <div className="flex items-start gap-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4 transition-colors duration-200 hover:border-violet-200/25">
                    <span className="flex h-11 w-11 flex-none items-center justify-center rounded-xl bg-violet-500/16 text-violet-100">
                      <Icon className="h-5 w-5" />
                    </span>
                    <div>
                      <h3 className="text-base font-semibold text-white">{title}</h3>
                      <p className="mt-1 text-sm leading-6 text-[#8793ad]">{body}</p>
                    </div>
                  </div>
                </Reveal>
              ))}
            </div>
          </Reveal>

          <Reveal delay={140} className="min-w-0">
            <div className="relative lg:pr-10 xl:pr-14">
              <div aria-hidden className="absolute -inset-x-6 -top-10 -bottom-14 -z-10">
                <div className="absolute right-8 top-0 h-56 w-56 rounded-full bg-violet-600/18 blur-[90px]" />
                <div className="absolute -bottom-4 left-4 h-52 w-52 rounded-full bg-signal-500/12 blur-[90px]" />
              </div>

              <div
                className="relative overflow-hidden rounded-[1.6rem] border border-white/12 bg-ink-900 shadow-[0_44px_130px_-40px_rgba(0,0,0,0.9)]"
                onMouseEnter={() => setPaused(true)}
                onMouseLeave={() => setPaused(false)}
              >
                <div className="flex items-center gap-3 border-b border-white/[0.07] bg-white/[0.025] px-4 py-3">
                  <div className="flex items-center gap-1.5">
                    <span className="h-3 w-3 rounded-full bg-[#ff5f57]" />
                    <span className="h-3 w-3 rounded-full bg-[#febc2e]" />
                    <span className="h-3 w-3 rounded-full bg-[#28c840]" />
                  </div>
                  <div className="ml-1 flex flex-1 items-center gap-2 rounded-lg border border-white/[0.07] bg-black/30 px-3 py-1.5">
                    <Lock className="h-3 w-3 flex-none text-[#7c8aa3]" />
                    <span className="text-telemetry truncate text-[0.56rem] text-[#8793ad]">violema.app / runs / 7241</span>
                  </div>
                  <span className="flex flex-none items-center gap-1.5 rounded-full border border-signal-500/30 bg-signal-500/10 px-2.5 py-1">
                    <span className="relative flex h-1.5 w-1.5 items-center justify-center">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-signal-400 opacity-70" />
                      <span className="relative h-1.5 w-1.5 rounded-full bg-signal-400" />
                    </span>
                    <span className="text-telemetry text-[0.5rem] text-signal-300">Live</span>
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-2 border-b border-white/10 bg-white/[0.015] px-4 py-2.5">
                  {workflowDemos.map((item, index) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setActive(index)}
                      aria-pressed={index === active}
                      className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300 ${
                        index === active
                          ? 'bg-white/10 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]'
                          : 'text-[#8793ad] hover:text-white'
                      }`}
                    >
                      {item.shortTitle}
                    </button>
                  ))}
                </div>

                <div className="relative p-4 sm:p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-semibold tracking-[-0.02em] text-white">{demo.title}</h3>
                    <span className="text-telemetry text-[0.5rem] text-[#6f7a91]">Run #7241</span>
                  </div>
                  <div className="flex items-center gap-2 text-telemetry text-[0.52rem] text-[#8793ad]">
                    <span className="rounded-md border border-white/10 bg-black/30 px-2 py-1">{demo.cadence}</span>
                    <span className="rounded-md border border-white/10 bg-black/30 px-2 py-1 text-violet-200">{demo.cost}</span>
                  </div>
                </div>

                <div key={demo.id} className="mt-4 grid gap-2">
                  {demo.messages.map((message, index) => (
                    <div
                      key={`${demo.id}-${index}`}
                      className="flex animate-fade-in-up items-start gap-2.5 rounded-xl border border-white/8 bg-ink-850/70 p-3"
                      style={{ animationDelay: `${index * 110}ms`, animationFillMode: 'both' } as CSSProperties}
                    >
                      <MessageAvatar message={message} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-xs font-bold text-white">{message.label}</p>
                          {message.meta ? (
                            <span className="text-telemetry flex-none text-[0.46rem] text-[#6f7a91]">{message.meta}</span>
                          ) : null}
                        </div>
                        <p className="mt-1 text-[0.8rem] leading-5 text-[#c2cadb]">{message.body}</p>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-white/10 pt-4">
                  <span className="text-telemetry text-[0.5rem] text-[#6f7a91]">Sources</span>
                  {demo.sources.map((source) => (
                    <span key={source} className="rounded-full border border-white/10 bg-black/25 px-2.5 py-1 text-[0.66rem] text-[#aeb7cd]">
                      {source}
                    </span>
                  ))}
                </div>
              </div>
              </div>

              <div className="pointer-events-none absolute -bottom-8 right-0 hidden w-[8.6rem] lg:block xl:w-[9.6rem]">
                <div className="rounded-[1.55rem] border border-white/12 bg-ink-850/95 p-2 shadow-[0_34px_80px_-18px_rgba(0,0,0,0.92)] backdrop-blur-xl">
                  <div className="rounded-[1.15rem] border border-white/[0.08] bg-ink-900 p-2.5">
                    <div className="flex items-center gap-1.5">
                      <span className="flex h-5 w-5 flex-none items-center justify-center rounded-md bg-gradient-to-br from-violet-400/30 to-violet-700/10 text-violet-100">
                        <BrandIcon name="Slack" className="h-3 w-3" />
                      </span>
                      <span className="text-telemetry truncate text-[0.46rem] text-[#8793ad]">{demo.channel}</span>
                    </div>
                    <div className="mt-2 rounded-lg border border-violet-300/25 bg-violet-500/[0.1] p-2">
                      <span className="text-telemetry text-[0.42rem] text-violet-200">Approval needed</span>
                      <p className="mt-1 text-[0.62rem] leading-snug text-[#d6dcea]">{demo.approval}</p>
                    </div>
                    <div className="mt-2 grid grid-cols-2 gap-1.5">
                      <span className="flex items-center justify-center gap-1 rounded-md bg-signal-500/90 py-1 text-[0.56rem] font-bold text-ink-950">
                        <Check className="h-2.5 w-2.5" /> Approve
                      </span>
                      <span className="flex items-center justify-center rounded-md border border-white/12 bg-white/[0.04] py-1 text-[0.56rem] font-semibold text-[#c2cadb]">
                        Changes
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

function WorkflowGrid() {
  return (
    <section className="bg-ink-900 py-20 text-white sm:py-28">
      <div className="mx-auto max-w-[88rem] px-4 sm:px-6 lg:px-8">
        <Reveal className="max-w-3xl">
          <p className="text-telemetry text-[0.62rem] text-signal-400">// recurring work</p>
          <h2 className="mt-4 font-display text-[2.6rem] font-semibold leading-[0.98] tracking-[-0.03em] sm:text-[3.5rem]">
            The work that repeats, on rails — not on autopilot.
          </h2>
          <p className="mt-5 max-w-2xl text-lg leading-8 text-[#aeb7cd]">
            Updates, checks, monitors, briefs, and follow-up loops — recurring work that still needs real business judgment.
          </p>
        </Reveal>

        <div className="mt-12 grid gap-4 md:grid-cols-2">
          {workflowExamples.map((workflow, index) => {
            const featured = index === 0;
            const stages = [
              { label: 'Input', detail: workflow.input, Icon: Inbox },
              { label: 'Action', detail: workflow.action, Icon: Cpu },
              { label: 'Approval', detail: workflow.approval, Icon: UserCheck, gate: true },
              { label: 'Output', detail: workflow.output, Icon: Send, terminal: true },
            ];

            return (
              <Reveal key={workflow.title} delay={index * 80}>
                <article
                  className={`surface-lift flex h-full flex-col rounded-[1.5rem] border p-6 ${
                    featured ? 'border-violet-300/25 bg-violet-500/[0.06]' : 'border-white/10 bg-ink-850/70'
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-violet-300/25 bg-violet-500/10 px-2.5 py-1">
                        <Clock3 className="h-3 w-3 text-violet-200" />
                        <span className="text-telemetry text-[0.5rem] text-violet-200">{workflow.cadence}</span>
                      </span>
                      <h3 className="mt-3 font-display text-2xl font-semibold tracking-[-0.02em] text-white">{workflow.title}</h3>
                    </div>
                    <span className="flex h-9 w-9 flex-none items-center justify-center rounded-xl border border-white/10 bg-black/25 font-mono text-[0.72rem] text-violet-100">
                      {String(index + 1).padStart(2, '0')}
                    </span>
                  </div>

                  <ol className="relative mt-6 space-y-3.5">
                    <span
                      aria-hidden
                      className="absolute left-[1.12rem] top-[1.12rem] bottom-[1.12rem] w-px bg-gradient-to-b from-violet-400/45 via-white/12 to-signal-500/45"
                    />
                    {stages.map((stage) => (
                      <li key={stage.label} className="relative flex gap-3.5">
                        <span
                          className={`relative z-10 flex h-9 w-9 flex-none items-center justify-center rounded-xl border ${
                            stage.gate
                              ? 'border-violet-300/40 bg-violet-500/[0.18] text-violet-100 shadow-[0_0_16px_rgba(139,92,246,0.28)]'
                              : stage.terminal
                                ? 'border-signal-500/30 bg-signal-500/[0.12] text-signal-300'
                                : 'border-white/10 bg-black/30 text-[#9aa4ba]'
                          }`}
                        >
                          <stage.Icon className="h-[0.95rem] w-[0.95rem]" />
                        </span>
                        <div className="min-w-0 pt-0.5">
                          <div className="flex items-center gap-2">
                            <span className="text-telemetry text-[0.5rem] text-[#6f7a91]">{stage.label}</span>
                            {stage.gate ? (
                              <span className="text-telemetry rounded-full bg-violet-500/[0.16] px-1.5 py-px text-[0.42rem] text-violet-200">
                                human gate
                              </span>
                            ) : null}
                          </div>
                          <p className="mt-1 text-sm leading-6 text-[#c2cadb]">{stage.detail}</p>
                        </div>
                      </li>
                    ))}
                  </ol>
                </article>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function TrustBand() {
  return (
    <section id="features" className="scroll-mt-24 border-y border-white/10 bg-ink-950 py-20 text-white sm:py-28">
      <div className="mx-auto max-w-[88rem] px-4 sm:px-6 lg:px-8">
        <Reveal className="relative min-h-[20rem] overflow-hidden rounded-[1.9rem] border border-white/10 bg-gradient-to-br from-ink-900 via-ink-900 to-ink-950 sm:min-h-[24rem]">
          <div
            aria-hidden
            className="absolute inset-0 opacity-[0.45]"
            style={{
              backgroundImage:
                'linear-gradient(rgba(255,255,255,0.035) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.035) 1px, transparent 1px)',
              backgroundSize: '46px 46px',
            }}
          />
          <div aria-hidden className="pointer-events-none absolute -right-10 top-1/2 h-80 w-80 -translate-y-1/2 rounded-full bg-violet-600/20 blur-[110px]" />
          <div aria-hidden className="pointer-events-none absolute bottom-0 right-40 h-56 w-56 rounded-full bg-signal-500/14 blur-[90px]" />

          {/* Trust Surface line art — single continuous violet→cyan Cane Corso (one-line, transparent).
              Mobile: stacked on top, full and undimmed. Desktop: right-bleed overlay behind the copy. */}
          <div className="flex flex-col sm:contents">
            <div
              aria-hidden
              className="relative mt-6 h-36 w-full px-6 sm:absolute sm:inset-y-0 sm:left-auto sm:right-0 sm:mt-0 sm:h-full sm:w-[64%] sm:px-0"
            >
              <img
                src="/brand/violema-trust-cane-corso.png"
                alt=""
                width={2400}
                height={1101}
                loading="lazy"
                className="h-full w-full object-contain object-center opacity-95 drop-shadow-[0_0_46px_rgba(124,92,255,0.20)] sm:translate-x-[3%] sm:object-right"
              />
            </div>

            <div aria-hidden className="absolute inset-0 hidden bg-gradient-to-r from-ink-950 via-ink-950/85 to-transparent sm:block" />
            <div aria-hidden className="absolute inset-0 hidden bg-gradient-to-t from-ink-950/85 via-ink-950/10 to-transparent sm:block" />

            <div className="relative px-6 pb-6 pt-4 sm:absolute sm:inset-x-0 sm:bottom-0 sm:p-10">
              <p className="text-telemetry text-[0.62rem] text-signal-400">// trust surface</p>
              <h2 className="mt-3 max-w-2xl font-display text-[2.4rem] font-semibold leading-[0.98] tracking-[-0.03em] sm:text-[3.4rem]">
                Trust is a product surface.
              </h2>
              <p className="mt-4 max-w-2xl text-base leading-7 text-[#c2cadb] sm:text-lg">
                The web platform is where teams inspect the work — approvals, audit trail, retry history, policies, and cost before a run becomes a delivered artifact.
              </p>
            </div>
          </div>
        </Reveal>

        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {controls.map((control, index) => {
            const Icon = controlIcons[index % controlIcons.length];
            return (
              <Reveal key={control.title} delay={index * 80}>
                <article className="surface-lift h-full rounded-2xl border border-white/10 bg-ink-900 p-5">
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-violet-500/16 text-violet-100">
                    <Icon className="h-5 w-5" />
                  </span>
                  <h3 className="mt-4 text-base font-semibold tracking-[-0.01em] text-white">{control.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-[#8793ad]">{control.body}</p>
                </article>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function Comparison() {
  const columns = [
    { key: 'violema', label: 'Violema', featured: true },
    { key: 'aiEmployee', label: 'AI employee', featured: false },
    { key: 'automation', label: 'Automation', featured: false },
  ] as const;

  return (
    <section id="compare" className="scroll-mt-24 bg-ink-900 py-20 text-white sm:py-28">
      <div className="mx-auto max-w-[88rem] px-4 sm:px-6 lg:px-8">
        <Reveal className="grid gap-8 lg:grid-cols-[0.7fr_1.3fr] lg:items-end">
          <div>
            <p className="text-telemetry text-[0.62rem] text-signal-400">// positioning</p>
            <h2 className="mt-4 font-display text-[2.6rem] font-semibold leading-[0.98] tracking-[-0.03em] sm:text-[3.5rem]">
              Not a chatbot. Not brittle automation.
            </h2>
            <a
              href="#pricing"
              className="group mt-7 inline-flex min-h-[3rem] items-center justify-center gap-2 rounded-2xl border border-white/12 bg-white/[0.04] px-5 text-sm font-semibold text-white transition duration-200 hover:border-signal-500/40 hover:bg-signal-500/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300"
            >
              Match this to a plan
              <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" />
            </a>
          </div>

          <div className="overflow-hidden rounded-[1.6rem] border border-white/10 bg-ink-950">
            <div className="hidden border-b border-white/10 bg-white/[0.02] sm:grid sm:grid-cols-[0.85fr_1fr_1fr_1fr]">
              <span className="px-4 py-3" />
              {columns.map((column) => (
                <span
                  key={column.key}
                  className={`text-telemetry px-4 py-3 text-[0.55rem] ${
                    column.featured ? 'bg-violet-500/10 text-violet-100' : 'text-[#8793ad]'
                  }`}
                >
                  {column.label}
                </span>
              ))}
            </div>

            {comparisonRows.map((row, rowIndex) => (
              <div
                key={row.label}
                className={`p-4 sm:grid sm:grid-cols-[0.85fr_1fr_1fr_1fr] sm:p-0 ${rowIndex > 0 ? 'border-t border-white/10' : ''}`}
              >
                <span className="block text-sm font-semibold leading-5 text-white sm:px-4 sm:py-4 sm:text-xs">{row.label}</span>
                {columns.map((column) => (
                  <div
                    key={column.key}
                    className={`mt-3 sm:mt-0 sm:px-4 sm:py-4 ${
                      column.featured
                        ? 'rounded-xl border border-violet-300/20 bg-violet-500/[0.08] p-3 sm:rounded-none sm:border-0 sm:bg-violet-500/[0.07] sm:p-0 sm:px-4 sm:py-4'
                        : ''
                    }`}
                  >
                    <span className="text-telemetry mb-1 block text-[0.5rem] text-[#6f7a91] sm:hidden">{column.label}</span>
                    <span className={`text-[0.82rem] leading-5 ${column.featured ? 'text-violet-50' : 'text-[#9aa4ba]'}`}>
                      {row[column.key]}
                    </span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  );
}

export default function Features() {
  return (
    <>
      <RunTheatre />
      <WorkflowGrid />
      <TrustBand />
      <Comparison />
    </>
  );
}
