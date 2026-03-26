// src/utils/windRisk.ts
import {
  WIND_BREEZY,
  WIND_MODERATE,
  WIND_STRONG,
  WIND_VERY_STRONG,
} from "../constants/riskThresholds";

export type WindRisk =
  | 'none'
  | 'breezy'
  | 'moderate'
  | 'strong'
  | 'very_strong';

export function getWindRisk(kmh: number): WindRisk {
  if (kmh >= WIND_VERY_STRONG) return 'very_strong';
  if (kmh >= WIND_STRONG) return 'strong';
  if (kmh >= WIND_MODERATE) return 'moderate';
  if (kmh >= WIND_BREEZY) return 'breezy';
  return 'none';
}

export const WIND_COLORS = {
  none: "#4CAF50",        // Verd
  breezy: "#8BC34A",      // Verd clar
  moderate: "#FFC107",    // Groc (alerta lleu laboral)
  strong: "#FF9800",      // Taronja
  very_strong: "#d32f2f" // vermell intens
} as const;