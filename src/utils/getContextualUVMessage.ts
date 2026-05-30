import { getUvLevelIndex } from "./uv";

export function getContextualUVMessage(uv: number): string {
  const level = getUvLevelIndex(uv);

  if (level === 0) {
    return "Risc baix. Pots estar a l'exterior amb normalitat.";
  }

  if (level === 1) {
    return "Risc moderat. Recomanable protecció solar si l'exposició és prolongada.";
  }

  if (level === 2) {
    return "Risc alt. Utilitza crema solar, gorra i ulleres de sol.";
  }

  if (level === 3) {
    return "Risc molt alt. Evita l'exposició prolongada al sol.";
  }

  return "Risc extrem. Evita el sol i protegeix-te al màxim.";
}
