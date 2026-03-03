// ------------------------------------------------------------
// getThermalRisk.ts
// Funció única per determinar risc per calor i risc per fred
// ------------------------------------------------------------
export function getThermalRisk(temp: number) {
  if (temp >= 32) return "heat_high";
  if (temp >= 27) return "heat_moderate";
  if (temp >= 18) return "safe";

  if (temp >= 5) return "cool";          // NO fred-risc, només “fresc”
  if (temp >= 0) return "cold_mild";     // fred lleu (ja més coherent)
  if (temp >= -5) return "cold_moderate";
  return "cold_severe";
}