export function formatLastUpdate(timestamp: number): string {
  const now = Date.now() / 1000;
  const elapsedSeconds = Math.floor(now - timestamp);
  const diff = Number.isFinite(elapsedSeconds) ? Math.max(0, elapsedSeconds) : elapsedSeconds;

  if (diff < 60) return `${diff} s`;
  if (diff < 3600) return `${Math.floor(diff / 60)} min`;

  const h = Math.floor(diff / 3600);
  return `${h} h`;
}
