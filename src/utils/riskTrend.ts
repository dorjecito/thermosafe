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

export type RiskTrendFactor = "heat" | "cold" | "wind" | "uv";

export type RiskTrendResult = {
  direction: RiskTrendDirection;
  factors: RiskTrendFactor[];
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

const HEAT_TREND_DELTA = 3;
const HEAT_TREND_CLEAR_DELTA = 6;
const UV_TREND_DELTA = 1.5;
const UV_TREND_CLEAR_DELTA = 3;
const WIND_TREND_DELTA = 9;
const WIND_TREND_CLEAR_DELTA = 18;

const factorOrder: RiskTrendFactor[] = ["heat", "cold", "wind", "uv"];

function finiteNumber(value?: number | null) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

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
  const temp = finiteNumber(input.temp);
  const heatIndex = finiteNumber(input.heatIndex) ?? temp;
  const windKmh = finiteNumber(input.windKmh);

  const heatScore =
    heatIndex !== null
      ? heatSeverity[getHeatRisk(heatIndex, input.activity || "rest").class] ?? 0
      : null;

  // Below the wind-chill threshold, wind is needed to determine cold severity.
  // Above it, windChill returns temperature unchanged, so temperature alone is enough.
  const coldComparable = temp !== null &&
    (temp > WINDCHILL_TEMP_MAX || windKmh !== null);
  const coldBase = coldComparable && temp !== null
    ? windChill(temp, windKmh ?? 0)
    : null;
  const coldScore =
    coldBase !== null ? coldSeverity[getColdRisk(coldBase, windKmh)] ?? 0 : null;

  const windScore = windKmh !== null ? windSeverity[getWindRisk(windKmh)] ?? 0 : null;
  const uvScore = uvSeverity(input.uvi);
  const scores: Record<RiskTrendFactor, number | null> = {
    heat: heatScore,
    cold: coldScore,
    wind: windScore,
    uv: uvScore,
  };
  const knownScores = Object.values(scores).filter((score): score is number => score !== null);

  return {
    score: knownScores.length > 0 ? Math.max(...knownScores) : null,
    scores,
    complete: knownScores.length === factorOrder.length,
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

function forecastHeatIndex(item: HourlyForecastItem) {
  return finiteNumber(item.feels_like) ?? finiteNumber(item.temp);
}

function forecastWindKmh(item: HourlyForecastItem) {
  const windMs = finiteNumber(item.wind_speed);
  return windMs !== null ? windMs * 3.6 : null;
}

function forecastUvi(item: HourlyForecastItem) {
  return finiteNumber(item.uvi);
}

function topFactors(
  scores: Record<RiskTrendFactor, number | null>,
  score: number,
  previousScores?: Record<RiskTrendFactor, number | null>
) {
  if (score <= 0) return [];

  const matchingFactors = factorOrder.filter((factor) => scores[factor] === score);
  const increasedFactors = previousScores
    ? matchingFactors.filter((factor) =>
        previousScores[factor] !== null && scores[factor] !== null && scores[factor]! > previousScores[factor]!
      )
    : [];

  return (increasedFactors.length > 0 ? increasedFactors : matchingFactors).slice(0, 2);
}

function strongestIncrease(
  item: HourlyForecastItem,
  current: CurrentRiskInput
): { value: number; clear: boolean; factors: RiskTrendFactor[] } {
  const currentHeatIndex = finiteNumber(current.heatIndex) ?? finiteNumber(current.temp);
  const futureHeatIndex = forecastHeatIndex(item);
  const heatDelta =
    currentHeatIndex !== null && futureHeatIndex !== null &&
    getHeatRisk(futureHeatIndex, current.activity || "rest").class !== "safe"
      ? futureHeatIndex - currentHeatIndex
      : null;

  const currentWind = finiteNumber(current.windKmh);
  const futureWind = forecastWindKmh(item);
  const windDelta =
    currentWind !== null && futureWind !== null ? futureWind - currentWind : null;

  const currentUvi = finiteNumber(current.uvi);
  const futureUvi = forecastUvi(item);
  const uvDelta = currentUvi !== null && futureUvi !== null ? futureUvi - currentUvi : null;

  const normalized: Array<{ factor: RiskTrendFactor; value: number }> = [
    {
      factor: "heat",
      value:
        heatDelta !== null && heatDelta >= HEAT_TREND_DELTA
          ? heatDelta / HEAT_TREND_DELTA
          : 0,
    },
    {
      factor: "uv",
      value:
        uvDelta !== null && uvDelta >= UV_TREND_DELTA
          ? uvDelta / UV_TREND_DELTA
          : 0,
    },
    {
      factor: "wind",
      value:
        windDelta !== null && windDelta >= WIND_TREND_DELTA
          ? windDelta / WIND_TREND_DELTA
          : 0,
    },
  ];
  const value = Math.max(...normalized.map((entry) => entry.value));

  return {
    value,
    factors: normalized
      .filter((entry) => entry.value > 0 && entry.value >= value * 0.9)
      .sort((a, b) => b.value - a.value)
      .map((entry) => entry.factor)
      .slice(0, 2),
    clear:
      (heatDelta !== null && heatDelta >= HEAT_TREND_CLEAR_DELTA) ||
      (uvDelta !== null && uvDelta >= UV_TREND_CLEAR_DELTA) ||
      (windDelta !== null && windDelta >= WIND_TREND_CLEAR_DELTA),
  };
}

function buildSensitivityTrend(current: CurrentRiskInput, nextHours: HourlyForecastItem[]) {
  const increases = nextHours
    .map((item) => ({
      item,
      increase: strongestIncrease(item, current),
    }))
    .filter((entry) => entry.increase.value > 0);

  if (increases.length > 0) {
    const strongest = increases.reduce((best, next) =>
      next.increase.value > best.increase.value ? next : best
    );
    return {
      direction: strongest.increase.clear
        ? "worsening_clearly"
        : "worsening",
      item: strongest.item,
      factors: strongest.increase.factors,
    } as const;
  }

  const currentHeatIndex = finiteNumber(current.heatIndex) ?? finiteNumber(current.temp);
  const futureHeatValues = nextHours.map(forecastHeatIndex);
  const heatImproves =
    currentHeatIndex !== null &&
    getHeatRisk(currentHeatIndex, current.activity || "rest").class !== "safe" &&
    futureHeatValues.every((value): value is number => value !== null) &&
    Math.max(...futureHeatValues) <= currentHeatIndex - HEAT_TREND_DELTA;

  const currentWind = finiteNumber(current.windKmh);
  const futureWindValues = nextHours.map(forecastWindKmh);
  const windImproves =
    currentWind !== null &&
    futureWindValues.every((value): value is number => value !== null) &&
    Math.max(...futureWindValues) <= currentWind - WIND_TREND_DELTA;

  if (heatImproves || windImproves) {
    return {
      direction: "improving",
      item: nextHours[0],
      factors: [
        ...(heatImproves ? (["heat"] as const) : []),
        ...(windImproves ? (["wind"] as const) : []),
      ].slice(0, 2),
    } as const;
  }

  return null;
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

  const currentRisk = scoreConditions(current);
  const currentScore = currentRisk.score;
  const scored = nextHours.map((item) => {
    const risk = scoreConditions(forecastItemToCurrentInput(item, current.activity || "rest"));
    return {
      item,
      score: risk.score,
      scores: risk.scores,
      complete: risk.complete,
    };
  });

  const partial = !currentRisk.complete || scored.some((entry) => !entry.complete);

  // On incomplete forecasts compare each factor only where current and future
  // observations exist. This retains supported worsening while preventing an
  // unknown factor from acting as a zero and creating an apparent improvement.
  if (partial) {
    if (currentScore === null) return null;

    // Keep the original dominant-risk policy: compare the highest known future
    // severity with the highest known current severity, then retain only
    // comparable factors tied at that future maximum. A larger per-factor
    // delta must not displace a more severe future risk.
    const candidates = scored.flatMap((entry) => {
      if (entry.score === null || entry.score <= currentScore) return [];
      const factors = factorOrder.filter((factor) => {
        const futureScore = entry.scores[factor];
        const previousScore = currentRisk.scores[factor];
        return futureScore === entry.score && previousScore !== null && futureScore > previousScore;
      }).slice(0, 2);
      return factors.length > 0 ? [{ ...entry, factors }] : [];
    });

    const sensitivityHours = scored
      .filter((entry) => {
        const currentDominants = factorOrder.filter((factor) => currentRisk.scores[factor] === currentScore);
        const observedDominants = currentDominants
          .map((factor) => entry.scores[factor])
          .filter((score): score is number => score !== null);
        const allDominantsObserved = observedDominants.length === currentDominants.length;
        const allDominantsDeclined = allDominantsObserved &&
          observedDominants.every((score) => score < currentScore);
        return !allDominantsDeclined;
      })
      .map((entry) => entry.item);
    const sensitivityTrend = sensitivityHours.length > 0
      ? buildSensitivityTrend(current, sensitivityHours)
      : null;
    const sensitivityWorsens = sensitivityTrend &&
      (sensitivityTrend.direction === "worsening" || sensitivityTrend.direction === "worsening_clearly");
    if (candidates.length === 0) {
      if (!sensitivityWorsens || !sensitivityTrend?.item) return null;
      return {
        direction: sensitivityTrend.direction,
        factors: sensitivityTrend.factors,
        peakStart: new Date(sensitivityTrend.item.dt * 1000),
        peakEnd: new Date((sensitivityTrend.item.dt + 2 * 60 * 60) * 1000),
        partial: true,
        stale: Boolean(forecast.stale),
      };
    }
    // Strictly greater preserves the original earliest-sample tie break.
    const peak = candidates.reduce((best, next) => next.score! > best.score! ? next : best);
    const delta = peak.score! - currentScore;
    const direction = delta >= 2
      ? "worsening_clearly"
      : "worsening";
    return {
      direction,
      factors: peak.factors,
      peakStart: new Date(peak.item.dt * 1000),
      peakEnd: new Date((peak.item.dt + 2 * 60 * 60) * 1000),
      partial: true,
      stale: Boolean(forecast.stale),
    };
  }

  // Complete data follows the existing global severity comparison unchanged.
  if (currentScore === null) return null;

  const peak = scored.reduce((best, next) => (next.score > best.score ? next : best), scored[0]);
  if (peak.score === null) return null;
  const maxScore = peak.score;
  const delta = maxScore - currentScore;

  let direction: RiskTrendDirection = "stable";
  let factors: RiskTrendFactor[] = [];
  if (delta >= 2) direction = "worsening_clearly";
  else if (delta === 1) direction = "worsening";
  else if (delta <= -1) direction = "improving";

  if (direction === "worsening" || direction === "worsening_clearly") {
    factors = topFactors(peak.scores, maxScore, currentRisk.scores);
  } else if (direction === "improving") {
    factors = topFactors(currentRisk.scores, currentScore);
  }

  let peakItem = peak.item;
  if (delta === 0) {
    // Secondary sensitivity keeps the main risk thresholds intact while catching perceptible trends.
    const sensitivityTrend = buildSensitivityTrend(current, nextHours);
    if (sensitivityTrend) {
      direction = sensitivityTrend.direction;
      peakItem = sensitivityTrend.item;
      factors = sensitivityTrend.factors;
    }
  }

  const peakStart = new Date(peakItem.dt * 1000);
  const peakEnd = new Date((peakItem.dt + 2 * 60 * 60) * 1000);

  return {
    direction,
    factors,
    peakStart,
    peakEnd,
    partial: false,
    stale: Boolean(forecast.stale),
  };
}
