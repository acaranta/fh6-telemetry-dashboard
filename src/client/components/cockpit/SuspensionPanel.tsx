import { useTelemetryStore } from '../../state/telemetryStore';
import { Panel } from '../common/Panel';

/** Vertical travel bar — 0 = fully extended (top), 1 = fully compressed. */
function TravelBar({ label, travel }: { label: string; travel: number }) {
  const compressed = Math.min(1, Math.max(0, travel));
  return (
    <div className="flex flex-col items-center gap-1">
      <span className="text-[10px] uppercase text-slate-500">{label}</span>
      <div className="relative h-20 w-6 overflow-hidden rounded bg-cockpit-bg">
        <div
          className="absolute top-0 w-full bg-sky-500/80"
          style={{ height: `${compressed * 100}%` }}
        />
      </div>
      <span className="font-mono text-[10px] text-slate-400">{(compressed * 100).toFixed(0)}%</span>
    </div>
  );
}

export function SuspensionPanel() {
  const f = useTelemetryStore((s) => s.frame);

  return (
    <Panel title="Suspension">
      <div className="grid grid-cols-2 gap-x-6 gap-y-3 px-2">
        <TravelBar label="FL" travel={f?.normalizedSuspensionTravelFl ?? 0} />
        <TravelBar label="FR" travel={f?.normalizedSuspensionTravelFr ?? 0} />
        <TravelBar label="RL" travel={f?.normalizedSuspensionTravelRl ?? 0} />
        <TravelBar label="RR" travel={f?.normalizedSuspensionTravelRr ?? 0} />
      </div>
    </Panel>
  );
}
