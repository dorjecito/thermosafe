import { calcHeatIndexCelsius } from "../../functions/shared/heat-index.cjs";

/** NWS heat-index procedure; inputs and result are Celsius and RH percent. */
export function calcHI(tempC: number, relativeHumidity: number): number {
  return calcHeatIndexCelsius(tempC, relativeHumidity) ?? Number.NaN;
}

/** Returns null so callers can preserve unavailable weather as unknown. */
export function calcHIOrNull(
  tempC: unknown,
  relativeHumidity: unknown
): number | null {
  return calcHeatIndexCelsius(tempC, relativeHumidity);
}
