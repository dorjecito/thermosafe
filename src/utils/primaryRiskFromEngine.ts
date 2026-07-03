import type { PrimaryKind, Severity } from "./PickPrimaryRisk";
import type { RiskScoreResult } from "./riskScoreEngine";

export type PrimaryRiskFromEngineResult = {
  kind: PrimaryKind;
  severity: Severity;
  labelKey: string;
};

export function primaryRiskFromEngine(
  riskScore: RiskScoreResult
): PrimaryRiskFromEngineResult {
  const primary = riskScore.primary;

  if (
    !primary ||
    primary.severity === 0 ||
    !["heat", "cold", "wind", "uv"].includes(primary.factor)
  ) {
    return { kind: "none", severity: 0, labelKey: "none" };
  }

  return {
    kind: primary.factor as PrimaryKind,
    severity: primary.severity as Severity,
    labelKey: primary.labelKey,
  };
}
