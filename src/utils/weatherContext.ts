export interface WeatherContextInput {
  weatherMain?: string | null;
  weatherCode?: number | null;
  humidity?: number | null;
  effectiveTemp?: number | null;
  cloudiness?: number | null;
}

export interface WeatherContext {
  rainy: boolean;
  stormy: boolean;
  humid: boolean;
  veryCloudy: boolean;
  uvBlockingCloudy: boolean;
  suppressUv: boolean;
  slipperySurface: boolean;
  snowy: boolean;
  foggy: boolean;
  icySurface: boolean;
  hail: boolean;
  dusty: boolean;
  smoky: boolean;
}

export const CONTEXT_VERY_CLOUDY_THRESHOLD = 75;
export const UV_BLOCKING_CLOUDINESS_THRESHOLD = 85;
export const HUMIDITY_CONTEXT_THRESHOLD = 70;
export const HUMIDITY_WARM_TEMP_THRESHOLD = 24;

const RAINY_WEATHER_MAIN = new Set(["Rain", "Drizzle", "Thunderstorm"]);

export function getWeatherContext({
  weatherMain,
  weatherCode,
  humidity,
  effectiveTemp,
  cloudiness,
}: WeatherContextInput): WeatherContext {
  const code =
    typeof weatherCode === "number" && Number.isFinite(weatherCode)
      ? weatherCode
      : null;
  const rainy = RAINY_WEATHER_MAIN.has(weatherMain ?? "");
  const stormy = weatherMain === "Thunderstorm";
  const snowy = weatherMain === "Snow" || (code !== null && code >= 600 && code < 700);
  const foggy = code === 741 || weatherMain === "Fog";
  const hail = code === 906 || weatherMain === "Hail";
  const dusty = code === 731 || code === 761 || weatherMain === "Dust";
  const smoky = code === 711 || weatherMain === "Smoke";
  const freezingPrecipitation = code === 511;
  const icySurface =
    snowy ||
    freezingPrecipitation ||
    ((rainy || hail) &&
      typeof effectiveTemp === "number" &&
      Number.isFinite(effectiveTemp) &&
      effectiveTemp <= 0);
  const humid =
    typeof humidity === "number" &&
    Number.isFinite(humidity) &&
    humidity >= HUMIDITY_CONTEXT_THRESHOLD &&
    typeof effectiveTemp === "number" &&
    Number.isFinite(effectiveTemp) &&
    effectiveTemp >= HUMIDITY_WARM_TEMP_THRESHOLD;
  const veryCloudy =
    typeof cloudiness === "number" &&
    Number.isFinite(cloudiness) &&
    cloudiness >= CONTEXT_VERY_CLOUDY_THRESHOLD;
  const uvBlockingCloudy =
    typeof cloudiness === "number" &&
    Number.isFinite(cloudiness) &&
    cloudiness >= UV_BLOCKING_CLOUDINESS_THRESHOLD;

  return {
    rainy,
    stormy,
    humid,
    veryCloudy,
    uvBlockingCloudy,
    suppressUv: rainy || stormy || veryCloudy,
    slipperySurface: rainy,
    snowy,
    foggy,
    icySurface,
    hail,
    dusty,
    smoky,
  };
}
