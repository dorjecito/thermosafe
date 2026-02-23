// src/utils/getLocationNameFromCoords.ts

type GeoReverseItem = {
  name?: string;
  state?: string;
  country?: string;
  local_names?: Record<string, string>;
};

function pickLocalName(item: GeoReverseItem, lang?: string) {
  const l = (lang || "").toLowerCase();
  // Intenta primer amb local_names segons idioma
  const ln = item.local_names;
  const byLang =
    (l && ln?.[l]) ||
    (l.startsWith("ca") && ln?.ca) ||
    (l.startsWith("es") && ln?.es) ||
    (l.startsWith("eu") && ln?.eu) ||
    (l.startsWith("gl") && ln?.gl) ||
    (l.startsWith("en") && ln?.en);

  // Fallback final a name
  return (byLang || item.name || "").trim();
}

export async function getLocationNameFromCoords(
  lat: number,
  lon: number,
  lang?: string
): Promise<string> {
  try {
    const API_KEY =
      (import.meta as any).env?.VITE_OPENWEATHER_KEY ||
      (import.meta as any).env?.VITE_OWM_KEY ||
      (import.meta as any).env?.VITE_OPENWEATHER_API_KEY;

    if (!API_KEY) return "";

    const url = `https://api.openweathermap.org/geo/1.0/reverse?lat=${lat}&lon=${lon}&limit=1&appid=${API_KEY}`;
    const res = await fetch(url);

    if (!res.ok) {
      // Opcional debug
      console.warn("[GeoReverse] HTTP", res.status, res.statusText);
      return "";
    }

    const data = (await res.json()) as GeoReverseItem[];
    const first = data?.[0];
    if (!first) return "";

    const name = pickLocalName(first, lang);
    return name; // pot ser "" si no hi ha res
  } catch (error) {
    console.error("Error obtenint el nom de la ubicació (OpenWeather):", error);
    return "";
  }
}