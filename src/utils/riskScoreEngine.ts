import { getColdRisk, type ColdRisk } from "./getColdRisk";
import { getHeatRisk, type HeatRisk } from "./heatRisk";
import { getUvLevelIndex, type UvLevelIndex } from "./uv";
import { getWindRisk, type WindRisk } from "./windRisk";

export type RiskFactor = "aemet" | "heat" | "cold" | "uv" | "wind" | "other";
export type RiskSeverity = 0 | 1 | 2 | 3 | 4;
export type ActivityLevel = "rest" | "walk" | "moderate" | "intense";
export type NightHeatLevel = "none" | "tropical" | "torrid";

export type FactorRisk = {
  factor: RiskFactor;
  active: boolean;
  level: string;
  severity: RiskSeverity;
  value: number | null;
  labelKey: string;
  reasonKey?: string;
};

export type RiskEngineInput = {
  heatIndex?: number | null;
  activity?: ActivityLevel;
  coldEffectiveTemp?: number | null;
  windKmh?: number | null;
  uvi?: number | null;
  isNightAtLocation?: boolean;
  nightReferenceTemperature?: number | null;
};

export type RiskScoreResult = {
  factors: FactorRisk[];
  activeFactors: FactorRisk[];
  activeFactorsSorted: FactorRisk[];
  primary: FactorRisk | null;
  maxSeverity: RiskSeverity;
  nightHeatLevel: NightHeatLevel;
};

const heatSeverityByClass: Record<HeatRisk["class"], RiskSeverity> = {
  safe: 0,
  mild: 1,
  moderate: 2,
  high: 3,
  ext: 4,
};

const coldSeverityByRisk: Record<ColdRisk, RiskSeverity> = {
  cap: 0,
  lleu: 1,
  moderat: 2,
  alt: 3,
  "molt alt": 3,
  extrem: 4,
};

const windSeverityByRisk: Record<WindRisk, RiskSeverity> = {
  none: 0,
  breezy: 1,
  moderate: 2,
  strong: 3,
  very_strong: 4,
};

const finiteNumber = (value: number | null | undefined): number | null =>
  typeof value === "number" && Number.isFinite(value) ? value : null;

function classifyNightHeatLevel(input: RiskEngineInput): NightHeatLevel {
  if (!input.isNightAtLocation) return "none";

  const nightReferenceTemperature = finiteNumber(input.nightReferenceTemperature);
  if (nightReferenceTemperature === null) return "none";

  if (nightReferenceTemperature >= 25) return "torrid";
  if (nightReferenceTemperature >= 20) return "tropical";
  return "none";
}

const factorTieOrder: Record<RiskFactor, number> = {
  aemet: 6,
  heat: 5,
  cold: 4,
  uv: 2,
  wind: 1,
  other: 1,
};

function getFactorTieOrder(factor: FactorRisk): number {
  if (factor.factor === "wind") {
    return factor.severity >= 3 ? 3 : factorTieOrder.wind;
  }

  return factorTieOrder[factor.factor];
}

const coldLabelKeyByRisk: Record<ColdRisk, string> = {
  cap: "cold_safe",
  lleu: "cold_mild",
  moderat: "cold_moderate",
  alt: "cold_high",
  "molt alt": "cold_very_high",
  extrem: "cold_extreme",
};

const uvLabelBySeverity: Record<UvLevelIndex, string> = {
  0: "low",
  1: "moderate",
  2: "high",
  3: "very_high",
  4: "extreme",
};

function sortFactorsByPriority(factors: FactorRisk[]): FactorRisk[] {
  return [...factors].sort(
    (a, b) =>
      b.severity - a.severity || getFactorTieOrder(b) - getFactorTieOrder(a)
  );
}

function createHeatFactor(input: RiskEngineInput): FactorRisk {
  const heatIndex = finiteNumber(input.heatIndex);
  const heatRisk =
    heatIndex !== null ? getHeatRisk(heatIndex, input.activity || "rest") : null;
  const severity = heatRisk ? heatSeverityByClass[heatRisk.class] : 0;

  return {
    factor: "heat",
    active: severity > 0,
    severity,
    level: heatRisk?.class || "safe",
    value: heatIndex,
    labelKey: `heat_${heatRisk?.class || "safe"}`,
    reasonKey: `riskScore.heat.${heatRisk?.class || "safe"}`,
  };
}

function createColdFactor(input: RiskEngineInput): FactorRisk {
  const coldEffectiveTemp = finiteNumber(input.coldEffectiveTemp);
  const windKmh = finiteNumber(input.windKmh);
  const coldRisk = getColdRisk(coldEffectiveTemp, windKmh);
  const severity = coldSeverityByRisk[coldRisk];

  return {
    factor: "cold",
    active: severity > 0,
    severity,
    level: coldRisk,
    value: coldEffectiveTemp,
    labelKey: coldLabelKeyByRisk[coldRisk],
    reasonKey: `riskScore.cold.${coldRisk}`,
  };
}

function createUvFactor(input: RiskEngineInput): FactorRisk {
  const uvi = finiteNumber(input.uvi);
  const uvLevel: UvLevelIndex = getUvLevelIndex(uvi);
  const severity = uvLevel as RiskSeverity;
  const level = uvLabelBySeverity[uvLevel];

  return {
    factor: "uv",
    active: severity > 0,
    severity,
    level,
    value: uvi,
    labelKey: `uv_${level}`,
    reasonKey: `riskScore.uv.${level}`,
  };
}

function createWindFactor(input: RiskEngineInput): FactorRisk {
  const windKmh = finiteNumber(input.windKmh);
  const windRisk = getWindRisk(windKmh ?? 0);
  const severity = windSeverityByRisk[windRisk];

  return {
    factor: "wind",
    active: severity > 0,
    severity,
    level: windRisk,
    value: windKmh,
    labelKey: windRisk === "none" ? "wind_none" : `wind_${windRisk}`,
    reasonKey: `riskScore.wind.${windRisk}`,
  };
}

function pickPrimaryFactor(factors: FactorRisk[]): FactorRisk | null {
  const sorted = sortFactorsByPriority(factors);
  const primary = sorted[0];
  return primary && primary.severity > 0 ? primary : null;
}

export function evaluateRiskScore(input: RiskEngineInput): RiskScoreResult {
  const factors = [
    createHeatFactor(input),
    createColdFactor(input),
    createWindFactor(input),
    createUvFactor(input),
  ];
  const activeFactors = factors.filter((factor) => factor.active);
  const activeFactorsSorted = sortFactorsByPriority(activeFactors);
  const primary = pickPrimaryFactor(factors);
  const maxSeverity = (primary?.severity ?? 0) as RiskSeverity;
  const nightHeatLevel = classifyNightHeatLevel(input);

  return {
    factors,
    activeFactors,
    activeFactorsSorted,
    primary,
    maxSeverity,
    nightHeatLevel,
  };
}
