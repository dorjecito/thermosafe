// src/utils/windRisk.ts

export type WindRisk =
  | 'none'
  | 'breezy'
  | 'moderate'
  | 'strong'
  | 'very_strong';

export const WIND_THRESHOLDS_KMH = {
  breezy: 15,       // abans 20
  moderate: 30,     // abans 35
  strong: 45,       // abans 50
  very_strong: 65,  // abans 70
} as const;

export function getWindRisk(kmh: number): WindRisk {
  if (kmh >= WIND_THRESHOLDS_KMH.very_strong) return 'very_strong';
  if (kmh >= WIND_THRESHOLDS_KMH.strong) return 'strong';
  if (kmh >= WIND_THRESHOLDS_KMH.moderate) return 'moderate';
  if (kmh >= WIND_THRESHOLDS_KMH.breezy) return 'breezy';
  return 'none';
}

export const WIND_COLORS = {
  none: "#4CAF50",        // Verd
  breezy: "#8BC34A",      // Verd clar
  moderate: "#FFC107",    // Groc (alerta lleu laboral)
  strong: "#FF9800",      // Taronja
  very_strong: "#d32f2f" // vermell intens
} as const;