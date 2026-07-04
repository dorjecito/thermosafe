import type { WindRisk } from "./windRisk";
import type { FactorRisk, RiskScoreResult } from "./riskScoreEngine";
import type { WeatherContext } from "./weatherContext";
import { getUvLevelIndex } from "./uv";

export type WorkWindow = "optimal" | "caution" | "limited" | "avoid";
export type WorkWindowLang = "ca" | "es" | "eu" | "gl" | "en";
type ActivityLevel = "rest" | "walk" | "moderate" | "intense";

type HeatRiskLike =
  | {
      isHigh?: boolean;
      isExtreme?: boolean;
      class?: "safe" | "mild" | "moderate" | "high" | "ext";
    }
  | null
  | undefined;

type ColdRiskLike = "cap" | "lleu" | "moderat" | "alt" | "molt alt" | "extrem";
type DiagnosticSeverity = 0 | 1 | 2 | 3 | 4;

type Params = {
  heatRisk?: HeatRiskLike;
  heatIndex?: number | null;
  coldRisk?: ColdRiskLike;
  windRisk?: WindRisk;
  uvi?: number | null;
  aemetActive?: boolean;
  weatherMain?: string | null;
  activity?: ActivityLevel;
  nocturnalHeat?: boolean;
  engineRisk?: RiskScoreResult | null;
  weatherContext?: WeatherContext | null;
};

function getEngineFactor(
  engineRisk: RiskScoreResult,
  factor: "heat" | "cold" | "uv" | "wind"
): FactorRisk | undefined {
  return engineRisk.factors.find((item) => item.factor === factor);
}

function getUvLevelFromEngine(engineRisk: RiskScoreResult | null | undefined): number | null {
  const uv = engineRisk ? getEngineFactor(engineRisk, "uv") : undefined;
  return typeof uv?.severity === "number" ? uv.severity : null;
}

function getWindRiskFromEngine(
  engineRisk: RiskScoreResult | null | undefined
): WindRisk | null {
  const wind = engineRisk ? getEngineFactor(engineRisk, "wind") : undefined;
  const level = wind?.level;

  return level === "none" ||
    level === "breezy" ||
    level === "moderate" ||
    level === "strong" ||
    level === "very_strong"
    ? level
    : null;
}

function getColdRiskFromEngine(
  engineRisk: RiskScoreResult | null | undefined
): ColdRiskLike | null {
  const cold = engineRisk ? getEngineFactor(engineRisk, "cold") : undefined;
  const level = cold?.level;

  return level === "cap" ||
    level === "lleu" ||
    level === "moderat" ||
    level === "alt" ||
    level === "molt alt" ||
    level === "extrem"
    ? level
    : null;
}

function getHeatRiskFromEngine(
  engineRisk: RiskScoreResult | null | undefined
): HeatRiskLike | null {
  const heat = engineRisk ? getEngineFactor(engineRisk, "heat") : undefined;
  const level = heat?.level;

  return level === "safe" ||
    level === "mild" ||
    level === "moderate" ||
    level === "high" ||
    level === "ext"
    ? {
        class: level,
        isHigh: level === "high" || level === "ext",
        isExtreme: level === "ext",
      }
    : null;
}

function isRainyWeather(weatherMain: string | null | undefined): boolean {
  return (
    weatherMain === "Rain" ||
    weatherMain === "Drizzle" ||
    weatherMain === "Thunderstorm"
  );
}

function isStormyWeather(weatherMain: string | null | undefined): boolean {
  return weatherMain === "Thunderstorm";
}

function getDiagnosticHeatSeverity(level: HeatRiskLike["class"]): DiagnosticSeverity {
  switch (level) {
    case "mild":
      return 1;
    case "moderate":
      return 2;
    case "high":
      return 3;
    case "ext":
      return 4;
    case "safe":
    default:
      return 0;
  }
}

function getDiagnosticColdSeverity(level: ColdRiskLike): DiagnosticSeverity {
  switch (level) {
    case "lleu":
      return 1;
    case "moderat":
      return 2;
    case "alt":
    case "molt alt":
      return 3;
    case "extrem":
      return 4;
    case "cap":
    default:
      return 0;
  }
}

function getDiagnosticWindSeverity(level: WindRisk): DiagnosticSeverity {
  switch (level) {
    case "breezy":
      return 1;
    case "moderate":
      return 2;
    case "strong":
      return 3;
    case "very_strong":
      return 4;
    case "none":
    default:
      return 0;
  }
}

function warnIfEngineDiverges(
  params: {
    heatRisk?: HeatRiskLike;
    heatIndex: number | null;
    coldRisk: ColdRiskLike;
    windRisk: WindRisk;
    uvi: number | null;
    legacyUvLevel: number;
    aemetActive: boolean;
    weatherMain: string | null;
    activity: ActivityLevel;
    nocturnalHeat: boolean;
    engineRisk: RiskScoreResult | null | undefined;
  }
): void {
  if (!import.meta.env?.DEV || !params.engineRisk) return;

  const divergences: Array<{
    factor: "heat" | "cold" | "wind" | "uv";
    legacy: string | number;
    engine: string | number;
    severityLegacy: number;
    severityEngine: number;
    classification: "expected_engine_override";
    legacySource: string;
    engineSource: string;
  }> = [];
  const heat = getEngineFactor(params.engineRisk, "heat");
  const cold = getEngineFactor(params.engineRisk, "cold");
  const wind = getEngineFactor(params.engineRisk, "wind");
  const uv = getEngineFactor(params.engineRisk, "uv");

  const expectedHeatLevel = params.heatRisk?.class || "safe";
  if (heat && heat.level !== expectedHeatLevel) {
    divergences.push({
      factor: "heat",
      legacy: expectedHeatLevel,
      engine: heat.level,
      severityLegacy: getDiagnosticHeatSeverity(expectedHeatLevel),
      severityEngine: heat.severity,
      classification: "expected_engine_override",
      legacySource: "workWindow heatRisk.class",
      engineSource: "RiskScoreEngine heat factor level",
    });
  }

  if (cold && cold.level !== params.coldRisk) {
    divergences.push({
      factor: "cold",
      legacy: params.coldRisk,
      engine: cold.level,
      severityLegacy: getDiagnosticColdSeverity(params.coldRisk),
      severityEngine: cold.severity,
      classification: "expected_engine_override",
      legacySource: "workWindow coldRisk prop",
      engineSource: "RiskScoreEngine cold factor level",
    });
  }

  if (wind && wind.level !== params.windRisk) {
    divergences.push({
      factor: "wind",
      legacy: params.windRisk,
      engine: wind.level,
      severityLegacy: getDiagnosticWindSeverity(params.windRisk),
      severityEngine: wind.severity,
      classification: "expected_engine_override",
      legacySource: "workWindow windRisk prop",
      engineSource: "RiskScoreEngine wind factor level",
    });
  }

  if (uv && uv.severity !== params.legacyUvLevel) {
    divergences.push({
      factor: "uv",
      legacy: params.legacyUvLevel,
      engine: uv.severity,
      severityLegacy: params.legacyUvLevel,
      severityEngine: uv.severity,
      classification: "expected_engine_override",
      legacySource: "getUvLevelIndex(uvi) inside workWindow",
      engineSource: "RiskScoreEngine uv factor severity",
    });
  }

  if (divergences.length === 0) return;

  console.info("[workWindow][DEV] Comparacio legacy/engine de factors", {
    divergences,
    note:
      "Informatiu: workWindow usa el factor del RiskScoreEngine quan existeix; aquestes diferencies no impliquen canvi visible per si soles.",
    workWindowInput: {
      heatClass: expectedHeatLevel,
      heatIndex: params.heatIndex,
      heatRisk: params.heatRisk,
      coldRisk: params.coldRisk,
      windRisk: params.windRisk,
      uvi: params.uvi,
      uvLevel: params.legacyUvLevel,
      aemetActive: params.aemetActive,
      weatherMain: params.weatherMain,
      activity: params.activity,
      nocturnalHeat: params.nocturnalHeat,
    },
    engineFactors: {
      heat,
      cold,
      wind,
      uv,
    },
    enginePrimary: params.engineRisk.primary,
    engineMaxSeverity: params.engineRisk.maxSeverity,
  });
}

export function getWorkWindow({
  heatRisk,
  heatIndex = null,
  coldRisk = "cap",
  windRisk = "none",
  uvi = null,
  aemetActive = false,
  weatherMain = null,
  activity = "rest",
  nocturnalHeat = false,
  engineRisk = null,
  weatherContext = null,
}: Params): WorkWindow {
  const legacyUvLevel = getUvLevelIndex(uvi);
  const uvLevel = getUvLevelFromEngine(engineRisk) ?? legacyUvLevel;
  const legacyWindRisk = windRisk;
  const effectiveWindRisk = getWindRiskFromEngine(engineRisk) ?? legacyWindRisk;
  const legacyColdRisk = coldRisk;
  const effectiveColdRisk = getColdRiskFromEngine(engineRisk) ?? legacyColdRisk;
  const legacyHeatRisk = heatRisk;
  const effectiveHeatRisk = getHeatRiskFromEngine(engineRisk) ?? legacyHeatRisk;
  warnIfEngineDiverges({
    heatRisk,
    heatIndex,
    coldRisk,
    windRisk,
    uvi,
    legacyUvLevel,
    aemetActive,
    weatherMain,
    activity,
    nocturnalHeat,
    engineRisk,
  });

  const hi =
  typeof heatIndex === "number" && Number.isFinite(heatIndex)
    ? heatIndex
    : null;

  const legacyRainy = isRainyWeather(weatherMain);
  const rainy = weatherContext?.rainy ?? legacyRainy;
  const legacyStormy = isStormyWeather(weatherMain);
  const stormy = weatherContext?.stormy ?? legacyStormy;
  void stormy;

  if (import.meta.env?.DEV && weatherContext && legacyRainy !== weatherContext.rainy) {
    console.info("[workWindow][DEV] rainy mismatch", {
      legacyRainy,
      contextRainy: weatherContext.rainy,
      weatherMain,
    });
  }

  if (import.meta.env?.DEV && weatherContext && legacyStormy !== weatherContext.stormy) {
    console.info("[workWindow][DEV] stormy mismatch", {
      legacyStormy,
      contextStormy: weatherContext.stormy,
      weatherMain,
    });
  }

  const hasRelevantWindForCold =
    effectiveWindRisk === "moderate" ||
    effectiveWindRisk === "strong" ||
    effectiveWindRisk === "very_strong";

  /* 1) Situacions extremes */
  if (aemetActive && (effectiveWindRisk === "strong" || effectiveWindRisk === "very_strong")) return "avoid";
  if (effectiveColdRisk === "extrem") return "avoid";
  if (effectiveHeatRisk?.isExtreme) return "avoid";
  if (effectiveWindRisk === "very_strong") return "avoid";
  if (uvLevel === 4) return "avoid";

  /* 2) Fred + vent combinats */
  if (
    (effectiveColdRisk === "moderat" ||
      effectiveColdRisk === "alt" ||
      effectiveColdRisk === "molt alt") &&
    hasRelevantWindForCold
  ) {
    return effectiveColdRisk === "moderat" ? "limited" : "avoid";
  }

  /* 2b) Calor segons sensació tèrmica directa */
  if (hi !== null && hi >= 41) return "avoid";
  if (hi !== null && hi >= 32) return "limited";
  if (effectiveHeatRisk?.isHigh) return "limited";
  if (hi !== null && hi >= 27) return "caution";

  /* 2c) L'esforç físic pot exigir precaució abans del llindar tèrmic oficial */
  if (
    hi !== null &&
    hi >= 24 &&
    activity !== "rest" &&
    effectiveHeatRisk?.class !== "safe"
  ) {
    return "caution";
  }

  /* 3) Situacions altes */
  if (effectiveColdRisk === "alt" || effectiveColdRisk === "molt alt") return "limited";
  if (effectiveColdRisk === "moderat") return "limited";
  if (effectiveWindRisk === "strong") return "limited";
  if (uvLevel >= 3) return "limited";

  /* 3b) Avís oficial + situació ja delicada */
  if (
    aemetActive &&
	    (
	      effectiveColdRisk === "lleu" ||
	      effectiveWindRisk === "moderate" ||
	      uvLevel >= 2 ||
	      rainy
    )
  ) {
    return "limited";
  }

  /* 4) Situacions de precaució */
  if (aemetActive) return "caution";
  if (nocturnalHeat) return "caution";
  if (effectiveWindRisk === "moderate") return "caution";
  if (uvLevel >= 2) return "caution";
  if (rainy) return "caution";
  if (effectiveColdRisk === "lleu") return "caution";

  /* 5) Situació segura */
  return "optimal";
}

export function getWorkWindowTitle(lang: WorkWindowLang): string {
  const txt = {
    ca: "Activitat exterior",
    es: "Actividad exterior",
    eu: "Kanpoko jarduera",
    gl: "Actividade exterior",
    en: "Outdoor activity",
  };

  return txt[lang] || txt.ca;
}

export function getWorkWindowText(
  level: WorkWindow,
  lang: WorkWindowLang,
  aemetActive = false,
  nocturnalHeat = false
): string {
  const txt = {
    ca: {
      optimal: "Situació adequada per a activitats a l’aire lliure.",
      optimalAlert: "Condicions actuals adequades, però hi ha avisos oficials actius. Mantén la precaució.",
      caution: "Es poden realitzar activitats a l’aire lliure amb precaucions bàsiques.",
      nightHeat: "Es poden realitzar activitats suaus, però convé evitar esforços físics innecessaris.",
      limited: "Convé limitar les activitats exigents o adaptar-les a les condicions actuals.",
      avoid: "No es recomana fer activitats exigents a l’aire lliure en aquests moments.",
    },
    es: {
      optimal: "Situación adecuada para actividades al aire libre.",
      optimalAlert: "Condiciones actuales adecuadas, pero hay avisos oficiales activos. Mantén la precaución.",
      caution: "Se pueden realizar actividades al aire libre con precauciones básicas.",
      nightHeat: "Se pueden realizar actividades suaves, pero conviene evitar esfuerzos físicos innecesarios.",
      limited: "Conviene limitar las actividades exigentes o adaptarlas a las condiciones actuales.",
      avoid: "No se recomienda realizar actividades exigentes al aire libre en estos momentos.",
    },
    eu: {
      optimal: "Kanpoko jardueretarako egoera egokia.",
      optimalAlert: "Uneko baldintzak egokiak dira, baina abisu ofizialak aktibo daude. Mantendu arreta.",
      caution: "Kanpoko jarduerak egin daitezke oinarrizko neurriak hartuta.",
      nightHeat: "Jarduera arinak egin daitezke, baina komeni da beharrezkoak ez diren ahalegin fisikoak saihestea.",
      limited: "Komeni da jarduera zorrotzak mugatzea edo uneko baldintzetara egokitzea.",
      avoid: "Ez da gomendatzen une honetan kanpoko jarduera zorrotzak egitea.",
    },
    gl: {
      optimal: "Situación axeitada para actividades ao aire libre.",
      optimalAlert: "As condicións actuais son adecuadas, pero hai avisos oficiais activos. Mantén a precaución.",
      caution: "Pódense realizar actividades ao aire libre con precaucións básicas.",
      nightHeat: "Pódense realizar actividades suaves, pero convén evitar esforzos físicos innecesarios.",
      limited: "Convén limitar as actividades esixentes ou adaptalas ás condicións actuais.",
      avoid: "Non se recomenda realizar actividades esixentes ao aire libre nestes momentos.",
    },
    en: {
      optimal: "Suitable conditions for outdoor activities.",
      optimalAlert: "Current conditions are suitable, but official alerts are active. Stay cautious.",
      caution: "Outdoor activities are possible with basic precautions.",
      nightHeat: "Light outdoor activities are possible, but unnecessary physical effort should be avoided.",
      limited: "It is advisable to limit demanding activities or adapt them to current conditions.",
      avoid: "Demanding outdoor activities are not recommended at this time.",
    },
  };

  if (level === "optimal" && aemetActive) {
    return txt[lang]?.optimalAlert || txt.ca.optimalAlert;
  }

  if (level === "caution" && nocturnalHeat) {
    return txt[lang]?.nightHeat || txt.ca.nightHeat;
  }

  return txt[lang]?.[level] || txt.ca[level];
}
