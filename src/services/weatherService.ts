// 🌤️ Serveis meteorològics unificats (OpenWeather 2.5 i 3.0)
import { startupEnd, startupStart } from "../utils/startupAudit";

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
const forecastInflight = new Map<string, Promise<HourlyForecastResponse | null>>();

export type HourlyForecastItem = {
  dt: number;
  temp?: number;
  feels_like?: number;
  humidity?: number;
  wind_speed?: number;
  wind_gust?: number;
  clouds?: number;
  uvi?: number;
  weather?: Array<{ main?: string; description?: string; icon?: string }>;
};

export type HourlyForecastResponse = {
  hourly: HourlyForecastItem[];
  timezone_offset?: number;
  stale?: boolean;
};

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

function getRoundedForecastBlock(now = Date.now()) {
  return Math.floor(now / (60 * 60 * 1000));
}

function getForecastStorageKey(lat: number, lon: number, lang: string, block = getRoundedForecastBlock()) {
  const latKey = Number(lat).toFixed(2);
  const lonKey = Number(lon).toFixed(2);
  return getCacheKey("forecast-hourly-v1", latKey, lonKey, block, normLang2(lang));
}

function getStoredForecast(key: string, ttlMs: number): HourlyForecastResponse | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;

    const parsed = JSON.parse(raw);
    const timestamp = typeof parsed?.timestamp === "number" ? parsed.timestamp : 0;
    const data = parsed?.data;

    if (!Array.isArray(data?.hourly)) return null;
    if (Date.now() - timestamp > ttlMs) return null;

    return data;
  } catch (err) {
    console.warn("[FORECAST] Error llegint caché local:", err);
    return null;
  }
}

function getStoredForecastFallback(
  lat: number,
  lon: number,
  lang: string,
  ttlMs: number
): HourlyForecastResponse | null {
  const currentBlock = getRoundedForecastBlock();

  for (let block = currentBlock; block >= currentBlock - 6; block -= 1) {
    const cached = getStoredForecast(getForecastStorageKey(lat, lon, lang, block), ttlMs);
    if (cached) return cached;
  }

  return null;
}

function saveStoredForecast(key: string, data: HourlyForecastResponse) {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(
      key,
      JSON.stringify({
        timestamp: Date.now(),
        data,
      })
    );
  } catch (err) {
    console.warn("[FORECAST] Error guardant caché local:", err);
  }
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
  if (cached) {
    startupStart("openweather-current", { source: "coords", cache: "memory-hit" });
    startupEnd("openweather-current", { status: "cache-hit" });
    return cached;
  }

  const url = buildOpenWeatherUrl(
    "weather",
    { lat, lon, units: "metric", lang: lang2 },
    apiKey
  );

  try {
    startupStart("openweather-current", { source: "coords", cache: "miss" });
    const response = await fetch(url);
    if (!response.ok) {
      startupEnd("openweather-current", { status: "http-error", httpStatus: response.status });
      console.error("[DEBUG] Error HTTP a getWeatherByCoords:", response.status);
      return null;
    }

    const data = await response.json();

    if (!data || typeof data !== "object") return null;

    // ❗ No posam country com a "name". Si falta name, millor deixar-ho buit
    // i resoldre-ho fora amb reverse geocoding.
    if (typeof data.name !== "string") data.name = "";

    saveToCache(cacheKey, data);
    startupEnd("openweather-current", { status: "ok" });
    return data;
  } catch (err) {
    startupEnd("openweather-current", { status: "error" });
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
  if (cached) {
    startupStart("openweather-city", { cache: "memory-hit" });
    startupEnd("openweather-city", { status: "cache-hit" });
    return cached;
  }

  const url = buildOpenWeatherUrl(
    "weather",
    { q: cityName, units: "metric", lang: lang2 },
    apiKey
  );

  try {
    startupStart("openweather-city", { cache: "miss" });
    const response = await fetch(url);
    if (!response.ok) {
      startupEnd("openweather-city", { status: "http-error", httpStatus: response.status });
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
    startupEnd("openweather-city", { status: "ok" });
    return data;
  } catch (err) {
    startupEnd("openweather-city", { status: "error" });
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

  if (cached) {
    startupStart("openweather-alerts", { cache: "memory-hit" });
    startupEnd("openweather-alerts", { status: "cache-hit" });
    return cached;
  }

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
    startupStart("openweather-alerts", { cache: "miss" });
    const response = await fetch(url);

    if (!response.ok) {
      startupEnd("openweather-alerts", { status: "http-error", httpStatus: response.status });
      console.error("[DEBUG] Error HTTP a getWeatherAlerts:", response.status);
      return [];
    }

    const data = await response.json();
    const alerts = Array.isArray(data?.alerts) ? data.alerts : [];

    saveToCache(cacheKey, alerts);
    startupEnd("openweather-alerts", { status: "ok", alertsCount: alerts.length });
    return alerts;
  } catch (err) {
    startupEnd("openweather-alerts", { status: "error" });
    console.error("[DEBUG] Error obtenint avisos meteorològics:", err);
    return [];
  }
}

export async function getHourlyForecastByCoords(
  lat: number,
  lon: number,
  lang: string = "en",
  apiKey?: string
): Promise<HourlyForecastResponse | null> {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  if (typeof document !== "undefined" && document.hidden) return null;

  const lang2 = normLang2(lang);
  const storageKey = getForecastStorageKey(lat, lon, lang2);
  const freshTtl = 60 * 60 * 1000;
  const staleTtl = 6 * 60 * 60 * 1000;

  const fresh = getStoredForecast(storageKey, freshTtl);
  if (fresh) {
    startupStart("openweather-hourly-forecast", { cache: "localStorage-fresh" });
    startupEnd("openweather-hourly-forecast", { status: "cache-hit" });
    return fresh;
  }

  if (forecastInflight.has(storageKey)) {
    return forecastInflight.get(storageKey)!;
  }

  const promise = (async () => {
    const stale = getStoredForecastFallback(lat, lon, lang2, staleTtl);

    try {
      startupStart("openweather-hourly-forecast", {
        cache: stale ? "stale-available" : "miss",
      });
      const url = buildOpenWeatherUrl(
        "onecall",
        {
          lat,
          lon,
          units: "metric",
          lang: lang2,
          exclude: "current,minutely,daily,alerts",
        },
        apiKey
      );

      const response = await fetch(url);

      if (!response.ok) {
        startupEnd("openweather-hourly-forecast", {
          status: "http-error",
          httpStatus: response.status,
          fallback: Boolean(stale),
        });
        console.error("[FORECAST] Error HTTP:", response.status);
        return stale ? { ...stale, stale: true } : null;
      }

      const data = await response.json();
      const hourly = Array.isArray(data?.hourly) ? data.hourly : [];

      if (!hourly.length) {
        startupEnd("openweather-hourly-forecast", {
          status: "empty",
          fallback: Boolean(stale),
        });
        return stale ? { ...stale, stale: true } : null;
      }

      const normalized: HourlyForecastResponse = {
        hourly,
        timezone_offset:
          typeof data?.timezone_offset === "number" ? data.timezone_offset : undefined,
      };

      saveStoredForecast(storageKey, normalized);
      startupEnd("openweather-hourly-forecast", { status: "ok", hourlyCount: hourly.length });
      return normalized;
    } catch (err) {
      startupEnd("openweather-hourly-forecast", {
        status: "error",
        fallback: Boolean(stale),
      });
      console.warn("[FORECAST] Error obtenint previsió horària:", err);
      return stale ? { ...stale, stale: true } : null;
    }
  })();

  forecastInflight.set(storageKey, promise);

  try {
    return await promise;
  } finally {
    forecastInflight.delete(storageKey);
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
