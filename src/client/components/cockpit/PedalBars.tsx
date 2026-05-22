import { useTelemetryStore } from '../../state/telemetryStore';
import { Panel } from '../common/Panel';
import { pedalFraction } from '../../lib/format';

function Bar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="relative h-36 w-9 overflow-hidden rounded bg-cockpit-bg">
        <div
          className="absolute bottom-0 w-full transition-[height] duration-75"
          style={{ height: `${value * 100}%`, backgroundColor: color }}
        />
      </div>
      <span className="text-[10px] uppercase tracking-wide text-slate-500">{label}</span>
      <span className="font-mono text-sm font-semibold text-slate-200">
        {Math.round(value * 100)}
      </span>
    </div>
  );
}

export function PedalBars() {
  const frame = useTelemetryStore((s) => s.frame);

  return (
    <Panel title="Inputs">
      <div className="flex justify-around">
        <Bar label="Throttle" value={pedalFraction(frame?.accelerator ?? 0)} color="#22c55e" />
        <Bar label="Brake" value={pedalFraction(frame?.brake ?? 0)} color="#ef4444" />
        <Bar label="Clutch" value={pedalFraction(frame?.clutch ?? 0)} color="#3b82f6" />
        <Bar label="Hand" value={pedalFraction(frame?.handbrake ?? 0)} color="#f59e0b" />
      </div>
    </Panel>
  );
}
