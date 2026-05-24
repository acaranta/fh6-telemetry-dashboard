import { useTelemetryStore } from '../../state/telemetryStore';
import { Panel } from '../common/Panel';
import { tempColor } from './tireColors';

function Spring() {
  return (
    <svg viewBox="0 0 16 10" width="16" height="10" aria-hidden className="shrink-0 text-slate-400">
      <path
        d="M0 5 L2 1 L4 9 L6 1 L8 9 L10 1 L12 9 L14 1 L16 5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CarSilhouette() {
  return (
    <svg
      viewBox="0 0 60 140"
      className="mx-auto h-full w-auto text-cockpit-edge"
      preserveAspectRatio="xMidYMid meet"
      aria-hidden
    >
      <rect
        x="6"
        y="6"
        width="48"
        height="128"
        rx="14"
        fill="#0f172a"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path
        d="M14 38 L46 38 L42 58 L18 58 Z"
        fill="#1e293b"
        stroke="currentColor"
        strokeWidth="1"
      />
      <path
        d="M18 86 L42 86 L46 106 L14 106 Z"
        fill="#1e293b"
        stroke="currentColor"
        strokeWidth="1"
      />
      <line x1="30" y1="60" x2="30" y2="84" stroke="currentColor" strokeWidth="0.5" opacity="0.5" />
    </svg>
  );
}

interface WheelProps {
  label: string;
  temp: number;
  travel: number;
  slip: number;
  wear?: number;
  align: 'left' | 'right';
}

function WheelReadout({ label, temp, travel, slip, wear, align }: WheelProps) {
  const t = Math.min(1, Math.max(0, travel));
  const slipPct = Math.min(100, Math.max(0, slip * 100));
  const wearPct = wear !== undefined ? Math.round(wear * 100) : null;
  const alignClass = align === 'left' ? 'items-start text-left' : 'items-end text-right';

  return (
    <div className={`flex flex-col gap-1.5 rounded-md bg-cockpit-bg p-2 ${alignClass}`}>
      <div className="flex w-full items-baseline justify-between gap-2">
        <span className="text-[10px] uppercase tracking-wider text-slate-500">{label}</span>
        <span
          className="font-mono text-2xl font-bold leading-none"
          style={{ color: tempColor(temp), fontVariantNumeric: 'tabular-nums' }}
        >
          {temp > 0 ? `${temp.toFixed(0)}°` : '--'}
        </span>
      </div>

      <div className="flex w-full items-center gap-1.5">
        <Spring />
        <div className="relative h-2 flex-1 overflow-hidden rounded bg-cockpit-edge">
          <div
            className="absolute inset-y-0 left-0 bg-sky-500/80 transition-[width] duration-100"
            style={{ width: `${t * 100}%` }}
          />
        </div>
        <span className="w-8 text-right font-mono text-[10px] tabular-nums text-slate-400">
          {Math.round(t * 100)}%
        </span>
      </div>

      <div className="flex w-full items-center gap-2">
        <div className="relative h-1 flex-1 overflow-hidden rounded bg-cockpit-edge">
          <div
            className="absolute inset-y-0 left-0 bg-cockpit-accent"
            style={{ width: `${slipPct}%` }}
          />
        </div>
        <span className="font-mono text-[9px] text-slate-500">slip {slip.toFixed(2)}</span>
        {wearPct !== null && (
          <span className="rounded bg-cockpit-edge px-1.5 py-0.5 font-mono text-[9px] text-slate-300">
            {wearPct}%
          </span>
        )}
      </div>
    </div>
  );
}

export function TireSuspensionPanel() {
  const f = useTelemetryStore((s) => s.frame);

  return (
    <Panel title="Tires & Suspension" className="h-full">
      <div className="grid h-full grid-cols-1 gap-2 lg:grid-cols-[1fr_auto_1fr] lg:grid-rows-2">
        <WheelReadout
          align="right"
          label="FL"
          temp={f?.tireTempFl ?? 0}
          travel={f?.normalizedSuspensionTravelFl ?? 0}
          slip={f?.tireCombinedSlipFl ?? 0}
          wear={f?.tireWearFl}
        />
        <div className="hidden w-14 lg:col-start-2 lg:row-span-2 lg:block">
          <CarSilhouette />
        </div>
        <WheelReadout
          align="left"
          label="FR"
          temp={f?.tireTempFr ?? 0}
          travel={f?.normalizedSuspensionTravelFr ?? 0}
          slip={f?.tireCombinedSlipFr ?? 0}
          wear={f?.tireWearFr}
        />
        <WheelReadout
          align="right"
          label="RL"
          temp={f?.tireTempRl ?? 0}
          travel={f?.normalizedSuspensionTravelRl ?? 0}
          slip={f?.tireCombinedSlipRl ?? 0}
          wear={f?.tireWearRl}
        />
        <WheelReadout
          align="left"
          label="RR"
          temp={f?.tireTempRr ?? 0}
          travel={f?.normalizedSuspensionTravelRr ?? 0}
          slip={f?.tireCombinedSlipRr ?? 0}
          wear={f?.tireWearRr}
        />
      </div>
    </Panel>
  );
}
