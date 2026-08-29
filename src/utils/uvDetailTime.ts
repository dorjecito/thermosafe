export function formatUvDetailTime(
  iso?: string | null,
  timezoneOffsetSec: number | null = 0
): string | null {
  if (!iso) return null;

  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;

  const offsetMs = Number.isFinite(timezoneOffsetSec) ? timezoneOffsetSec * 1000 : 0;
  const localDate = new Date(date.getTime() + offsetMs);
  return `${String(localDate.getUTCHours()).padStart(2, "0")}:${String(
    localDate.getUTCMinutes()
  ).padStart(2, "0")}`;
}
