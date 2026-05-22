import { useTelemetryStore } from '../state/telemetryStore';
import { ConnectionBadge } from './common/ConnectionBadge';

interface TopBarProps {
  onOpenSessions: () => void;
}

export function TopBar({ onOpenSessions }: TopBarProps) {
  const mode = useTelemetryStore((s) => s.mode);
  const recording = useTelemetryStore((s) => s.status?.recording.active ?? false);
  const replaySessionId = useTelemetryStore((s) => s.replay.sessionId);

  return (
    <header className="flex items-center justify-between border-b border-cockpit-edge bg-cockpit-panel px-4 py-2">
      <div className="flex items-center gap-3">
        <span className="text-lg font-bold tracking-wide text-slate-100">
          FH6 <span className="text-cockpit-accent">TELEMETRY</span>
        </span>
        {mode === 'replay' ? (
          <span className="flex items-center gap-1.5 rounded bg-sky-500/20 px-2 py-0.5 text-xs font-semibold text-sky-300">
            <span className="h-2 w-2 rounded-full bg-sky-400" />
            REPLAY
            {replaySessionId && (
              <span className="font-mono font-normal text-sky-400/70">{replaySessionId}</span>
            )}
          </span>
        ) : (
          <span className="flex items-center gap-1.5 rounded bg-red-500/20 px-2 py-0.5 text-xs font-semibold text-red-300">
            <span className="h-2 w-2 rounded-full bg-red-500" />
            LIVE
          </span>
        )}
      </div>

      <div className="flex items-center gap-4">
        {recording && (
          <span className="flex items-center gap-1.5 text-xs text-red-300">
            <span className="h-2 w-2 animate-pulse rounded-full bg-red-500" />
            Recording
          </span>
        )}
        <ConnectionBadge />
        <button
          onClick={onOpenSessions}
          className="rounded border border-cockpit-edge px-3 py-1 text-sm text-slate-200 hover:bg-cockpit-bg"
        >
          Sessions
        </button>
      </div>
    </header>
  );
}
