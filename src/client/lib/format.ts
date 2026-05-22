/** Display formatting helpers. */

export const MPS_TO_KMH = 3.6;
export const MPS_TO_MPH = 2.2369362921;

export function formatLapTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return '--:--.---';
  const minutes = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  const millis = Math.floor((seconds * 1000) % 1000);
  return `${minutes}:${String(secs).padStart(2, '0')}.${String(millis).padStart(3, '0')}`;
}

export function formatGear(gear: number): string {
  if (gear < 0) return 'R';
  if (gear === 0) return 'N';
  return String(gear);
}

export function formatDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return '0:00';
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

export function formatDistance(meters: number): string {
  if (!Number.isFinite(meters) || meters <= 0) return '0 m';
  if (meters >= 1000) return `${(meters / 1000).toFixed(2)} km`;
  return `${Math.round(meters)} m`;
}

export function formatClockTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString();
}

/** Pedal/handbrake raw value (0-255) as a 0-1 fraction. */
export function pedalFraction(raw: number): number {
  return Math.min(1, Math.max(0, raw / 255));
}

/** Steering raw value (-128..127) as a -1..1 fraction. */
export function steerFraction(raw: number): number {
  return Math.min(1, Math.max(-1, raw / 127));
}

export function placeholderOr(value: number | undefined, decimals = 0): string {
  if (value === undefined || !Number.isFinite(value)) return '--';
  return value.toFixed(decimals);
}
