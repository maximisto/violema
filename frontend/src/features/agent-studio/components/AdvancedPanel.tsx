import type { ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';

interface AdvancedPanelProps {
  eyebrow: string;
  title: string;
  body: string;
  open: boolean;
  onToggle: () => void;
  openLabel: string;
  closeLabel: string;
  children: ReactNode;
}

export function AdvancedPanel({
  eyebrow,
  title,
  body,
  open,
  onToggle,
  openLabel,
  closeLabel,
  children,
}: AdvancedPanelProps) {
  return (
    <div className="rounded-[1.8rem] border border-white/6 bg-white/[0.03] p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="max-w-3xl">
          <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">{eyebrow}</p>
          <h3 className="mt-1 text-sm font-semibold text-white">{title}</h3>
          <p className="mt-2 text-sm leading-relaxed text-slate-400">{body}</p>
        </div>
        <button
          type="button"
          onClick={onToggle}
          className={`ui-pill inline-flex items-center gap-2 px-3 py-1.5 text-[11px] normal-case tracking-normal ${
            open ? 'border-violet-500/30 bg-violet-500/12 text-violet-200' : 'text-slate-300'
          }`}
        >
          <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? 'rotate-180' : ''}`} />
          {open ? closeLabel : openLabel}
        </button>
      </div>
      {open ? <div className="mt-5 space-y-6">{children}</div> : null}
    </div>
  );
}
