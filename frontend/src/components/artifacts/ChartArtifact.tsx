export type ChartType = 'bar' | 'line' | 'area' | 'pie';

export interface ChartPoint {
  label: string;
  value: number;
  series?: string;
}

export interface ChartArtifactSpec {
  type: ChartType;
  title: string;
  subtitle?: string;
  xLabel?: string;
  yLabel?: string;
  unit?: string;
  insight?: string;
  data: ChartPoint[];
}

const CHART_COLORS = ['#8b5cf6', '#22d3ee', '#f59e0b', '#34d399', '#f472b6', '#a78bfa', '#60a5fa', '#fb7185'];

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function readTrimmedString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function readChartLabel(record: Record<string, unknown>, index: number) {
  return readTrimmedString(record.label) ||
    readTrimmedString(record.x) ||
    readTrimmedString(record.name) ||
    readTrimmedString(record.period) ||
    `Point ${index + 1}`;
}

function readChartValue(record: Record<string, unknown>) {
  const raw = record.value ?? record.y ?? record.amount ?? record.count ?? record.total ?? record.revenue ?? record.credits;
  const value = typeof raw === 'number' ? raw : Number(raw);
  return Number.isFinite(value) ? value : null;
}

function normalizeChartType(value: unknown): ChartType {
  return value === 'line' || value === 'area' || value === 'pie' ? value : 'bar';
}

export function normalizeChartArtifactFromResult(result?: Record<string, unknown> | null): ChartArtifactSpec | null {
  if (!result) return null;
  const chart = isRecord(result.chart) ? result.chart : result;
  if (!isRecord(chart)) return null;

  const rows = Array.isArray(chart.data)
    ? chart.data
        .filter(isRecord)
        .map((row, index): ChartPoint | null => {
          const value = readChartValue(row);
          if (value === null) return null;
          const series = readTrimmedString(row.series);
          return {
            label: readChartLabel(row, index),
            value,
            ...(series ? { series } : {}),
          };
        })
        .filter((row): row is ChartPoint => row !== null)
    : [];

  if (rows.length === 0) return null;

  return {
    type: normalizeChartType(chart.type),
    title: readTrimmedString(chart.title) || 'Generated chart',
    subtitle: readTrimmedString(chart.subtitle),
    xLabel: readTrimmedString(chart.x_label) || readTrimmedString(chart.xLabel),
    yLabel: readTrimmedString(chart.y_label) || readTrimmedString(chart.yLabel),
    unit: readTrimmedString(chart.unit),
    insight: readTrimmedString(chart.insight),
    data: rows.slice(0, 48),
  };
}

function formatChartValue(value: number, unit?: string) {
  const abs = Math.abs(value);
  const compact =
    abs >= 1_000_000 ? `${(value / 1_000_000).toFixed(abs >= 10_000_000 ? 0 : 1)}M`
    : abs >= 1_000 ? `${(value / 1_000).toFixed(abs >= 10_000 ? 0 : 1)}K`
    : Number.isInteger(value) ? String(value)
    : value.toFixed(1);

  if (!unit) return compact;
  if (unit === '$' || unit === '\u20ac' || unit === '\u00a3') return `${unit}${compact}`;
  if (unit === '%') return `${compact}%`;
  return `${compact} ${unit}`;
}

function chartId(title: string, suffix: string) {
  const id = title.replace(/[^a-z0-9]/gi, '').slice(0, 48) || 'chart';
  return `${suffix}-${id}`;
}

export function ChartRenderer({ chart, compact = false }: { chart: ChartArtifactSpec; compact?: boolean }) {
  const data = chart.data.filter((point) => Number.isFinite(point.value)).slice(0, compact ? 12 : 24);
  if (data.length === 0) return null;

  const width = 720;
  const height = compact ? 230 : 320;
  const pad = { top: 28, right: 28, bottom: compact ? 48 : 62, left: 62 };
  const plotWidth = width - pad.left - pad.right;
  const plotHeight = height - pad.top - pad.bottom;
  const maxValue = Math.max(...data.map((point) => point.value), 1);
  const minValue = Math.min(...data.map((point) => point.value), 0);
  const range = Math.max(maxValue - minValue, 1);
  const yFor = (value: number) => pad.top + plotHeight - ((value - minValue) / range) * plotHeight;
  const xFor = (index: number) => pad.left + (data.length === 1 ? plotWidth / 2 : (index / (data.length - 1)) * plotWidth);
  const seriesNames = Array.from(new Set(data.map((point) => point.series).filter(Boolean))) as string[];
  const colorFor = (point: ChartPoint, index: number) => {
    const seriesIndex = point.series ? Math.max(0, seriesNames.indexOf(point.series)) : index;
    return CHART_COLORS[seriesIndex % CHART_COLORS.length];
  };

  if (chart.type === 'pie') {
    const positiveData = data.filter((point) => point.value > 0);
    const total = positiveData.reduce((sum, point) => sum + point.value, 0) || 1;
    let cursor = -90;
    const radius = compact ? 74 : 94;
    const centerX = compact ? 166 : 210;
    const centerY = compact ? 112 : 150;
    const slices = positiveData.map((point, index) => {
      const angle = (point.value / total) * 360;
      const start = cursor;
      const end = cursor + angle;
      cursor = end;
      const largeArc = angle > 180 ? 1 : 0;
      const startRad = (Math.PI / 180) * start;
      const endRad = (Math.PI / 180) * end;
      const x1 = centerX + radius * Math.cos(startRad);
      const y1 = centerY + radius * Math.sin(startRad);
      const x2 = centerX + radius * Math.cos(endRad);
      const y2 = centerY + radius * Math.sin(endRad);
      return {
        point,
        color: CHART_COLORS[index % CHART_COLORS.length],
        d: `M ${centerX} ${centerY} L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2} Z`,
      };
    });

    return (
      <div className="rounded-2xl border border-navy-700/70 bg-gradient-to-br from-navy-950/85 via-navy-950/64 to-cyan-950/18 p-4">
        <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={chart.title} className="h-auto w-full">
          <defs>
            <filter id={chartId(chart.title, 'chart-glow')} x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur stdDeviation="4" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          <circle cx={centerX} cy={centerY} r={radius + 12} fill="rgba(15,23,42,0.72)" stroke="rgba(148,163,184,0.18)" />
          {slices.map((slice, index) => (
            <path key={`${slice.point.label}-${index}`} d={slice.d} fill={slice.color} opacity="0.84" />
          ))}
          <circle cx={centerX} cy={centerY} r={radius * 0.52} fill="#020617" stroke="rgba(148,163,184,0.18)" />
          <text x={centerX} y={centerY - 4} textAnchor="middle" fill="#f8fafc" fontSize="22" fontWeight="700">
            {formatChartValue(total, chart.unit)}
          </text>
          <text x={centerX} y={centerY + 18} textAnchor="middle" fill="#64748b" fontSize="11" fontWeight="600" letterSpacing="2">
            TOTAL
          </text>
          <g transform={`translate(${compact ? 330 : 390}, ${compact ? 42 : 60})`}>
            {positiveData.slice(0, compact ? 5 : 8).map((point, index) => (
              <g key={`${point.label}-${index}`} transform={`translate(0, ${index * 26})`}>
                <circle cx="0" cy="0" r="5" fill={CHART_COLORS[index % CHART_COLORS.length]} />
                <text x="16" y="4" fill="#cbd5e1" fontSize="12" fontWeight="600">{point.label}</text>
                <text x="220" y="4" textAnchor="end" fill="#94a3b8" fontSize="12">{formatChartValue(point.value, chart.unit)}</text>
              </g>
            ))}
          </g>
        </svg>
      </div>
    );
  }

  const linePoints = data.map((point, index) => `${xFor(index)},${yFor(point.value)}`).join(' ');
  const areaPoints = `${pad.left},${pad.top + plotHeight} ${linePoints} ${pad.left + plotWidth},${pad.top + plotHeight}`;
  const gridTicks = Array.from({ length: 4 }, (_, index) => minValue + (range / 3) * index);
  const fillId = chartId(chart.title, 'chart-fill');

  return (
    <div className="rounded-2xl border border-navy-700/70 bg-gradient-to-br from-navy-950/85 via-navy-950/64 to-violet-950/20 p-4">
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={chart.title} className="h-auto w-full">
        <defs>
          <linearGradient id={fillId} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#8b5cf6" stopOpacity="0.36" />
            <stop offset="100%" stopColor="#22d3ee" stopOpacity="0.03" />
          </linearGradient>
        </defs>
        {gridTicks.map((tick, index) => {
          const y = yFor(tick);
          return (
            <g key={tick}>
              <line x1={pad.left} x2={pad.left + plotWidth} y1={y} y2={y} stroke="rgba(148,163,184,0.13)" />
              {!compact && (
                <text x={pad.left - 10} y={y + 4} textAnchor="end" fill="#64748b" fontSize="11">
                  {formatChartValue(tick, chart.unit)}
                </text>
              )}
              {index === 0 && <line x1={pad.left} x2={pad.left + plotWidth} y1={y} y2={y} stroke="rgba(148,163,184,0.28)" />}
            </g>
          );
        })}
        {chart.type === 'bar' ? (
          data.map((point, index) => {
            const gap = Math.max(8, plotWidth / data.length * 0.18);
            const barWidth = Math.max(12, Math.min(48, plotWidth / data.length - gap));
            const x = pad.left + index * (plotWidth / data.length) + gap / 2;
            const y = yFor(point.value);
            const barHeight = pad.top + plotHeight - y;
            return (
              <g key={`${point.label}-${index}`}>
                <rect
                  x={x}
                  y={y}
                  width={barWidth}
                  height={Math.max(2, barHeight)}
                  rx="7"
                  fill={colorFor(point, index)}
                  opacity="0.88"
                />
                {!compact && (
                  <text x={x + barWidth / 2} y={Math.max(pad.top + 14, y - 8)} textAnchor="middle" fill="#cbd5e1" fontSize="11" fontWeight="600">
                    {formatChartValue(point.value, chart.unit)}
                  </text>
                )}
              </g>
            );
          })
        ) : (
          <>
            {chart.type === 'area' && <polygon points={areaPoints} fill={`url(#${fillId})`} />}
            <polyline points={linePoints} fill="none" stroke="#22d3ee" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
            {data.map((point, index) => (
              <circle key={`${point.label}-${index}`} cx={xFor(index)} cy={yFor(point.value)} r={compact ? 4 : 5} fill={colorFor(point, index)} stroke="#020617" strokeWidth="2" />
            ))}
          </>
        )}
        {data.map((point, index) => {
          if (compact && index % Math.ceil(data.length / 4) !== 0) return null;
          const x = chart.type === 'bar'
            ? pad.left + index * (plotWidth / data.length) + (plotWidth / data.length) / 2
            : xFor(index);
          return (
            <text key={`${point.label}-label`} x={x} y={height - 24} textAnchor="middle" fill="#94a3b8" fontSize="11">
              {point.label.length > 12 ? `${point.label.slice(0, 11)}...` : point.label}
            </text>
          );
        })}
        {!compact && chart.xLabel && <text x={pad.left + plotWidth / 2} y={height - 6} textAnchor="middle" fill="#64748b" fontSize="11">{chart.xLabel}</text>}
        {!compact && chart.yLabel && <text x="16" y={pad.top + 8} fill="#64748b" fontSize="11">{chart.yLabel}</text>}
      </svg>
    </div>
  );
}
