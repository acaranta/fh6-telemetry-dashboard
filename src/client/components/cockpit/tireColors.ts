export function tempColor(temp: number): string {
  if (temp <= 0) return '#475569';
  if (temp < 70) return '#3b82f6';
  if (temp < 100) return '#22c55e';
  if (temp < 120) return '#f59e0b';
  return '#ef4444';
}
