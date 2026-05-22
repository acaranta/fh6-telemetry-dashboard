import type { MouseEvent } from 'react';
import { useTelemetryStore } from '../../state/telemetryStore';
import { REPLAY_SPEEDS } from '../../../../shared/protocol';
import { formatDuration } from '../../lib/format';

export function ReplayControls() {
  const replay = useTelemetryStore((s) => s.replay);
  const send = useTelemetryStore((s) => s.send);
  const resetReplay = useTelemetryStore((s) => s.resetReplay);

  if (!replay.active) return null;

  const playing = replay.state === 'playing';
  const ended = replay.state === 'ended';
  const progress = replay.totalMs > 0 ? Math.min(1, replay.elapsedMs / replay.totalMs) : 0;

  const togglePlay = (): void => send({ type: playing ? 'replay.pause' : 'replay.resume' });
  const stop = (): void => {
    send({ type: 'replay.stop' });
    resetReplay();
  };
  const restart = (): void => {
    if (replay.sessionId) {
      send({ type: 'replay.start', sessionId: replay.sessionId, speed: replay.speed });
    }
  };
  const seek = (e: MouseEvent<HTMLDivElement>): void => {
    if (replay.totalMs <= 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const frac = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    send({ type: 'replay.seek', toMs: frac * replay.totalMs });
  };

  return (
    <div className="border-t border-cockpit-edge bg-cockpit-panel px-4 py-2">
      <div
        onClick={seek}
        className="group h-2.5 cursor-pointer rounded-full bg-cockpit-bg"
        title="Click to seek"
      >
        <div
          className="h-full rounded-full bg-cockpit-accent"
          style={{ width: `${progress * 100}%` }}
        />
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-3">
        {ended ? (
          <button
            onClick={restart}
            className="rounded bg-cockpit-accent px-4 py-1 text-sm font-semibold text-black hover:bg-orange-400"
          >
            Restart
          </button>
        ) : (
          <button
            onClick={togglePlay}
            className="rounded bg-cockpit-accent px-4 py-1 text-sm font-semibold text-black hover:bg-orange-400"
          >
            {playing ? 'Pause' : 'Play'}
          </button>
        )}
        <button
          onClick={stop}
          className="rounded border border-cockpit-edge px-3 py-1 text-sm text-slate-300 hover:bg-cockpit-bg"
        >
          Stop
        </button>

        <span className="font-mono text-xs text-slate-400">
          {formatDuration(replay.elapsedMs)} / {formatDuration(replay.totalMs)}
        </span>
        {ended && <span className="text-xs text-amber-300">replay finished</span>}

        <div className="ml-auto flex items-center gap-1">
          <span className="mr-1 text-[10px] uppercase text-slate-500">Speed</span>
          {REPLAY_SPEEDS.map((speed) => (
            <button
              key={speed}
              onClick={() => send({ type: 'replay.setSpeed', speed })}
              className={`rounded px-2 py-0.5 text-xs font-mono ${
                replay.speed === speed
                  ? 'bg-cockpit-accent text-black'
                  : 'border border-cockpit-edge text-slate-300 hover:bg-cockpit-bg'
              }`}
            >
              {speed}x
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
