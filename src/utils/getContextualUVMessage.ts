import { getUvLevelIndex } from "./uv";

export function getContextualUVMessage(uv: number, lang: string = "ca"): string {
  const level = getUvLevelIndex(uv);
  const l = String(lang || "ca").slice(0, 2).toLowerCase();

  if (l === "en") {
    if (level === 0) {
      return "Low risk. You can be outdoors as usual.";
    }

    if (level === 1) {
      return "Moderate risk. Sun protection is recommended if exposure is prolonged.";
    }

    if (level === 2) {
      return "High risk. Use sunscreen, a hat, and sunglasses.";
    }

    if (level === 3) {
      return "Very high risk. Avoid prolonged sun exposure.";
    }

    return "Extreme risk. Avoid the sun and protect yourself as much as possible.";
  }

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
