import type { HourlyForecastItem, HourlyForecastResponse } from "../services/weatherService";
import { WINDCHILL_TEMP_MAX, WINDCHILL_WIND_MIN } from "../constants/riskThresholds";
import { getColdRisk } from "./getColdRisk";
import { getHeatRisk } from "./heatRisk";
import { getUvLevelIndex } from "./uv";
import { getWindRisk } from "./windRisk";

type ActivityLevel = "rest" | "walk" | "moderate" | "intense";

export type RiskTrendDirection =
  | "improving"
  | "stable"
  | "worsening"
  | "worsening_clearly";

export type RiskTrendResult = {
  direction: RiskTrendDirection;
  peakStart: Date | null;
  peakEnd: Date | null;
  partial: boolean;
  stale: boolean;
};

type CurrentRiskInput = {
  heatIndex?: number | null;
  temp?: number | null;
  windKmh?: number | null;
  uvi?: number | null;
  activity?: ActivityLevel;
};

const heatSeverity: Record<string, number> = {
  safe: 0,
  mild: 1,
  moderate: 2,
  high: 3,
  ext: 4,
};

const coldSeverity: Record<string, number> = {
  cap: 0,
  lleu: 1,
  moderat: 2,
  alt: 3,
  "molt alt": 4,
  extrem: 4,
};

const windSeverity: Record<string, number> = {
  none: 0,
  breezy: 1,
  moderate: 2,
  strong: 3,
  very_strong: 4,
};

function windChill(temp: number, windKmh: number) {
  if (temp > WINDCHILL_TEMP_MAX || windKmh < WINDCHILL_WIND_MIN) return temp;

  return (
    13.12 +
    0.6215 * temp -
    11.37 * Math.pow(windKmh, 0.16) +
    0.3965 * temp * Math.pow(windKmh, 0.16)
  );
}

function uvSeverity(uvi?: number | null) {
  if (typeof uvi !== "number" || !Number.isFinite(uvi)) return null;
  return getUvLevelIndex(uvi);
}

function scoreConditions(input: CurrentRiskInput) {
  const temp = typeof input.temp === "number" && Number.isFinite(input.temp) ? input.temp : null;
  const heatIndex =
    typeof input.heatIndex === "number" && Number.isFinite(input.heatIndex)
      ? input.heatIndex
      : temp;
  const windKmh =
    typeof input.windKmh === "number" && Number.isFinite(input.windKmh)
      ? input.windKmh
      : 0;

  const heatScore =
    heatIndex !== null
      ? heatSeverity[getHeatRisk(heatIndex, input.activity || "rest").class] ?? 0
      : 0;

  const coldBase = temp !== null ? windChill(temp, windKmh) : null;
  const coldScore =
    coldBase !== null ? coldSeverity[getColdRisk(coldBase, windKmh)] ?? 0 : 0;

  const windScore = windSeverity[getWindRisk(windKmh)] ?? 0;
  const uvScore = uvSeverity(input.uvi);

  return {
    score: Math.max(heatScore, coldScore, windScore, uvScore ?? 0),
    hasUv: uvScore !== null,
  };
}

function forecastItemToCurrentInput(item: HourlyForecastItem, activity: ActivityLevel): CurrentRiskInput {
  return {
    temp: item.temp,
    heatIndex: item.feels_like ?? item.temp,
    windKmh:
      typeof item.wind_speed === "number" && Number.isFinite(item.wind_speed)
        ? item.wind_speed * 3.6
        : null,
    uvi: item.uvi,
    activity,
  };
}

export function buildRiskTrend(
  forecast: HourlyForecastResponse | null,
  current: CurrentRiskInput,
  now = new Date()
): RiskTrendResult | null {
  if (!forecast || !Array.isArray(forecast.hourly) || forecast.hourly.length === 0) {
    return null;
  }

  const nowSeconds = now.getTime() / 1000;
  const maxSeconds = nowSeconds + 6 * 60 * 60;
  const nextHours = forecast.hourly
    .filter(
      (item) =>
        typeof item?.dt === "number" &&
        item.dt > nowSeconds &&
        item.dt <= maxSeconds
    )
    .slice(0, 6);

  if (nextHours.length < 2) return null;

  const currentScore = scoreConditions(current).score;
  const scored = nextHours.map((item) => {
    const risk = scoreConditions(forecastItemToCurrentInput(item, current.activity || "rest"));
    return {
      item,
      score: risk.score,
      hasUv: risk.hasUv,
    };
  });

  const peak = scored.reduce((best, next) => (next.score > best.score ? next : best), scored[0]);
  const maxScore = peak.score;
  const delta = maxScore - currentScore;

  let direction: RiskTrendDirection = "stable";
  if (delta >= 2) direction = "worsening_clearly";
  else if (delta === 1) direction = "worsening";
  else if (delta <= -1) direction = "improving";

  const peakStart = new Date(peak.item.dt * 1000);
  const peakEnd = new Date((peak.item.dt + 2 * 60 * 60) * 1000);

  return {
    direction,
    peakStart,
    peakEnd,
    partial: scored.some((entry) => !entry.hasUv),
    stale: Boolean(forecast.stale),
  };
}
