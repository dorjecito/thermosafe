export type ColdRisk =
  | "cap"
  | "lleu"
  | "moderat"
  | "alt"
  | "molt alt"
  | "extrem";

export function getColdRisk(
  tempEff: number | null,
  _windKmh: number | null
): ColdRisk {
  if (tempEff === null || Number.isNaN(tempEff)) return "cap";
  if (tempEff > 0) return "cap";

  if (tempEff <= -40) return "extrem";
  if (tempEff <= -25) return "molt alt";
  if (tempEff <= -15) return "alt";
  if (tempEff <= -5) return "moderat";
  if (tempEff <= 0) return "lleu";

  return "cap";
}