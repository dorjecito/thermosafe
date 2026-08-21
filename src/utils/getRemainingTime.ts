type TFunctionLike = (key: string, options?: any) => string;

export function getRemainingTime(
  endUnix: number,
  lang: string,
  t: TFunctionLike
): string {
  const now = Date.now() / 1000;
  const diff = Math.floor(endUnix - now);

  if (diff <= 0) return t("alert_time.ended");

  const hours = Math.floor(diff / 3600);
  const minutes = Math.floor((diff % 3600) / 60);

  if (hours > 0) {
    return t("alert_time.remaining_hours", { hours, minutes });
  }

  return t("alert_time.remaining_minutes", { minutes });
}

function formatDuration(diffSeconds: number, t: TFunctionLike, keyPrefix: string): string {
  const hours = Math.floor(diffSeconds / 3600);
  const minutes = Math.floor((diffSeconds % 3600) / 60);

  if (hours > 0) {
    return t(`alert_time.${keyPrefix}_hours`, { hours, minutes });
  }

  return t(`alert_time.${keyPrefix}_minutes`, { minutes });
}

export function getAlertTimeCountdown(
  startUnix: number,
  endUnix: number,
  lang: string,
  t: TFunctionLike,
  nowUnix = Date.now() / 1000
): string {
  const now = Math.floor(nowUnix);

  if (now < startUnix) {
    return formatDuration(Math.floor(startUnix - now), t, "starts_in");
  }

  const diff = Math.floor(endUnix - now);
  if (diff <= 0) return t("alert_time.ended");

  return formatDuration(diff, t, "remaining");
}
