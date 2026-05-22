import { useTelemetryStore } from '../../state/telemetryStore';
import { Panel } from '../common/Panel';

function tempColor(temp: number): string {
  if (temp <= 0) return '#475569';
  if (temp < 70) return '#3b82f6';
  if (temp < 100) return '#22c55e';
  if (temp < 120) return '#f59e0b';
  return '#ef4444';
}

interface CornerProps {
  label: string;
  temp: number;
  slip: number;
  wear?: number;
}

function Corner({ label, temp, slip, wear }: CornerProps) {
  return (
    <div className="rounded bg-cockpit-bg p-2">
      <div className="flex items-baseline justify-between">
        <span className="text-[10px] uppercase text-slate-500">{label}</span>
        <span
          className="font-mono text-xl font-bold"
          style={{ color: tempColor(temp), fontVariantNumeric: 'tabular-nums' }}
        >
          {temp > 0 ? `${temp.toFixed(0)}°` : '--'}
        </span>
      </div>
      <div className="mt-1.5 h-1.5 overflow-hidden rounded bg-cockpit-edge">
        <div
          className="h-full bg-cockpit-accent"
          style={{ width: `${Math.min(100, slip * 100)}%` }}
        />
      </div>
      <div className="mt-1 flex justify-between font-mono text-[10px] text-slate-400">
        <span>slip {slip.toFixed(2)}</span>
        {wear !== undefined && <span>wear {(wear * 100).toFixed(0)}%</span>}
      </div>
    </div>
  );
}

export function TirePanel() {
  const f = useTelemetryStore((s) => s.frame);

  return (
    <Panel title="Tires">
      <div className="grid grid-cols-2 gap-2">
        <Corner
          label="FL"
          temp={f?.tireTempFl ?? 0}
          slip={f?.tireCombinedSlipFl ?? 0}
          wear={f?.tireWearFl}
        />
        <Corner
          label="FR"
          temp={f?.tireTempFr ?? 0}
          slip={f?.tireCombinedSlipFr ?? 0}
          wear={f?.tireWearFr}
        />
        <Corner
          label="RL"
          temp={f?.tireTempRl ?? 0}
          slip={f?.tireCombinedSlipRl ?? 0}
          wear={f?.tireWearRl}
        />
        <Corner
          label="RR"
          temp={f?.tireTempRr ?? 0}
          slip={f?.tireCombinedSlipRr ?? 0}
          wear={f?.tireWearRr}
        />
      </div>
    </Panel>
  );
}
