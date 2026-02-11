// src/utils/windRisk.ts

export type WindRisk =
  | 'none'
  | 'breezy'
  | 'moderate'
  | 'strong'
  | 'very_strong';

export const WIND_THRESHOLDS_KMH = {
  breezy: 20,
  moderate: 35,
  strong: 50,
  very_strong: 70,
} as const;

export function getWindRisk(kmh: number): WindRisk {
  if (kmh >= WIND_THRESHOLDS_KMH.very_strong) return 'very_strong';
  if (kmh >= WIND_THRESHOLDS_KMH.strong) return 'strong';
  if (kmh >= WIND_THRESHOLDS_KMH.moderate) return 'moderate';
  if (kmh >= WIND_THRESHOLDS_KMH.breezy) return 'breezy';
  return 'none';
}

export const WIND_COLORS = {
  none: "#4CAF50",
  breezy: "#8BC34A",
  moderate: "#FFC107",
  strong: "#FF9800",
  very_strong: "#F44336",
} as const;