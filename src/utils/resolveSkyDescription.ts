// Exact OpenWeather codes for descriptions already available in all five locales.
// https://openweathermap.org/weather-conditions
// Uncatalogued phenomena keep the API description; do not approximate severity.
const skyKeys: Readonly<Record<number, string>> = {
  201: "thunderstorm_with_rain",
  211: "thunderstorm",
  301: "drizzle",
  500: "light_rain",
  501: "moderate_rain",
  502: "heavy_intensity_rain",
  521: "shower_rain",
  600: "light_snow",
  601: "snow",
  701: "mist",
  711: "smoke",
  721: "haze",
  741: "fog",
  751: "sand",
  761: "dust",
  762: "ash",
  771: "squall",
  781: "tornado",
  800: "clear_sky",
  801: "few_clouds",
  802: "scattered_clouds",
  803: "broken_clouds",
  804: "overcast_clouds",
};
const knownKeys = new Set([
  ...Object.values(skyKeys),
  "ennuvolat", "lleugerament_ennuvolat", "molt_ennuvolat",
  "cel_net", "poc_ennuvolat", "nuvolositat_variable",
]);

export function resolveSkyDescription(
  rawDescription: string,
  t: (key: string) => string,
  weatherCode?: number,
): string {
  const raw = (rawDescription || "").trim();
  const codeKey = weatherCode === undefined ? undefined : skyKeys[weatherCode];
  if (codeKey) return t(`weather_desc.${codeKey}`);

  // English descriptions can also identify an existing key in older fixtures/cache.
  const descriptionKey = raw.toLowerCase().replace(/\s+/g, "_");
  if (knownKeys.has(descriptionKey)) return t(`weather_desc.${descriptionKey}`);
  return raw.replace(/_/g, " ");
}
