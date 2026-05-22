import type { SessionSummary } from '../../../../shared/session';
import { CAR_CLASSES } from '../../../../shared/telemetry';
import { formatClockTime, formatDuration, MPS_TO_KMH } from '../../lib/format';

interface SessionCardProps {
  session: SessionSummary;
  allowDelete: boolean;
  onReplay: (id: string) => void;
  onDelete: (id: string) => void;
}

export function SessionCard({ session, allowDelete, onReplay, onDelete }: SessionCardProps) {
  const carClass = CAR_CLASSES[session.car.class] ?? `Class ${session.car.class}`;
  const topKmh = Math.round(session.topSpeed * MPS_TO_KMH);

  return (
    <div className="rounded-lg border border-cockpit-edge bg-cockpit-bg p-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="font-mono text-sm font-semibold text-slate-100">{session.id}</div>
          <div className="text-xs text-slate-500">{formatClockTime(session.startedAt)}</div>
        </div>
        {session.status !== 'completed' && (
          <span className="rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] text-amber-300">
            {session.status}
          </span>
        )}
      </div>

      <div className="mt-2 grid grid-cols-4 gap-2 text-center">
        <Metric label="Duration" value={formatDuration(session.durationMs)} />
        <Metric label="Frames" value={session.frameCount.toLocaleString()} />
        <Metric label="Top" value={`${topKmh}`} suffix="km/h" />
        <Metric label="Class" value={carClass} />
      </div>

      <div className="mt-3 flex gap-2">
        <button
          onClick={() => onReplay(session.id)}
          className="flex-1 rounded bg-cockpit-accent px-3 py-1.5 text-sm font-semibold text-black hover:bg-orange-400"
        >
          Replay
        </button>
        {allowDelete && (
          <button
            onClick={() => onDelete(session.id)}
            className="rounded border border-red-500/40 px-3 py-1.5 text-sm text-red-300 hover:bg-red-500/10"
          >
            Delete
          </button>
        )}
      </div>
    </div>
  );
}

function Metric({ label, value, suffix }: { label: string; value: string; suffix?: string }) {
  return (
    <div className="rounded bg-cockpit-panel p-1.5">
      <div className="text-[10px] uppercase text-slate-500">{label}</div>
      <div className="font-mono text-sm font-semibold text-slate-100">
        {value}
        {suffix && <span className="ml-0.5 text-[10px] font-normal text-slate-500">{suffix}</span>}
      </div>
    </div>
  );
}
