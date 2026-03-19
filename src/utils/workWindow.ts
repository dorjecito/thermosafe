export type WorkWindow = "optimal" | "caution" | "limited" | "avoid";

type Lang = "ca" | "es" | "eu" | "gl" | "en";

type Params = {
  heatRisk?: any;
  coldRisk?: string | null;
  windRisk?: string | null;
  uvi?: number | null;
};

/* =========================================================
   Determinar estat global d'activitat exterior
========================================================= */

export function getWorkWindow({
  heatRisk,
  coldRisk,
  windRisk,
  uvi,
}: Params): WorkWindow {
  const uv = typeof uvi === "number" && Number.isFinite(uvi) ? uvi : 0;

  /* Situacions extremes */
  if (coldRisk === "extrem") return "avoid";
  if (heatRisk?.isExtreme) return "avoid";
  if (windRisk === "very_strong" || windRisk === "extreme") return "avoid";
  if (uv >= 11) return "avoid";

  /* 🔧 Ajust combinat: fred + vent */
  if (
    (coldRisk === "moderat" || coldRisk === "alt" || coldRisk === "molt alt") &&
    (windRisk === "moderate" || windRisk === "strong" || windRisk === "very_strong")
  ) {
    return coldRisk === "moderat" ? "limited" : "avoid";
  }

  /* Situacions elevades */
  if (coldRisk === "alt" || coldRisk === "molt alt") return "limited";
  if (heatRisk?.isHigh) return "limited";
  if (windRisk === "strong") return "limited";
  if (uv >= 8) return "limited";

  /* Situacions moderades */
  if (coldRisk === "moderat") return "caution";
  if (windRisk === "moderate") return "caution";
  if (uv >= 6) return "caution";

  return "optimal";
}

/* =========================================================
   Títol del bloc
========================================================= */

export function getWorkWindowTitle(lang: string): string {

  const l = (lang || "ca").slice(0, 2).toLowerCase();

  if (l === "es") return "🌤️ Condiciones para la actividad exterior";
  if (l === "eu") return "🌤️ Kanpoko jarduerarako baldintzak";
  if (l === "gl") return "🌤️ Condicións para a actividade exterior";
  if (l === "en") return "🌤️ Outdoor activity conditions";

  return "🌤️ Condicions per a l’activitat exterior";
}

/* =========================================================
   Text segons nivell de risc
========================================================= */

export function getWorkWindowText(level: WorkWindow, lang: string): string {

  const l = (lang || "ca").slice(0, 2).toLowerCase();

  const TXT = {

    ca: {
      optimal: "Situació adequada per a activitats a l’aire lliure.",
      caution: "Es poden realitzar activitats a l’aire lliure amb precaucions bàsiques.",
      limited: "Millor limitar activitats exigents a l’aire lliure i prioritzar pauses.",
      avoid: "No es recomana fer activitats exigents a l’aire lliure en aquests moments.",
    },

    es: {
      optimal: "Situación adecuada para actividades al aire libre.",
      caution: "Se pueden realizar actividades al aire libre con precauciones básicas.",
      limited: "Mejor limitar actividades exigentes al aire libre y priorizar pausas.",
      avoid: "No se recomienda realizar actividades exigentes al aire libre en este momento.",
    },

    eu: {
      optimal: "Kanpoko jardueretarako egoera egokia.",
      caution: "Kanpoko jarduera egin daiteke oinarrizko neurriak hartuta.",
      limited: "Hobe kanpoko jarduera gogorrak mugatzea eta atsedenak lehenestea.",
      avoid: "Ez da gomendagarria une honetan kanpoko jarduera intentsuak egitea.",
    },

    gl: {
      optimal: "Situación axeitada para actividades ao aire libre.",
      caution: "Pódense realizar actividades ao aire libre con precaucións básicas.",
      limited: "Mellor limitar actividades esixentes ao aire libre e priorizar pausas.",
      avoid: "Non se recomenda realizar actividades esixentes ao aire libre neste momento.",
    },

    en: {
      optimal: "Suitable conditions for outdoor activities.",
      caution: "Outdoor activities are possible with basic precautions.",
      limited: "Better to limit demanding outdoor activities and prioritize breaks.",
      avoid: "Intense outdoor activities are not recommended at this time.",
    },

  } as const;

  const langKey =
    ["ca", "es", "eu", "gl", "en"].includes(l) ? (l as Lang) : "ca";

  return TXT[langKey][level];
}