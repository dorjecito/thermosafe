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