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

export async function getCoords(): Promise<{ lat: number; lon: number } | null> {
  // 1) intent GPS fi (clau per iPhone)
  const fine = await getOnce({
    enableHighAccuracy: true,
    timeout: 12000,
    maximumAge: 0,
  });

  if (fine && (fine.acc ?? 999999) <= 200) {
    return { lat: fine.lat, lon: fine.lon };
  }

  // 2) fallback ràpid
  const coarse = await getOnce({
    enableHighAccuracy: false,
    timeout: 8000,
    maximumAge: 0,
  });

  if (coarse) return { lat: coarse.lat, lon: coarse.lon };

  if (fine) return { lat: fine.lat, lon: fine.lon };

  return null;
}