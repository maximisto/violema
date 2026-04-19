import type { ReactNode } from 'react';

interface RoomSectionProps {
  eyebrow: string;
  title: string;
  body: string;
  items: string[];
  children?: ReactNode;
}

export function RoomSection({ eyebrow, title, body, items, children }: RoomSectionProps) {
  return (
    <div className="rounded-[1.6rem] border border-white/6 bg-white/[0.03] p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="max-w-3xl">
          <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">{eyebrow}</p>
          <p className="mt-1 text-sm font-semibold text-white">{title}</p>
          <p className="mt-2 text-sm leading-relaxed text-slate-400">{body}</p>
        </div>
        {children ? <div className="flex items-center gap-2">{children}</div> : null}
      </div>
      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        {items.map((item) => (
          <div key={item} className="rounded-xl border border-navy-700/70 bg-navy-950/45 px-3 py-3 text-sm leading-relaxed text-slate-300">
            {item}
          </div>
        ))}
      </div>
    </div>
  );
}
