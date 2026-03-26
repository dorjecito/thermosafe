export function resolveSkyDescription(
  rawDescription: string,
  t: (key: string, defaultValue?: string) => string
): string {
  const rawDesc = (rawDescription || "").trim();

  if (!rawDesc) return "";

  const normalize = (s: string) => s.trim().toLowerCase();
  const humanize = (s: string) => s.replace(/_/g, " ");

  const candidates = [
    normalize(rawDesc),
    normalize(humanize(rawDesc)),
  ];

  let finalSky = humanize(rawDesc);

  for (const k of candidates) {
    const keyPath = `weather_desc.${k}`;
    const out = t(keyPath);

    if (out && out !== keyPath && out !== k && out !== rawDesc) {
      finalSky = out;
      break;
    }
  }

  return finalSky;
}