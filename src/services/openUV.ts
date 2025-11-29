// src/services/openUV.ts
export async function getUVFromOpenUV(lat: number, lon: number): Promise<number | null> {
  try {
    const API_KEY = import.meta.env.VITE_OPENUV_KEY;
    if (!API_KEY) {
      console.error("[OpenUV] Falta VITE_OPENUV_KEY a .env");
      return null;
    }

    const url = `https://api.openuv.io/api/v1/uv?lat=${lat}&lng=${lon}`;

    console.log("[OpenUV] Fetch:", url);

    const response = await fetch(url, {
      headers: {
        "x-access-token": API_KEY,
      },
    });

    const data = await response.json();
    console.log("[OpenUV] Response:", data);

    const uvi = data.result?.uv ?? null;
    return typeof uvi === "number" ? uvi : null;

  } catch (err) {
    console.error("[OpenUV] Error obtenint UVI:", err);
    return null;
  }
}