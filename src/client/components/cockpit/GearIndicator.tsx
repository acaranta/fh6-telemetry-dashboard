import { useTelemetryStore } from '../../state/telemetryStore';
import { formatGear, MPS_TO_KMH } from '../../lib/format';

export function GearIndicator() {
  const gear = useTelemetryStore((s) => s.frame?.gear ?? 0);
  const speedMps = useTelemetryStore((s) => s.frame?.speed ?? 0);
  const kmh = Math.round(speedMps * MPS_TO_KMH);

  return (
    <div className="flex flex-col items-center justify-center">
      <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
        Gear
      </span>
      <span
        className="font-bold leading-none text-cockpit-accent"
        style={{ fontSize: '8rem', fontVariantNumeric: 'tabular-nums' }}
      >
        {formatGear(gear)}
      </span>
      <span
        className="mt-1 font-mono text-3xl font-bold text-slate-100"
        style={{ fontVariantNumeric: 'tabular-nums' }}
      >
        {kmh}
        <span className="ml-1 text-base font-normal text-slate-500">km/h</span>
      </span>
    </div>
  );
}
