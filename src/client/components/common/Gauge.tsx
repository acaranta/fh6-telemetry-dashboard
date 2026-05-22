const START_ANGLE = -135;
const END_ANGLE = 135;
const SWEEP = END_ANGLE - START_ANGLE;

interface Point {
  x: number;
  y: number;
}

function polar(cx: number, cy: number, r: number, deg: number): Point {
  const a = ((deg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
}

function arcPath(cx: number, cy: number, r: number, a0: number, a1: number): string {
  if (a1 <= a0) return '';
  const start = polar(cx, cy, r, a1);
  const end = polar(cx, cy, r, a0);
  const large = a1 - a0 <= 180 ? 0 : 1;
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${large} 0 ${end.x} ${end.y}`;
}

interface GaugeProps {
  value: number;
  max: number;
  min?: number;
  label: string;
  unit?: string;
  redlineFrom?: number;
  size?: number;
  decimals?: number;
}

/** Reusable 270° SVG arc gauge with an optional redline zone. */
export function Gauge({
  value,
  max,
  min = 0,
  label,
  unit,
  redlineFrom,
  size = 240,
  decimals = 0,
}: GaugeProps) {
  const cx = size / 2;
  const cy = size / 2;
  const stroke = size * 0.075;
  const r = size / 2 - stroke;
  const range = max - min || 1;
  const frac = Math.min(1, Math.max(0, (value - min) / range));
  const valueAngle = START_ANGLE + frac * SWEEP;
  const onRedline = redlineFrom !== undefined && value >= redlineFrom;
  const color = onRedline ? '#ef4444' : '#ff6b1a';

  const redlineAngle =
    redlineFrom !== undefined
      ? START_ANGLE + Math.min(1, Math.max(0, (redlineFrom - min) / range)) * SWEEP
      : null;

  const ticks: Point[][] = [];
  const TICK_COUNT = 8;
  for (let i = 0; i <= TICK_COUNT; i += 1) {
    const a = START_ANGLE + (i / TICK_COUNT) * SWEEP;
    ticks.push([polar(cx, cy, r - stroke * 0.55, a), polar(cx, cy, r + stroke * 0.55, a)]);
  }
  const tip = polar(cx, cy, r, valueAngle);

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <path
        d={arcPath(cx, cy, r, START_ANGLE, END_ANGLE)}
        fill="none"
        stroke="#1c2330"
        strokeWidth={stroke}
        strokeLinecap="round"
      />
      {redlineAngle !== null && (
        <path
          d={arcPath(cx, cy, r, redlineAngle, END_ANGLE)}
          fill="none"
          stroke="#7f1d1d"
          strokeWidth={stroke}
          strokeLinecap="round"
        />
      )}
      <path
        d={arcPath(cx, cy, r, START_ANGLE, valueAngle)}
        fill="none"
        stroke={color}
        strokeWidth={stroke}
        strokeLinecap="round"
      />
      {ticks.map(([p1, p2], i) => (
        <line key={i} x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke="#3a4453" strokeWidth={2} />
      ))}
      {frac > 0 && <circle cx={tip.x} cy={tip.y} r={stroke * 0.55} fill={color} />}
      <text
        x={cx}
        y={cy + size * 0.06}
        textAnchor="middle"
        fill="#f3f4f6"
        fontSize={size * 0.22}
        fontWeight={700}
        style={{ fontVariantNumeric: 'tabular-nums' }}
      >
        {value.toFixed(decimals)}
      </text>
      {unit && (
        <text x={cx} y={cy + size * 0.17} textAnchor="middle" fill="#8b97a8" fontSize={size * 0.07}>
          {unit}
        </text>
      )}
      <text
        x={cx}
        y={cy - size * 0.2}
        textAnchor="middle"
        fill="#8b97a8"
        fontSize={size * 0.075}
        fontWeight={600}
        letterSpacing={2}
      >
        {label.toUpperCase()}
      </text>
    </svg>
  );
}
