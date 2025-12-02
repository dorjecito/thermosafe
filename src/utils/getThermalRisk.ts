// ------------------------------------------------------------
// getThermalRisk.ts
// Funció única per determinar risc per calor i risc per fred
// ------------------------------------------------------------
export function getThermalRisk(temp: number) {
  if (temp >= 27) return "heat_high";         // calor alta
  if (temp >= 22) return "heat_moderate";     // calor moderada
  if (temp >= 15) return "safe";              // zona segura

  if (temp >= 5) return "cold_mild";          // fred lleu
  if (temp >= -5) return "cold_moderate";     // fred moderat

  return "cold_severe";                       // fred sever
}