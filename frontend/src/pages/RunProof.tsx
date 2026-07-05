import { Link, useParams } from 'react-router-dom';
import ArrowRight from 'lucide-react/dist/esm/icons/arrow-right.js';
import Check from 'lucide-react/dist/esm/icons/check.js';
import Clock3 from 'lucide-react/dist/esm/icons/clock-3.js';
import DollarSign from 'lucide-react/dist/esm/icons/dollar-sign.js';
import Link2 from 'lucide-react/dist/esm/icons/link-2.js';
import ShieldCheck from 'lucide-react/dist/esm/icons/shield-check.js';
import PublicHeader from '../components/PublicHeader';
import {
  SAMPLE_RUNS,
  formatSampleUsd,
  getCreditValueUsd,
  getMonthlyCredits,
  getSampleRunById,
  getSampleRunPath,
} from '../content/sampleRuns';
import { formatCredits } from '../lib/credits';
import { useTheme } from '../lib/useTheme';

function MetricCard({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="rounded-2xl border border-navy-700/70 bg-navy-950/45 px-4 py-3">
      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-600">{label}</p>
      <p className="mt-2 text-xl font-semibold text-white">{value}</p>
      <p className="mt-1 text-xs leading-5 text-slate-500">{detail}</p>
    </div>
  );
}

function RunNotFound() {
  const { scopeClass } = useTheme();

  return (
    <div className={`min-h-screen bg-hero-gradient ${scopeClass}`}>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(168,85,247,0.12),transparent_35%),radial-gradient(circle_at_bottom_right,rgba(34,211,238,0.06),transparent_28%)]" />
      <PublicHeader backHref="/pricing" backLabel="Pricing" actionHref="/signup?next=%2Fdashboard" actionLabel="Start free" />
      <main className="relative mx-auto flex min-h-[calc(100dvh-4.85rem)] max-w-3xl items-center px-4 py-12 sm:px-6 lg:px-8">
        <div className="rounded-[1.9rem] border border-navy-700/70 bg-navy-900/50 p-6 sm:p-8">
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-600">Run not found</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-[-0.02em] text-white">This proof run is not available.</h1>
          <p className="mt-3 text-sm leading-6 text-slate-400">
            The public sample run may have moved. Pricing still shows the current Start, Pro, and Enterprise proof set.
          </p>
          <Link
            to="/pricing"
            className="mt-6 inline-flex items-center gap-2 rounded-2xl bg-violet-600 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-violet-500"
          >
            Back to pricing
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </main>
    </div>
  );
}

export default function RunProof() {
  const { runId } = useParams();
  const run = getSampleRunById(runId);
  const { scopeClass } = useTheme();

  if (!run) return <RunNotFound />;

  const monthlyCredits = getMonthlyCredits(run);
  const creditValueUsd = getCreditValueUsd(run);
  const relatedRuns = SAMPLE_RUNS.filter((item) => item.id !== run.id);

  return (
    <div className={`min-h-screen bg-hero-gradient ${scopeClass}`}>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(168,85,247,0.12),transparent_35%),radial-gradient(circle_at_bottom_right,rgba(34,211,238,0.06),transparent_28%)]" />
      <PublicHeader backHref="/pricing" backLabel="Pricing" actionHref="/signup?next=%2Fdashboard" actionLabel="Start free" />

      <main className="relative mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <section className="rounded-[2rem] border border-navy-700/70 bg-navy-950/42 p-5 shadow-[0_24px_80px_rgba(3,8,24,0.32)] sm:p-7 lg:p-8">
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1.35fr)_24rem] lg:items-start">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-violet-500/20 bg-violet-500/10 px-4 py-1.5 text-sm font-medium text-violet-300">
                <ShieldCheck className="h-3.5 w-3.5" />
                Public sample run
              </div>
              <h1 className="mt-5 max-w-4xl text-4xl font-extrabold leading-[0.95] text-white sm:text-5xl lg:text-[4rem]">
                {run.title}
              </h1>
              <p className="mt-4 max-w-3xl text-base leading-7 text-slate-400 sm:text-lg">
                {run.summary}
              </p>
              <div className="mt-5 flex flex-wrap gap-2">
                {run.sources.map((source) => (
                  <span key={source} className="rounded-full border border-cyan-500/20 bg-cyan-500/8 px-3 py-1 text-xs font-medium text-cyan-100">
                    {source}
                  </span>
                ))}
              </div>
            </div>

            <aside className="rounded-[1.7rem] border border-violet-500/20 bg-violet-500/8 p-5">
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-violet-200/80">Buyer takeaway</p>
              <p className="mt-3 text-lg font-semibold leading-snug text-white">{run.buyerTakeaway}</p>
              <div className="mt-5 rounded-2xl border border-white/8 bg-navy-950/45 px-4 py-3">
                <p className="text-sm text-slate-400">Recommended path</p>
                <p className="mt-1 text-xl font-semibold text-white">{run.recommendedPlan}</p>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
                <Link
                  to="/pricing"
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-violet-600 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-violet-500"
                >
                  View pricing
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  to="/signup?next=%2Fdashboard"
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/12 bg-white/[0.04] px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-white/[0.07]"
                >
                  Start free preview
                </Link>
              </div>
            </aside>
          </div>
        </section>

        <section className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard label="Per run" value={`${formatCredits(run.runCredits)} cr`} detail="Credits held and settled for this sample workflow." />
          <MetricCard label="Monthly pressure" value={`${formatCredits(monthlyCredits)} cr`} detail={`${run.monthlyRuns} runs at ${run.cadence.toLowerCase()} cadence.`} />
          <MetricCard label="Provider cost" value={formatSampleUsd(run.providerCostUsd)} detail="Estimated model and tool provider cost for one run." />
          <MetricCard label="Credit value" value={formatSampleUsd(creditValueUsd)} detail="Start-plan value of the credits consumed by one run." />
        </section>

        <section className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
          <div className="rounded-[1.9rem] border border-navy-700/70 bg-navy-900/45 p-5 sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-600">Run ledger</p>
                <h2 className="mt-2 text-2xl font-semibold tracking-[-0.02em] text-white">What happened in the run</h2>
              </div>
              <span className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-sm font-semibold text-emerald-100">
                {run.approvalState}
              </span>
            </div>

            <div className="mt-5 grid gap-3">
              {run.steps.map((step) => (
                <article key={step.title} className="rounded-2xl border border-navy-700/70 bg-navy-950/45 p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <h3 className="text-base font-semibold text-white">{step.title}</h3>
                      <p className="mt-2 text-sm leading-6 text-slate-400">{step.detail}</p>
                    </div>
                    <span className="rounded-xl border border-amber-500/20 bg-amber-500/8 px-3 py-1.5 text-sm font-semibold text-amber-100">
                      {formatCredits(step.credits)} cr
                    </span>
                  </div>
                </article>
              ))}
            </div>

            <div className="mt-5 rounded-2xl border border-cyan-500/20 bg-cyan-500/8 px-4 py-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-100/80">Deliverable</p>
              <p className="mt-2 text-sm leading-6 text-slate-200">{run.deliverable}</p>
            </div>
          </div>

          <div className="grid gap-6">
            <section className="rounded-[1.9rem] border border-navy-700/70 bg-navy-900/45 p-5 sm:p-6">
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-600">Evidence trail</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-[-0.02em] text-white">Sources and approvals stay attached.</h2>
              <div className="mt-5 grid gap-3">
                {run.ledger.map((event) => (
                  <div key={event} className="flex items-start gap-3 rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3">
                    <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-violet-300" />
                    <span className="text-sm leading-6 text-slate-300">{event}</span>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-[1.9rem] border border-navy-700/70 bg-navy-900/45 p-5 sm:p-6">
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-600">Cost model</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-[-0.02em] text-white">Run economics stay visible.</h2>
              <div className="mt-5 grid gap-3">
                <div className="flex items-start gap-3 rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3">
                  <Clock3 className="mt-0.5 h-4 w-4 flex-shrink-0 text-cyan-200" />
                  <p className="text-sm leading-6 text-slate-300">{run.cadence} cadence means about {formatCredits(monthlyCredits)} credits per month.</p>
                </div>
                <div className="flex items-start gap-3 rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3">
                  <DollarSign className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-200" />
                  <p className="text-sm leading-6 text-slate-300">One run uses about {formatSampleUsd(creditValueUsd)} in Start-plan credit value.</p>
                </div>
                <div className="flex items-start gap-3 rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3">
                  <Link2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-violet-200" />
                  <p className="text-sm leading-6 text-slate-300">Live workspace Run pages can replace this sample once real customer records are ready to share.</p>
                </div>
              </div>
            </section>
          </div>
        </section>

        <section className="mt-6 rounded-[1.9rem] border border-navy-700/70 bg-navy-900/45 p-5 sm:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-600">Related proof</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-[-0.02em] text-white">Compare the other plan samples.</h2>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              {relatedRuns.map((item) => (
                <Link
                  key={item.id}
                  to={getSampleRunPath(item.id)}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/12 bg-white/[0.04] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:border-violet-500/35 hover:bg-violet-500/10"
                >
                  {item.planLabel}
                  <ArrowRight className="h-4 w-4" />
                </Link>
              ))}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
