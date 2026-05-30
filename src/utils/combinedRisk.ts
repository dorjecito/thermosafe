import { getUvLevelIndex } from "./uv";

export function getCombinedRiskLevel(
  heatRisk: { isModerate?: boolean; isHigh?: boolean; isExtreme?: boolean } | null,
  coldRisk: string | null,
  windRisk: string | null,
  uvi: number | null
): "none" | "high" | "extreme" {
  const uvLevel = getUvLevelIndex(uvi);
  const hasUvHigh = uvLevel >= 2;
  const hasUvVeryHigh = uvLevel >= 3;

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
