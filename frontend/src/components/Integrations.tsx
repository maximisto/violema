const INTEGRATIONS = [
  { name: 'Stripe', color: '#635BFF', letter: 'S' },
  { name: 'HubSpot', color: '#FF7A59', letter: 'H' },
  { name: 'GitHub', color: '#6e40c9', letter: 'G' },
  { name: 'Linear', color: '#5E6AD2', letter: 'L' },
  { name: 'Notion', color: '#ffffff', letter: 'N' },
  { name: 'Slack', color: '#4A154B', letter: 'S' },
  { name: 'Salesforce', color: '#00A1E0', letter: 'SF' },
  { name: 'Jira', color: '#0052CC', letter: 'J' },
  { name: 'Figma', color: '#F24E1E', letter: 'F' },
  { name: 'Vercel', color: '#000000', letter: 'V' },
  { name: 'AWS', color: '#FF9900', letter: 'A' },
  { name: 'Postgres', color: '#336791', letter: 'PG' },
];

// Duplicate for seamless loop
const ROW1 = [...INTEGRATIONS, ...INTEGRATIONS];
const ROW2 = [...INTEGRATIONS.slice(6), ...INTEGRATIONS.slice(0, 6), ...INTEGRATIONS.slice(6), ...INTEGRATIONS.slice(0, 6)];

interface IntegrationBadgeProps {
  name: string;
  color: string;
  letter: string;
}

function IntegrationBadge({ name, color, letter }: IntegrationBadgeProps) {
  return (
    <div className="flex items-center gap-2.5 bg-navy-800/80 border border-navy-700/60 rounded-xl px-4 py-3 flex-shrink-0 hover:border-navy-600 transition-colors duration-200 cursor-default">
      <div
        className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0"
        style={{ backgroundColor: color === '#ffffff' ? '#1e293b' : `${color}22`, color }}
      >
        {letter}
      </div>
      <span className="text-slate-300 text-sm font-medium whitespace-nowrap">{name}</span>
    </div>
  );
}

export default function Integrations() {
  return (
    <section className="py-24 relative overflow-hidden">
      {/* Fade edges */}
      <div className="absolute left-0 top-0 bottom-0 w-32 bg-gradient-to-r from-navy-900 to-transparent z-10 pointer-events-none" />
      <div className="absolute right-0 top-0 bottom-0 w-32 bg-gradient-to-l from-navy-900 to-transparent z-10 pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-12 text-center">
        <p className="text-slate-500 text-sm font-medium uppercase tracking-widest mb-2">Works with your entire stack</p>
        <h2 className="text-3xl sm:text-4xl font-bold text-white">
          Plug into{' '}
          <span className="gradient-text">3,000+ integrations</span>
        </h2>
      </div>

      {/* Row 1 — scrolls left */}
      <div className="mb-4 flex gap-3" style={{ animation: 'scrollLeft 40s linear infinite' }}>
        {ROW1.map((item, i) => (
          <IntegrationBadge key={`r1-${i}`} {...item} />
        ))}
      </div>

      {/* Row 2 — scrolls right */}
      <div className="flex gap-3" style={{ animation: 'scrollRight 45s linear infinite' }}>
        {ROW2.map((item, i) => (
          <IntegrationBadge key={`r2-${i}`} {...item} />
        ))}
      </div>

      <style>{`
        @keyframes scrollLeft {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        @keyframes scrollRight {
          0% { transform: translateX(-50%); }
          100% { transform: translateX(0); }
        }
      `}</style>
    </section>
  );
}
