// src/utils/windDirections.ts
export type WindLang = "ca" | "es" | "gl" | "eu" | "en";

/** Normalitza l’idioma a un dels suportats */
function normLang(lang?: string): WindLang {
  const s = (lang || "ca").slice(0, 2).toLowerCase();
  if (s === "ca" || s === "es" || s === "gl" || s === "eu" || s === "en") return s;
  return "en";
}

/** Fletxa: la rotació és directament el grau meteorològic */
export function windArrowRotation(deg: number | null | undefined): number {
  return typeof deg === "number" && !Number.isNaN(deg) ? deg : 0;
}

/** Graus -> cardinal 16 punts, amb localització (ca/es/gl/eu/en) */
export function windDegToCardinal16(deg: number | null | undefined, lang?: string): string {
  if (typeof deg !== "number" || Number.isNaN(deg)) return "";

  const l = normLang(lang);

  const directions16 = [
    "N", "NNE", "NE", "ENE",
    "E", "ESE", "SE", "SSE",
    "S", "SSW", "SW", "WSW",
    "W", "WNW", "NW", "NNW",
  ] as const;

  const index = Math.round(deg / 22.5) % 16;
  const base = directions16[index];

  const map: Record<WindLang, Record<(typeof directions16)[number], string>> = {
    ca: {
      N: "N", NNE: "NNE", NE: "NE", ENE: "ENE",
      E: "E", ESE: "ESE", SE: "SE", SSE: "SSE",
      S: "S", SSW: "SSO", SW: "SO", WSW: "OSO",
      W: "O", WNW: "ONO", NW: "NO", NNW: "NNO",
    },
    es: {
      N: "N", NNE: "NNE", NE: "NE", ENE: "ENE",
      E: "E", ESE: "ESE", SE: "SE", SSE: "SSE",
      S: "S", SSW: "SSO", SW: "SO", WSW: "OSO",
      W: "O", WNW: "ONO", NW: "NO", NNW: "NNO",
    },
    gl: {
      N: "N", NNE: "NNE", NE: "NE", ENE: "ENE",
      E: "E", ESE: "ESE", SE: "SE", SSE: "SSE",
      S: "S", SSW: "SSO", SW: "SO", WSW: "OSO",
      W: "O", WNW: "ONO", NW: "NO", NNW: "NNO",
    },
    eu: {
      N: "I", NNE: "INE", NE: "IE", ENE: "EIE",
      E: "E", ESE: "ESE", SE: "HE", SSE: "HSE",
      S: "H", SSW: "HSO", SW: "HO", WSW: "OHO",
      W: "M", WNW: "MIM", NW: "MI", NNW: "IMI",
    },
    en: {
      N: "N", NNE: "NNE", NE: "NE", ENE: "ENE",
      E: "E", ESE: "ESE", SE: "SE", SSE: "SSE",
      S: "S", SSW: "SSW", SW: "SW", WSW: "WSW",
      W: "W", WNW: "WNW", NW: "NW", NNW: "NNW",
    },
  };

  return map[l][base] ?? base;
}

/** (Opcional) Graus -> cardinal 8 punts. Només si ho necessites */
export function windDegToCardinal8(deg: number | null | undefined, lang?: string): string {
  if (typeof deg !== "number" || Number.isNaN(deg)) return "";

  const l = normLang(lang);

  // 8 punts
  const idx = Math.floor(((deg + 22.5) % 360) / 45); // 0..7
  const base = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"][idx] as
    | "N" | "NE" | "E" | "SE" | "S" | "SW" | "W" | "NW";

  // Localització curta (eu diferent)
  const map8: Record<WindLang, Record<typeof base, string>> = {
    ca: { N: "N", NE: "NE", E: "E", SE: "SE", S: "S", SW: "SO", W: "O", NW: "NO" },
    es: { N: "N", NE: "NE", E: "E", SE: "SE", S: "S", SW: "SO", W: "O", NW: "NO" },
    gl: { N: "N", NE: "NE", E: "E", SE: "SE", S: "S", SW: "SO", W: "O", NW: "NO" },
    eu: { N: "I", NE: "IE", E: "E", SE: "HE", S: "H", SW: "HO", W: "M", NW: "MI" },
    en: { N: "N", NE: "NE", E: "E", SE: "SE", S: "S", SW: "SW", W: "W", NW: "NW" },
  };

  return map8[l][base] ?? base;
}

// ------------------------------------------------------------------
// ✅ Aliases de compatibilitat (per no tocar App.tsx)
// ------------------------------------------------------------------

/** Alias antic -> nou (16 punts) */
export function windDegreesToCardinal16(deg: number, lang: string = "ca"): string {
  return windDegToCardinal16(deg, lang);
}

/** Alias antic -> nou (rotació fletxa) */
export function getWindRotationFromDegrees(deg: number | null | undefined): number {
  return windArrowRotation(deg);
}