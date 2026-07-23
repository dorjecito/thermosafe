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
  const fine = await getOnce({
    enableHighAccuracy: true,
    timeout: 12000,
    maximumAge: 0,
  });

  if (fine && (fine.acc ?? 999999) <= 200) {
    return fine;
  }

  // 2) fallback ràpid
  const coarse = await getOnce({
    enableHighAccuracy: false,
    timeout: 8000,
    maximumAge: 0,
  });

  if (coarse) return coarse;

  if (fine) return fine;

  return null;
}
