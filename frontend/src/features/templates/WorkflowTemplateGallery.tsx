import { ArrowRight, Clock, Layers3 } from 'lucide-react';
import type { WorkflowTemplateDefinition } from '../../content/workflowTemplates';

interface WorkflowTemplateGalleryProps {
  templates: WorkflowTemplateDefinition[];
  onUse: (id: string) => void;
  className?: string;
}

const CATEGORY_TONE: Record<string, string> = {
  'Operating cadence': 'border-violet-300/25 bg-violet-300/10 text-violet-100',
  'Revenue & risk': 'border-emerald-300/25 bg-emerald-300/10 text-emerald-100',
  'Market intelligence': 'border-cyan-300/25 bg-cyan-300/10 text-cyan-100',
  'Customer & growth': 'border-amber-300/25 bg-amber-300/10 text-amber-100',
  Relationships: 'border-sky-300/25 bg-sky-300/10 text-sky-100',
};

export function WorkflowTemplateGallery({ templates, onUse, className }: WorkflowTemplateGalleryProps) {
  if (templates.length === 0) return null;

  return (
    <section
      aria-labelledby="workflow-template-gallery-heading"
      className={`rounded-2xl border border-navy-800/80 bg-navy-900/48 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] sm:p-5 ${className ?? ''}`}
    >
      <header className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-cyan-300/85">Templates</p>
          <h2
            id="workflow-template-gallery-heading"
            className="mt-1 text-lg font-semibold tracking-[-0.02em] text-white sm:text-xl"
          >
            Start from a proven operating loop
          </h2>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-400">
            Pick a founder workflow, review the prefilled steps, and schedule it. You approve before anything
            sensitive ships.
          </p>
        </div>
        <Layers3 className="hidden h-5 w-5 flex-shrink-0 text-cyan-200/80 sm:block" aria-hidden="true" />
      </header>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {templates.map((template) => {
          const toneClass = CATEGORY_TONE[template.category] ?? 'border-white/15 bg-white/5 text-slate-200';
          return (
            <article
              key={template.id}
              className="flex flex-col rounded-xl border border-white/10 bg-navy-950/45 p-4 transition-colors hover:border-cyan-400/35 hover:bg-cyan-500/[0.06]"
            >
              <div className="flex items-center justify-between gap-2">
                <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${toneClass}`}>
                  {template.category}
                </span>
                <span className="inline-flex items-center gap-1 text-[10px] font-medium text-slate-500">
                  <Layers3 className="h-3 w-3" aria-hidden="true" />
                  {template.steps.length} steps
                </span>
              </div>

              <h3 className="mt-3 text-sm font-semibold text-white">{template.title}</h3>
              <p className="mt-1 text-[12px] leading-5 text-slate-400">{template.outcome}</p>

              {template.integrations.length > 0 ? (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {template.integrations.map((integration) => (
                    <span
                      key={integration}
                      className="rounded-md border border-white/10 bg-white/5 px-1.5 py-0.5 text-[10px] font-medium text-slate-300"
                    >
                      {integration}
                    </span>
                  ))}
                </div>
              ) : null}

              <div className="mt-4 flex items-center justify-between gap-2 border-t border-white/5 pt-3">
                <span className="inline-flex items-center gap-1 text-[10px] font-medium text-cyan-200/80">
                  <Clock className="h-3 w-3" aria-hidden="true" />
                  {template.cadence}
                </span>
                <button
                  type="button"
                  onClick={() => onUse(template.id)}
                  aria-label={`Use the ${template.title} template`}
                  className="inline-flex items-center gap-1 rounded-lg border border-cyan-400/30 bg-cyan-500/10 px-2.5 py-1 text-[11px] font-semibold text-cyan-100 transition-colors hover:border-cyan-300/50 hover:bg-cyan-500/20"
                >
                  Use template
                  <ArrowRight className="h-3 w-3" aria-hidden="true" />
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

export default WorkflowTemplateGallery;
