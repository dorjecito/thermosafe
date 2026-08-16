export type SkinType = 1 | 2 | 3 | 4 | 5 | 6;

export const MAX_UV_EXPOSURE_MINUTES = 480;
export const MIN_UV_TO_SHOW_EXPOSURE_TIME = 3;

type SkinTypeKey = "1" | "2" | "3" | "4" | "5" | "6";

const UV_MULTIPLIER: Record<SkinTypeKey, number> = {
  "1": 0.67,
  "2": 0.83,
  "3": 1,
  "4": 1.33,
  "5": 1.67,
  "6": 2,
};

export function estimateUvExposureMinutes(
  uvi: number,
  skinType: SkinType
): number | null {
  if (!Number.isFinite(uvi) || uvi <= 0) return null;
  if (uvi < MIN_UV_TO_SHOW_EXPOSURE_TIME) return null;

  const basePhototype3 = 200 / uvi;
  const adjusted = basePhototype3 * UV_MULTIPLIER[String(skinType) as SkinTypeKey];

  return Math.max(5, adjusted);
}

export function formatUvExposureMinutes(
  totalMinutes: number,
  lang: string,
  moreThanMax: string
): string {
  if (totalMinutes > MAX_UV_EXPOSURE_MINUTES) return moreThanMax;

  const mins = Math.max(1, Math.round(totalMinutes));
  const h = Math.floor(mins / 60);
  const m = mins % 60;

  if (lang === "en") {
    if (h > 0 && m > 0) return `${h} h ${m} min`;
    if (h > 0) return `${h} h`;
    return `${m} min`;
  }

  if (h > 0 && m > 0) return `${h} h ${m} min`;
  if (h > 0) return `${h} h`;
  return `${m} min`;
}
