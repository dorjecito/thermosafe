export function getContextualUVMessage(uv: number): string {
  if (uv <= 2) {
    return "Risc baix. Pots estar a l'exterior amb normalitat.";
  }

  if (uv <= 5) {
    return "Risc moderat. Recomanable protecció solar si l'exposició és prolongada.";
  }

  if (uv <= 7) {
    return "Risc alt. Utilitza crema solar, gorra i ulleres de sol.";
  }

  if (uv <= 10) {
    return "Risc molt alt. Evita l'exposició prolongada al sol.";
  }

  return "Risc extrem. Evita el sol i protegeix-te al màxim.";
}