import { startupEnd, startupStart } from "./startupAudit";

export type Coords = { lat: number; lon: number; acc?: number };

function getOnce(opts: PositionOptions): Promise<Coords | null> {
  if (!("geolocation" in navigator)) return Promise.resolve(null);

  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({
          lat: pos.coords.latitude,
          lon: pos.coords.longitude,
          acc: pos.coords.accuracy,
        }),
      () => resolve(null),
      opts
    );
  });
}

export async function getCoords(): Promise<Coords | null> {
  // 1) intent GPS fi (clau per iPhone)
  startupStart("gps-high-accuracy", {
    enableHighAccuracy: true,
    maximumAge: 0,
    timeoutMs: 12000,
  });
  const fine = await getOnce({
    enableHighAccuracy: true,
    timeout: 12000,
    maximumAge: 0,
  });
  startupEnd("gps-high-accuracy", {
    result: fine ? "position" : "none",
    accuracyBucket:
      typeof fine?.acc === "number"
        ? fine.acc <= 50
          ? "<=50m"
          : fine.acc <= 200
          ? "<=200m"
          : ">200m"
        : "unknown",
  });

  if (fine && (fine.acc ?? 999999) <= 200) {
    return fine;
  }

  // 2) fallback ràpid
  startupStart("gps-coarse-fallback", {
    enableHighAccuracy: false,
    maximumAge: 0,
    timeoutMs: 8000,
  });
  const coarse = await getOnce({
    enableHighAccuracy: false,
    timeout: 8000,
    maximumAge: 0,
  });
  startupEnd("gps-coarse-fallback", {
    result: coarse ? "position" : "none",
    accuracyBucket:
      typeof coarse?.acc === "number"
        ? coarse.acc <= 50
          ? "<=50m"
          : coarse.acc <= 200
          ? "<=200m"
          : ">200m"
        : "unknown",
  });

  if (coarse) return coarse;

  if (fine) return fine;

  return null;
}
