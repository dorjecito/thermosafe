import { getUVFromOpenUV } from "../services/openUV";

export async function safeUVFetch(
  lat: number,
  lon: number,
  isDay: boolean
): Promise<number | null> {
  if (!isDay) {
    console.log("[UV] Nit a la ubicació consultada → no es consulta OpenUV");
    return 0;
  }

  try {
    console.log("[UV] És de dia a la ubicació → consultant OpenUV…");
    const uv = await getUVFromOpenUV(lat, lon);
    return typeof uv === "number" ? uv : null;
  } catch (err) {
    console.error("[UV] Error consultant OpenUV:", err);
    return null;
  }
}