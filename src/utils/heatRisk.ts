export interface HeatRisk {
  level: 'Cap risc'|'Baix'|'Moderat'|'Alt'|'Extrem';
  color: string;
  isHigh: boolean;     // Alt o Extrem
  isExtreme: boolean;  // Extrem
}

/**
 * Converteix l’índex de calor (ST) en nivell de risc segons la taula INSST.
 */
export function getHeatRisk(st: number): HeatRisk {
  if (st < 27)  return { level: 'Cap risc', color: 'gray',    isHigh: false, isExtreme: false };
  if (st < 32)  return { level: 'Baix',     color: 'green',   isHigh: false, isExtreme: false };
  if (st < 40)  return { level: 'Moderat',  color: 'goldenrod', isHigh: false, isExtreme: false };
  if (st < 55)  return { level: 'Alt',      color: 'orange',  isHigh: true,  isExtreme: false };
  return         { level: 'Extrem',   color: 'red',     isHigh: true,  isExtreme: true  };
}