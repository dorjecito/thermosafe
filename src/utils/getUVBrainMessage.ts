export function getUVBrainMessage(
  uvi: number | null,
  lang: string = "ca"
): string {
  if (uvi === null || Number.isNaN(uvi)) return "";

  const l = (lang || "ca").slice(0, 2).toLowerCase();

  if (l === "es") {
    if (uvi < 3) return "Riesgo muy bajo. Protección mínima.";
    if (uvi < 6) return "Riesgo moderado. Usa protección solar.";
    if (uvi < 8) return "Riesgo alto. Reduce la exposición al sol.";
    if (uvi < 11) return "Riesgo muy alto. Evita el sol en horas centrales.";
    return "Riesgo extremo. Evita el sol y protégete al máximo.";
  }

  if (l === "en") {
    if (uvi < 3) return "Very low risk. Minimal protection needed.";
    if (uvi < 6) return "Moderate risk. Use sun protection.";
    if (uvi < 8) return "High risk. Reduce sun exposure.";
    if (uvi < 11) return "Very high risk. Avoid midday sun.";
    return "Extreme risk. Avoid the sun and protect yourself as much as possible.";
  }

  if (l === "eu") {
    if (uvi < 3) return "Arrisku oso txikia. Babes minimoa.";
    if (uvi < 6) return "Arrisku moderatua. Erabili eguzki-babesa.";
    if (uvi < 8) return "Arrisku handia. Murriztu eguzki-esposizioa.";
    if (uvi < 11) return "Arrisku oso handia. Saihestu eguzkia erdiko orduetan.";
    return "Muturreko arriskua. Saihestu eguzkia eta babestu zaitez gehienez.";
  }

  if (l === "gl") {
    if (uvi < 3) return "Risco moi baixo. Protección mínima.";
    if (uvi < 6) return "Risco moderado. Usa protección solar.";
    if (uvi < 8) return "Risco alto. Reduce a exposición ao sol.";
    if (uvi < 11) return "Risco moi alto. Evita o sol nas horas centrais.";
    return "Risco extremo. Evita o sol e protéxete ao máximo.";
  }

  // Català per defecte
  if (uvi < 3) return "Risc molt baix. Protecció mínima.";
  if (uvi < 6) return "Risc moderat. Utilitza protecció solar.";
  if (uvi < 8) return "Risc alt. Redueix l’exposició al sol.";
  if (uvi < 11) return "Risc molt alt. Evita el sol en hores centrals.";
  return "Risc extrem. Evita el sol i protegeix-te al màxim.";
}