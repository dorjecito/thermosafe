import { getUvLevelIndex } from "./uv";

export function getUVBrainMessage(
  uvi: number | null,
  lang: string = "ca"
): string {
  if (uvi === null || Number.isNaN(uvi)) return "";

  const l = (lang || "ca").slice(0, 2).toLowerCase();
  const level = getUvLevelIndex(uvi);

  if (l === "es") {
    if (level === 0) return "Riesgo muy bajo. Protección mínima.";
    if (level === 1) return "Riesgo moderado. Usa protección solar si la exposición es prolongada.";
    if (level === 2) return "Riesgo alto. Reduce la exposición al sol.";
    if (level === 3) return "Riesgo muy alto. Evita el sol en horas centrales.";
    return "Riesgo extremo. Evita el sol y protégete al máximo.";
  }

  if (l === "en") {
    if (level === 0) return "Very low risk. Minimal protection needed.";
    if (level === 1) return "Moderate risk. Use sun protection for prolonged exposure.";
    if (level === 2) return "High risk. Reduce sun exposure.";
    if (level === 3) return "Very high risk. Avoid midday sun.";
    return "Extreme risk. Avoid the sun and protect yourself as much as possible.";
  }

  if (l === "eu") {
    if (level === 0) return "Arrisku oso txikia. Babes minimoa.";
    if (level === 1) return "Arrisku moderatua. Erabili eguzki-babesa esposizioa luzea bada.";
    if (level === 2) return "Arrisku handia. Murriztu eguzki-esposizioa.";
    if (level === 3) return "Arrisku oso handia. Saihestu eguzkia erdiko orduetan.";
    return "Muturreko arriskua. Saihestu eguzkia eta babestu zaitez gehienez.";
  }

  if (l === "gl") {
    if (level === 0) return "Risco moi baixo. Protección mínima.";
    if (level === 1) return "Risco moderado. Usa protección solar se a exposición é prolongada.";
    if (level === 2) return "Risco alto. Reduce a exposición ao sol.";
    if (level === 3) return "Risco moi alto. Evita o sol nas horas centrais.";
    return "Risco extremo. Evita o sol e protéxete ao máximo.";
  }

  // Català per defecte
  if (level === 0) return "Risc molt baix. Protecció mínima.";
  if (level === 1) return "Risc moderat. Utilitza protecció solar si l’exposició és prolongada.";
  if (level === 2) return "Risc alt. Redueix l’exposició al sol.";
  if (level === 3) return "Risc molt alt. Evita el sol en hores centrals.";
  return "Risc extrem. Evita el sol i protegeix-te al màxim.";
}
