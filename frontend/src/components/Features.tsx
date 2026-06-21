import ArrowRight from 'lucide-react/dist/esm/icons/arrow-right.js';
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
import Smartphone from 'lucide-react/dist/esm/icons/smartphone.js';
import UserCheck from 'lucide-react/dist/esm/icons/user-check.js';
import { useState } from 'react';
import {
  comparisonRows,
  controls,
  workflowExamples,
} from '../content/homepage';
import BrandIcon from './BrandIcon';
import Reveal from './Reveal';
import SlackPhone from './SlackPhone';


const controlIcons = [ShieldCheck, FileText, RefreshCcw, Link2];



const CHANNELS = [
  { label: 'Slack', live: true },
  { label: 'Discord', live: false },
  { label: 'Telegram', live: false },
  { label: 'iMessage', live: false },
];

function ChatOps() {
  return (
    <section id="how-it-works" className="scroll-mt-24 border-t border-white/10 bg-ink-950 py-20 text-white sm:py-28">
      <div id="product-demo" className="mx-auto max-w-[88rem] scroll-mt-28 px-4 sm:px-6 lg:px-8">
        <div className="grid gap-x-12 gap-y-12 lg:grid-cols-[0.92fr_1.08fr] lg:items-center">
          <Reveal className="min-w-0">
            <p className="text-telemetry text-[0.62rem] text-signal-400">// chatops</p>
            <h2 className="mt-4 font-display text-[2.6rem] font-semibold leading-[0.98] tracking-[-0.03em] sm:text-[3.4rem]">
              Run your agents from the apps you already live in.
            </h2>
            <p className="mt-5 max-w-xl text-lg leading-8 text-[#aeb7cd]">
              Type a request in Slack — Violema runs the workflow, links every source, waits for your approval, and reports back in thread. No new app to learn.
            </p>

            <div className="mt-8 grid gap-3">
              <div className="flex items-start gap-4 rounded-2xl border border-violet-300/20 bg-violet-500/[0.06] p-4">
                <span className="flex h-11 w-11 flex-none items-center justify-center rounded-xl bg-white/10 text-white">
                  <BrandIcon name="Slack" className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-base font-semibold text-white">Slack — your daily surface</h3>
                    <span className="rounded-full border border-signal-500/30 bg-signal-500/10 px-2 py-0.5 text-[0.5rem] font-bold uppercase tracking-[0.12em] text-signal-300">Live today</span>
                  </div>
                  <p className="mt-1 text-sm leading-6 text-[#8793ad]">Manage and approve your agents in the channels your team already uses. Discord, Telegram, and iMessage coming soon.</p>
                </div>
              </div>

              <div className="flex items-start gap-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <span className="flex h-11 w-11 flex-none items-center justify-center rounded-xl bg-violet-500/16 text-violet-100">
                  <Monitor className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                  <h3 className="text-base font-semibold text-white">Web command center — full control</h3>
                  <p className="mt-1 text-sm leading-6 text-[#8793ad]">Build workflows, inspect evidence, costs, and run history — more power, and more fun to work in.</p>
                </div>
              </div>

              <div className="flex items-start gap-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <span className="flex h-11 w-11 flex-none items-center justify-center rounded-xl bg-white/[0.06] text-[#aeb7cd]">
                  <Smartphone className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-base font-semibold text-white">Mobile app</h3>
                    <span className="rounded-full border border-white/12 bg-white/[0.04] px-2 py-0.5 text-[0.5rem] font-bold uppercase tracking-[0.12em] text-[#8793ad]">Coming soon</span>
                  </div>
                  <p className="mt-1 text-sm leading-6 text-[#8793ad]">Approve and check in on your agents from anywhere.</p>
                </div>
              </div>
            </div>

            <p className="mt-6 flex items-center gap-2 text-sm text-[#8793ad]">
              <Lock className="h-4 w-4 flex-none text-signal-400/90" />
              No new logins · OAuth + audit trail · approvals before anything ships.
            </p>
          </Reveal>

          <Reveal delay={140} className="min-w-0">
            <div className="relative">
              <div aria-hidden className="absolute -inset-x-6 -top-10 -bottom-14 -z-10">
                <div className="absolute right-10 top-2 h-56 w-56 rounded-full bg-violet-600/18 blur-[90px]" />
                <div className="absolute -bottom-4 left-6 h-52 w-52 rounded-full bg-signal-500/12 blur-[90px]" />
              </div>

              <div className="mb-6 flex flex-wrap items-center justify-center gap-2">
                {CHANNELS.map((channel) => (
                  <span
                    key={channel.label}
                    className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold ${
                      channel.live
                        ? 'border-violet-300/40 bg-violet-500/15 text-white'
                        : 'border-white/10 bg-white/[0.03] text-[#8793ad]'
                    }`}
                  >
                    {channel.label}
                    {channel.live ? (
                      <span className="relative flex h-1.5 w-1.5 items-center justify-center">
                        <span className="live-dot absolute inset-0 rounded-full" />
                        <span className="relative h-1.5 w-1.5 rounded-full bg-signal-400" />
                      </span>
                    ) : (
                      <span className="text-[0.5rem] uppercase tracking-[0.1em] text-[#6f7a91]">soon</span>
                    )}
                  </span>
                ))}
              </div>

              <SlackPhone className="mx-auto" />
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
      <ChatOps />
      <WorkflowGrid />
      <TrustBand />
      <Comparison />
    </>
  );
}
