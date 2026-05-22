import { useTelemetryStore } from '../../state/telemetryStore';
import { useSessions } from '../../hooks/useSessions';
import { api } from '../../lib/api';
import { SessionCard } from './SessionCard';

interface SessionBrowserProps {
  open: boolean;
  onClose: () => void;
}

export function SessionBrowser({ open, onClose }: SessionBrowserProps) {
  const send = useTelemetryStore((s) => s.send);
  const allowDelete = useTelemetryStore((s) => s.status?.allowDeleteSessions ?? false);
  const { sessions, loading, error, reload } = useSessions(open);

  if (!open) return null;

  const replay = (id: string): void => {
    send({ type: 'replay.start', sessionId: id, speed: 1 });
    onClose();
  };

  const remove = async (id: string): Promise<void> => {
    try {
      await api.deleteSession(id);
      await reload();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[85vh] w-full max-w-3xl flex-col rounded-xl border border-cockpit-edge bg-cockpit-panel"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-cockpit-edge p-4">
          <h2 className="text-lg font-semibold text-slate-100">Recorded Sessions</h2>
          <div className="flex gap-2">
            <button
              onClick={() => void reload()}
              className="rounded border border-cockpit-edge px-3 py-1 text-sm text-slate-300 hover:bg-cockpit-bg"
            >
              Refresh
            </button>
            <button
              onClick={onClose}
              className="rounded border border-cockpit-edge px-3 py-1 text-sm text-slate-300 hover:bg-cockpit-bg"
            >
              Close
            </button>
          </div>
        </div>

        <div className="grid gap-3 overflow-y-auto p-4">
          {loading && <p className="text-center text-slate-500">Loading…</p>}
          {error && <p className="text-center text-red-400">{error}</p>}
          {!loading && !error && sessions.length === 0 && (
            <p className="py-8 text-center text-slate-500">
              No sessions recorded yet. Start driving in Forza Horizon 6.
            </p>
          )}
          {sessions.map((session) => (
            <SessionCard
              key={session.id}
              session={session}
              allowDelete={allowDelete}
              onReplay={replay}
              onDelete={(id) => void remove(id)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
