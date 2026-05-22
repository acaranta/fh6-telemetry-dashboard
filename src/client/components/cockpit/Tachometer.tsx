import { useTelemetryStore } from '../../state/telemetryStore';
import { Gauge } from '../common/Gauge';

export function Tachometer() {
  const rpm = useTelemetryStore((s) => s.frame?.currentEngineRpm ?? 0);
  const maxRpm = useTelemetryStore((s) => s.frame?.engineMaxRpm ?? 0) || 8000;

  return <Gauge value={rpm} max={maxRpm} label="RPM" redlineFrom={maxRpm * 0.9} size={300} />;
}
