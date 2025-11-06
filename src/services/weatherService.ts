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
    if (!response.ok) {
      console.error(`[OpenWeather] Error ${response.status} per coordenades: ${lat}, ${lon}`);
      return null;
    }

    const data = await response.json();

    // 🏙️ Afegeix nom si no hi és
    if (!data.name && data.sys?.country) {
      data.name = `${data.sys.country}`;
    }

    console.log(`[DEBUG] Dades rebudes per coordenades: ${lat}, ${lon} → ${data.name}`);
    return data;
  } catch (err) {
    console.error("[DEBUG] Error a getWeatherByCoords:", err);
    return null;
  }
}

// 🏙️ Obté temps actual per nom de ciutat
export async function getWeatherByCity(cityName: string, lang: string = "en", apiKey?: string) {
  const API_KEY = apiKey || import.meta.env.VITE_OPENWEATHER_API_KEY;
  const url = `${BASE_URL}/weather?q=${encodeURIComponent(cityName)}&appid=${API_KEY}&units=metric&lang=${lang}`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      console.error(`[OpenWeather] Error ${response.status} per ciutat: ${cityName}`);
      return null;
    }

    const data = await response.json();

    // 📍 Si falta coord, intenta recuperar-la via Geo API
    if (!data.coord || !data.coord.lat || !data.coord.lon) {
      console.warn(`[OpenWeather] Coordenades absents per ${cityName}, intentant recuperar...`);
      const geoUrl = `${GEO_URL}/direct?q=${encodeURIComponent(cityName)}&limit=1&appid=${API_KEY}`;
      const geoResp = await fetch(geoUrl);
      const geoData = await geoResp.json();

      if (Array.isArray(geoData) && geoData.length > 0) {
        data.coord = { lat: geoData[0].lat, lon: geoData[0].lon };
        data.name =
          geoData[0].local_names?.[lang] ||
          geoData[0].local_names?.ca ||
          geoData[0].name ||
          cityName;
      }
    }

    if (!data.name) data.name = cityName;

    console.log(`[DEBUG] Dades meteorològiques per ciutat: ${data.name}`, data);
    return data;
  } catch (err) {
    console.error("[DEBUG] Error a getWeatherByCity:", err);
    return null;
  }
}

// ⚠️ Avisos meteorològics (versió 3.0)
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
    if (!response.ok) {
      console.warn(`[OpenWeather] Sense avisos per ${lat}, ${lon}`);
      return [];
    }

    const data = await response.json();
    return data.alerts || [];
  } catch (err) {
    console.error("[DEBUG] Error obtenint avisos meteorològics:", err);
    return [];
  }
}

// 💨 Converteix direcció del vent
export function getWindDirection(deg: number): string {
  const dirs = ["N", "NE", "E", "SE", "S", "SO", "O", "NO"];
  return dirs[Math.round(deg / 45) % 8];
}