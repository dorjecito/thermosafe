import type { HourlyForecastItem, HourlyForecastResponse } from "../services/weatherService";

export type RainShortTermSummary = {
  visible: boolean;
  rainingNow: boolean;
  currentMm: number | null;
  forecastMm: number | null;
  endAt: number | null;
  intensity: RainIntensity | null;
  futureFallback: boolean;
};

export type RainIntensity = "very_weak" | "weak" | "moderate" | "intense";

export function isForecastForLocation(
  forecastCoords: { lat: number; lon: number } | null,
  lat: number | null,
  lon: number | null,
): boolean {
  return Boolean(
    forecastCoords &&
      typeof lat === "number" &&
      typeof lon === "number" &&
      forecastCoords.lat === lat &&
      forecastCoords.lon === lon,
  );
}

export function getUsableForecastHourly(
  forecast: HourlyForecastResponse | null,
  forecastCoords: { lat: number; lon: number } | null,
  lat: number | null,
  lon: number | null,
): HourlyForecastItem[] | null {
  if (forecast?.stale || !isForecastForLocation(forecastCoords, lat, lon)) return null;
  return forecast?.hourly ?? null;
}

export function getRainTimingKey(rainingNow: boolean): "rain_ends_at" | "rain_expected_before" {
  return rainingNow ? "rain_ends_at" : "rain_expected_before";
}

export function getCurrentRainMessageKey(
  rainingNow: boolean,
  currentMm: number | null,
): "rain_now_amount" | "rain_current_no_amount" | null {
  if (!rainingNow) return null;
  return currentMm !== null ? "rain_now_amount" : "rain_current_no_amount";
}

export function getRainIntensity(mm: number | null): RainIntensity | null {
  if (mm === null || !Number.isFinite(mm) || mm < 0.1) return null;
  if (mm >= 10) return "intense";
  if (mm >= 2) return "moderate";
  if (mm >= 0.5) return "weak";
  return "very_weak";
}

function finite(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function itemMm(item: HourlyForecastItem): number {
  const rain = (item as HourlyForecastItem & { rain?: { [key: string]: unknown } }).rain;
  return finite(rain?.["1h"]) ?? finite((item as any).precipitation) ?? 0;
}

function itemPop(item: HourlyForecastItem): number {
  const pop = finite((item as any).pop) ?? 0;
  return pop > 1 ? pop / 100 : pop;
}

export function buildRainShortTermSummary(input: {
  rainingNow: boolean;
  currentMm?: number | null;
  hourly?: HourlyForecastItem[] | null;
  nowSec?: number;
}): RainShortTermSummary {
  const currentMm = finite(input.currentMm);
  const rainingNow = input.rainingNow === true;
  const nowSec = input.nowSec ?? Math.floor(Date.now() / 1000);
  const horizon = nowSec + 3 * 60 * 60;
  const upcoming = (input.hourly ?? [])
    .filter((item) => Number.isFinite(item.dt) && item.dt >= nowSec && item.dt <= horizon)
    .slice(0, 4);
  const relevant = upcoming.filter((item) => itemMm(item) > 0 || itemPop(item) >= 0.4);
  const forecastMm = relevant.reduce((sum, item) => sum + itemMm(item), 0);

  let endAt: number | null = null;
  if (relevant.length > 0) {
    const lastRainIndex = upcoming.findIndex((item) => item.dt === relevant[relevant.length - 1].dt);
    const after = lastRainIndex >= 0 ? upcoming[lastRainIndex + 1] : undefined;
    if (after && itemMm(after) === 0 && itemPop(after) < 0.4) endAt = after.dt;
  }

  return {
    visible: rainingNow || relevant.length > 0,
    rainingNow,
    currentMm,
    forecastMm: relevant.length > 0 && forecastMm > 0 ? forecastMm : null,
    endAt,
    intensity: getRainIntensity(relevant.length > 0 && forecastMm > 0 ? forecastMm : null),
    futureFallback: relevant.length > 0 && forecastMm <= 0 && endAt === null,
  };
}
