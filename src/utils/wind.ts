// src/utils/wind.ts
// ======================================================
// 💨 Utils de vent — direcció, risc, colors i formats
// ======================================================

export type WindRisk =
  | "none"
  | "breezy"
  | "moderate"
  | "strong"
  | "very_strong";

// ─────────────────────────────
// Llindars oficials (km/h)
// ─────────────────────────────
const WIND_THRESHOLDS = {
  breezy: 15,
  moderate: 30,
  strong: 45,
  very_strong: 65,
} as const;

// ─────────────────────────────
// Classificació del risc
// ─────────────────────────────
export function getWindRisk(kmh: number): WindRisk {
  if (kmh >= WIND_THRESHOLDS.very_strong) return "very_strong";
  if (kmh >= WIND_THRESHOLDS.strong) return "strong";
  if (kmh >= WIND_THRESHOLDS.moderate) return "moderate";
  if (kmh >= WIND_THRESHOLDS.breezy) return "breezy";
  return "none";
}

// ─────────────────────────────
// Colors associats al risc
// ─────────────────────────────
export const WIND_COLORS: Record<WindRisk, string> = {
  none: "#4CAF50",
  breezy: "#8BC34A",
  moderate: "#FFC107",
  strong: "#FF9800",
  very_strong: "#F44336",
};

// ─────────────────────────────
// Conversió graus → cardinal (16 punts)
// ─────────────────────────────
export function windDegreesToCardinal16(
  deg: number,
  lang: string = "ca"
): string {
  const baseDirs = [
    "N", "NNE", "NE", "ENE",
    "E", "ESE", "SE", "SSE",
    "S", "SSW", "SW", "WSW",
    "W", "WNW", "NW", "NNW",
  ];

  const index = Math.round(deg / 22.5) % 16;
  const base = baseDirs[index];

  const map: Record<string, Record<string, string>> = {
    ca: {
      N: "N", NNE: "NNE", NE: "NE", ENE: "ENE",
      E: "E", ESE: "ESE", SE: "SE", SSE: "SSE",
      S: "S", SSW: "SSO", SW: "SO", WSW: "OSO",
      W: "O", WNW: "ONO", NW: "NO", NNW: "NNO",
    },
    es: {
      N: "N", NNE: "NNE", NE: "NE", ENE: "ENE",
      E: "E", ESE: "ESE", SE: "SE", SSE: "SSE",
      S: "S", SSW: "SSO", SW: "SO", WSW: "OSO",
      W: "O", WNW: "ONO", NW: "NO", NNW: "NNO",
    },
    eu: {
      N: "I", NNE: "INE", NE: "IE", ENE: "EIE",
      E: "E", ESE: "ESE", SE: "HE", SSE: "HSE",
      S: "H", SSW: "HSO", SW: "HO", WSW: "OHO",
      W: "M", WNW: "MIM", NW: "MI", NNW: "IMI",
    },
    gl: {
      N: "N", NNE: "NNE", NE: "NE", ENE: "ENE",
      E: "E", ESE: "ESE", SE: "SE", SSE: "SSE",
      S: "S", SSW: "SSO", SW: "SO", WSW: "OSO",
      W: "O", WNW: "ONO", NW: "NO", NNW: "NNO",
    },
  };

  return map[lang]?.[base] ?? base;
}

// ─────────────────────────────
// Rotació de la fletxa (SVG)
// ─────────────────────────────
export function getWindRotationFromDegrees(deg: number): number {
  return deg ?? 0;
}