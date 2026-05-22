import { useTelemetryStore } from '../../state/telemetryStore';
import { Panel } from '../common/Panel';
import { steerFraction } from '../../lib/format';

export function SteeringIndicator() {
  const steer = useTelemetryStore((s) => s.frame?.steer ?? 0);
  const angle = steerFraction(steer) * 130;

  return (
    <Panel title="Steering">
      <div className="flex flex-col items-center gap-2">
        <svg
          width={116}
          height={116}
          viewBox="0 0 120 120"
          style={{ transform: `rotate(${angle}deg)`, transition: 'transform 80ms linear' }}
        >
          <circle cx="60" cy="60" r="48" fill="none" stroke="#3a4453" strokeWidth="9" />
          <line x1="60" y1="60" x2="60" y2="16" stroke="#ff6b1a" strokeWidth="7" />
          <line x1="60" y1="60" x2="26" y2="82" stroke="#3a4453" strokeWidth="7" />
          <line x1="60" y1="60" x2="94" y2="82" stroke="#3a4453" strokeWidth="7" />
          <circle cx="60" cy="60" r="12" fill="#ff6b1a" />
        </svg>
        <span className="font-mono text-sm text-slate-300">{Math.round(angle)}°</span>
      </div>
    </Panel>
  );
}
