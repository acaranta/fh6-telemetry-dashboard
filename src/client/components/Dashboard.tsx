import { useTelemetryStore } from '../state/telemetryStore';
import { Tachometer } from './cockpit/Tachometer';
import { Speedometer } from './cockpit/Speedometer';
import { GearIndicator } from './cockpit/GearIndicator';
import { PedalBars } from './cockpit/PedalBars';
import { SteeringIndicator } from './cockpit/SteeringIndicator';
import { GForceMeter } from './cockpit/GForceMeter';
import { TirePanel } from './cockpit/TirePanel';
import { SuspensionPanel } from './cockpit/SuspensionPanel';
import { LapInfo } from './cockpit/LapInfo';
import { VehicleStats } from './cockpit/VehicleStats';
import { RollingChart } from './charts/RollingChart';
import { MPS_TO_KMH } from '../lib/format';

function WaitingOverlay({ message }: { message: string }) {
  return (
    <div className="absolute inset-0 z-10 flex items-center justify-center bg-cockpit-bg/80 backdrop-blur-sm">
      <div className="text-center">
        <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-2 border-cockpit-edge border-t-cockpit-accent" />
        <p className="text-lg font-medium text-slate-300">{message}</p>
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
    <div className="relative mx-auto max-w-[1440px] p-4">
      <div className="grid grid-cols-1 items-center gap-3 md:grid-cols-3">
        <div className="flex justify-center">
          <Tachometer />
        </div>
        <div className="flex justify-center">
          <GearIndicator />
        </div>
        <div className="flex justify-center">
          <Speedometer />
        </div>
      </div>

      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <PedalBars />
        <SteeringIndicator />
        <GForceMeter />
        <LapInfo />
      </div>

      <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-3">
        <TirePanel />
        <SuspensionPanel />
        <VehicleStats />
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
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
