import type { HealthResponse, ServerStatus } from '../../../shared/api';
import type { SessionManifest, SessionSummary } from '../../../shared/session';

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} responded ${res.status}`);
  return (await res.json()) as T;
}

export interface MapSettings {
  calibration: {
    worldA: [number, number];
    pixelA: [number, number];
    worldB: [number, number];
    pixelB: [number, number];
  };
  defaultView: { center: [number, number]; zoom: number } | null;
}

export const api = {
  health: () => getJson<HealthResponse>('/api/health'),
  status: () => getJson<ServerStatus>('/api/status'),
  sessions: () => getJson<SessionSummary[]>('/api/sessions'),
  session: (id: string) => getJson<SessionManifest>(`/api/sessions/${encodeURIComponent(id)}`),
  settings: () => getJson<MapSettings>('/api/settings'),

  async deleteSession(id: string): Promise<void> {
    const res = await fetch(`/api/sessions/${encodeURIComponent(id)}`, { method: 'DELETE' });
    if (!res.ok) throw new Error(`failed to delete session (${res.status})`);
  },

  async saveSettings(settings: MapSettings): Promise<void> {
    const res = await fetch('/api/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings),
    });
    if (!res.ok) throw new Error(`failed to save settings (${res.status})`);
  },
};
