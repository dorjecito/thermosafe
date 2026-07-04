export interface WeatherContextInput {
  weatherMain?: string | null;
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
}

export const CONTEXT_VERY_CLOUDY_THRESHOLD = 75;
export const UV_BLOCKING_CLOUDINESS_THRESHOLD = 85;
export const HUMIDITY_CONTEXT_THRESHOLD = 70;
export const HUMIDITY_WARM_TEMP_THRESHOLD = 24;

const RAINY_WEATHER_MAIN = new Set(["Rain", "Drizzle", "Thunderstorm"]);

export function getWeatherContext({
  weatherMain,
  humidity,
  effectiveTemp,
  cloudiness,
}: WeatherContextInput): WeatherContext {
  const rainy = RAINY_WEATHER_MAIN.has(weatherMain ?? "");
  const stormy = weatherMain === "Thunderstorm";
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
  };
}
