/* =========================================================
   🧠 AEMET AI — Traducció i interpretació d’avisos oficials
   (corregit: suport EN + fallback robust + lang normalitzat)
   ========================================================= */

// ---------------------------------------------------------
// Tipus bàsics
// ---------------------------------------------------------
export type LangKey = "ca" | "es" | "eu" | "gl" | "en";

export type HazardId =
  | "rain"
  | "snow"
  | "wind"
  | "storm"
  | "coast"
  | "fog"
  | "temp_min"
  | "temp_max"
  | "other";

type LevelId = "extreme" | "high" | "moderate" | "info";

export interface AemetAiAlert {
  title: string;
  body: string;
}

// ---------------------------------------------------------
// Constants (labels i textos fixos)
// ---------------------------------------------------------
const HAZARD_LABELS: Record<HazardId, Record<LangKey, string>> = {
  rain: { ca: "pluja", es: "lluvia", eu: "euria", gl: "chuva", en: "rain" },
  snow: { ca: "neu", es: "nieve", eu: "elurra", gl: "neve", en: "snow" },
  wind: { ca: "vent", es: "viento", eu: "haizea", gl: "vento", en: "wind" },
  storm: { ca: "tempestes", es: "tormentas", eu: "ekaitzak", gl: "treboadas", en: "storms" },
  coast: {
    ca: "costa i onatge",
    es: "costa y oleaje",
    eu: "kostaldea",
    gl: "costa e ondaxe",
    en: "coastal conditions",
  },
  fog: { ca: "boira", es: "niebla", eu: "lainoa", gl: "néboa", en: "fog" },
  temp_min: {
    ca: "temperatures mínimes",
    es: "temperaturas mínimas",
    eu: "tenperatura baxuak",
    gl: "temperaturas mínimas",
    en: "minimum temperatures",
  },
  temp_max: {
    ca: "temperatures màximes",
    es: "temperaturas máximas",
    eu: "tenperatura altuak",
    gl: "temperaturas máximas",
    en: "maximum temperatures",
  },
  other: {
    ca: "fenòmens adversos",
    es: "fenómenos adversos",
    eu: "fenomeno kaltegarriak",
    gl: "fenómenos adversos",
    en: "adverse phenomena",
  },
};

const LEVEL_LABELS: Record<LevelId, Record<LangKey, string>> = {
  extreme: {
    ca: "Risc extrem per",
    es: "Riesgo extremo por",
    eu: "Arrisku oso larria",
    gl: "Risco extremo por",
    en: "Extreme risk:",
  },
  high: {
    ca: "Risc important per",
    es: "Riesgo importante por",
    eu: "Arrisku handia",
    gl: "Risco importante por",
    en: "High risk:",
  },
  moderate: {
    ca: "Avís per",
    es: "Aviso por",
    eu: "Abisua",
    gl: "Aviso por",
    en: "Warning:",
  },
  info: {
    ca: "Informació sobre",
    es: "Información sobre",
    eu: "Informazioa",
    gl: "Información sobre",
    en: "Info:",
  },
};

const GENERIC_BODY: Record<LangKey, string> = {
  ca: "Avís meteorològic oficial d'AEMET.",
  es: "Aviso meteorológico oficial de AEMET.",
  eu: "AEMETen abisu ofiziala.",
  gl: "Aviso meteorolóxico oficial da AEMET.",
  en: "Official weather alert from AEMET.",
};

// ---------------------------------------------------------
// Helpers
// ---------------------------------------------------------
function cleanAemetDescription(text: string): string {
  if (!text) return "";
  return text
    .replace(/_/g, " ")
    .replace(/\s{2,}/g, " ")
    .replace(/([a-zà-ü])([A-ZÀ-Ü])/g, "$1 $2")
    .replace(/\.(?=[A-Za-zÀ-ÿ])/g, ". ")
    .trim();
}

/** Normalitza "en-US" -> "en", "ca-ES" -> "ca" */
export function normalizeLang(input: string | undefined | null): LangKey {
  const base = String(input || "ca").split("-")[0].toLowerCase();
  if (base === "ca" || base === "es" || base === "eu" || base === "gl" || base === "en") return base;
  return "ca";
}

function normalizeAlertText(text: string): string {
  return String(text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function detectAemetHazard(
  rawEvent: string,
  rawDescription: string = ""
): HazardId {
  const text = normalizeAlertText(`${rawEvent || ""} ${rawDescription || ""}`);

  if (text.includes("rain") || text.includes("precipit") || text.includes("pluja") || text.includes("lluvia") || text.includes("chuva") || text.includes("euria")) return "rain";
  if (text.includes("snow") || text.includes("neu") || text.includes("nieve") || text.includes("neve") || text.includes("elur")) return "snow";
  if (text.includes("coast") || text.includes("wave") || text.includes("oleaje") || text.includes("onatge") || text.includes("costa") || text.includes("mar") || text.includes("ondada")) return "coast";
  if (/(^|\s)(wind|vent|viento|vento|haize|haizea|racha|ratxa)(\s|$)/.test(text)) return "wind";
  if (text.includes("storm") || text.includes("thunder") || text.includes("tempest") || text.includes("torment") || text.includes("treboad") || text.includes("ekaitz")) return "storm";
  if (text.includes("fog") || text.includes("boira") || text.includes("niebla") || text.includes("neboa") || text.includes("lainoa")) return "fog";
  if (
    text.includes("minimum") ||
    text.includes("low temperature") ||
    text.includes("low temp") ||
    text.includes("temperatura minima") ||
    text.includes("temperaturas minimas") ||
    text.includes("temperatura baxu")
  ) return "temp_min";
  if (
    text.includes("maximum") ||
    text.includes("high temperature") ||
    text.includes("high temp") ||
    text.includes("heat") ||
    text.includes("calor") ||
    text.includes("temperatura maxima") ||
    text.includes("temperaturas maximas") ||
    text.includes("tenperatura altu")
  ) return "temp_max";

  return "other";
}

// ---------------------------------------------------------
// Traducció automàtica AEMET via i18next
// ---------------------------------------------------------
export function translateAemetAuto(text: string, t: any): string {
  if (!text) return "";

  let key = text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[-‐-‒–—―]/g, " ")
    .replace(/\s+/g, "_")
    .trim();

  // AEMET variants
  key = key.replace(/coastal_event/g, "coastalevent");

  const direct = t(`weather_alerts.${key}`);
  if (direct && direct !== `weather_alerts.${key}`) return direct;

  const variants = [
    key.replace(/_/g, ""),
    key.replace(/warning/g, ""),
    key.replace(/moderate/g, "moderat"),
  ];

  for (const v of variants) {
    const tr = t(`weather_alerts.${v}`);
    if (tr && tr !== `weather_alerts.${v}`) return tr;
  }

  return text;
}

// ---------------------------------------------------------
// Diccionari IA (base + ampliat) — per casos simples (opc)
// ---------------------------------------------------------
const IA_KNOWLEDGE: Record<string, Record<LangKey, string>> = {
  "heavy rain": { ca: "pluja intensa", es: "lluvia intensa", eu: "eurite handia", gl: "chuva intensa", en: "heavy rain" },
  "moderate rain": { ca: "pluja moderada", es: "lluvia moderada", eu: "eurite moderatua", gl: "chuva moderada", en: "moderate rain" },
  thunderstorm: { ca: "tempesta", es: "tormenta", eu: "ekaitza", gl: "treboada", en: "thunderstorm" },
  snowfall: { ca: "nevada", es: "nevada", eu: "elurtea", gl: "nevada", en: "snowfall" },
  fog: { ca: "boira", es: "niebla", eu: "lainoa", gl: "néboa", en: "fog" },
  "strong waves": { ca: "fort onatge", es: "fuerte oleaje", eu: "olatu handiak", gl: "ondaxe forte", en: "strong waves" },
  "high temperature": { ca: "temperatures altes", es: "temperaturas altas", eu: "tenperatura altuak", gl: "temperaturas altas", en: "high temperature" },
  "maximum gust of wind": { ca: "ratxa màxima de vent", es: "racha máxima de viento", eu: "haize-bolada maximoa", gl: "refacho máximo de vento", en: "maximum gust of wind" },
  "minimum temperature": { ca: "temperatura mínima prevista", es: "temperatura mínima prevista", eu: "gutxieneko tenperatura", gl: "temperatura mínima prevista", en: "minimum temperature" },
};

const IA_KNOWLEDGE_EXTENDED: Record<string, Record<LangKey, string>> = {
  "yellow warning": { ca: "avís groc", es: "aviso amarillo", eu: "abisu horia", gl: "aviso amarelo", en: "yellow warning" },
  "orange warning": { ca: "avís taronja", es: "aviso naranja", eu: "abisu laranja", gl: "aviso laranxa", en: "orange warning" },
  "red warning": { ca: "avís vermell", es: "aviso rojo", eu: "abisu gorria", gl: "aviso vermello", en: "red warning" },
  "very strong wind": { ca: "vent molt fort", es: "viento muy fuerte", eu: "oso haize gogorra", gl: "vento moi forte", en: "very strong wind" },
  "heat wave": { ca: "onada de calor", es: "ola de calor", eu: "bero bolada", gl: "onda de calor", en: "heat wave" },
};

const IA_FULL: Record<string, Record<LangKey, string>> = {
  ...IA_KNOWLEDGE,
  ...IA_KNOWLEDGE_EXTENDED,
};

function normalizeKnownAemetDescription(text: string, lang: LangKey): string | null {
  const normalized = text.trim();
  const windGustMatch = normalized.match(
    /^Rachas fuertes o muy fuertes(?:\s*\(de\s*([^)]+?)\))?\.$/i
  );

  if (windGustMatch) {
    const value = windGustMatch[1]?.trim();
    const base: Record<LangKey, string> = {
      ca: "Ratxes fortes o molt fortes",
      es: "Rachas fuertes o muy fuertes",
      eu: "Haize-bolada gogorrak edo oso gogorrak",
      gl: "Refachos fortes ou moi fortes",
      en: "Strong or very strong wind gusts",
    };
    const suffix: Record<LangKey, string> = value
      ? {
          ca: ` (de ${value})`,
          es: ` (de ${value})`,
          eu: ` (${value}-koak)`,
          gl: ` (de ${value})`,
          en: ` (${value})`,
        }
      : { ca: "", es: "", eu: "", gl: "", en: "" };

    return `${base[lang]}${suffix[lang]}.`;
  }

  const specialWindGustMatch = normalized.match(
    /^Especial atención a las rachas que pueden alcanzar los\s+([^)]+?km\/h)\.$/i
  );

  if (specialWindGustMatch) {
    const value = specialWindGustMatch[1].trim();
    const template: Record<LangKey, string> = {
      ca: `Atenció especial a les ratxes que poden arribar als ${value}.`,
      es: `Especial atención a las rachas que pueden alcanzar los ${value}.`,
      eu: `Arreta berezia ${value}-ra irits daitezkeen haize-boladei.`,
      gl: `Especial atención aos refachos que poden alcanzar os ${value}.`,
      en: `Special attention to wind gusts that may reach ${value}.`,
    };

    return template[lang];
  }

  const hailAndWindGustsSource = normalized.replace(/\s+/g, " ");
  const hailAndWindGustsMatch =
    /^Pueden ir acompañadas de .+\.$/i.test(hailAndWindGustsSource) &&
    /\bgranizo\b/i.test(hailAndWindGustsSource) &&
    /\b(?:rachas|ratxes)\b/i.test(hailAndWindGustsSource) &&
    /(?:\b(?:rachas|ratxes) de viento muy fuertes\b|\b(?:rachas|ratxes) muy fuertes de viento\b)/i.test(
      hailAndWindGustsSource
    );

  if (hailAndWindGustsMatch) {
    const template: Record<LangKey, string> = {
      ca: "Poden anar acompanyades de calamarsa i ratxes de vent molt fortes.",
      es: "Pueden ir acompañadas de granizo y rachas de viento muy fuertes.",
      eu: "Txingorra eta haize-bolada oso gogorrak izan ditzakete.",
      gl: "Poden ir acompañadas de sarabia e refachos de vento moi fortes.",
      en: "They may be accompanied by hail and very strong wind gusts.",
    };

    return template[lang];
  }

  const maxTemperatureMatch = normalized.match(/^Maximum temperature:\s*([^.]*)\.$/i);
  if (maxTemperatureMatch) {
    const value = maxTemperatureMatch[1].trim();
    const label: Record<LangKey, string> = {
      ca: "Temperatura màxima",
      es: "Temperatura máxima",
      eu: "Gehieneko tenperatura",
      gl: "Temperatura máxima",
      en: "Maximum temperature",
    };

    return `${label[lang]}: ${value}.`;
  }

  const twelveHourPrecipitationMatch = normalized.match(
    /^Twelve[- ]hours accumulated precipitation:\s*([^.]*)\.$/i
  );
  if (twelveHourPrecipitationMatch) {
    const value = twelveHourPrecipitationMatch[1].trim();
    const label: Record<LangKey, string> = {
      ca: "Precipitació acumulada en dotze hores",
      es: "Precipitación acumulada en doce horas",
      eu: "Hamabi ordutako prezipitazio metatua",
      gl: "Precipitación acumulada en doce horas",
      en: "Twelve-hours accumulated precipitation",
    };

    return `${label[lang]}: ${value}.`;
  }

  const oneHourPrecipitationMatch = normalized.match(
    /^One[- ]hour accumulated precipitation:\s*([^.]*)\.$/i
  );
  if (oneHourPrecipitationMatch) {
    const value = oneHourPrecipitationMatch[1].trim();
    const label: Record<LangKey, string> = {
      ca: "Precipitació acumulada en una hora",
      es: "Precipitación acumulada en una hora",
      eu: "Ordubeteko prezipitazio metatua",
      gl: "Precipitación acumulada nunha hora",
      en: "One-hour accumulated precipitation",
    };

    return `${label[lang]}: ${value}.`;
  }

  return null;
}

function hasKnownAemetDescriptionPrefixOnly(text: string, lang: LangKey): boolean {
  const normalized = text.trim();
  if (normalizeKnownAemetDescription(normalized, lang)) return false;

  const firstSentenceMatch = normalized.match(/^.+?\./);
  if (!firstSentenceMatch) return false;

  const firstSentence = firstSentenceMatch[0].trim();
  if (firstSentence.length === normalized.length) return false;

  return normalizeKnownAemetDescription(firstSentence, lang) !== null;
}

// ---------------------------------------------------------
// ✅ ÚNICA translateWithIA (NO la dupliquis)
// ---------------------------------------------------------
function translateWithIA(text: string, lang: LangKey): string {
  if (!text) return "";

  const knownDescription = normalizeKnownAemetDescription(text, lang);
  if (knownDescription) return knownDescription;

  if (hasKnownAemetDescriptionPrefixOnly(text, lang)) return text;

  // Conserva el comportament anterior: el fallback parcial només s'aplicava al català.
  if (lang !== "ca") return text;

  let t = text;

  // Formats / unitats (abans de packs)
  t = t
    .replace(/(\d+)\s*km\/h/gi, "$1 km/h")
    .replace(/(\d+)\s*ºc/gi, "$1 °C");

  // 🌬️ PACK VENT — Versió PRO
  t = t
    .replace(/wind gusts?/gi, "ratxes de vent")
    .replace(/maximum gust of wind/gi, "ratxa màxima de vent")
    .replace(/maximum wind gust/gi, "ratxa màxima de vent")
    .replace(/strong wind/gi, "vent fort")
    .replace(/very strong wind/gi, "vent molt fort")
    .replace(/gales?/gi, "ventades")
    .replace(/high winds?/gi, "vents forts")
    .replace(/rachas máximas/gi, "ratxes màximes")
    .replace(/rachas muy fuertes/gi, "ratxes molt fortes")
    .replace(/rachas/gi, "ratxes")
    .replace(/viento de componente norte/gi, "vent de component nord")
    .replace(/viento de componente sur/gi, "vent de component sud")
    .replace(/viento de componente este/gi, "vent de component est")
    .replace(/viento de componente oeste/gi, "vent de component oest")
    .replace(/viento del norte/gi, "vent del nord")
    .replace(/viento del sur/gi, "vent del sud")
    .replace(/viento del este/gi, "vent de l’est")
    .replace(/viento del oeste/gi, "vent de l’oest")
    .replace(/se llegará al umbral en zonas altas/gi, "s'arribarà al llindar en zones elevades")
    .replace(/se alcanzarán rachas/gi, "s'arribaran ratxes")
    .replace(/con rachas que podrán superar/gi, "amb ratxes que poden superar")
    .replace(/vientos intensos/gi, "vents intensos")
    .replace(/vientos muy intensos/gi, "vents molt intensos")
    .replace(/gusts? exceeding/gi, "ratxes superant")
    .replace(/gusts? up to/gi, "ratxes de fins a")
    .replace(/gusting to/gi, "amb ratxes de fins a")
    .replace(/wind speeds? of/gi, "velocitat del vent de")
    .replace(/wind speeds? up to/gi, "velocitat del vent de fins a");

  // 🌧️ PLUJA — PACK COMPLET AEMET
  t = t
    .replace(/one[- ]hour accumulated precipitation/gi, "precipitació acumulada en una hora")
    .replace(/one[- ]hour accumulated rainfall/gi, "precipitació acumulada en una hora")
    .replace(/1[- ]hour accumulated precipitation/gi, "precipitació acumulada en una hora")
    .replace(/1[- ]hour accumulated rainfall/gi, "precipitació acumulada en una hora")
    .replace(/1h accumulated rainfall/gi, "precipitació acumulada en una hora")
    .replace(/1h accumulated precipitation/gi, "precipitació acumulada en una hora")
    .replace(/one hour precipitation/gi, "precipitació d'una hora")
    .replace(/1 hour precipitation/gi, "precipitació d'una hora")
    .replace(/1h precipitation/gi, "precipitació d'una hora")
    .replace(/accumulated precipitation of (\d+)\s*mm/gi, "precipitació acumulada de $1 mm")
    .replace(/accumulated rainfall of (\d+)\s*mm/gi, "precipitació acumulada de $1 mm")
    .replace(/precipitation accumulation/gi, "acumulació de precipitació")
    .replace(/rainfall accumulation/gi, "acumulació de precipitació")
    .replace(/twelve[- ]hour accumulated precipitation/gi, "precipitació acumulada en 12 hores")
    .replace(/12[- ]hour accumulated precipitation/gi, "precipitació acumulada en 12 hores")
    .replace(/12h accumulated precipitation/gi, "precipitació acumulada en 12 hores")
    .replace(/twelve hour precipitation/gi, "precipitació en 12 hores")
    .replace(/twenty[- ]four[- ]hour accumulated precipitation/gi, "precipitació acumulada en 24 hores")
    .replace(/twentyfour[- ]hour accumulated precipitation/gi, "precipitació acumulada en 24 hores")
    .replace(/24[- ]hour accumulated precipitation/gi, "precipitació acumulada en 24 hores")
    .replace(/24h accumulated precipitation/gi, "precipitació acumulada en 24 hores")
    .replace(/24 hour precipitation/gi, "precipitació de 24 hores")
    .replace(/accumulated precipitation/gi, "precipitació acumulada")
    .replace(/accumulated rainfall/gi, "precipitació acumulada")
    .replace(/persistent precipitations/gi, "precipitacions persistents")
    .replace(/persistent rainfall/gi, "precipitació persistent")
    .replace(/moderate rain/gi, "pluja moderada")
    .replace(/heavy rain/gi, "pluja intensa");

  // Diccionari IA simple per restes en anglès
  for (const key in IA_FULL) {
    const reg = new RegExp(key, "gi");
    if (reg.test(t)) {
      t = t.replace(reg, IA_FULL[key][lang] || IA_FULL[key].es || key);
    }
  }

  // Neteja final + majúscula post punt
  t = t.replace(/\. ([a-zà-ü])/g, (_, l) => `. ${String(l).toUpperCase()}`);
  t = t.replace(/\s{2,}/g, " ");

  return t.trim();
}

export function isKnownAemetDescription(text: string, langInput: LangKey): boolean {
  const lang = normalizeLang(langInput);
  return normalizeKnownAemetDescription(cleanAemetDescription(text || ""), lang) !== null;
}

// ---------------------------------------------------------
// Builder principal AEMET (amb fallback anti-undefined)
// ---------------------------------------------------------
export function buildAemetAiAlert(
  rawEvent: string,
  rawDescription: string,
  langInput: LangKey,
  senderName?: string
): AemetAiAlert {
  const lang = normalizeLang(langInput);

  const desc = cleanAemetDescription(rawDescription || "");

  // ---- Fenomen ----
  const ev = normalizeAlertText(rawEvent || "");
  const hazard = detectAemetHazard(rawEvent, desc);

  // ---- Nivell ----
  let level: LevelId = "info";
  if (ev.includes("extreme") || ev.includes("red")) level = "extreme";
  else if (ev.includes("severe") || ev.includes("high") || ev.includes("important") || ev.includes("orange")) level = "high";
  else if (ev.includes("moderate") || ev.includes("yellow")) level = "moderate";

  const levelText =
    LEVEL_LABELS[level]?.[lang] || LEVEL_LABELS[level]?.es || (lang === "en" ? "Warning:" : "Avís");

  const hazardText =
    HAZARD_LABELS[hazard]?.[lang] || HAZARD_LABELS[hazard]?.es || rawEvent || (lang === "en" ? "Weather alert" : "Avís meteorològic");

  const title = `${levelText} ${hazardText}`.trim();

  const cleanSender = (senderName || "").trim();

  const genericBodyBySource: Record<LangKey, string> = cleanSender
    ? {
        ca: `Avís meteorològic oficial de ${cleanSender}.`,
        es: `Aviso meteorológico oficial de ${cleanSender}.`,
        eu: `${cleanSender} erakundearen abisu meteorologiko ofiziala.`,
        gl: `Aviso meteorolóxico oficial de ${cleanSender}.`,
        en: `Official weather alert from ${cleanSender}.`,
      }
    : GENERIC_BODY;

  const body =
    translateWithIA(desc, lang) ||
    genericBodyBySource[lang] ||
    genericBodyBySource.es;

  return { title, body };
}
