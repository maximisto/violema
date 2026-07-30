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

/** Couture accents per category: the top seam, the collection numeral, and the
 * hover aura each carry the mission family's signature color. */
const CATEGORY_ACCENT: Record<string, { seam: string; numeral: string; aura: string }> = {
  'Operating cadence': {
    seam: 'from-violet-400 via-violet-400/70 to-transparent',
    numeral: 'text-violet-300/55',
    aura: 'hover:border-violet-400/45 hover:shadow-[0_22px_48px_-20px_rgba(124,58,237,0.42)]',
  },
  'Revenue & risk': {
    seam: 'from-emerald-400 via-emerald-400/70 to-transparent',
    numeral: 'text-emerald-300/55',
    aura: 'hover:border-emerald-400/45 hover:shadow-[0_22px_48px_-20px_rgba(16,185,129,0.38)]',
  },
  'Market intelligence': {
    seam: 'from-cyan-400 via-cyan-400/70 to-transparent',
    numeral: 'text-cyan-300/55',
    aura: 'hover:border-cyan-400/45 hover:shadow-[0_22px_48px_-20px_rgba(34,211,238,0.38)]',
  },
  'Customer & growth': {
    seam: 'from-amber-400 via-amber-400/70 to-transparent',
    numeral: 'text-amber-300/55',
    aura: 'hover:border-amber-400/45 hover:shadow-[0_22px_48px_-20px_rgba(245,158,11,0.36)]',
  },
  Relationships: {
    seam: 'from-sky-400 via-sky-400/70 to-transparent',
    numeral: 'text-sky-300/55',
    aura: 'hover:border-sky-400/45 hover:shadow-[0_22px_48px_-20px_rgba(56,189,248,0.38)]',
  },
};

const DEFAULT_ACCENT = {
  seam: 'from-violet-400 via-violet-400/70 to-transparent',
  numeral: 'text-violet-300/55',
  aura: 'hover:border-violet-400/45 hover:shadow-[0_22px_48px_-20px_rgba(124,58,237,0.42)]',
};

export function WorkflowTemplateGallery({ templates, onUse, className }: WorkflowTemplateGalleryProps) {
  if (templates.length === 0) return null;

  return (
    <section
      aria-labelledby="workflow-template-gallery-heading"
      className={`relative overflow-hidden rounded-2xl border border-violet-500/20 bg-navy-900/48 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] sm:p-6 ${className ?? ''}`}
    >
      {/* the chamber: a quiet stage that sets the collection apart */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_8%_0%,rgba(139,92,246,0.10),transparent_38%),radial-gradient(circle_at_96%_100%,rgba(245,158,11,0.05),transparent_30%)]"
      />

      <header className="relative flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.26em] text-violet-300/90">Mission collection</p>
          <h2
            id="workflow-template-gallery-heading"
            className="mt-1.5 font-display text-xl font-semibold tracking-[-0.02em] text-white sm:text-2xl"
          >
            Start from a proven operating loop
          </h2>
          <p className="mt-1.5 max-w-2xl text-sm leading-6 text-slate-400">
            Six missions, built by an operator. Run one as-is, or open it and reshape any step — the
            output is entirely yours, and you approve before anything sensitive ships.
          </p>
        </div>
        <Layers3 className="hidden h-5 w-5 flex-shrink-0 text-violet-300/80 sm:block" aria-hidden="true" />
      </header>

      <div className="relative mt-5 grid gap-3.5 sm:grid-cols-2 xl:grid-cols-3">
        {templates.map((template, index) => {
          const toneClass = CATEGORY_TONE[template.category] ?? 'border-white/15 bg-white/5 text-slate-200';
          const accent = CATEGORY_ACCENT[template.category] ?? DEFAULT_ACCENT;
          const numeral = String(index + 1).padStart(2, '0');
          return (
            <article
              key={template.id}
              className={`group relative flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-navy-950/45 transition-all duration-200 hover:-translate-y-0.5 ${accent.aura}`}
            >
              {/* signature seam */}
              <span aria-hidden className={`h-[2.5px] w-full bg-gradient-to-r ${accent.seam}`} />

              <div className="flex flex-1 flex-col p-4">
                <span
                  aria-hidden
                  className={`pointer-events-none absolute right-3.5 top-2.5 font-display text-[1.7rem] font-semibold leading-none tracking-tight ${accent.numeral}`}
                >
                  {numeral}
                </span>

                <span className={`inline-flex w-fit items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${toneClass}`}>
                  {template.category}
                </span>

                <h3 className="mt-3 pr-10 text-[15px] font-semibold tracking-[-0.01em] text-white">{template.title}</h3>
                <p className="mt-1.5 text-[12.5px] leading-5 text-slate-300">{template.outcome}</p>

                {template.integrations.length > 0 ? (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {template.integrations.map((integration) => (
                      <span
                        key={integration}
                        className="rounded-md border border-white/10 bg-white/5 px-1.5 py-0.5 text-[10px] font-medium text-slate-400"
                      >
                        {integration}
                      </span>
                    ))}
                  </div>
                ) : null}

                <div className="mt-auto flex items-center justify-between gap-2 border-t border-white/5 pt-3">
                  <span className="inline-flex items-center gap-2.5 text-[10px] font-medium text-slate-500">
                    <span className="inline-flex items-center gap-1">
                      <Clock className="h-3 w-3" aria-hidden="true" />
                      {template.cadence}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Layers3 className="h-3 w-3" aria-hidden="true" />
                      {template.steps.length} steps
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={() => onUse(template.id)}
                    aria-label={`Start the ${template.title} mission`}
                    className="inline-flex items-center gap-1 rounded-lg border border-violet-400/30 bg-violet-500/10 px-2.5 py-1 text-[11px] font-semibold text-violet-100 transition-all group-hover:border-violet-300/50 group-hover:bg-violet-500/20 hover:gap-1.5"
                  >
                    Start mission
                    <ArrowRight className="h-3 w-3" aria-hidden="true" />
                  </button>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

export default WorkflowTemplateGallery;
