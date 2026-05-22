import { useTelemetryStore } from '../../state/telemetryStore';
import { Panel } from '../common/Panel';
import { formatLapTime } from '../../lib/format';

function TimeRow({ label, seconds, accent }: { label: string; seconds: number; accent?: boolean }) {
  return (
    <div className="flex items-baseline justify-between">
      <span className="text-[11px] uppercase tracking-wide text-slate-500">{label}</span>
      <span
        className={`font-mono text-lg font-semibold ${accent ? 'text-cockpit-accent' : 'text-slate-100'}`}
      >
        {formatLapTime(seconds)}
      </span>
    </div>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded bg-cockpit-bg p-2 text-center">
      <div className="text-[10px] uppercase text-slate-500">{label}</div>
      <div className="font-mono text-2xl font-bold text-slate-100">{value}</div>
    </div>
  );
}

export function LapInfo() {
  const f = useTelemetryStore((s) => s.frame);

  return (
    <Panel title="Lap & Race">
      <div className="space-y-1.5">
        <TimeRow label="Current" seconds={f?.currentLap ?? 0} />
        <TimeRow label="Last" seconds={f?.lastLap ?? 0} />
        <TimeRow label="Best" seconds={f?.bestLap ?? 0} accent />
        <div className="grid grid-cols-2 gap-2 pt-1">
          <Mini label="Lap" value={f && f.lapNumber > 0 ? String(f.lapNumber) : '--'} />
          <Mini label="Position" value={f && f.racePosition > 0 ? String(f.racePosition) : '--'} />
        </div>
      </div>
    </Panel>
  );
}
