interface RollingChartProps {
  label: string;
  data: number[];
  color: string;
  max?: number;
  unit?: string;
}

/** Lightweight SVG sparkline of the last N telemetry samples. */
export function RollingChart({ label, data, color, max, unit }: RollingChartProps) {
  const W = 120;
  const H = 40;
  const peak = max ?? Math.max(1, ...data);
  const n = data.length;

  let path = '';
  for (let i = 0; i < n; i += 1) {
    const x = n > 1 ? (i / (n - 1)) * W : 0;
    const y = H - Math.min(1, Math.max(0, data[i] / peak)) * H;
    path += `${i === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)} `;
  }

  const last = n > 0 ? data[n - 1] : 0;

  return (
    <div className="rounded-lg border border-cockpit-edge bg-cockpit-panel p-2">
      <div className="flex justify-between text-[10px] font-semibold uppercase tracking-wide text-slate-500">
        <span>{label}</span>
        <span className="font-mono text-slate-300">
          {last.toFixed(0)}
          {unit ?? ''}
        </span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="mt-1 h-12 w-full">
        {n > 1 && (
          <path
            d={path}
            fill="none"
            stroke={color}
            strokeWidth={1.5}
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
        )}
      </svg>
    </div>
  );
}
