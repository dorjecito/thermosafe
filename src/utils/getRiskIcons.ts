export function getRiskIcons(
  heatRisk: { isModerate?: boolean; isHigh?: boolean; isExtreme?: boolean } | null,
  coldRisk: string | null,
  windRisk: string | null,
  uvi: number | null
): string {
  const icons = new Set<string>();

  const hasUvRisk =
    typeof uvi === "number" && uvi >= 3;

  const hasHeatRisk =
    Boolean(heatRisk?.isModerate || heatRisk?.isHigh || heatRisk?.isExtreme);

  const coldLevels = ["moderat", "alt", "molt alt", "extrem"];
  const hasColdRisk = coldLevels.includes(coldRisk ?? "");

  const windLevels = ["moderate", "strong", "very_strong"];
  const hasWindRisk = windLevels.includes(windRisk ?? "");

  if (hasUvRisk) icons.add("☀️");
  if (hasHeatRisk) icons.add("🔥");
  if (hasColdRisk) icons.add("❄️");
  if (hasWindRisk) icons.add("💨");

  return icons.size ? [...icons].join(" ") : "🌤️";
}