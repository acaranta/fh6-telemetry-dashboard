import { useTelemetryStore } from '../state/telemetryStore';
import { Tachometer } from './cockpit/Tachometer';
import { Speedometer } from './cockpit/Speedometer';
import { GearIndicator } from './cockpit/GearIndicator';
import { PedalBars } from './cockpit/PedalBars';
import { SteeringIndicator } from './cockpit/SteeringIndicator';
import { GForceMeter } from './cockpit/GForceMeter';
import { TireSuspensionPanel } from './cockpit/TireSuspensionPanel';
import { LapInfo } from './cockpit/LapInfo';
import { VehicleStats } from './cockpit/VehicleStats';
import { RollingChart } from './charts/RollingChart';
import { TrackMap } from './map/TrackMap';
import { MPS_TO_KMH } from '../lib/format';

function WaitingOverlay({ message }: { message: string }) {
  // Informational only — `pointer-events-none` keeps the map and its controls
  // usable underneath while there is no telemetry.
  return (
    <div className="pointer-events-none absolute inset-0 z-10 flex items-start justify-center bg-cockpit-bg/70 pt-24">
      <div className="rounded-lg border border-cockpit-edge bg-cockpit-panel/90 px-6 py-4 text-center">
        <div className="mx-auto mb-3 h-9 w-9 animate-spin rounded-full border-2 border-cockpit-edge border-t-cockpit-accent" />
        <p className="text-base font-medium text-slate-300">{message}</p>
      </div>
    </div>
  );
}

export function Dashboard() {
  const connection = useTelemetryStore((s) => s.connection);
  const mode = useTelemetryStore((s) => s.mode);
  const receiving = useTelemetryStore((s) => s.status?.udp.receivingPackets ?? false);
  const history = useTelemetryStore((s) => s.history);

  let overlay: string | null = null;
  if (connection !== 'open') overlay = 'Connecting to server…';
  else if (mode === 'live' && !receiving) overlay = 'Waiting for FH6 telemetry…';

  return (
    <div className="relative mx-auto max-w-[1600px] p-2">
      <div className="grid grid-cols-2 items-stretch gap-2 lg:grid-cols-5">
        <div className="flex justify-center">
          <Tachometer />
        </div>
        <VehicleStats />
        <div className="flex justify-center">
          <GearIndicator />
        </div>
        <LapInfo />
        <div className="flex justify-center">
          <Speedometer />
        </div>
      </div>

      <div className="mt-2 grid grid-cols-1 gap-2 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] lg:grid-rows-[auto_minmax(0,1fr)]">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 lg:col-start-1 lg:row-start-1">
          <PedalBars />
          <SteeringIndicator />
          <GForceMeter />
        </div>
        <div className="lg:col-start-2 lg:row-span-2">
          <TireSuspensionPanel />
        </div>
        <div className="lg:col-start-1 lg:row-start-2">
          <TrackMap />
        </div>
      </div>

      <div className="mt-2 grid grid-cols-2 gap-2 lg:grid-cols-4">
        <RollingChart
          label="Speed"
          data={history.speed.map((mps) => mps * MPS_TO_KMH)}
          color="#22c55e"
          unit=" km/h"
        />
        <RollingChart label="RPM" data={history.rpm} color="#ff6b1a" />
        <RollingChart label="Throttle" data={history.throttle} color="#22c55e" max={255} />
        <RollingChart label="Brake" data={history.brake} color="#ef4444" max={255} />
      </div>

      {overlay && <WaitingOverlay message={overlay} />}
    </div>
  );
}
