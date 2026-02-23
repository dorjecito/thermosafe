// src/services/openUV.ts

// ==============================
// 🔹 Tipus
// ==============================

export type OpenUVSunInfo = {
  sun_times?: {
    sunrise?: string; // ISO
    sunset?: string;  // ISO
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

    // ✅ AFEGITS (per "UV màxim avui")
    uv_max?: number;
    uv_max_time?: string;

    // ✅ AFEGITS (per sortida i posta)
    sun_info?: OpenUVSunInfo;

    // ✅ Ja els tenies
    safe_exposure_time?: Record<string, number>;
    ozone?: number;
    ozone_time?: string;
  };
};

export type OpenUVForecastPoint = {
  uv: number;
  uv_time: string; // ISO
};

export type OpenUVForecastResponse = {
  result?: OpenUVForecastPoint[];
};

// ==============================
// 🔹 Helpers interns
// ==============================

function getApiKey(): string | null {
  const key = import.meta.env.VITE_OPENUV_KEY;
  if (!key) {
    console.error("[OpenUV] Falta VITE_OPENUV_KEY a .env");
    return null;
  }
  return key;
}

async function safeFetch(url: string, key: string) {
  const response = await fetch(url, {
    headers: {
      "x-access-token": key,
    },
  });

  if (!response.ok) {
    const txt = await response.text().catch(() => "");
    throw new Error(`OpenUV error ${response.status}: ${txt}`);
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
  try {
    const API_KEY = getApiKey();
    if (!API_KEY) return null;

    const url = `https://api.openuv.io/api/v1/uv?lat=${lat}&lng=${lon}`;

    console.log("[OpenUV] Fetch UV:", url);

    const data = (await safeFetch(url, API_KEY)) as OpenUVCurrentResponse;

    console.log("[OpenUV] UV Response:", data);

    const uvi = data.result?.uv ?? null;
    return typeof uvi === "number" ? uvi : null;
  } catch (err) {
    console.error("[OpenUV] Error obtenint UVI:", err);
    return null;
  }
}

// ==============================
// 🔹 Forecast horari
// ==============================

export async function getUVForecast(
  lat: number,
  lon: number
): Promise<OpenUVForecastPoint[]> {
  try {
    const API_KEY = getApiKey();
    if (!API_KEY) return [];

    const url = `https://api.openuv.io/api/v1/forecast?lat=${lat}&lng=${lon}`;

    console.log("[OpenUV] Fetch Forecast:", url);

    const data = (await safeFetch(url, API_KEY)) as OpenUVForecastResponse;

    console.log("[OpenUV] Forecast Response:", data);

    return Array.isArray(data.result) ? data.result : [];
  } catch (err) {
    console.error("[OpenUV] Error obtenint forecast UV:", err);
    return [];
  }
}

// ==============================
// 🔹 Detall UV (inclou safe_exposure_time + UV màxim + sortida/posta)
// ==============================

export type SafeExposureTime = {
  // OpenUV acostuma a retornar claus "st1"..."st6"
  st1?: number;
  st2?: number;
  st3?: number;
  st4?: number;
  st5?: number;
  st6?: number;
};

export type OpenUVDetail = {
  uv: number | null;
  uv_time?: string;

  // ✅ AFEGITS
  uv_max?: number | null;
  uv_max_time?: string;

  // ✅ AFEGITS
  sun_info?: OpenUVSunInfo;

  safe_exposure_time?: SafeExposureTime;

  ozone?: number | null;
  ozone_time?: string;
};

export async function getUVDetailFromOpenUV(
  lat: number,
  lon: number
): Promise<OpenUVDetail | null> {
  try {
    const API_KEY = getApiKey();
    if (!API_KEY) return null;

    const url = `https://api.openuv.io/api/v1/uv?lat=${lat}&lng=${lon}`;
    console.log("[OpenUV] Fetch UV Detail:", url);

    const data = (await safeFetch(url, API_KEY)) as OpenUVCurrentResponse;

    const r = data?.result;
    console.log("[OpenUV] UV detail result keys:", Object.keys(r || {}));
    console.log("[OpenUV] safe_exposure_time:", r?.safe_exposure_time);

    const uv = typeof r?.uv === "number" ? r.uv : null;

    const raw = r?.safe_exposure_time as any;

    const safe: SafeExposureTime | undefined = raw
      ? {
          st1: raw.st1 ?? raw["1"],
          st2: raw.st2 ?? raw["2"],
          st3: raw.st3 ?? raw["3"],
          st4: raw.st4 ?? raw["4"],
          st5: raw.st5 ?? raw["5"],
          st6: raw.st6 ?? raw["6"],
        }
      : undefined;

    const ozone = typeof r?.ozone === "number" ? r.ozone : null;

    // ✅ NOU: uv_max / uv_max_time
    const uv_max = typeof r?.uv_max === "number" ? r.uv_max : null;
    const uv_max_time = typeof r?.uv_max_time === "string" ? r.uv_max_time : undefined;

    // ✅ NOU: sun_info (sortida/posta)
    const sun_info = r?.sun_info;

    // ✅ NOU: ozone_time (si ve)
    const ozone_time = typeof r?.ozone_time === "string" ? r.ozone_time : undefined;

    return {
      uv,
      uv_time: r?.uv_time,

      uv_max,
      uv_max_time,

      sun_info,

      safe_exposure_time: safe,

      ozone,
      ozone_time,
    };
  } catch (err) {
    console.error("[OpenUV] Error obtenint detall UV:", err);
    return null;
  }
}