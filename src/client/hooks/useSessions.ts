import { useCallback, useEffect, useState } from 'react';
import { api } from '../lib/api';
import type { SessionSummary } from '../../../shared/session';

interface UseSessionsResult {
  sessions: SessionSummary[];
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
}

/** Fetches the recorded-session list, refreshing whenever `enabled` flips on. */
export function useSessions(enabled: boolean): UseSessionsResult {
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setSessions(await api.sessions());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'failed to load sessions');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (enabled) void reload();
  }, [enabled, reload]);

  return { sessions, loading, error, reload };
}
