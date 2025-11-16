// 🌤️ Serveis meteorològics unificats (OpenWeather 2.5 i 3.0)

const BASE_URL = "https://api.openweathermap.org/data/2.5";
const GEO_URL = "https://api.openweathermap.org/geo/1.0";
const ONECALL_URL = "https://api.openweathermap.org/data/3.0/onecall";

// 📡 Obté temps actual per coordenades
export async function getWeatherByCoords(
  lat: number,
  lon: number,
  lang: string = "en",
  apiKey?: string
) {
  const API_KEY = apiKey || import.meta.env.VITE_OPENWEATHER_API_KEY;
  const url = `${BASE_URL}/weather?lat=${lat}&lon=${lon}&appid=${API_KEY}&units=metric&lang=${lang}`;

  try {
    const response = await fetch(url);
    if (!response.ok) return null;

    const data = await response.json();

    if (!data.name && data.sys?.country) {
      data.name = data.sys.country;
    }

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
  const url = `${BASE_URL}/weather?q=${encodeURIComponent(
    cityName
  )}&appid=${API_KEY}&units=metric&lang=${lang}`;

  try {
    const response = await fetch(url);
    if (!response.ok) return null;

    const data = await response.json();

    // Si falten coordenades, recuperar-les via GeoAPI
    if (!data.coord?.lat || !data.coord?.lon) {
      const geoUrl = `${GEO_URL}/direct?q=${encodeURIComponent(
        cityName
      )}&limit=1&appid=${API_KEY}`;
      const geoResp = await fetch(geoUrl);
      const geoData = await geoResp.json();

      if (geoData.length > 0) {
        data.coord = { lat: geoData[0].lat, lon: geoData[0].lon };
        data.name =
          geoData[0].local_names?.[lang] ||
          geoData[0].local_names?.ca ||
          geoData[0].name ||
          cityName;
      }
    }

    if (!data.name) data.name = cityName;

    return data;
  } catch (err) {
    console.error("[DEBUG] Error a getWeatherByCity:", err);
    return null;
  }
}

// ⚠️ Avisos meteorològics One Call 3.0
export async function getWeatherAlerts(
  lat: number,
  lon: number,
  lang: string = "en",
  apiKey?: string
) {
  const API_KEY = apiKey || import.meta.env.VITE_OPENWEATHER_API_KEY;
  const url = `${ONECALL_URL}?lat=${lat}&lon=${lon}&appid=${API_KEY}&units=metric&lang=${lang}&exclude=current,minutely,hourly,daily`;

  try {
    const response = await fetch(url);
    if (!response.ok) return [];

    const data = await response.json();
    return data.alerts || [];
  } catch (err) {
    console.error("[DEBUG] Error obtenint avisos meteorològics:", err);
    return [];
  }
}

// ☀️ Índex UV oficial One Call API 3.0
export async function getUVFromOW(
  lat: number,
  lon: number
): Promise<number | null> {
  try {
    const API_KEY = import.meta.env.VITE_OPENWEATHER_API_KEY;
    const url = `${ONECALL_URL}?lat=${lat}&lon=${lon}&appid=${API_KEY}&units=metric&exclude=minutely,hourly,daily,alerts`;

    console.log("[DEBUG] Fetch UVI OW →", url);

    const response = await fetch(url);
    if (!response.ok) {
      console.warn("[DEBUG] Error OW UVI:", response.status);
      return null;
    }

    const data = await response.json();
    console.log("[DEBUG] OneCall 3.0 response:", data);

    // Camp correcte
    const uvi =
      data?.current?.uvi ?? // oficial
      data?.current?.uv ??  // fallback ocasional
      null;

    return typeof uvi === "number" ? uvi : null;
  } catch (err) {
    console.error("[DEBUG] Error obtenint UVI OW:", err);
    return null;
  }
}

// 💨 Converteix direcció del vent
export function getWindDirection(deg: number): string {
  const dirs = ["N", "NE", "E", "SE", "S", "SO", "O", "NO"];
  return dirs[Math.round(deg / 45) % 8];
}