import type { HourlyForecastItem, HourlyForecastResponse } from "../services/weatherService";

export type RainShortTermSummary = {
  forecastKind: ForecastPrecipitationKind;
  visible: boolean;
  rainingNow: boolean;
  currentMm: number | null;
  forecastMm: number | null;
  peakRainMmH: number | null;
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

export type ForecastPrecipitationKind = "rain" | "snow" | "precipitation";

// Explicit codes only: mixed/sleet, freezing rain (511), and unknown codes
// deliberately remain generic. Temperature never participates in classification.
const RAIN_CODES = new Set([200, 201, 202, 230, 231, 232, 300, 301, 302,
  310, 311, 312, 313, 314, 321, 500, 501, 502, 503, 504, 520, 521, 522, 531]);
const SNOW_CODES = new Set([600, 601, 602, 620, 621, 622]);
const PRECIPITATION_MAIN = new Set(["Rain", "Drizzle", "Snow", "Thunderstorm"]);

function hasExplicitPrecipitation(item: HourlyForecastItem): boolean {
  return (finite(item.snow?.["1h"]) ?? 0) > 0 || (item.weather ?? []).some(
    ({ id, main }) => PRECIPITATION_MAIN.has(main ?? "") ||
      (typeof id === "number" && id >= 200 && id < 700),
  );
}

function classifyForecastItem(item: HourlyForecastItem): ForecastPrecipitationKind {
  const evidence = new Set<ForecastPrecipitationKind>();
  if ((finite(item.rain?.["1h"]) ?? 0) > 0) evidence.add("rain");
  if ((finite(item.snow?.["1h"]) ?? 0) > 0) evidence.add("snow");
  for (const { id, main } of item.weather ?? []) {
    if (id !== undefined) {
      evidence.add(RAIN_CODES.has(id) ? "rain" : SNOW_CODES.has(id) ? "snow" : "precipitation");
    }
    if (main === "Rain" || main === "Drizzle") evidence.add("rain");
    else if (main === "Snow") evidence.add("snow");
    // Thunderstorm alone does not confirm rain, but is compatible with rain codes.
    else if (main && main !== "Thunderstorm") evidence.add("precipitation");
  }
  return evidence.size === 1 ? [...evidence][0] : "precipitation";
}

function classifyForecastWindow(upcoming: HourlyForecastItem[]): ForecastPrecipitationKind {
  // Inspect explicit precipitation even below the visibility threshold, so a
  // different phenomenon in this same window cannot be labelled as all rain/snow.
  // This does not add samples to accumulation, timing, or visibility calculations.
  const kinds = new Set(upcoming
    .filter(item => itemMm(item) > 0 || itemPop(item) >= 0.4 || hasExplicitPrecipitation(item))
    .map(classifyForecastItem));
  return kinds.size === 1 ? [...kinds][0] : "precipitation";
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
  // Accumulation is in mm; classify the peak hourly rate, in mm/h, separately.
  const peakRainMmH = relevant.length > 0 ? Math.max(...relevant.map(itemMm)) : null;

  let endAt: number | null = null;
  if (relevant.length > 0) {
    const lastRainIndex = upcoming.findIndex((item) => item.dt === relevant[relevant.length - 1].dt);
    const after = lastRainIndex >= 0 ? upcoming[lastRainIndex + 1] : undefined;
    if (after && itemMm(after) === 0 && itemPop(after) < 0.4) endAt = after.dt;
  }

  return {
    forecastKind: classifyForecastWindow(upcoming),
    // Presentation-only minimum in accumulated mm; retain probability-only forecasts.
    visible: rainingNow || (relevant.length > 0 && (forecastMm <= 0 || forecastMm >= 0.5)),
    rainingNow,
    currentMm,
    forecastMm: relevant.length > 0 && forecastMm > 0 ? forecastMm : null,
    peakRainMmH,
    endAt,
    intensity: getRainIntensity(peakRainMmH),
    futureFallback: relevant.length > 0 && forecastMm <= 0 && endAt === null,
  };
}
