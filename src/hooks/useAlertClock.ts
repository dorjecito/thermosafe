import { useEffect, useState } from "react";
import type { AemetAlertLike } from "../utils/aemetAlertTimeline";

// Presentation only: one boundary timer, with no network or cache operations.
export function useAlertClock(alerts: AemetAlertLike[], dataRevision: unknown): number {
  const [nowTs, setNowTs] = useState(() => Math.floor(Date.now() / 1000));

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;

    const update = () => {
      if (timer !== undefined) clearTimeout(timer);
      timer = undefined;
      const nowMs = Date.now();
      setNowTs(Math.floor(nowMs / 1000));

      const boundaries = alerts.flatMap(alert => [alert.start, alert.end])
        .filter((value): value is number =>
          typeof value === "number" && Number.isFinite(value) && value * 1000 > nowMs);
      if (boundaries.length) {
        // Clamp long delays to the browser's signed 32-bit timer limit.
        timer = setTimeout(update, Math.min(Math.min(...boundaries) * 1000 - nowMs, 2_147_483_647));
      }
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") update();
    };

    update();
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      if (timer !== undefined) clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [alerts, dataRevision]);

  return nowTs;
}
