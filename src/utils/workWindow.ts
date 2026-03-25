export type WorkWindow = "optimal" | "caution" | "limited" | "avoid";

type HeatRiskLike =
  | {
      isHigh?: boolean;
      isExtreme?: boolean;
    }
  | null
  | undefined;

type ColdRiskLike = "cap" | "lleu" | "moderat" | "alt" | "molt alt" | "extrem";

type WindRiskLike = "none" | "breezy" | "moderate" | "strong" | "very_strong";

type Params = {
  heatRisk?: HeatRiskLike;
  coldRisk?: ColdRiskLike;
  windRisk?: WindRiskLike;
  uvi?: number | null;
  aemetActive?: boolean;
  weatherMain?: string | null;
};

export function getWorkWindow({
  heatRisk,
  coldRisk = "cap",
  windRisk = "none",
  uvi = null,
  aemetActive = false,
  weatherMain = null,
}: Params): WorkWindow {
  const uv = typeof uvi === "number" && Number.isFinite(uvi) ? uvi : 0;
  const rainy =
    weatherMain === "Rain" ||
    weatherMain === "Drizzle" ||
    weatherMain === "Thunderstorm";

  /* 1) Situacions extremes */
  if (aemetActive && (windRisk === "strong" || windRisk === "very_strong")) return "avoid";
  if (coldRisk === "extrem") return "avoid";
  if (heatRisk?.isExtreme) return "avoid";
  if (windRisk === "very_strong") return "avoid";
  if (uv >= 11) return "avoid";

  /* 2) Fred + vent combinats */
  if (
    (coldRisk === "moderat" || coldRisk === "alt" || coldRisk === "molt alt") &&
    (windRisk === "moderate" || windRisk === "strong" || windRisk === "very_strong")
  ) {
    return coldRisk === "moderat" ? "limited" : "avoid";
  }

  /* 3) Situacions altes */
  if (coldRisk === "alt" || coldRisk === "molt alt") return "limited";
  if (coldRisk === "moderat") return "limited"; // ← abans era "caution"
  if (heatRisk?.isHigh) return "limited";
  if (windRisk === "strong") return "limited";
  if (uv >= 8) return "limited";

  /* 3b) Avís oficial + situació ja delicada */
  if (
    aemetActive &&
    (
      coldRisk === "lleu" ||
      windRisk === "moderate" ||
      uv >= 6 ||
      rainy
    )
  ) {
    return "limited";
  }

  /* 4) Situacions de precaució */
  if (aemetActive) return "caution";
  if (windRisk === "moderate") return "caution";
  if (uv >= 6) return "caution";
  if (rainy) return "caution";
  if (coldRisk === "lleu") return "caution";

  /* 5) Vent suau / situació segura */
  return "optimal";
}

export function getWorkWindowTitle(lang: "ca" | "es" | "eu" | "gl" | "en"): string {
  const txt = {
    ca: "Condicions per a l’activitat exterior",
    es: "Condiciones para la actividad exterior",
    eu: "Kanpoko jarduerarako baldintzak",
    gl: "Condicións para a actividade exterior",
    en: "Outdoor activity conditions",
  };
  return txt[lang] || txt.ca;
}

export function getWorkWindowText(level: WorkWindow, lang: "ca" | "es" | "eu" | "gl" | "en"): string {
  const txt = {
    ca: {
      optimal: "Situació adequada per a activitats a l’aire lliure.",
      caution: "Es poden realitzar activitats a l’aire lliure amb precaucions bàsiques.",
      limited: "Convé limitar o adaptar les activitats a l’aire lliure en aquest moment.",
      avoid: "No es recomana fer activitats exigents a l’aire lliure en aquests moments.",
    },
    es: {
      optimal: "Situación adecuada para actividades al aire libre.",
      caution: "Se pueden realizar actividades al aire libre con precauciones básicas.",
      limited: "Conviene limitar o adaptar las actividades al aire libre en este momento.",
      avoid: "No se recomienda realizar actividades exigentes al aire libre en estos momentos.",
    },
    eu: {
      optimal: "Kanpoko jardueretarako egoera egokia.",
      caution: "Kanpoko jarduerak egin daitezke oinarrizko neurriak hartuta.",
      limited: "Komeni da kanpoko jarduerak mugatzea edo egokitzea une honetan.",
      avoid: "Ez da gomendatzen une honetan kanpoko jarduera zorrotzak egitea.",
    },
    gl: {
      optimal: "Situación axeitada para actividades ao aire libre.",
      caution: "Pódense realizar actividades ao aire libre con precaucións básicas.",
      limited: "Convén limitar ou adaptar as actividades ao aire libre neste momento.",
      avoid: "Non se recomenda realizar actividades esixentes ao aire libre nestes momentos.",
    },
    en: {
      optimal: "Suitable conditions for outdoor activities.",
      caution: "Outdoor activities are possible with basic precautions.",
      limited: "It is advisable to limit or adapt outdoor activities at this time.",
      avoid: "Demanding outdoor activities are not recommended at this time.",
    },
  };

  return txt[lang]?.[level] || txt.ca[level];
}