export function DimaSidebarNote() {
  return (
    <div className="hidden px-3 pb-3 sm:block" aria-hidden="true">
      <div className="relative h-16 overflow-hidden">
        <div className="absolute inset-y-2 left-0 right-0 bg-gradient-to-r from-transparent via-slate-900/42 to-transparent" />
        <div className="absolute left-10 right-10 top-1/2 h-px -translate-y-1/2 bg-gradient-to-r from-cyan-200/16 via-slate-500/14 to-violet-200/16" />
        <span className="absolute left-6 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full border border-cyan-200/13 bg-navy-950/58 font-serif text-[12px] text-cyan-100/48 shadow-[0_0_18px_rgba(103,232,249,0.04)]">
          Σ
        </span>
        <span className="absolute right-6 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full border border-violet-200/14 bg-navy-950/58 font-serif text-[12px] text-violet-100/52 shadow-[0_0_18px_rgba(167,139,250,0.05)]">
          Ω
        </span>
        <img
          src="/brand/violema-trust-cane-corso.png"
          alt=""
          aria-hidden="true"
          className="dima-sidebar-mark pointer-events-none absolute left-1/2 top-1/2 h-16 w-[13.25rem] max-w-none -translate-x-1/2 -translate-y-1/2 object-contain object-center opacity-44"
          draggable={false}
        />
      </div>
    </div>
  );
}
