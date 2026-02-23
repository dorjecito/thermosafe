import type { SafeExposureTime } from "../services/openUV";

export type SkinType = 1 | 2 | 3 | 4 | 5 | 6;

export function getSafeMinutes(safe: SafeExposureTime | undefined, skin: SkinType): number | null {
  if (!safe) return null;
  const key = (`st${skin}` as keyof SafeExposureTime);
  const v = safe[key];
  return typeof v === "number" && isFinite(v) ? v : null;
}

export function formatMinutes(mins: number): string {
  // OpenUV sol donar minuts
  if (mins < 60) return `${Math.round(mins)} min`;
  const h = Math.floor(mins / 60);
  const m = Math.round(mins - h * 60);
  if (m === 0) return `${h} h`;
  return `${h} h ${m} min`;
}