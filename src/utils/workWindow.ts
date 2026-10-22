import type { WindRisk } from "./windRisk";
import type { FactorRisk, NightHeatLevel, RiskScoreResult } from "./riskScoreEngine";
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
  nightHeatLevel?: NightHeatLevel;
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

export function getWorkWindow({
  heatRisk,
  heatIndex = null,
  coldRisk = "cap",
  windRisk = "none",
  uvi = null,
  aemetActive = false,
  weatherMain = null,
  activity = "rest",
  nocturnalHeat: _nocturnalHeat = false,
  nightHeatLevel: _nightHeatLevel,
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

  const hi =
  typeof heatIndex === "number" && Number.isFinite(heatIndex)
    ? heatIndex
    : null;

  const legacyRainy = isRainyWeather(weatherMain);
  const rainy = weatherContext?.rainy ?? legacyRainy;

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
  if (uvLevel !== null && uvLevel >= 3) return "limited";

  /* 3b) Avís oficial + situació ja delicada */
  if (
    aemetActive &&
	    (
	      effectiveColdRisk === "lleu" ||
	      effectiveWindRisk === "moderate" ||
      (uvLevel !== null && uvLevel >= 2) ||
	      rainy
    )
  ) {
    return "limited";
  }

  /* 4) Situacions de precaució */
  if (aemetActive) return "caution";
  if (effectiveWindRisk === "moderate") return "caution";
  if (uvLevel !== null && uvLevel >= 2) return "caution";
  if (rainy) return "caution";
  if (effectiveColdRisk === "lleu") return "caution";

  /* 5) Situació segura */
  return "optimal";
}

export function isAemetOnlyCaution(params: Params, level: WorkWindow): boolean {
  return params.aemetActive === true &&
    level === "caution" &&
    getWorkWindow({ ...params, aemetActive: false }) === "optimal";
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
  nightHeatLevel: NightHeatLevel | boolean = "none",
  aemetOnlyCaution = false,
  uvUnavailable = false
): string {
  void nightHeatLevel;

  const txt = {
    ca: {
      optimal: "Les condicions són adequades per a activitats a l’aire lliure.",
	      optimalUvUnavailable: "Les condicions conegudes són adequades per a activitats a l’aire lliure, però no es pot valorar el risc UV perquè la dada actual no està disponible.",
      optimalAlert: "Condicions actuals adequades, però hi ha avisos oficials actius. Mantén la precaució.",
      caution: "Es poden realitzar activitats a l’aire lliure amb precaucions bàsiques.",
      cautionAlert: "Les condicions actuals permeten fer activitats a l’aire lliure, però hi ha un avís meteorològic oficial actiu. Consulta'n el detall i adapta l’activitat si les condicions empitjoren.",
      limited: "Convé limitar les activitats exigents o adaptar-les a les condicions actuals.",
      avoid: "No es recomana fer activitats exigents a l’aire lliure en aquests moments.",
    },
    es: {
      optimal: "Las condiciones son adecuadas para actividades al aire libre.",
	      optimalUvUnavailable: "Las condiciones conocidas son adecuadas para actividades al aire libre, pero no se puede valorar el riesgo UV porque el dato actual no está disponible.",
      optimalAlert: "Condiciones actuales adecuadas, pero hay avisos oficiales activos. Mantén la precaución.",
      caution: "Puedes hacer actividades al aire libre con precauciones básicas.",
      cautionAlert: "Las condiciones actuales permiten realizar actividades al aire libre, pero hay un aviso meteorológico oficial activo. Consulta sus detalles y adapta la actividad si las condiciones empeoran.",
      limited: "Conviene limitar las actividades exigentes o adaptarlas a las condiciones actuales.",
      avoid: "No se recomienda hacer actividades exigentes al aire libre en este momento.",
    },
    eu: {
      optimal: "Baldintzak egokiak dira kanpoko jardueretarako.",
	      optimalUvUnavailable: "Ezagutzen diren baldintzak egokiak dira kanpoko jardueretarako, baina ezin da UV arriskua baloratu uneko datua ez dagoelako eskuragarri.",
      optimalAlert: "Uneko baldintzak egokiak dira, baina abisu ofizialak aktibo daude. Mantendu arreta.",
      caution: "Kanpoko jarduerak egin daitezke oinarrizko neurriak hartuta.",
      cautionAlert: "Egungo baldintzek aire zabaleko jarduerak egiteko aukera ematen dute, baina alerta meteorologiko ofizial bat dago indarrean. Kontsultatu xehetasunak eta egokitu jarduera baldintzek okerrera egiten badute.",
      limited: "Komeni da jarduera zorrotzak mugatzea edo uneko baldintzetara egokitzea.",
      avoid: "Ez da gomendatzen une honetan kanpoko jarduera zorrotzak egitea.",
    },
    gl: {
      optimal: "As condicións son axeitadas para actividades ao aire libre.",
	      optimalUvUnavailable: "As condicións coñecidas son axeitadas para actividades ao aire libre, pero non se pode valorar o risco UV porque o dato actual non está dispoñible.",
      optimalAlert: "As condicións actuais son adecuadas, pero hai avisos oficiais activos. Mantén a precaución.",
      caution: "Podes facer actividades ao aire libre con precaucións básicas.",
      cautionAlert: "As condicións actuais permiten realizar actividades ao aire libre, pero hai un aviso meteorolóxico oficial activo. Consulta os detalles e adapta a actividade se as condicións empeoran.",
      limited: "Convén limitar as actividades esixentes ou adaptalas ás condicións actuais.",
      avoid: "Non se recomenda facer actividades esixentes ao aire libre nestes momentos.",
    },
    en: {
      optimal: "Conditions are suitable for outdoor activities.",
	      optimalUvUnavailable: "Known conditions are suitable for outdoor activities, but UV risk cannot be assessed because current data is unavailable.",
      optimalAlert: "Current conditions are suitable, but official alerts are active. Stay cautious.",
      caution: "You can do outdoor activities with basic precautions.",
      cautionAlert: "Current conditions allow outdoor activities, but an official weather alert is active. Check its details and adapt your activity if conditions worsen.",
      limited: "Limit demanding activities or adapt them to current conditions.",
      avoid: "Demanding outdoor activities are not recommended at this time.",
    },
  };

  if (level === "caution" && aemetActive && aemetOnlyCaution) {
    return txt[lang]?.cautionAlert || txt.ca.cautionAlert;
  }

  if (level === "optimal" && aemetActive) {
    return txt[lang]?.optimalAlert || txt.ca.optimalAlert;
  }

	if (level === "optimal" && uvUnavailable) {
		return txt[lang]?.optimalUvUnavailable || txt.ca.optimalUvUnavailable;
	}

  return txt[lang]?.[level] || txt.ca[level];
}
