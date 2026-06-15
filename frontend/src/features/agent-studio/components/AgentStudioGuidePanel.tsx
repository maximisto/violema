import ArrowRight from 'lucide-react/dist/esm/icons/arrow-right.js';
import BookOpen from 'lucide-react/dist/esm/icons/book-open.js';
import LineChart from 'lucide-react/dist/esm/icons/line-chart.js';
import Target from 'lucide-react/dist/esm/icons/target.js';
import Workflow from 'lucide-react/dist/esm/icons/workflow.js';

interface AgentStudioGuidePanelProps {
  onDismiss: () => void;
  onOpenDashboard: () => void;
  onEditWorkflow: () => void;
}

export function AgentStudioGuidePanel({
  onDismiss,
  onOpenDashboard,
  onEditWorkflow,
}: AgentStudioGuidePanelProps) {
  return (
    <div className="rounded-[1.8rem] border border-violet-500/16 bg-gradient-to-br from-violet-500/10 via-navy-900/76 to-navy-950/92 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="max-w-2xl">
          <div className="flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-violet-200" />
            <div>
              <p className="text-[10px] uppercase tracking-[0.18em] text-violet-200/80">How to use Studio</p>
              <h3 className="text-sm font-semibold text-white">Operate the workflow. Do not author it here.</h3>
            </div>
          </div>
          <p className="mt-2 text-sm leading-relaxed text-slate-400">
            Dashboard is where you create and schedule workflows. Agent Studio is where you inspect the multi-agent system
            behind a workflow, understand what changed, and decide what should ship next.
          </p>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          className="ui-pill px-3 py-1.5 text-[11px] normal-case tracking-normal text-slate-300"
        >
          Hide guide
        </button>
      </div>

      <div className="mt-4 grid gap-3 xl:grid-cols-3">
        {[
          {
            title: '1. Live',
            subtitle: 'Operate the current system',
            body: 'Read the system map, then use the operator brief to focus on the one worker, phase, or run that actually matters.',
            icon: Workflow,
            tone: 'text-cyan-200',
          },
          {
            title: '2. Replay',
            subtitle: 'Explain the last run',
            body: 'Use Replay to understand what changed outcome, what drifted from healthy state, and which fix is worth testing next.',
            icon: LineChart,
            tone: 'text-emerald-200',
          },
          {
            title: '3. Optimize',
            subtitle: 'Test and release changes',
            body: 'Compare a candidate against the live posture under a realistic scenario, then apply only when the evidence holds up.',
            icon: Target,
            tone: 'text-violet-200',
          },
        ].map((item) => {
          const Icon = item.icon;
          return (
            <div key={item.title} className="rounded-[1.35rem] border border-white/6 bg-white/[0.03] p-4">
              <div className="flex items-center gap-2">
                <Icon className={`h-4 w-4 ${item.tone}`} />
                <div>
                  <p className="text-sm font-medium text-white">{item.title}</p>
                  <p className="mt-1 text-[11px] uppercase tracking-[0.16em] text-slate-500">{item.subtitle}</p>
                </div>
              </div>
              <p className="mt-3 text-sm leading-relaxed text-slate-400">{item.body}</p>
            </div>
          );
        })}
      </div>

      <div className="mt-4 grid gap-3 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <div className="rounded-[1.35rem] border border-white/6 bg-white/[0.03] p-4">
          <p className="text-[10px] uppercase tracking-[0.16em] text-slate-500">Boundary</p>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <div className="rounded-xl border border-white/6 bg-white/[0.02] p-3">
              <p className="text-sm font-medium text-white">Use Dashboard for</p>
              <ul className="mt-2 space-y-1 text-[12px] leading-relaxed text-slate-400">
                <li>Create a workflow</li>
                <li>Edit workflow steps</li>
                <li>Change the schedule</li>
              </ul>
            </div>
            <div className="rounded-xl border border-violet-500/14 bg-violet-500/6 p-3">
              <p className="text-sm font-medium text-white">Use Studio for</p>
              <ul className="mt-2 space-y-1 text-[12px] leading-relaxed text-slate-300">
                <li>Inspect runs and worker behavior</li>
                <li>Understand cost, drift, and failure patterns</li>
                <li>Test and release better operating policies</li>
              </ul>
            </div>
          </div>
        </div>

        <div className="rounded-[1.35rem] border border-white/6 bg-white/[0.03] p-4">
          <p className="text-[10px] uppercase tracking-[0.16em] text-slate-500">Best next move</p>
          <p className="mt-2 text-sm leading-relaxed text-slate-300">
            If the workflow definition is wrong, go back to Dashboard. If the workflow is fine but the system around it needs tuning,
            stay in Studio and follow the control loop.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onEditWorkflow}
              className="rounded-xl border border-violet-500/24 bg-violet-500/10 px-4 py-2 text-sm font-medium text-violet-100 transition-colors hover:bg-violet-500/14"
            >
              Edit workflow
            </button>
            <button
              type="button"
              onClick={onOpenDashboard}
              className="ui-pill flex items-center gap-1 px-3 py-1.5 text-[11px] normal-case tracking-normal text-slate-300"
            >
              Open dashboard
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
