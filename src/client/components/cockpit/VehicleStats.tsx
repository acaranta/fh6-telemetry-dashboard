import { useTelemetryStore } from '../../state/telemetryStore';
import { Panel } from '../common/Panel';
import { CAR_CLASSES, DRIVETRAIN_TYPES } from '../../../../shared/telemetry';

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded bg-cockpit-bg p-2">
      <div className="text-[10px] uppercase tracking-wide text-slate-500">{label}</div>
      <div className="font-mono text-base font-semibold text-slate-100">{value}</div>
    </div>
  );
}

export function VehicleStats() {
  const f = useTelemetryStore((s) => s.frame);

  const carClass = f ? (CAR_CLASSES[f.carClass] ?? `#${f.carClass}`) : '--';
  const drivetrain = f ? (DRIVETRAIN_TYPES[f.drivetrainType] ?? '--') : '--';

  return (
    <Panel title="Vehicle">
      <div className="grid grid-cols-3 gap-2">
        <Stat label="Power" value={f ? `${(f.power / 1000).toFixed(0)} kW` : '--'} />
        <Stat label="Torque" value={f ? `${f.torque.toFixed(0)} Nm` : '--'} />
        <Stat label="Boost" value={f ? f.boost.toFixed(1) : '--'} />
        <Stat label="Fuel" value={f ? `${(f.fuel * 100).toFixed(0)}%` : '--'} />
        <Stat label="Class" value={carClass} />
        <Stat label="Drive" value={drivetrain} />
        <Stat
          label="PI"
          value={f && f.carPerformanceIndex > 0 ? String(f.carPerformanceIndex) : '--'}
        />
        <Stat label="Car ID" value={f && f.carOrdinal > 0 ? String(f.carOrdinal) : '--'} />
        <Stat label="Cyl." value={f && f.numCylinders > 0 ? String(f.numCylinders) : '--'} />
      </div>
    </Panel>
  );
}
