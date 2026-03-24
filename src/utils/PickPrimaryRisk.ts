export type PrimaryKind = "heat" | "cold" | "wind" | "uv" | "none";
export type Severity = 0 | 1 | 2 | 3 | 4;

type PickPrimaryRiskArgs = {
  hi: number | null;
  effForCold: number | null;
  windRisk: string;
  uvi: number | null;
};

type PickPrimaryRiskResult = {
  kind: PrimaryKind;
  severity: Severity;
  labelKey: string;
};

export function pickPrimaryRisk({
  hi,
  effForCold,
  windRisk,
  uvi,
}: PickPrimaryRiskArgs): PickPrimaryRiskResult {
  // --- 1) CALOR ---
  let heatSev: Severity = 0;
  let heatKey = "heat_safe";

  if (typeof hi === "number") {
    if (hi >= 54) {
      heatSev = 4;
      heatKey = "heat_extreme";
    } else if (hi >= 41) {
      heatSev = 3;
      heatKey = "heat_high";
    } else if (hi >= 32) {
      heatSev = 2;
      heatKey = "heat_moderate";
    } else if (hi >= 27) {
      heatSev = 1;
      heatKey = "heat_mild";
    }
  }

  // --- 2) FRED ---
  let coldSev: Severity = 0;
  let coldKey = "cold_safe";

  if (typeof effForCold === "number") {
    if (effForCold <= -40) {
      coldSev = 4;
      coldKey = "cold_extreme";
    } else if (effForCold <= -25) {
      coldSev = 3;
      coldKey = "cold_very_high";
    } else if (effForCold <= -15) {
      coldSev = 3;
      coldKey = "cold_high";
    } else if (effForCold <= -5) {
      coldSev = 2;
      coldKey = "cold_moderate";
    } else if (effForCold <= 0) {
      coldSev = 1;
      coldKey = "cold_mild";
    }
  }

  // --- 3) VENT ---
  const windMap: Record<string, Severity> = {
    none: 0,
    breezy: 1,
    moderate: 2,
    strong: 3,
    very_strong: 4,
    extreme: 4,
  };

  const windSev: Severity = windMap[windRisk] ?? 0;
  const windKey = windSev === 0 ? "wind_none" : `wind_${windRisk}`;

  // --- 4) UV ---
  let uvSev: Severity = 0;
  let uvKey = "uv_low";

  if (typeof uvi === "number" && Number.isFinite(uvi)) {
    const uviSafe = Math.max(0, uvi);

    if (uviSafe >= 11) {
      uvSev = 4;
      uvKey = "uv_extreme";
    } else if (uviSafe >= 8) {
      uvSev = 3;
      uvKey = "uv_very_high";
    } else if (uviSafe >= 6) {
      uvSev = 2;
      uvKey = "uv_high";
    } else if (uviSafe >= 3) {
      uvSev = 1;
      uvKey = "uv_moderate";
    } else {
      uvSev = 0;
      uvKey = "uv_low";
    }
  }

  // --- Tria final ---
  const candidates: Array<{
    kind: PrimaryKind;
    sev: Severity;
    key: string;
    tie: number;
  }> = [
    { kind: "heat", sev: heatSev, key: heatKey, tie: 4 },
    { kind: "cold", sev: coldSev, key: coldKey, tie: 3 },
    { kind: "wind", sev: windSev, key: windKey, tie: 2 },
    { kind: "uv", sev: uvSev, key: uvKey, tie: 1 },
  ];

  candidates.sort((a, b) => (b.sev - a.sev) || (b.tie - a.tie));
  const top = candidates[0];

  if (!top || top.sev === 0) {
    return { kind: "none", severity: 0, labelKey: "none" };
  }

  return { kind: top.kind, severity: top.sev, labelKey: top.key };
}