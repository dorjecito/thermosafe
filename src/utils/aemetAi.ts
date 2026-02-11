/* =========================================================
   🧠 AEMET AI — Traducció i interpretació d’avisos oficials
   ========================================================= */

// ---------------------------------------------------------
// Tipus bàsics
// ---------------------------------------------------------
export type LangKey = "ca" | "es" | "eu" | "gl";

type HazardId =
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
  rain: { ca: "pluja", es: "lluvia", eu: "euria", gl: "chuva" },
  snow: { ca: "neu", es: "nieve", eu: "elurra", gl: "neve" },
  wind: { ca: "vent", es: "viento", eu: "haizea", gl: "vento" },
  storm: { ca: "tempestes", es: "tormentas", eu: "ekaitzak", gl: "treboadas" },
  coast: { ca: "costa i onatge", es: "costa y oleaje", eu: "kostaldea", gl: "costa e ondada" },
  fog: { ca: "boira", es: "niebla", eu: "lainoa", gl: "néboa" },
  temp_min: {
    ca: "temperatures mínimes",
    es: "temperaturas mínimas",
    eu: "tenperatura baxuak",
    gl: "temperaturas mínimas",
  },
  temp_max: {
    ca: "temperatures màximes",
    es: "temperaturas máximas",
    eu: "tenperatura altuak",
    gl: "temperaturas máximas",
  },
  other: {
    ca: "fenòmens adversos",
    es: "fenómenos adversos",
    eu: "fenomeno kaltegarriak",
    gl: "fenómenos adversos",
  },
};

const LEVEL_LABELS: Record<LevelId, Record<LangKey, string>> = {
  extreme: { ca: "Risc extrem per", es: "Riesgo extremo por", eu: "Arrisku oso larria", gl: "Risco extremo por" },
  high: { ca: "Risc important per", es: "Riesgo importante por", eu: "Arrisku handia", gl: "Risco importante por" },
  moderate: { ca: "Avís per", es: "Aviso por", eu: "Abisua", gl: "Aviso por" },
  info: { ca: "Informació sobre", es: "Información sobre", eu: "Informazioa", gl: "Información sobre" },
};

const GENERIC_BODY: Record<LangKey, string> = {
  ca: "Avís meteorològic oficial d'AEMET.",
  es: "Aviso meteorológico oficial de AEMET.",
  eu: "AEMETen abisu ofiziala.",
  gl: "Aviso meteorolóxico oficial da AEMET.",
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
// (Pots eliminar-ho si ja uses només PACKs per replace())
// ---------------------------------------------------------
const IA_KNOWLEDGE: Record<string, Record<LangKey, string>> = {
  "heavy rain": { ca: "pluja intensa", es: "lluvia intensa", eu: "eurite handia", gl: "chuva intensa" },
  "moderate rain": { ca: "pluja moderada", es: "lluvia moderada", eu: "eurite moderatua", gl: "chuva moderada" },
  thunderstorm: { ca: "tempesta", es: "tormenta", eu: "ekaitza", gl: "treboada" },
  snowfall: { ca: "nevada", es: "nevada", eu: "elurtea", gl: "nevada" },
  fog: { ca: "boira", es: "niebla", eu: "lainoa", gl: "néboa" },
  "strong waves": { ca: "fort onatge", es: "fuerte oleaje", eu: "olatu handiak", gl: "forte ondada" },
  "high temperature": { ca: "temperatures altes", es: "temperaturas altas", eu: "tenperatura altuak", gl: "temperaturas altas" },
  "maximum gust of wind": { ca: "ratxa màxima de vent", es: "racha máxima de viento", eu: "haize-bolada maximoa", gl: "refacho máximo de vento" },
  "minimum temperature": { ca: "temperatura mínima prevista", es: "temperatura mínima prevista", eu: "gutxieneko tenperatura", gl: "temperatura mínima prevista" },
};

const IA_KNOWLEDGE_EXTENDED: Record<string, Record<LangKey, string>> = {
  "yellow warning": { ca: "avís groc", es: "aviso amarillo", eu: "abisu horia", gl: "aviso amarelo" },
  "orange warning": { ca: "avís taronja", es: "aviso naranja", eu: "abisu laranja", gl: "aviso laranxa" },
  "red warning": { ca: "avís vermell", es: "aviso rojo", eu: "abisu gorria", gl: "aviso vermello" },
  "very strong wind": { ca: "vent molt fort", es: "viento muy fuerte", eu: "oso haize gogorra", gl: "vento moi forte" },
  "heat wave": { ca: "onada de calor", es: "ola de calor", eu: "bero bolada", gl: "onda de calor" },
};

const IA_FULL: Record<string, Record<LangKey, string>> = {
  ...IA_KNOWLEDGE,
  ...IA_KNOWLEDGE_EXTENDED,
};

// ---------------------------------------------------------
// ✅ ÚNICA translateWithIA (NO la dupliquis)
// ---------------------------------------------------------
function translateWithIA(text: string, lang: LangKey): string {
  if (!text) return "";

  // Coherent amb la teva lògica: només “traducció IA” quan és català
  if (lang !== "ca") return text;

  let t = text;

  // Formats / unitats (abans de packs)
  t = t
    .replace(/(\d+)\s*km\/h/gi, "$1 km/h")
    .replace(/(\d+)\s*ºc/gi, "$1 °C");

  // -----------------------------
  // 🌬️ PACK VENT — Versió PRO
  // -----------------------------
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

  // -----------------------------
  // 🌧️ PLUJA — PACK COMPLET AEMET
  // -----------------------------
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

  // -------------------------------------------------------
  // (Opcional) Diccionari IA simple per restes en anglès
  // -------------------------------------------------------
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

// ---------------------------------------------------------
// Builder principal AEMET
// ---------------------------------------------------------
export function buildAemetAiAlert(rawEvent: string, rawDescription: string, lang: LangKey): AemetAiAlert {
  const ev = (rawEvent || "").toLowerCase();
  const desc = cleanAemetDescription(rawDescription || "");

  // ---- Fenomen ----
  let hazard: HazardId = "other";
  if (ev.includes("rain") || ev.includes("precipit")) hazard = "rain";
  else if (ev.includes("snow")) hazard = "snow";
  else if (ev.includes("wind")) hazard = "wind";
  else if (ev.includes("coast") || ev.includes("wave") || ev.includes("oleaje")) hazard = "coast";
  else if (ev.includes("storm") || ev.includes("thunder")) hazard = "storm";
  else if (ev.includes("fog")) hazard = "fog";
  else if (
    ev.includes("minimum") ||
    ev.includes("low_temperature") ||
    ev.includes("low temperature") ||
    ev.includes("low-temperature") ||
    ev.includes("low temp") ||
    ev.includes("low")
  ) hazard = "temp_min";
  else if (
    ev.includes("maximum") ||
    ev.includes("high temp") ||
    ev.includes("high_temperature") ||
    ev.includes("heat")
  ) hazard = "temp_max";

  // ---- Nivell ----
  let level: LevelId = "info";
  if (ev.includes("extreme") || ev.includes("red")) level = "extreme";
  else if (ev.includes("severe") || ev.includes("high") || ev.includes("important") || ev.includes("orange")) level = "high";
  else if (ev.includes("moderate") || ev.includes("yellow")) level = "moderate";

  const title = `${LEVEL_LABELS[level][lang]} ${HAZARD_LABELS[hazard][lang]}`.trim();
  const body = (lang === "ca" ? translateWithIA(desc, lang) : desc) || GENERIC_BODY[lang];

  return { title, body };
}