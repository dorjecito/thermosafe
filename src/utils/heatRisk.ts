/* ============================================================
   Tipus del risc de calor
   ============================================================ */
export interface HeatRisk {
  level: 'Cap risc' | 'Baix' | 'Moderat' | 'Alt' | 'Extrem';
  color: string;
  class: 'safe' | 'mild' | 'moderate' | 'high' | 'ext';
  isHigh: boolean;
  isExtreme: boolean;
}

/* ============================================================
   1) CÀLCUL BASE SEGONS TAULA INSST (sense activitat)
   ============================================================ */
export function getBaseHeatRisk(st: number): HeatRisk {
  if (st < 27) {
    return { level: 'Cap risc', color: 'gray', class: 'safe', isHigh: false, isExtreme: false };
  }

  if (st < 32) {
    return { level: 'Baix', color: 'green', class: 'mild', isHigh: false, isExtreme: false };
  }

  if (st < 41) {
    return { level: 'Moderat', color: 'goldenrod', class: 'moderate', isHigh: false, isExtreme: false };
  }

  if (st < 54) {
    return { level: 'Alt', color: 'orange', class: 'high', isHigh: true, isExtreme: false };
  }

  return { level: 'Extrem', color: 'red', class: 'ext', isHigh: true, isExtreme: true };
}

/* ============================================================
   2) INFLUÈNCIA DE L’ACTIVITAT SOBRE EL RISC DE CALOR
   rest → +0
   walk → +1
   moderate → +2
   intense → +3
   ============================================================ */

const HEAT_LEVELS = ["safe", "mild", "moderate", "high", "ext"] as const;
type HeatKey = typeof HEAT_LEVELS[number];

const ACTIVITY_BOOST: Record<string, number> = {
  rest: 0,
  walk: 1,
  moderate: 2,
  intense: 3,
};

/* ============================================================
   3) Apliquem increments de risc segons activitat
   Exemple:
   baseRisk.class = "mild"
   activitat = "moderate" (+2)
   resultat = "high"
   ============================================================ */
export function applyActivityToHeatRisk(baseRisk: HeatRisk, activity: string): HeatRisk {
  const idx = HEAT_LEVELS.indexOf(baseRisk.class as HeatKey);
  if (idx === -1) return baseRisk;

  // 🛑 TALL DE SEGURETAT
  // En ambient fresc o fred, l'activitat NO pot generar risc alt o extrem per calor
  if (baseRisk.class === "safe") {
    // Permetem com a màxim "mild"
    return getBaseHeatRisk(30); // "Baix"
  }

  const boost = ACTIVITY_BOOST[activity] ?? 0;
  const newIdx = Math.min(idx + boost, HEAT_LEVELS.length - 1);

  if (newIdx === idx) return baseRisk;

  const newClass = HEAT_LEVELS[newIdx];

  switch (newClass) {
    case "safe":      return getBaseHeatRisk(25);
    case "mild":      return getBaseHeatRisk(30);
    case "moderate":  return getBaseHeatRisk(35);
    case "high":      return getBaseHeatRisk(45);
    case "ext":       return getBaseHeatRisk(60);
    default:          return baseRisk;
  }
}

/* ============================================================
   4) Funció FINAL que ha de cridar App.tsx
   ============================================================ */
export function getHeatRisk(st: number, activity: string): HeatRisk {
  const base = getBaseHeatRisk(st);
  return applyActivityToHeatRisk(base, activity);
}