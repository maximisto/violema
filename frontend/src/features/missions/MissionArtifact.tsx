import FileText from 'lucide-react/dist/esm/icons/file-text.js';
import ShieldCheck from 'lucide-react/dist/esm/icons/shield-check.js';
import Sparkles from 'lucide-react/dist/esm/icons/sparkles.js';
import type { MissionArtifactSectionView, MissionWorkspaceView } from './types';

interface MissionArtifactProps {
  mission: MissionWorkspaceView;
  actionSaved?: boolean;
  savedActionLabel?: string;
  onPrimaryAction?: () => void;
}

const sectionToneClasses: Record<MissionArtifactSectionView['tone'], string> = {
  violet: 'border-violet-400/20 bg-violet-400/10 text-violet-100',
  cyan: 'border-cyan-400/20 bg-cyan-400/10 text-cyan-100',
  green: 'border-green-400/20 bg-green-400/10 text-green-100',
  amber: 'border-amber-400/20 bg-amber-400/10 text-amber-100',
  slate: 'border-slate-500/20 bg-slate-500/10 text-slate-200',
};

export function MissionArtifact({ mission, actionSaved = false, savedActionLabel = 'Saved', onPrimaryAction }: MissionArtifactProps) {
  const artifact = mission.artifact;
  const actionLabel = actionSaved ? savedActionLabel : artifact.primaryActionLabel;

  return (
    <section className="space-y-4">
      <div className="overflow-hidden rounded-xl border border-violet-400/20 bg-gradient-to-br from-violet-500/14 via-navy-950/70 to-cyan-500/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
        <div className="border-b border-navy-800/75 bg-navy-950/45 px-4 py-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-start gap-3">
              <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl border border-violet-300/25 bg-violet-300/10 text-violet-100">
                <FileText className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-violet-300/80">
                  Living artifact
                </p>
                <h3 className="mt-1 truncate text-base font-semibold leading-snug text-white" title={artifact.title}>
                  {artifact.title}
                </h3>
                <p className="mt-1 truncate text-[11px] text-slate-500" title={artifact.sourceLabel}>
                  {artifact.kindLabel} · {artifact.sourceLabel}
                </p>
              </div>
            </div>
            <span className="flex-shrink-0 rounded-full border border-cyan-400/25 bg-cyan-400/10 px-2.5 py-1 text-[10px] font-medium text-cyan-100">
              {artifact.statusLabel}
            </span>
          </div>
        </div>

        <div className="px-4 py-4">
          <p className="text-sm leading-6 text-slate-300">{artifact.summary}</p>

          <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-1 2xl:grid-cols-2">
            {artifact.sections.map((section) => (
              <article
                key={section.id}
                className={`rounded-lg border p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.025)] ${sectionToneClasses[section.tone]}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="text-[10px] font-medium text-slate-400">{section.label}</p>
                  <span className="mt-1 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-current opacity-75" />
                </div>
                <p className="mt-2 text-[13px] font-semibold leading-snug text-white">{section.value}</p>
                <p className="mt-1 text-[11px] leading-5 text-slate-500">{section.detail}</p>
              </article>
            ))}
          </div>

          <div className="mt-4 rounded-lg border border-navy-700/70 bg-navy-950/45 p-3">
            <div className="flex items-start gap-3">
              <ShieldCheck className="mt-0.5 h-4 w-4 flex-shrink-0 text-green-300" />
              <div className="min-w-0">
                <p className="text-[12px] font-semibold text-slate-100">Delivery proof</p>
                <p className="mt-1 text-[11px] leading-5 text-slate-500">
                  {mission.reviewSummary}
                </p>
              </div>
            </div>
          </div>

          <div className="mt-4">
            <div className="mb-2 flex items-center gap-2">
              <Sparkles className="h-3.5 w-3.5 text-violet-300" />
              <p className="text-[11px] font-semibold text-slate-200">Active skills and context</p>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {artifact.skills.map((skill) => (
                <span
                  key={skill}
                  className="rounded-full border border-navy-700/80 bg-navy-900/70 px-2.5 py-1 text-[10px] font-medium text-slate-300"
                >
                  {skill}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 rounded-lg border border-navy-700/70 bg-navy-950/40 px-3 py-2.5">
        <div className="min-w-0">
          <p className="text-[10px] font-medium text-slate-500">Last updated</p>
          <p className="mt-0.5 truncate text-[12px] font-semibold text-slate-200">{artifact.lastUpdatedLabel}</p>
        </div>
        <button
          type="button"
          onClick={onPrimaryAction}
          disabled={!onPrimaryAction}
          title={actionSaved ? 'Mission action saved for this artifact.' : undefined}
          className={`flex-shrink-0 rounded-lg border px-3 py-2 text-[11px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 ${
            actionSaved
              ? 'border-green-400/25 bg-green-400/12 text-green-100 hover:border-green-300/40 hover:bg-green-400/16'
              : onPrimaryAction
                ? 'border-violet-400/30 bg-violet-400/14 text-violet-50 hover:border-violet-300/45 hover:bg-violet-400/20'
                : 'cursor-not-allowed border-violet-400/20 bg-violet-400/10 text-violet-100/70 opacity-75'
          }`}
        >
          {actionLabel}
        </button>
      </div>
    </section>
  );
}
