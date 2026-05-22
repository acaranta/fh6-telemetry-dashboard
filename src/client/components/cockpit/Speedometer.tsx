import { useTelemetryStore } from '../../state/telemetryStore';
import { Gauge } from '../common/Gauge';
import { MPS_TO_KMH } from '../../lib/format';

export function Speedometer() {
  const speedMps = useTelemetryStore((s) => s.frame?.speed ?? 0);
  return <Gauge value={speedMps * MPS_TO_KMH} max={400} label="Speed" unit="km/h" size={300} />;
}
