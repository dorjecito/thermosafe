type TFunctionLike = (key: string) => string;

type PrimaryKind = "heat" | "cold" | "wind" | "uv" | "none";

type Primary = {
  kind: PrimaryKind;
  severity: 0 | 1 | 2 | 3 | 4;
  labelKey: string;
};

type HeatRiskLike = {
  isModerate?: boolean;
  isHigh?: boolean;
  isExtreme?: boolean;
} | null;

type GetPrimaryAdviceTextArgs = {
  primary: Primary;
  coldRisk: string | null;
  heatRisk: HeatRiskLike;
  hi: number | null;
  temp: number | null;
  uvi: number | null;
  windRisk: string | null;
  t: TFunctionLike;
};

export function getPrimaryAdviceText({
  primary,
  coldRisk,
  heatRisk,
  hi,
  temp,
  uvi,
  windRisk,
  t,
}: GetPrimaryAdviceTextArgs): string | null {
  // ❄️ FRED
  if (primary.kind === "cold") {
    if (coldRisk === "lleu") {
      const text = t("officialAdviceDynamic.cold.mild");
      return text !== "officialAdviceDynamic.cold.mild" ? text : null;
    }

    if (coldRisk === "moderat") {
      const text = t("officialAdviceDynamic.cold.moderate");
      return text !== "officialAdviceDynamic.cold.moderate" ? text : null;
    }

    if (coldRisk === "alt" || coldRisk === "molt alt") {
      const text = t("officialAdviceDynamic.cold.high");
      return text !== "officialAdviceDynamic.cold.high" ? text : null;
    }

    if (coldRisk === "extrem") {
      const text = t("officialAdviceDynamic.cold.extreme");
      return text !== "officialAdviceDynamic.cold.extreme" ? text : null;
    }
  }

  // 🔥 CALOR
  if (primary.kind === "heat" && heatRisk) {
    if (heatRisk.isExtreme) {
      const text = t("officialAdviceDynamic.heat.extreme");
      return text !== "officialAdviceDynamic.heat.extreme" ? text : null;
    }

    if (heatRisk.isHigh) {
      const text = t("officialAdviceDynamic.heat.high");
      return text !== "officialAdviceDynamic.heat.high" ? text : null;
    }

    const hiNow = hi ?? temp ?? null;

    if (typeof hiNow === "number") {
      if (hiNow >= 32) {
        const text = t("officialAdviceDynamic.heat.moderate");
        return text !== "officialAdviceDynamic.heat.moderate" ? text : null;
      }

      if (hiNow >= 27) {
        const text = t("officialAdviceDynamic.heat.mild");
        return text !== "officialAdviceDynamic.heat.mild" ? text : null;
      }
    }
  }

  // ☀️ UV
  if (primary.kind === "uv" && typeof uvi === "number") {
    let uvLevel: "moderate" | "high" | "very_high" | "extreme" = "moderate";

    if (uvi >= 11) uvLevel = "extreme";
    else if (uvi >= 8) uvLevel = "very_high";
    else if (uvi >= 6) uvLevel = "high";

    const key = `officialAdviceDynamic.uv.${uvLevel}`;
    const text = t(key);
    return text !== key ? text : null;
  }

  // 💨 VENT
  if (primary.kind === "wind" && windRisk && windRisk !== "none") {
    const key = `officialAdviceDynamic.wind.${windRisk}`;
    const text = t(key);
    return text !== key ? text : null;
  }

  return null;
}