export function formatUvDetailTime(iso?: string | null): string | null {
  if (!iso) return null;

  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;

  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}
