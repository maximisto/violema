import type { MissionIntegrationView } from './types';
import BrandIcon from '../../components/BrandIcon';

interface MissionIntegrationsStripProps {
  integrations: MissionIntegrationView[];
}

export function MissionIntegrationsStrip({ integrations }: MissionIntegrationsStripProps) {
  if (integrations.length === 0) return null;

  return (
    <section className="rounded-lg border border-navy-700/70 bg-navy-950/40 p-3">
      <p className="mb-2 text-[10px] font-medium text-slate-500">Available integrations</p>
      <div className="flex flex-wrap gap-2">
        {integrations.map((integration) => (
          <div
            key={integration.id}
            title={integration.category}
            className="inline-flex max-w-full items-center gap-2 rounded-full border border-navy-700/70 bg-navy-900/50 py-1 pl-1 pr-2.5"
          >
            <span
              className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-slate-100"
            >
              <BrandIcon name={integration.label} className="h-3.5 w-3.5" />
            </span>
            <span className="min-w-0 truncate text-[11px] font-medium text-slate-200">
              {integration.label}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
