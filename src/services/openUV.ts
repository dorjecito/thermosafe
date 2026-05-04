// src/services/openUV.ts

// ==============================
// 🔹 Tipus
// ==============================

export type OpenUVSunInfo = {
  sun_times?: {
    sunrise?: string;
    sunset?: string;
    solar_noon?: string;
    golden_hour?: string;
  };
  sun_position?: {
    azimuth?: number;
    altitude?: number;
  };
};

export type OpenUVCurrentResponse = {
  result?: {
    uv: number;
    uv_time: string;
    uv_max?: number;
    uv_max_time?: string;
    sun_info?: OpenUVSunInfo;
    safe_exposure_time?: Record<string, number | null>;
    ozone?: number;
    ozone_time?: string;
  };
};

export type OpenUVForecastPoint = {
  uv: number;
  uv_time: string;
};

export type OpenUVForecastResponse = {
  result?: OpenUVForecastPoint[];
};

export type SafeExposureTime = {
  st1?: number | null;
  st2?: number | null;
  st3?: number | null;
  st4?: number | null;
  st5?: number | null;
  st6?: number | null;
};

export type OpenUVDetail = {
  uv: number | null;
  uv_time?: string;
  uv_max?: number | null;
  uv_max_time?: string;
  sun_info?: OpenUVSunInfo;
  safe_exposure_time?: SafeExposureTime;
  ozone?: number | null;
  ozone_time?: string;
};

// ==============================
// 🔹 Caché i deduplicació
// ==============================

const UV_NOW_TTL = 5 * 60 * 1000;
const UV_DETAIL_TTL = 10 * 60 * 1000;

type CacheEntry<T> = {
  ts: number;
  data: T;
};

const uvNowCache = new Map<string, CacheEntry<number | null>>();
const uvDetailCache = new Map<string, CacheEntry<OpenUVDetail | null>>();

const uvNowPending = new Map<string, Promise<number | null>>();
const uvDetailPending = new Map<string, Promise<OpenUVDetail | null>>();

function roundCoord(value: number): string {
  return Number(value).toFixed(3);
}

function makeKey(lat: number, lon: number): string {
  return `${roundCoord(lat)}:${roundCoord(lon)}`;
}

function getCached<T>(
  map: Map<string, CacheEntry<T>>,
  key: string,
  ttl: number
): T | null {
  const entry = map.get(key);
  if (!entry) return null;

  if (Date.now() - entry.ts > ttl) {
    map.delete(key);
    return null;
  }

  return entry.data;
}

function setCached<T>(
  map: Map<string, CacheEntry<T>>,
  key: string,
  data: T
) {
  map.set(key, {
    ts: Date.now(),
    data,
  });
}

// ==============================
// 🔹 Fetch segur via proxy Vercel
// ==============================

async function fetchOpenUVProxy(
  lat: number,
  lon: number
): Promise<OpenUVCurrentResponse> {
  const url = `/api/openuv?lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}`;

  console.log("[OpenUV] Fetch via proxy:", url);

  const response = await fetch(url);

  if (!response.ok) {
    const txt = await response.text().catch(() => "");
    throw new Error(`OpenUV proxy error ${response.status}: ${txt}`);
  }

  return response.json();
}

// ==============================
// 🔹 UVI actual
// ==============================

export async function getUVFromOpenUV(
  lat: number,
  lon: number
): Promise<number | null> {
  const key = makeKey(lat, lon);

  const cached = getCached(uvNowCache, key, UV_NOW_TTL);
  if (cached !== null) {
    console.log("[OpenUV] UV des de caché:", key, cached);
    return cached;
  }

  const pending = uvNowPending.get(key);
  if (pending) {
    console.log("[OpenUV] reutilitzant petició UV en curs:", key);
    return pending;
  }

  const request = (async () => {
    try {
      const data = await fetchOpenUVProxy(lat, lon);

      console.log("[OpenUV] UV Response:", data);

      const uvi = data.result?.uv ?? null;
      const safeUvi =
        typeof uvi === "number" && Number.isFinite(uvi) ? uvi : null;

      setCached(uvNowCache, key, safeUvi);
      return safeUvi;
    } catch (err) {
      console.error("[OpenUV] Error obtenint UVI:", err);
      return null;
    } finally {
      uvNowPending.delete(key);
    }
  })();

  uvNowPending.set(key, request);
  return request;
}

// ==============================
// 🔹 Forecast horari
// Ara mateix retorna [] perquè el proxy actual només cobreix /uv.
// Si més endavant vols forecast, ampliam api/openuv.ts.
// ==============================

export async function getUVForecast(
  lat: number,
  lon: number
): Promise<OpenUVForecastPoint[]> {
  console.warn("[OpenUV] Forecast no implementat encara al proxy.", { lat, lon });
  return [];
}

// ==============================
// 🔹 Detall UV
// ==============================

export async function getUVDetailFromOpenUV(
  lat: number,
  lon: number
): Promise<OpenUVDetail | null> {
  const key = makeKey(lat, lon);

  const cached = getCached(uvDetailCache, key, UV_DETAIL_TTL);
  if (cached !== null) {
    console.log("[OpenUV] UV detail des de caché:", key);
    return cached;
  }

  const pending = uvDetailPending.get(key);
  if (pending) {
    console.log("[OpenUV] reutilitzant petició UV detail en curs:", key);
    return pending;
  }

  const request = (async () => {
    try {
      const data = await fetchOpenUVProxy(lat, lon);

      const r = data?.result;

      console.log("[OpenUV] UV detail result keys:", Object.keys(r || {}));
      console.log("[OpenUV] safe_exposure_time:", r?.safe_exposure_time);

      const uv =
        typeof r?.uv === "number" && Number.isFinite(r.uv) ? r.uv : null;

      const raw = r?.safe_exposure_time as
        | Record<string, number | null>
        | undefined;

      const safe: SafeExposureTime | undefined = raw
        ? {
            st1: raw.st1 ?? raw["1"] ?? null,
            st2: raw.st2 ?? raw["2"] ?? null,
            st3: raw.st3 ?? raw["3"] ?? null,
            st4: raw.st4 ?? raw["4"] ?? null,
            st5: raw.st5 ?? raw["5"] ?? null,
            st6: raw.st6 ?? raw["6"] ?? null,
          }
        : undefined;

      const ozone =
        typeof r?.ozone === "number" && Number.isFinite(r.ozone)
          ? r.ozone
          : null;

      const uv_max =
        typeof r?.uv_max === "number" && Number.isFinite(r.uv_max)
          ? r.uv_max
          : null;

      const detail: OpenUVDetail = {
        uv,
        uv_time: r?.uv_time,
        uv_max,
        uv_max_time:
          typeof r?.uv_max_time === "string" ? r.uv_max_time : undefined,
        sun_info: r?.sun_info,
        safe_exposure_time: safe,
        ozone,
        ozone_time:
          typeof r?.ozone_time === "string" ? r.ozone_time : undefined,
      };

      setCached(uvDetailCache, key, detail);
      return detail;
    } catch (err) {
      console.error("[OpenUV] Error obtenint detall UV:", err);
      return null;
    } finally {
      uvDetailPending.delete(key);
    }
  })();

  uvDetailPending.set(key, request);
  return request;
}