// 🌤️ Serveis meteorològics unificats (OpenWeather 2.5 i 3.0)

const BASE_URL = "https://api.openweathermap.org/data/2.5";
const GEO_URL = "https://api.openweathermap.org/geo/1.0";
const ONECALL_URL = "https://api.openweathermap.org/data/3.0/onecall";

const normLang2 = (lang: string) => (lang || "en").slice(0, 2).toLowerCase();

// 📡 Obté temps actual per coordenades
export async function getWeatherByCoords(
  lat: number,
  lon: number,
  lang: string = "en",
  apiKey?: string
) {
  const API_KEY = apiKey || import.meta.env.VITE_OPENWEATHER_API_KEY;
  const lang2 = normLang2(lang);

  const url = `${BASE_URL}/weather?lat=${lat}&lon=${lon}&appid=${API_KEY}&units=metric&lang=${lang2}`;

  try {
    const response = await fetch(url);
    if (!response.ok) return null;

    const data = await response.json();

    // ❗ No posam country com a "name". Si falta name, millor deixar-ho buit i resoldre-ho fora (reverse geocoding).
    if (typeof data?.name !== "string") data.name = "";

    return data;
  } catch (err) {
    console.error("[DEBUG] Error a getWeatherByCoords:", err);
    return null;
  }
}

// 🏙️ Obté temps actual per ciutat
export async function getWeatherByCity(
  cityName: string,
  lang: string = "en",
  apiKey?: string
) {
  const API_KEY = apiKey || import.meta.env.VITE_OPENWEATHER_API_KEY;
  const lang2 = normLang2(lang);

  const url = `${BASE_URL}/weather?q=${encodeURIComponent(cityName)}&appid=${API_KEY}&units=metric&lang=${lang2}`;

  try {
    const response = await fetch(url);
    if (!response.ok) return null;

    const data = await response.json();

    // Si falten coordenades, recuperar-les via GeoAPI
    const missingCoords = data?.coord?.lat == null || data?.coord?.lon == null;

    if (missingCoords) {
      const geoUrl = `${GEO_URL}/direct?q=${encodeURIComponent(cityName)}&limit=1&appid=${API_KEY}`;

      const geoResp = await fetch(geoUrl);
      if (geoResp.ok) {
        const geoData = await geoResp.json();

        if (Array.isArray(geoData) && geoData.length > 0) {
          const g0 = geoData[0];
          data.coord = { lat: g0.lat, lon: g0.lon };

          // Nom preferit: local_names[lang2] → ca → name → cityName
          data.name =
            g0.local_names?.[lang2] ||
            g0.local_names?.ca ||
            g0.name ||
            cityName;
        }
      }
    }

    if (typeof data?.name !== "string" || !data.name.trim()) data.name = cityName;

    return data;
  } catch (err) {
    console.error("[DEBUG] Error a getWeatherByCity:", err);
    return null;
  }
}

// ⚠️ Avisos meteorològics One Call 3.0 (alerts)
export async function getWeatherAlerts(
  lat: number,
  lon: number,
  lang: string = "en",
  apiKey?: string
) {
  const API_KEY = apiKey || import.meta.env.VITE_OPENWEATHER_API_KEY;
  const lang2 = normLang2(lang);

  // Volem essencialment alerts
  const url = `${ONECALL_URL}?lat=${lat}&lon=${lon}&appid=${API_KEY}&units=metric&lang=${lang2}&exclude=current,minutely,hourly,daily`;

  try {
    const response = await fetch(url);
    if (!response.ok) return [];

    const data = await response.json();
    return Array.isArray(data?.alerts) ? data.alerts : [];
  } catch (err) {
    console.error("[DEBUG] Error obtenint avisos meteorològics:", err);
    return [];
  }
}

// ☀️ Índex UV oficial One Call API 3.0
export async function getUVFromOW(
  lat: number,
  lon: number,
  apiKey?: string
): Promise<number | null> {
  try {
    const API_KEY = apiKey || import.meta.env.VITE_OPENWEATHER_API_KEY;

    // Deixam només current
    const url = `${ONECALL_URL}?lat=${lat}&lon=${lon}&appid=${API_KEY}&units=metric&exclude=minutely,hourly,daily,alerts`;

    const response = await fetch(url);
    if (!response.ok) return null;

    const data = await response.json();

    const uvi =
      data?.current?.uvi ?? // oficial
      data?.current?.uv ??  // fallback rar
      null;

    return typeof uvi === "number" && Number.isFinite(uvi) ? uvi : null;
  } catch (err) {
    console.error("[DEBUG] Error obtenint UVI OW:", err);
    return null;
  }
}

// 💨 Converteix direcció del vent
export function getWindDirection(deg: number): string {
  const dirs = ["N", "NE", "E", "SE", "S", "SO", "O", "NO"];
  const d = typeof deg === "number" && Number.isFinite(deg) ? deg : 0;
  return dirs[Math.round(d / 45) % 8];
}