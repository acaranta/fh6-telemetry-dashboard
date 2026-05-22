import { useTelemetryStore } from '../../state/telemetryStore';

export function ConnectionBadge() {
  const connection = useTelemetryStore((s) => s.connection);

  const config = {
    connecting: { label: 'Connecting', color: 'bg-amber-500', text: 'text-amber-300' },
    open: { label: 'Connected', color: 'bg-emerald-500', text: 'text-emerald-300' },
    closed: { label: 'Disconnected', color: 'bg-red-500', text: 'text-red-300' },
  }[connection];

  return (
    <div className="flex items-center gap-2">
      <span
        className={`h-2.5 w-2.5 rounded-full ${config.color} ${
          connection === 'connecting' ? 'animate-pulse' : ''
        }`}
      />
      <span className={`text-xs font-medium ${config.text}`}>{config.label}</span>
    </div>
  );
}
