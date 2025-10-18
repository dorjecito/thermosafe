// Retorna velocitat del vent en km/h
export function parseWind(data: any): number | null {
  if (!data) return null;

  // Cas API temps actual (weather)
  if (data.wind && typeof data.wind.speed === "number") {
    return Math.round(data.wind.speed * 3.6 * 10) / 10;
  }

  // Cas API previsió diària (One Call)
  if (typeof data.wind_speed === "number") {
    return Math.round(data.wind_speed * 3.6 * 10) / 10;
  }

  return null;
}