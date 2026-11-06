export const WIND_ACTIVITY_PROFILE_STORAGE_KEY = "thermosafe_wind_activity_profile";

export const WIND_ACTIVITY_PROFILES = [
  "generic",
  "jardineria",
  "poda",
  "altura",
  "obra",
  "neteja",
  "trekking",
  "oci",
] as const;

export type WindActivityProfile = (typeof WIND_ACTIVITY_PROFILES)[number];
export type WindActivityRisk = "caution" | "elevated" | "avoid";

type WindActivityThresholds = {
  moderate: number;
  high: number;
  veryHigh: number;
};

// Mirrors the current getWindThresholds(jobType) table in functions/index.js.
// Keep this small frontend copy independent from the Functions bundle.
export const WIND_ACTIVITY_THRESHOLDS: Record<WindActivityProfile, WindActivityThresholds> = {
  generic: { moderate: 30, high: 45, veryHigh: 65 },
  jardineria: { moderate: 30, high: 45, veryHigh: 65 },
  poda: { moderate: 25, high: 40, veryHigh: 60 },
  altura: { moderate: 20, high: 35, veryHigh: 55 },
  obra: { moderate: 28, high: 45, veryHigh: 65 },
  neteja: { moderate: 30, high: 50, veryHigh: 70 },
  trekking: { moderate: 35, high: 50, veryHigh: 70 },
  oci: { moderate: 35, high: 50, veryHigh: 70 },
};

export type WindActivityStorage = Pick<Storage, "getItem" | "setItem">;

export function parseWindActivityProfile(value: unknown): WindActivityProfile {
  return typeof value === "string" && WIND_ACTIVITY_PROFILES.includes(value as WindActivityProfile)
    ? (value as WindActivityProfile)
    : "generic";
}

export function readWindActivityProfile(storage?: WindActivityStorage): WindActivityProfile {
  try {
    const target = storage ?? (typeof window !== "undefined" ? window.localStorage : undefined);
    return parseWindActivityProfile(target?.getItem(WIND_ACTIVITY_PROFILE_STORAGE_KEY));
  } catch {
    return "generic";
  }
}

export function writeWindActivityProfile(
  profile: WindActivityProfile,
  storage?: WindActivityStorage
): boolean {
  try {
    const target = storage ?? (typeof window !== "undefined" ? window.localStorage : undefined);
    if (!target) return false;
    target.setItem(WIND_ACTIVITY_PROFILE_STORAGE_KEY, parseWindActivityProfile(profile));
    return true;
  } catch {
    return false;
  }
}

/** Returns a separate task-context indicator; it never changes meteorological wind severity. */
export function getWindActivityRisk(
  windKmh: number | null | undefined,
  profile: WindActivityProfile
): WindActivityRisk | null {
  if (typeof windKmh !== "number" || !Number.isFinite(windKmh)) return null;
  const thresholds = WIND_ACTIVITY_THRESHOLDS[profile];
  if (windKmh >= thresholds.veryHigh) return "avoid";
  if (windKmh >= thresholds.high) return "elevated";
  if (windKmh >= thresholds.moderate) return "caution";
  return null;
}
