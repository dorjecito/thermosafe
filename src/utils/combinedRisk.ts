export function getCombinedRiskLevel(
  heatRisk: { isModerate?: boolean; isHigh?: boolean; isExtreme?: boolean } | null,
  coldRisk: string | null,
  windRisk: string | null,
  uvi: number | null
): "none" | "high" | "extreme" {
  const hasUvHigh = typeof uvi === "number" && uvi >= 6;
  const hasUvVeryHigh = typeof uvi === "number" && uvi >= 8;

  const hasHeatModerate = Boolean(
    heatRisk?.isModerate || heatRisk?.isHigh || heatRisk?.isExtreme
  );

  const hasHeatHigh = Boolean(
    heatRisk?.isHigh || heatRisk?.isExtreme
  );

  const hasColdModerateOrMore =
    coldRisk === "moderat" ||
    coldRisk === "alt" ||
    coldRisk === "molt alt" ||
    coldRisk === "extrem";

  const hasWindStrongOrMore =
    windRisk === "strong" ||
    windRisk === "very_strong";

  // 🔴 combinacions molt exigents
  if (
    (hasUvVeryHigh && hasHeatHigh) ||
    (hasColdModerateOrMore && hasWindStrongOrMore)
  ) {
    return "extreme";
  }

  // 🟠 combinacions rellevants
  if (
    (hasUvHigh && hasHeatModerate) ||
    (hasUvHigh && hasWindStrongOrMore) ||
    (hasHeatModerate && hasWindStrongOrMore)
  ) {
    return "high";
  }

  return "none";
}