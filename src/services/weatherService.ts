// 🌤️ Serveis meteorològics unificats (OpenWeather 2.5 i 3.0)

const OPENWEATHER_PROXY_URL = "/api/openweather";

const DIRECT_ENDPOINTS = {
  weather: "https://api.openweathermap.org/data/2.5/weather",
  onecall: "https://api.openweathermap.org/data/3.0/onecall",
  "geo-direct": "https://api.openweathermap.org/geo/1.0/direct",
} as const;

const normLang2 = (lang: string) => (lang || "en").slice(0, 2).toLowerCase();

const CACHE_TTL = 10 * 60 * 1000; // 10 minuts

type CacheEntry<T> = {
  timestamp: number;
  data: T;
};

const weatherCache = new Map<string, CacheEntry<any>>();

function getCacheKey(prefix: string, ...parts: (string | number)[]) {
  return `${prefix}:${parts.join(":")}`;
}

function getFromCache<T>(key: string): T | null {
  const entry = weatherCache.get(key);

  if (!entry) return null;

  const isExpired = Date.now() - entry.timestamp > CACHE_TTL;

  if (isExpired) {
    weatherCache.delete(key);
    return null;
  }

  return entry.data as T;
}

function saveToCache<T>(key: string, data: T) {
  weatherCache.set(key, {
    timestamp: Date.now(),
    data,
  });
}

function getDirectApiKey(apiKey?: string): string | null {
  const key =
    apiKey ||
    (import.meta.env.DEV
      ? import.meta.env.VITE_OPENWEATHER_API_KEY ||
        import.meta.env.VITE_OPENWEATHER_KEY ||
        import.meta.env.VITE_OWM_KEY
      : "");
  return typeof key === "string" && key.trim() ? key.trim() : null;
}

function buildOpenWeatherUrl(
  route: keyof typeof DIRECT_ENDPOINTS,
  params: Record<string, string | number>,
  apiKey?: string
) {
  const directKey = getDirectApiKey(apiKey);
  const url = new URL(
    directKey ? DIRECT_ENDPOINTS[route] : OPENWEATHER_PROXY_URL,
    directKey ? undefined : window.location.origin
  );

  if (!directKey) url.searchParams.set("route", route);

  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, String(value));
  }

  if (directKey) url.searchParams.set("appid", directKey);

  return directKey ? url.toString() : `${url.pathname}${url.search}`;
}

// 📡 Obté temps actual per coordenades
export async function getWeatherByCoords(
  lat: number,
  lon: number,
  lang: string = "en",
  apiKey?: string
) {
  const lang2 = normLang2(lang);

  const cacheKey = getCacheKey("coords", lat.toFixed(4), lon.toFixed(4), lang2);
  const cached = getFromCache<any>(cacheKey);
  if (cached) return cached;

  const url = buildOpenWeatherUrl(
    "weather",
    { lat, lon, units: "metric", lang: lang2 },
    apiKey
  );

  try {
    const response = await fetch(url);
    if (!response.ok) {
      console.error("[DEBUG] Error HTTP a getWeatherByCoords:", response.status);
      return null;
    }

    const data = await response.json();

    if (!data || typeof data !== "object") return null;

    // ❗ No posam country com a "name". Si falta name, millor deixar-ho buit
    // i resoldre-ho fora amb reverse geocoding.
    if (typeof data.name !== "string") data.name = "";

    saveToCache(cacheKey, data);
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
  const lang2 = normLang2(lang);

  const cacheKey = getCacheKey("city", cityName.trim().toLowerCase(), lang2);
  const cached = getFromCache<any>(cacheKey);
  if (cached) return cached;

  const url = buildOpenWeatherUrl(
    "weather",
    { q: cityName, units: "metric", lang: lang2 },
    apiKey
  );

  try {
    const response = await fetch(url);
    if (!response.ok) {
      console.error("[DEBUG] Error HTTP a getWeatherByCity:", response.status);
      return null;
    }

    const data = await response.json();
    if (!data || typeof data !== "object") return null;

    // Si falten coordenades, recuperar-les via Geo API
    const missingCoords = data?.coord?.lat == null || data?.coord?.lon == null;

    if (missingCoords) {
      const geoUrl = buildOpenWeatherUrl(
        "geo-direct",
        { q: cityName, limit: 1 },
        apiKey
      );

      try {
        const geoResp = await fetch(geoUrl);

        if (geoResp.ok) {
          const geoData = await geoResp.json();

          if (Array.isArray(geoData) && geoData.length > 0) {
            const g0 = geoData[0];
            data.coord = { lat: g0.lat, lon: g0.lon };

            // Nom preferit: local_names[lang2] → ca → name → cityName
            data.name =
              g0?.local_names?.[lang2] ||
              g0?.local_names?.ca ||
              g0?.name ||
              cityName;
          }
        }
      } catch (geoErr) {
        console.error("[DEBUG] Error a Geo API dins getWeatherByCity:", geoErr);
      }
    }

    if (typeof data.name !== "string" || !data.name.trim()) {
      data.name = cityName;
    }

    saveToCache(cacheKey, data);
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
): Promise<any[]> {
  const lang2 = normLang2(lang);
  const cacheKey = getCacheKey("alerts", lat.toFixed(3), lon.toFixed(3), lang2);
  const cached = getFromCache<any[]>(cacheKey);

  if (cached) return cached;

  // Demanam essencialment alerts
  const url = buildOpenWeatherUrl(
    "onecall",
    {
      lat,
      lon,
      units: "metric",
      lang: lang2,
      exclude: "current,minutely,hourly,daily",
    },
    apiKey
  );

  try {
    const response = await fetch(url);

    if (!response.ok) {
      console.error("[DEBUG] Error HTTP a getWeatherAlerts:", response.status);
      return [];
    }

    const data = await response.json();
    const alerts = Array.isArray(data?.alerts) ? data.alerts : [];

    saveToCache(cacheKey, alerts);
    return alerts;
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
  const cacheKey = getCacheKey("uv", lat.toFixed(2), lon.toFixed(2));
  const cached = getFromCache<number | null>(cacheKey);
  if (cached !== null) return cached;

  try {
    // Deixam només current
    const url = buildOpenWeatherUrl(
      "onecall",
      {
        lat,
        lon,
        units: "metric",
        exclude: "minutely,hourly,daily,alerts",
      },
      apiKey
    );

    const response = await fetch(url);

    if (!response.ok) {
      console.error("[DEBUG] Error HTTP a getUVFromOW:", response.status);
      return null;
    }

    const data = await response.json();

    const uvi =
      data?.current?.uvi ?? // oficial
      data?.current?.uv ?? // fallback rar
      null;

    const validUvi =
      typeof uvi === "number" && Number.isFinite(uvi) ? uvi : null;

    saveToCache(cacheKey, validUvi);
    return validUvi;
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
