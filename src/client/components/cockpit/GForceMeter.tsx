import { useTelemetryStore } from '../../state/telemetryStore';
import { Panel } from '../common/Panel';

const GRAVITY = 9.80665;
const MAX_G = 2;

export function GForceMeter() {
  const frame = useTelemetryStore((s) => s.frame);
  const latG = (frame?.accelerationX ?? 0) / GRAVITY;
  const lonG = (frame?.accelerationZ ?? 0) / GRAVITY;

  const size = 168;
  const c = size / 2;
  const r = c - 16;
  const clamp = (v: number) => Math.max(-1, Math.min(1, v / MAX_G));
  const dotX = c + clamp(latG) * r;
  const dotY = c - clamp(lonG) * r;

  return (
    <Panel title="G-Force">
      <div className="flex flex-col items-center">
        <svg width={size} height={size}>
          <circle cx={c} cy={c} r={r} fill="#0d1117" stroke="#3a4453" strokeWidth={2} />
          <circle cx={c} cy={c} r={r * 0.5} fill="none" stroke="#222a38" strokeWidth={1.5} />
          <line x1={c - r} y1={c} x2={c + r} y2={c} stroke="#222a38" strokeWidth={1.5} />
          <line x1={c} y1={c - r} x2={c} y2={c + r} stroke="#222a38" strokeWidth={1.5} />
          <line x1={c} y1={c} x2={dotX} y2={dotY} stroke="#ff6b1a" strokeWidth={2} opacity={0.5} />
          <circle cx={dotX} cy={dotY} r={8} fill="#ff6b1a" />
        </svg>
        <div className="mt-1 flex gap-5 font-mono text-xs text-slate-300">
          <span>
            <span className="text-slate-500">Lat </span>
            {latG.toFixed(2)}g
          </span>
          <span>
            <span className="text-slate-500">Lon </span>
            {lonG.toFixed(2)}g
          </span>
        </div>
      </div>
    </Panel>
  );
}
