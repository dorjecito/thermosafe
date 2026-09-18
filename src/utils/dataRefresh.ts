export const DATA_REFRESH_MIN_INTERVAL_MS = 10 * 60 * 1000;

export function shouldRefreshOnVisible(
  hasData: boolean,
  lastSuccessfulRefreshAt: number | null,
  now: number,
  isRefreshing: boolean,
): boolean {
  return (
    hasData &&
    !isRefreshing &&
    lastSuccessfulRefreshAt !== null &&
    now - lastSuccessfulRefreshAt >= DATA_REFRESH_MIN_INTERVAL_MS
  );
}

export type RefreshTarget =
  | { source: "gps" }
  | { source: "search"; city: string }
  | { source: "coords"; city: string; lat: number; lon: number };

export function getRefreshTarget(
  source: "gps" | "search" | null,
  city: string | null | undefined,
  realCity: string | null | undefined,
  selectedTarget: RefreshTarget | null = null,
): RefreshTarget {
  if (selectedTarget) return selectedTarget;
  const searchCity = (realCity || city || "").trim();
  if (source === "search" && searchCity) {
    return { source: "search", city: searchCity };
  }
  return { source: "gps" };
}

export function getRefreshCoords(
  lat: number | null,
  lon: number | null,
): { lat: number; lon: number } | undefined {
  if (typeof lat !== "number" || typeof lon !== "number") return undefined;
  return { lat, lon };
}

export function createRefreshGate() {
  let inFlight: Promise<boolean> | null = null;

  return {
    run(task: () => Promise<boolean>): Promise<boolean> {
      if (inFlight) return inFlight;

      const taskOperation = Promise.resolve().then(task);
      const operation = taskOperation.finally(() => {
        if (inFlight === operation) inFlight = null;
      });
      inFlight = operation;
      return operation;
    },
    isRunning(): boolean {
      return inFlight !== null;
    },
  };
}
