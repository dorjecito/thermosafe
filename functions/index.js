// ─────────────────────────────────────────────
// Imports i setup
// ─────────────────────────────────────────────
const admin = require("firebase-admin");
const functions = require("firebase-functions");
const { defineSecret } = require("firebase-functions/params");
const fetch = (...args) =>
  import("node-fetch").then(({ default: fetch }) => fetch(...args));

admin.initializeApp();
const db = admin.firestore();

// ✅ Secret Manager
const OPENWEATHER_KEY = defineSecret("OPENWEATHER_KEY");
const OPENUV_KEY = defineSecret("OPENUV_KEY");

const REGION = "europe-west1";

function getLocalDateParts(nowUtcMs, tzOffsetSec) {
  const d = new Date(nowUtcMs + tzOffsetSec * 1000);

  return {
    year: d.getUTCFullYear(),
    month: d.getUTCMonth() + 1,
    day: d.getUTCDate(),
    hour: d.getUTCHours(),
  };
}

function makeLocalDayKey(nowUtcMs, tzOffsetSec) {
  const { year, month, day } = getLocalDateParts(nowUtcMs, tzOffsetSec);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function shouldRunDailyReset(nowUtcMs, tzOffsetSec, lastDailyResetDay, resetHour = 6) {
  const { hour } = getLocalDateParts(nowUtcMs, tzOffsetSec);
  const todayKey = makeLocalDayKey(nowUtcMs, tzOffsetSec);

  if (hour < resetHour) {
    return { shouldReset: false, todayKey };
  }

  return {
    shouldReset: lastDailyResetDay !== todayKey,
    todayKey,
  };
}

// ─────────────────────────────────────────────
// Neteja de subscripcions velles o invàlides
// ─────────────────────────────────────────────
const INACTIVITY_DAYS = 30;
const PAGE_SIZE = 500;
const VALIDATION_CONC = 100;

function chunk(arr, n) {
  const out = [];
  for (let i = 0; i < arr.length; i += n) {
    out.push(arr.slice(i, i + n));
  }
  return out;
}

async function isTokenValid(token) {
  if (!token) return false;

  try {
    await admin.messaging().send(
      {
        token,
        notification: { title: "ping", body: "dry-run" },
      },
      true
    );
    return true;
  } catch (e) {
    const msg = String(e?.errorInfo?.code || e?.message || "");
    if (msg.includes("registration-token-not-registered")) return false;
    if (msg.includes("invalid-argument")) return false;

    console.warn("[cleanup] dry-run error no definitiu:", msg);
    return true;
  }
}

function daysBetweenNow(ms) {
  const age = Date.now() - Number(ms || 0);
  return age / (1000 * 60 * 60 * 24);
}

function getLastActivityMs(d) {
  return Math.max(
    Number(d.lastNotified || 0),
    Number(d.lastUvAt || 0),
    Number(d.lastHeatAt || 0),
    Number(d.lastColdAt || 0),
    Number(d.lastWindAt || 0),
    Number(d.createdAt || 0)
  );
}

exports.cleanupSubs = functions
  .region(REGION)
  .pubsub.schedule("0 3 * * *")
  .timeZone("Europe/Madrid")
  .onRun(async () => {
    console.log("[cleanup] start");

    let lastDoc = null;
    let totalChecked = 0;
    let totalDeleted = 0;
    let totalInvalid = 0;
    let totalStale = 0;

    while (true) {
      let q = db.collection("subs").orderBy("__name__").limit(PAGE_SIZE);
      if (lastDoc) q = q.startAfter(lastDoc);

      const snap = await q.get();
      if (snap.empty) break;

      const docs = snap.docs;
      lastDoc = docs[docs.length - 1];

      for (const batch of chunk(docs, VALIDATION_CONC)) {
        const validations = batch.map(async (doc) => {
          const d = doc.data() || {};
          const token = d.token;
          totalChecked++;

          const lastActivity = getLastActivityMs(d);
          const stale = daysBetweenNow(lastActivity) > INACTIVITY_DAYS;
          const valid = await isTokenValid(token);

          if (!token || !valid || stale) {
            const why = !token
              ? "missing token"
              : !valid
              ? "invalid token"
              : `stale > ${INACTIVITY_DAYS}d`;

            if (!valid) totalInvalid++;
            if (stale) totalStale++;

            console.log("[cleanup] delete", doc.id, why);
            await doc.ref.delete();
            totalDeleted++;
          }
        });

        await Promise.allSettled(validations);
      }
    }

    console.log("[cleanup] done", {
      totalChecked,
      totalDeleted,
      totalInvalid,
      totalStale,
    });

    return null;
  });

// ─────────────────────────────────────────────
// Llindars i helpers generals
// ─────────────────────────────────────────────
const TH = { MODERATE: 27, HIGH: 32, VERY_HIGH: 41 };
const LANGS = ["ca", "es", "eu", "gl", "en"];

function normalizeLang(lang) {
  const code = String(lang || "ca").toLowerCase().slice(0, 2);
  return LANGS.includes(code) ? code : "ca";
}

function levelFromINSST(hi) {
  if (hi >= TH.VERY_HIGH) {
    return {
      level: 3,
      ca: "Nivell 4 INSST – Risc molt alt",
      es: "Nivel 4 INSST – Riesgo muy alto",
      eu: "INSST 4 maila – Arrisku oso handia",
      gl: "Nivel 4 INSST – Risco moi alto",
      en: "INSST Level 4 – Very high risk",
    };
  }

  if (hi >= TH.HIGH) {
    return {
      level: 2,
      ca: "Nivell 3 INSST – Risc alt",
      es: "Nivel 3 INSST – Riesgo alto",
      eu: "INSST 3 maila – Arrisku handia",
      gl: "Nivel 3 INSST – Risco alto",
      en: "INSST Level 3 – High risk",
    };
  }

  if (hi >= TH.MODERATE) {
    return {
      level: 1,
      ca: "Nivell 2 INSST – Risc moderat",
      es: "Nivel 2 INSST – Riesgo moderado",
      eu: "INSST 2 maila – Arrisku moderatua",
      gl: "Nivel 2 INSST – Risco moderado",
      en: "INSST Level 2 – Moderate risk",
    };
  }

  return {
    level: 0,
    ca: "Nivell 1 INSST – Sense risc apreciable",
    es: "Nivel 1 INSST – Sin riesgo apreciable",
    eu: "INSST 1 maila – Arrisku nabaririk gabe",
    gl: "Nivel 1 INSST – Sen risco apreciable",
    en: "INSST Level 1 – No appreciable risk",
  };
}

function calcHI(t, h) {
  const hi =
    -8.784695 +
    1.61139411 * t +
    2.338549 * h -
    0.14611605 * t * h -
    0.012308094 * t * t -
    0.016424828 * h * h +
    0.002211732 * t * t * h +
    0.00072546 * t * h * h -
    0.000003582 * t * t * h * h;

  return Math.round(hi * 10) / 10;
}

function isQuietHours(nowUtcMs, tzOffsetSec) {
  const d = new Date(nowUtcMs + tzOffsetSec * 1000);
  const h = d.getUTCHours();
  return h >= 22 || h < 7;
}

function meetsUserThreshold(level, userThreshold) {
  const order = { moderate: 1, high: 2, very_high: 3 };
  return level >= (order[userThreshold] ?? 1);
}

function isInvalidTokenError(err) {
  const code = String(err?.errorInfo?.code || err?.code || err?.message || "");
  return (
    code.includes("registration-token-not-registered") ||
    code.includes("messaging/registration-token-not-registered") ||
    code.includes("invalid-registration-token") ||
    code.includes("messaging/invalid-registration-token") ||
    code.includes("invalid-argument")
  );
}

async function removeInvalidSub(docRef, docId, err, source) {
  if (!isInvalidTokenError(err)) return false;

  console.warn(`[${source}] invalid token, deleting sub`, {
    docId,
    error: String(err?.errorInfo?.code || err?.message || err),
  });

  await docRef.delete();
  return true;
}

function shouldNotifyLevelIncrease(prevLevel, nextLevel) {
  const prev = Number.isFinite(Number(prevLevel)) ? Number(prevLevel) : 0;
  const next = Number.isFinite(Number(nextLevel)) ? Number(nextLevel) : 0;
  return next > prev;
}

async function getWeather(lat, lon) {
  const url =
    `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}` +
    `&appid=${OPENWEATHER_KEY.value()}&units=metric`;

  const r = await fetch(url);
  if (!r.ok) throw new Error(`OpenWeather ${r.status}`);

  const j = await r.json();

  return {
    temp: j.main?.temp,
    hum: j.main?.humidity,
    feels: j.main?.feels_like,
    wind: j.wind?.speed,
    tzOffset: j.timezone,
    place: j.name || "",
    weatherMain: j.weather?.[0]?.main || "",
    weatherDescription: j.weather?.[0]?.description || "",
  };
}

async function getUV(lat, lon) {
  try {
    const r = await fetch(`https://api.openuv.io/api/v1/uv?lat=${lat}&lng=${lon}`, {
      headers: { "x-access-token": OPENUV_KEY.value() },
    });

    if (!r.ok) throw new Error(`OpenUV ${r.status}`);

    const j = await r.json();
    return typeof j?.result?.uv === "number" ? j.result.uv : null;
  } catch (e) {
    console.warn("[uv] error", e?.message || e);
    return null;
  }
}

async function getUVfromOpenWeather(lat, lon) {
  try {
    const url =
      `https://api.openweathermap.org/data/3.0/onecall?lat=${lat}&lon=${lon}` +
      `&appid=${OPENWEATHER_KEY.value()}&exclude=minutely,hourly,daily,alerts&units=metric`;

    const r = await fetch(url);
    if (!r.ok) throw new Error(`OpenWeather UV ${r.status}`);

    const j = await r.json();
    return typeof j?.current?.uvi === "number" ? j.current.uvi : null;
  } catch (e) {
    console.warn("[uv][fallback-openweather] error", e?.message || e);
    return null;
  }
}

// ─────────────────────────────────────────────
// Textos i notificacions · calor
// ─────────────────────────────────────────────
function makeTitle(lang) {
  return (
    {
      ca: "🌡️ ThermoSafe – Avís INSST",
      es: "🌡️ ThermoSafe – Aviso INSST",
      eu: "🌡️ ThermoSafe – INSST abisua",
      gl: "🌡️ ThermoSafe – Aviso INSST",
      en: "🌡️ ThermoSafe – INSST alert",
    }[lang] ?? "🌡️ ThermoSafe – INSST alert"
  );
}

const HI_LABEL = {
  ca: "Índex de calor",
  es: "Índice de calor",
  eu: "Bero-indizea",
  gl: "Índice de calor",
  en: "Heat index",
};

function makeBody(lang, labelByLang, hi) {
  const label = labelByLang[lang] ?? labelByLang.en ?? labelByLang.ca;
  const hiStr = `${Math.round(hi)} °C`;

  const tail =
    {
      ca: "Obre ThermoSafe per veure recomanacions.",
      es: "Abre ThermoSafe para ver recomendaciones.",
      eu: "Ireki ThermoSafe gomendioak ikusteko.",
      gl: "Abre ThermoSafe para ver recomendacións.",
      en: "Open ThermoSafe to see recommendations.",
    }[lang] ?? "Open ThermoSafe to see recommendations.";

  return `${label}. ${HI_LABEL[lang] ?? HI_LABEL.en}: ${hiStr}. ${tail}`;
}

async function sendPush(token, lang, level, hi, labelByLang, place) {
  if (level === 0) {
    console.log("[SEND][HEAT] skip level 0", { lang, hi, place: place || "" });
    return;
  }

  if (!token) {
    console.warn("[SEND][HEAT] missing token", { lang, level, hi, place: place || "" });
    return;
  }

  const title = makeTitle(lang);
  const body = makeBody(lang, labelByLang, hi);

  const data = {
    title,
    body,
    icon: "https://thermosafe.app/icons/icon-192.png",
    badge: "https://thermosafe.app/icons/badge-72.png",
    tag: "thermosafe-risk",
    url: "https://thermosafe.app",
    type: "heat",
    level: String(level),
    hi: String(Math.round(hi)),
    lang,
    place: place || "",
  };

  try {
    console.log("[SEND][HEAT] start", {
      lang,
      level,
      hi,
      place: place || "",
      tokenPreview: String(token).slice(0, 20),
    });

    const messageId = await admin.messaging().send({
      token,
      data,
      webpush: {
        headers: {
          TTL: "3600",
          Urgency: "high",
        },
        fcmOptions: {
          link: "https://thermosafe.app",
        },
      },
    });

    console.log("[SEND][HEAT] ok", {
      messageId,
      lang,
      level,
      hi,
      place: place || "",
    });

    return messageId;
  } catch (e) {
    console.error("[SEND][HEAT] error", {
      message: e?.message || String(e),
      code: e?.errorInfo?.code || "",
      lang,
      level,
      hi,
      place: place || "",
    });
    throw e;
  }
}

// ─────────────────────────────────────────────
// Textos i notificacions · fred
// ─────────────────────────────────────────────
function getColdInfo(windChill) {
  if (windChill <= -10) {
    return {
      level: 3,
      riskLevel: "extrem",
      title: {
        ca: "❄️ ThermoSafe – Fred extrem",
        es: "❄️ ThermoSafe – Frío extremo",
        eu: "❄️ ThermoSafe – Muturreko hotza",
        gl: "❄️ ThermoSafe – Frío extremo",
        en: "❄️ ThermoSafe – Extreme cold",
      },
      body: {
        ca: `⚠️ Fred extrem (${windChill.toFixed(1)} °C). Evita l’exposició prolongada.`,
        es: `⚠️ Frío extremo (${windChill.toFixed(1)} °C). Evita la exposición prolongada.`,
        eu: `⚠️ Muturreko hotza (${windChill.toFixed(1)} °C). Saihestu esposizio luzea.`,
        gl: `⚠️ Frío extremo (${windChill.toFixed(1)} °C). Evita a exposición prolongada.`,
        en: `⚠️ Extreme cold (${windChill.toFixed(1)} °C). Avoid prolonged exposure.`,
      },
    };
  }

  if (windChill <= -5) {
    return {
      level: 2,
      riskLevel: "alt",
      title: {
        ca: "❄️ ThermoSafe – Fred intens",
        es: "❄️ ThermoSafe – Frío intenso",
        eu: "❄️ ThermoSafe – Hotz handia",
        gl: "❄️ ThermoSafe – Frío intenso",
        en: "❄️ ThermoSafe – Intense cold",
      },
      body: {
        ca: `Fred intens (${windChill.toFixed(1)} °C). Protegeix-te les mans i la cara.`,
        es: `Frío intenso (${windChill.toFixed(1)} °C). Protégete las manos y la cara.`,
        eu: `Hotz handia (${windChill.toFixed(1)} °C). Babestu eskuak eta aurpegia.`,
        gl: `Frío intenso (${windChill.toFixed(1)} °C). Protexe as mans e a cara.`,
        en: `Intense cold (${windChill.toFixed(1)} °C). Protect your hands and face.`,
      },
    };
  }

  if (windChill <= 4) {
    return {
      level: 1,
      riskLevel: "moderat",
      title: {
        ca: "🧥 ThermoSafe – Fred moderat",
        es: "🧥 ThermoSafe – Frío moderado",
        eu: "🧥 ThermoSafe – Hotz moderatua",
        gl: "🧥 ThermoSafe – Frío moderado",
        en: "🧥 ThermoSafe – Moderate cold",
      },
      body: {
        ca: `Fred moderat (${windChill.toFixed(1)} °C). Usa roba d’abric.`,
        es: `Frío moderado (${windChill.toFixed(1)} °C). Usa ropa de abrigo.`,
        eu: `Hotz moderatua (${windChill.toFixed(1)} °C). Erabili arropa beroa.`,
        gl: `Frío moderado (${windChill.toFixed(1)} °C). Usa roupa de abrigo.`,
        en: `Moderate cold (${windChill.toFixed(1)} °C). Wear warm clothing.`,
      },
    };
  }

  return { level: 0, riskLevel: null, title: null, body: null };
}

async function sendColdPush(token, lang, info, windChill, place) {
  if (!info || info.level === 0) return;

  const title = info.title?.[lang] ?? info.title?.ca ?? "❄️ ThermoSafe";
  const body =
    info.body?.[lang] ??
    info.body?.ca ??
    `Fred (${windChill.toFixed(1)} °C)`;

  const data = {
    title,
    body,
    icon: "https://thermosafe.app/icons/icon-192.png",
    badge: "https://thermosafe.app/icons/badge-72.png",
    tag: "thermosafe-cold",
    url: "https://thermosafe.app",
    type: "cold",
    level: String(info.level),
    lang,
    place: place || "",
    windChill: String(Math.round(windChill)),
    riskLevel: info.riskLevel || "",
  };

  await admin.messaging().send({
    token,
    data,
    webpush: {
      headers: {
        TTL: "3600",
        Urgency: "high",
      },
      fcmOptions: {
        link: "https://thermosafe.app",
      },
    },
  });
}

function buildCombinedRiskMessage({
  lang,
  uvInfo,
  uvi,
  heatInfo,
  hi,
  aemetLevel,
  aemetEvent,
}) {
  const l = normalizeLang(lang);

  const hasUv = uvInfo && uvInfo.level > 0;
  const hasHeat = heatInfo && heatInfo.level > 0;
  const hasAemet = Number(aemetLevel || 0) > 0;

  if (!hasUv && !hasHeat && !hasAemet) return null;

  const txt = {
    ca: {
      combinedTitle: "⚠️ ThermoSafe — Riscos combinats",
      officialTitle: "🚨 ThermoSafe — Avís oficial actiu",
      official: "Avís oficial actiu",
      uv: "Índex UV",
      heat: "Sensació tèrmica",
      adviceOfficial:
        "Segueix les indicacions oficials i consulta ThermoSafe per veure el context local.",
      adviceHeatUv:
        "Protecció solar, hidratació freqüent, pauses a l’ombra i reducció de l’exposició.",
      adviceGeneric:
        "Revisa les condicions i adapta l’activitat exterior.",
    },
    es: {
      combinedTitle: "⚠️ ThermoSafe — Riesgos combinados",
      officialTitle: "🚨 ThermoSafe — Aviso oficial activo",
      official: "Aviso oficial activo",
      uv: "Índice UV",
      heat: "Sensación térmica",
      adviceOfficial:
        "Sigue las indicaciones oficiales y consulta ThermoSafe para ver el contexto local.",
      adviceHeatUv:
        "Protección solar, hidratación frecuente, pausas a la sombra y reducción de la exposición.",
      adviceGeneric:
        "Revisa las condiciones y adapta la actividad exterior.",
    },
    eu: {
      combinedTitle: "⚠️ ThermoSafe — Arrisku konbinatuak",
      officialTitle: "🚨 ThermoSafe — Abisu ofiziala aktibo",
      official: "Abisu ofiziala aktibo",
      uv: "UV indizea",
      heat: "Sentsazio termikoa",
      adviceOfficial:
        "Jarraitu jarraibide ofizialak eta kontsultatu ThermoSafe tokiko testuingurua ikusteko.",
      adviceHeatUv:
        "Eguzki-babesa, hidratazio maizkoa, itzaleko atsedenak eta esposizioa murriztea.",
      adviceGeneric:
        "Berrikusi baldintzak eta egokitu kanpoko jarduera.",
    },
    gl: {
      combinedTitle: "⚠️ ThermoSafe — Riscos combinados",
      officialTitle: "🚨 ThermoSafe — Aviso oficial activo",
      official: "Aviso oficial activo",
      uv: "Índice UV",
      heat: "Sensación térmica",
      adviceOfficial:
        "Segue as indicacións oficiais e consulta ThermoSafe para ver o contexto local.",
      adviceHeatUv:
        "Protección solar, hidratación frecuente, pausas á sombra e redución da exposición.",
      adviceGeneric:
        "Revisa as condicións e adapta a actividade exterior.",
    },
    en: {
      combinedTitle: "⚠️ ThermoSafe — Combined risks",
      officialTitle: "🚨 ThermoSafe — Active official alert",
      official: "Active official alert",
      uv: "UV index",
      heat: "Thermal sensation",
      adviceOfficial:
        "Follow official guidance and check ThermoSafe for local context.",
      adviceHeatUv:
        "Use sun protection, hydrate frequently, take shade breaks, and reduce exposure.",
      adviceGeneric:
        "Review the conditions and adapt outdoor activity.",
    },
  };

  const t = txt[l] || txt.ca;
  const parts = [];

  if (hasAemet) {
    parts.push(`${t.official}${aemetEvent ? `: ${aemetEvent}` : ""}`);
  }

  if (hasUv) {
    parts.push(`${t.uv} ${Number(uvi).toFixed(1)}`);
  }

  if (hasHeat) {
    parts.push(`${t.heat} ${Number(hi).toFixed(1)} °C`);
  }

  let type = "generic";
  let title = t.combinedTitle;
  let advice = t.adviceGeneric;

  if (hasAemet) {
    type = "aemet_combined";
    title = t.officialTitle;
    advice = t.adviceOfficial;
  } else if (hasHeat && hasUv) {
    type = "heat_uv";
    advice = t.adviceHeatUv;
  } else if (hasHeat) {
    type = "heat_only_context";
  } else if (hasUv) {
    type = "uv_only_context";
  }

  return {
    type,
    title,
    body: `${parts.join(" · ")}. ${advice}`,
    hasAemet,
    hasHeat,
    hasUv,
    heatLevel: heatInfo?.level ?? 0,
    uvLevel: uvInfo?.level ?? 0,
    aemetLevel: Number(aemetLevel || 0),
  };
}

function getWindThresholds(jobType = "generic") {
  switch (jobType) {
    case "altura":
      return { moderate: 20, high: 35, very_high: 55 };

    case "poda":
      return { moderate: 25, high: 40, very_high: 60 };

    case "obra":
      return { moderate: 28, high: 45, very_high: 65 };

    case "jardineria":
      return { moderate: 30, high: 45, very_high: 65 };

    case "neteja":
      return { moderate: 30, high: 50, very_high: 70 };

    case "trekking":
      return { moderate: 35, high: 50, very_high: 70 };

    case "oci":
      return { moderate: 35, high: 50, very_high: 70 };

    default:
      return { moderate: 30, high: 45, very_high: 65 };
  }
}

// ─────────────────────────────────────────────
// Textos i notificacions · vent
// ─────────────────────────────────────────────
function getWindInfo(windKmh, jobType = "generic") {
  const th = getWindThresholds(jobType);

  if (windKmh >= th.very_high) {
    return {
      level: 3,
      risk: "extrem",
      title: {
        ca: "🌪️ ThermoSafe – Vent molt fort",
        es: "🌪️ ThermoSafe – Viento muy fuerte",
        eu: "🌪️ ThermoSafe – Haize oso indartsua",
        gl: "🌪️ ThermoSafe – Vento moi forte",
        en: "🌪️ ThermoSafe – Very strong wind",
      },
      body: {
        ca: `🌪️ Vent molt fort (${windKmh} km/h). Evita treballar a l’exterior si no és imprescindible.`,
        es: `🌪️ Viento muy fuerte (${windKmh} km/h). Evita trabajar en el exterior si no es imprescindible.`,
        eu: `🌪️ Haize oso indartsua (${windKmh} km/h). Saihestu kanpoan lan egitea ezinbestekoa ez bada.`,
        gl: `🌪️ Vento moi forte (${windKmh} km/h). Evita traballar no exterior se non é imprescindible.`,
        en: `🌪️ Very strong wind (${windKmh} km/h). Avoid working outdoors unless strictly necessary.`,
      },
    };
  }
  if (windKmh >= th.high) {
    return {
      level: 2,
      risk: "alt",
      title: {
        ca: "💨 ThermoSafe – Vent fort",
        es: "💨 ThermoSafe – Viento fuerte",
        eu: "💨 ThermoSafe – Haize handia",
        gl: "💨 ThermoSafe – Vento forte",
        en: "💨 ThermoSafe – Strong wind",
      },
      body: {
        ca: `💨 Vent fort (${windKmh} km/h). Assegura objectes solts i extrema la precaució.`,
        es: `💨 Viento fuerte (${windKmh} km/h). Asegura objetos sueltos y extrema la precaución.`,
        eu: `💨 Haize handia (${windKmh} km/h). Lotu objektu solteak eta areagotu arreta.`,
        gl: `💨 Vento forte (${windKmh} km/h). Asegura obxectos soltos e extrema a precaución.`,
        en: `💨 Strong wind (${windKmh} km/h). Secure loose objects and take extra care.`,
      },
    };
  }

  if (windKmh >= th.moderate) {
    return {
      level: 1,
      risk: "moderat",
      title: {
        ca: "🌬️ ThermoSafe – Vent moderat",
        es: "🌬️ ThermoSafe – Viento moderado",
        eu: "🌬️ ThermoSafe – Haize moderatua",
        gl: "🌬️ ThermoSafe – Vento moderado",
        en: "🌬️ ThermoSafe – Moderate wind",
      },
      body: {
        ca: `🌬️ Vent moderat (${windKmh} km/h). Precaució en treballs a l’exterior.`,
        es: `🌬️ Viento moderado (${windKmh} km/h). Precaución en trabajos al aire libre.`,
        eu: `🌬️ Haize moderatua (${windKmh} km/h). Kontuz kanpoko lanetan.`,
        gl: `🌬️ Vento moderado (${windKmh} km/h). Precaución nos traballos ao aire libre.`,
        en: `🌬️ Moderate wind (${windKmh} km/h). Take care when working outdoors.`,
      },
    };
  }

  return { level: 0, risk: null, title: null, body: null };
}

async function sendWindPush(token, lang, info, windKmh, place) {
  if (!info || info.level === 0) return;

  const title = info.title?.[lang] ?? info.title?.ca ?? "🌬️ ThermoSafe";
  const body =
    info.body?.[lang] ?? info.body?.ca ?? `Vent (${windKmh} km/h)`;

  const data = {
    title,
    body,
    icon: "https://thermosafe.app/icons/icon-192.png",
    badge: "https://thermosafe.app/icons/badge-72.png",
    tag: "thermosafe-wind",
    url: "https://thermosafe.app",
    type: "wind",
    level: String(info.level),
    lang,
    place: place || "",
    windKmh: String(windKmh),
    risk: info.risk || "",
  };

  await admin.messaging().send({
    token,
    data,
    webpush: {
      headers: {
        TTL: "3600",
        Urgency: "high",
      },
      fcmOptions: {
        link: "https://thermosafe.app",
      },
    },
  });
}

// ─────────────────────────────────────────────
// Textos i notificacions · UV
// ─────────────────────────────────────────────
function getUvInfo(uvi) {
  if (uvi == null || Number.isNaN(uvi)) {
    return { level: 0, risk: null, title: null, body: null };
  }

  if (uvi >= 11) {
    return {
      level: 4,
      risk: "extreme",
      title: {
        ca: "☀️ ThermoSafe – UV extrem",
        es: "☀️ ThermoSafe – UV extremo",
        eu: "☀️ ThermoSafe – UV muturrekoa",
        gl: "☀️ ThermoSafe – UV extremo",
        en: "☀️ ThermoSafe – Extreme UV",
      },
      body: {
        ca: `Índex UV extrem (${uvi.toFixed(1)}). Evita el sol directe.`,
        es: `Índice UV extremo (${uvi.toFixed(1)}). Evita el sol directo.`,
        eu: `UV indize muturrekoa (${uvi.toFixed(1)}). Saihestu eguzki zuzena.`,
        gl: `Índice UV extremo (${uvi.toFixed(1)}). Evita o sol directo.`,
        en: `Extreme UV index (${uvi.toFixed(1)}). Avoid direct sun exposure.`,
      },
    };
  }

  if (uvi >= 8) {
    return {
      level: 3,
      risk: "very_high",
      title: {
        ca: "☀️ ThermoSafe – UV molt alt",
        es: "☀️ ThermoSafe – UV muy alto",
        eu: "☀️ ThermoSafe – UV oso altua",
        gl: "☀️ ThermoSafe – UV moi alto",
        en: "☀️ ThermoSafe – Very high UV",
      },
      body: {
        ca: `Índex UV molt alt (${uvi.toFixed(1)}). Protecció solar imprescindible.`,
        es: `Índice UV muy alto (${uvi.toFixed(1)}). Protección solar imprescindible.`,
        eu: `UV indize oso altua (${uvi.toFixed(1)}). Eguzki-babesa ezinbestekoa.`,
        gl: `Índice UV moi alto (${uvi.toFixed(1)}). Protección solar imprescindible.`,
        en: `Very high UV index (${uvi.toFixed(1)}). Sun protection is essential.`,
      },
    };
  }

  if (uvi >= 6) {
    return {
      level: 2,
      risk: "high",
      title: {
        ca: "☀️ ThermoSafe – UV alt",
        es: "☀️ ThermoSafe – UV alto",
        eu: "☀️ ThermoSafe – UV altua",
        gl: "☀️ ThermoSafe – UV alto",
        en: "☀️ ThermoSafe – High UV",
      },
      body: {
        ca: `Índex UV alt (${uvi.toFixed(1)}). Usa crema solar, gorra i busca ombra.`,
        es: `Índice UV alto (${uvi.toFixed(1)}). Usa crema solar, gorra y busca sombra.`,
        eu: `UV indize altua (${uvi.toFixed(1)}). Erabili krema, txapela eta itzala bilatu.`,
        gl: `Índice UV alto (${uvi.toFixed(1)}). Usa crema solar, gorra e busca sombra.`,
        en: `High UV index (${uvi.toFixed(1)}). Use sunscreen, a cap, and seek shade.`,
      },
    };
  }

  if (uvi >= 3) {
    return {
      level: 1,
      risk: "moderate",
      title: {
        ca: "☀️ ThermoSafe – UV moderat",
        es: "☀️ ThermoSafe – UV moderado",
        eu: "☀️ ThermoSafe – UV moderatua",
        gl: "☀️ ThermoSafe – UV moderado",
        en: "☀️ ThermoSafe – Moderate UV",
      },
      body: {
        ca: `Índex UV moderat (${uvi.toFixed(1)}). Recomanable crema solar, gorra i busca ombra.`,
        es: `Índice UV moderado (${uvi.toFixed(1)}). Recomendable crema solar, gorra y busca sombra.`,
        eu: `UV indize moderatua (${uvi.toFixed(1)}). Gomendagarria krema, txapela eta itzala bilatu.`,
        gl: `Índice UV moderado (${uvi.toFixed(1)}). Recomendable crema solar, gorra e busca sombra.`,
        en: `Moderate UV index (${uvi.toFixed(1)}). Sunscreen, a cap, and shade are recommended.`,
      },
    };
  }

  return { level: 0, risk: null, title: null, body: null };
}

async function sendUvPush(token, lang, info, uvi, place) {
  if (!info || info.level === 0) return;

  const title = info.title?.[lang] ?? info.title?.ca ?? "☀️ ThermoSafe";
  const body =
    info.body?.[lang] ??
    info.body?.ca ??
    `Índex UV (${uvi?.toFixed?.(1) ?? uvi})`;

  const data = {
    title,
    body,
    icon: "https://thermosafe.app/icons/icon-192.png",
    badge: "https://thermosafe.app/icons/badge-72.png",
    tag: "thermosafe-uv",
    url: "https://thermosafe.app",
    type: "uv",
    level: String(info.level),
    lang,
    place: place || "",
    uvi: String(Math.round(Number(uvi) || 0)),
    risk: info.risk || "",
  };

  await admin.messaging().send({
    token,
    data,
    webpush: {
      headers: {
        TTL: "3600",
        Urgency: "high",
      },
      fcmOptions: {
        link: "https://thermosafe.app",
      },
    },
  });
}

// ─────────────────────────────────────────────
// Textos i notificacions · AEMET / alertes oficials
// ─────────────────────────────────────────────
async function getWeatherAlerts(lat, lon) {
  const url =
    `https://api.openweathermap.org/data/3.0/onecall?lat=${lat}&lon=${lon}` +
    `&appid=${OPENWEATHER_KEY.value()}&units=metric&exclude=minutely,hourly,daily`;

  const r = await fetch(url);
  if (!r.ok) throw new Error(`OpenWeather alerts ${r.status}`);

  const j = await r.json();
  return Array.isArray(j?.alerts) ? j.alerts : [];
}

function getAemetLevelFromAlerts(alerts) {
  if (!Array.isArray(alerts) || alerts.length === 0) {
    return {
      level: 0,
      event: "",
      sender: "",
      description: "",
    };
  }

  const first = alerts[0] || {};

  return {
    level: 1,
    event: String(first.event || ""),
    sender: String(first.sender_name || ""),
    description: String(first.description || ""),
  };
}

async function sendAemetPush(token, lang, info, place) {
  if (!info || info.level === 0) return;

  const title =
    {
      ca: "🚨 ThermoSafe – Avís oficial",
      es: "🚨 ThermoSafe – Aviso oficial",
      eu: "🚨 ThermoSafe – Abisu ofiziala",
      gl: "🚨 ThermoSafe – Aviso oficial",
      en: "🚨 ThermoSafe – Official alert",
    }[lang] ?? "🚨 ThermoSafe – Official alert";

  const eventText =
    info.event ||
    {
      ca: "Avís meteorològic actiu",
      es: "Aviso meteorológico activo",
      eu: "Eguraldi-abisu aktiboa",
      gl: "Aviso meteorolóxico activo",
      en: "Active weather alert",
    }[lang] ||
    "Active weather alert";

  const tail =
    {
      ca: "Obre ThermoSafe per veure els detalls.",
      es: "Abre ThermoSafe para ver los detalles.",
      eu: "Ireki ThermoSafe xehetasunak ikusteko.",
      gl: "Abre ThermoSafe para ver os detalles.",
      en: "Open ThermoSafe to see the details.",
    }[lang] ?? "Open ThermoSafe to see the details.";

  const body = `${eventText}${place ? " · " + place : ""}. ${tail}`;

  const data = {
    title,
    body,
    icon: "https://thermosafe.app/icons/icon-192.png",
    badge: "https://thermosafe.app/icons/badge-72.png",
    tag: "thermosafe-aemet",
    url: "https://thermosafe.app",
    type: "aemet",
    level: String(info.level),
    lang,
    place: place || "",
    event: info.event || "",
  };

  await admin.messaging().send({
    token,
    data,
    webpush: {
      headers: {
        TTL: "3600",
        Urgency: "high",
      },
      fcmOptions: {
        link: "https://thermosafe.app",
      },
    },
  });
}
// ─────────────────────────────────────────────
// 🌦️ CACHE METEO PER ZONA
// Redueix crides a OpenWeather agrupant coordenades properes
// ─────────────────────────────────────────────
const WEATHER_CACHE_MINUTES = 45;

function locationKey(lat, lon) {
  const la = Number(lat);
  const lo = Number(lon);

  if (!Number.isFinite(la) || !Number.isFinite(lo)) {
    return null;
  }

  // 2 decimals ≈ zona d'1 km aproximadament
  return `${la.toFixed(2)}_${lo.toFixed(2)}`;
}

const weatherInflight = new Map();
const uvInflight = new Map();

async function getCachedWeather(lat, lon) {
  const key = locationKey(lat, lon);

  if (!key) {
    console.warn("[WEATHER CACHE] coordenades invàlides, crida directa", {
      lat,
      lon,
    });
    return getWeather(lat, lon);
  }

  if (weatherInflight.has(key)) {
    console.log("[WEATHER CACHE] INFLIGHT HIT", { key });
    return weatherInflight.get(key);
  }

  const promise = (async () => {
    const now = Date.now();
    const maxAge = WEATHER_CACHE_MINUTES * 60 * 1000;
    const ref = db.collection("weatherCache").doc(key);

    try {
      const snap = await ref.get();

      if (snap.exists) {
        const cached = snap.data();

        if (
          cached?.updatedAt &&
          now - Number(cached.updatedAt) < maxAge &&
          cached?.weather
        ) {
          console.log("[WEATHER CACHE] HIT", {
            key,
            ageMin: Math.round((now - Number(cached.updatedAt)) / 60000),
          });

          return cached.weather;
        }
      }

      console.log("[WEATHER CACHE] MISS", { key });

      const weather = await getWeather(lat, lon);

      await ref.set(
        {
          key,
          lat: Number(lat),
          lon: Number(lon),
          weather,
          updatedAt: Date.now(),
        },
        { merge: true }
      );

      return weather;
    } catch (e) {
      console.error("[WEATHER CACHE] error, fallback OpenWeather directe", {
        key,
        error: e?.message || e,
      });

      return getWeather(lat, lon);
    }
  })();

  weatherInflight.set(key, promise);

  try {
    return await promise;
  } finally {
    weatherInflight.delete(key);
  }
}

// ─────────────────────────────────────────────
// ☀️ CACHE UV PER ZONA
// Redueix crides a OpenUV agrupant coordenades properes
// ─────────────────────────────────────────────
const UV_CACHE_MINUTES = 45;

async function getCachedUV(lat, lon) {
  const key = locationKey(lat, lon);

  if (!key) {
    console.warn("[UV CACHE] coordenades invàlides, crida directa", {
      lat,
      lon,
    });
    return getUV(lat, lon);
  }

  if (uvInflight.has(key)) {
    console.log("[UV CACHE] INFLIGHT HIT", { key });
    return uvInflight.get(key);
  }

  const promise = (async () => {
    const now = Date.now();
    const maxAge = UV_CACHE_MINUTES * 60 * 1000;
    const ref = db.collection("uvCache").doc(key);

    try {
      const snap = await ref.get();

      if (snap.exists) {
        const cached = snap.data();

        if (
          cached?.updatedAt &&
          now - Number(cached.updatedAt) < maxAge &&
          cached?.uvi !== undefined
        ) {
          console.log("[UV CACHE] HIT", {
            key,
            ageMin: Math.round((now - Number(cached.updatedAt)) / 60000),
            uvi: cached.uvi,
          });

          return cached.uvi;
        }
      }

      console.log("[UV CACHE] MISS", { key });

      const uvi = await getUV(lat, lon);

      await ref.set(
        {
          key,
          lat: Number(lat),
          lon: Number(lon),
          uvi,
          updatedAt: Date.now(),
        },
        { merge: true }
      );

      return uvi;
    } catch (e) {
      console.error("[UV CACHE] error, fallback OpenUV directe", {
        key,
        error: e?.message || e,
      });

      return getUV(lat, lon);
    }
  })();

  uvInflight.set(key, promise);

  try {
    return await promise;
  } finally {
    uvInflight.delete(key);
  }
}
// ─────────────────────────────────────────────
// 🌦️ CRON METEO UNIFICAT — calor + fred + vent
// - Reset diari intel·ligent a les 06:00 (hora local)
// - No sobreescriu nivells amb 0 a cada cron
// - Resum final per zona
// ─────────────────────────────────────────────
exports.cronCheckWeatherRisk = functions
  .region(REGION)
  .runWith({ secrets: [OPENWEATHER_KEY] })
  .pubsub.schedule("every 60 minutes")
  .timeZone("Europe/Madrid")
  .onRun(async () => {
    const now = Date.now();
    const snap = await db.collection("subs").limit(1000).get();
    if (snap.empty) return null;

    const tasks = [];
    const zoneStats = new Map();

    function makeZoneKey(lat, lon) {
      return `${Number(lat).toFixed(1)},${Number(lon).toFixed(1)}`;
    }

    function getZoneStats(zoneKey, place = "") {
      if (!zoneStats.has(zoneKey)) {
        zoneStats.set(zoneKey, {
          zoneKey,
          place,
          tokensTotal: 0,
          quietHours: 0,
          invalidWeather: 0,
          dailyResets: 0,
          heat: {
            lastValue: null,
            tokensSent: 0,
            tokensSkipped: 0,
            reasons: {
              noLevelIncrease: 0,
              belowThreshold: 0,
              sendError: 0,
              removedInvalidToken: 0,
            },
          },
          cold: {
            lastValue: null,
            tokensSent: 0,
            tokensSkipped: 0,
            reasons: {
              noRisk: 0,
              noLevelIncrease: 0,
              belowThreshold: 0,
              sendError: 0,
              removedInvalidToken: 0,
            },
          },
          wind: {
            lastValue: null,
            tokensSent: 0,
            tokensSkipped: 0,
            reasons: {
              noRisk: 0,
              noLevelIncrease: 0,
              belowThreshold: 0,
              sendError: 0,
              removedInvalidToken: 0,
            },
          },
        });
      }

      const stats = zoneStats.get(zoneKey);
      if (!stats.place && place) stats.place = place;
      return stats;
    }

    for (const doc of snap.docs) {
      const sub = doc.data();
      const lang = normalizeLang(sub.lang);

      tasks.push(
        (async () => {
          let zoneKey = "unknown";
          let place = "";

          try {
            zoneKey = makeZoneKey(sub.lat, sub.lon);
            const stats = getZoneStats(zoneKey);
            stats.tokensTotal++;

            const w = await getCachedWeather(sub.lat, sub.lon);

            if (!w || w.temp === undefined) {
              console.warn("[WEATHER] dades invàlides, saltant usuari", {
                docId: doc.id,
                zoneKey,
              });

              stats.invalidWeather++;
              return;
            }

            place = sub.place || w.place || "";
            if (!stats.place && place) stats.place = place;

            if (isQuietHours(now, w.tzOffset)) {
              stats.quietHours++;
              return;
            }

            const updates = {};

            // ───────── RESET DIARI INTEL·LIGENT (06:00 hora local) ─────────
            const { shouldReset, todayKey } = shouldRunDailyReset(
              now,
              w.tzOffset,
              sub.lastDailyResetDay,
              6
            );

            if (shouldReset) {
              await doc.ref.set(
                {
                  lastHeatLevel: 0,
                  lastColdLevel: 0,
                  lastWindLevel: 0,
                  lastDailyResetDay: todayKey,
                },
                { merge: true }
              );

              sub.lastHeatLevel = 0;
              sub.lastColdLevel = 0;
              sub.lastWindLevel = 0;
              sub.lastDailyResetDay = todayKey;

              stats.dailyResets++;

              console.log("[WEATHER][DAILY RESET]", {
                docId: doc.id,
                place,
                zoneKey,
                todayKey,
              });
            }

            // ───────── CALOR ─────────
            const hi = w.temp < 18 ? w.temp : calcHI(w.temp, w.hum);
            const heatInfo = levelFromINSST(hi);
            const prevHeatLevel = Number(sub.lastHeatLevel ?? 0);

            let aemetLevel = 0;
            let aemetEvent = "";

            try {
              const aemetSnap = await db.collection("aemetZones").doc(zoneKey).get();

              if (aemetSnap.exists) {
                const aemetData = aemetSnap.data() || {};
                const updatedAt = Number(aemetData.updatedAt ?? 0);
                const ageMinutes = (now - updatedAt) / 60000;

                if (ageMinutes <= 90) {
                  aemetLevel = Number(aemetData.level ?? 0);
                  aemetEvent = aemetData.event || "";
                }
              }
            } catch (e) {
              console.warn("[UV][AEMET CHECK ERROR]", {
                docId: doc.id,
                zoneKey,
                error: e.message,
              });
            }

            stats.heat.lastValue = hi;

            if (heatInfo.level > 0) {
              updates.lastHeatLevel = heatInfo.level;
            }

            console.log("[WEATHER][HEAT]", {
              docId: doc.id,
              place,
              zoneKey,
              temp: w.temp,
              hum: w.hum,
              hi,
              prevLevel: prevHeatLevel,
              nextLevel: heatInfo.level,
              threshold: sub.threshold,
            });

            const heatLevelIncreases = shouldNotifyLevelIncrease(
              prevHeatLevel,
              heatInfo.level
            );

            const heatThresholdOk = meetsUserThreshold(
              heatInfo.level,
              sub.threshold
            );

            if (!heatLevelIncreases) {
              stats.heat.tokensSkipped++;
              stats.heat.reasons.noLevelIncrease++;
            } else if (!heatThresholdOk) {
              stats.heat.tokensSkipped++;
              stats.heat.reasons.belowThreshold++;
            } else {
              try {
                // 🔥 PRIORITAT AEMET
                if (aemetLevel > 0) {
                  console.log("[WEATHER][HEAT][SKIP AEMET PRIORITY]", {
                    docId: doc.id,
                    place,
                    zoneKey,
                    hi,
                    heatLevel: heatInfo.level,
                    aemetLevel,
                  });

                  stats.heat.tokensSkipped++;
                  stats.heat.reasons.noLevelIncrease++;
                } else {
                  // 🔥 CONSULTAM UV PER COMBINAR
                  let currentUvi = await getUVfromOpenWeather(sub.lat, sub.lon);
                  if (currentUvi == null) currentUvi = 0;

                  const currentUvInfo = getUvInfo(currentUvi);

                  const combined = buildCombinedRiskMessage({
                    lang,
                    uvInfo: currentUvInfo,
                    uvi: currentUvi,
                    heatInfo,
                    hi,
                    aemetLevel,
                    aemetEvent,
                  });

                  const isCombined =
                    combined &&
                    combined.type === "heat_uv" &&
                    heatInfo.level > 0 &&
                    currentUvInfo.level > 0;

                  if (isCombined) {
                    console.log("[WEATHER][COMBINED][SEND]", {
                      docId: doc.id,
                      place,
                      hi,
                      uvi: currentUvi,
                    });

                    await admin.messaging().send({
                      token: sub.token,
                      data: {
                        title: combined.title,
                        body: combined.body,
                        type: "combined",
                        hi: String(Math.round(hi)),
                        uvi: String(Math.round(currentUvi)),
                      },
                    });

                    updates.lastHeatAt = now;
                    updates.lastUvAt = now;
                    updates.lastNotified = now;
                    updates.lastUvLevel = currentUvInfo.level;

                  } else {
                    // 🔥 CALOR NORMAL
                    await sendPush(
                      sub.token,
                      lang,
                      heatInfo.level,
                      hi,
                      {
                        ca: heatInfo.ca,
                        es: heatInfo.es,
                        eu: heatInfo.eu,
                        gl: heatInfo.gl,
                        en: heatInfo.en,
                      },
                      place
                    );

                    updates.lastHeatAt = now;
                    updates.lastNotified = now;
                  }

                  stats.heat.tokensSent++;

                  console.log("[WEATHER][HEAT][SENT]", {
                    docId: doc.id,
                    place,
                    hi,
                    combined: isCombined,
                  });
                }
              } catch (sendErr) {
                const removed = await removeInvalidSub(
                  doc.ref,
                  doc.id,
                  sendErr,
                  "WEATHER-HEAT"
                );

                stats.heat.tokensSkipped++;

                if (removed) {
                  stats.heat.reasons.removedInvalidToken++;
                  return;
                }

                stats.heat.reasons.sendError++;
                throw sendErr;
              }
            }

            // ───────── FRED ─────────
            const windKmhExact = (w.wind ?? 0) * 3.6;
            const windChill =
              w.temp <= 10 && windKmhExact > 4.8
                ? 13.12 +
                  0.6215 * w.temp -
                  11.37 * Math.pow(windKmhExact, 0.16) +
                  0.3965 * w.temp * Math.pow(windKmhExact, 0.16)
                : w.temp;

            const coldInfo = getColdInfo(windChill);
            const prevColdLevel = Number(sub.lastColdLevel ?? 0);

            stats.cold.lastValue = windChill;

            if (coldInfo.level > 0) {
              updates.lastColdLevel = coldInfo.level;
            }

            console.log("[WEATHER][COLD]", {
              docId: doc.id,
              place,
              zoneKey,
              temp: w.temp,
              windKmh: windKmhExact,
              windChill,
              prevLevel: prevColdLevel,
              nextLevel: coldInfo.level,
              threshold: sub.threshold,
            });

            const coldLevelIncreases = shouldNotifyLevelIncrease(
              prevColdLevel,
              coldInfo.level
            );

            const coldThresholdOk = meetsUserThreshold(
              coldInfo.level,
              sub.threshold
            );

            if (coldInfo.level <= 0) {
              stats.cold.tokensSkipped++;
              stats.cold.reasons.noRisk++;
            } else if (!coldLevelIncreases) {
              stats.cold.tokensSkipped++;
              stats.cold.reasons.noLevelIncrease++;
            } else if (!coldThresholdOk) {
              stats.cold.tokensSkipped++;
              stats.cold.reasons.belowThreshold++;
            } else {
              try {
                await sendColdPush(sub.token, lang, coldInfo, windChill, place);

                updates.lastColdAt = now;
                updates.lastNotified = now;

                stats.cold.tokensSent++;

                console.log("[WEATHER][COLD][SENT]", {
                  docId: doc.id,
                  place,
                  zoneKey,
                  windChill,
                  prevLevel: prevColdLevel,
                  nextLevel: coldInfo.level,
                });
              } catch (sendErr) {
                const removed = await removeInvalidSub(
                  doc.ref,
                  doc.id,
                  sendErr,
                  "WEATHER-COLD"
                );

                stats.cold.tokensSkipped++;

                if (removed) {
                  stats.cold.reasons.removedInvalidToken++;
                  return;
                }

                stats.cold.reasons.sendError++;
                throw sendErr;
              }
            }

            // ───────── VENT ─────────
            const windKmh = Math.round((w.wind ?? 0) * 3.6);
            const jobType = sub.jobType || "generic";
            const windInfo = getWindInfo(windKmh, jobType);
            const prevWindLevel = Number(sub.lastWindLevel ?? 0);

            stats.wind.lastValue = windKmh;

            if (windInfo.level > 0) {
              updates.lastWindLevel = windInfo.level;
            }

            console.log("[WEATHER][WIND]", {
              docId: doc.id,
              place,
              zoneKey,
              windKmh,
              prevLevel: prevWindLevel,
              nextLevel: windInfo.level,
              threshold: sub.threshold,
            });

            const windLevelIncreases = shouldNotifyLevelIncrease(
              prevWindLevel,
              windInfo.level
            );

            const windThresholdOk = meetsUserThreshold(
              windInfo.level,
              sub.threshold
            );

            if (windInfo.level <= 0) {
              stats.wind.tokensSkipped++;
              stats.wind.reasons.noRisk++;
            } else if (!windLevelIncreases) {
              stats.wind.tokensSkipped++;
              stats.wind.reasons.noLevelIncrease++;
            } else if (!windThresholdOk) {
              stats.wind.tokensSkipped++;
              stats.wind.reasons.belowThreshold++;
            } else {
              try {
                await sendWindPush(sub.token, lang, windInfo, windKmh, place);

                updates.lastWindAt = now;
                updates.lastNotified = now;

                stats.wind.tokensSent++;

                console.log("[WEATHER][WIND][SENT]", {
                  docId: doc.id,
                  place,
                  zoneKey,
                  windKmh,
                  prevLevel: prevWindLevel,
                  nextLevel: windInfo.level,
                });
              } catch (sendErr) {
                const removed = await removeInvalidSub(
                  doc.ref,
                  doc.id,
                  sendErr,
                  "WEATHER-WIND"
                );

                stats.wind.tokensSkipped++;

                if (removed) {
                  stats.wind.reasons.removedInvalidToken++;
                  return;
                }

                stats.wind.reasons.sendError++;
                throw sendErr;
              }
            }

            await doc.ref.set(updates, { merge: true });
          } catch (e) {
            const stats = getZoneStats(zoneKey, place);
            stats.heat.reasons.sendError++;
            stats.cold.reasons.sendError++;
            stats.wind.reasons.sendError++;

            console.error("cron weather error", doc.id, e);
          }
        })()
      );
    }

    await Promise.allSettled(tasks);

    for (const stats of zoneStats.values()) {
      console.log("[WEATHER SENT SUMMARY]", stats);
    }

    return null;
  });

// ─────────────────────────────────────────────
// ☀️ CRON UV ROBUST — OpenUV principal + fallback OpenWeather
// - Agrupació per zones
// - Reset nocturn
// - Només notifica si puja de nivell
// - Resum final per zona
// - No envia UV si hi ha alerta AEMET oficial activa
// - Si hi ha calor + UV, envia una única notificació combinada
// ─────────────────────────────────────────────
exports.cronCheckUvRisk = functions
  .region(REGION)
  .runWith({ secrets: [OPENUV_KEY, OPENWEATHER_KEY] })
  .pubsub.schedule("every 60 minutes")
  .timeZone("Europe/Madrid")
  .onRun(async () => {
    const now = Date.now();
    const snap = await db.collection("subs").limit(1000).get();
    if (snap.empty) return null;

    const tasks = [];
    const weatherCache = new Map();
    const zoneStats = new Map();

    function makeZoneKey(lat, lon) {
      return `${Number(lat).toFixed(1)},${Number(lon).toFixed(1)}`;
    }

    function getZoneStats(zoneKey, place = "") {
      if (!zoneStats.has(zoneKey)) {
        zoneStats.set(zoneKey, {
          zoneKey,
          place,
          tokensTotal: 0,
          tokensSent: 0,
          tokensSkipped: 0,
          lastUvi: null,
          reasons: {
            night: 0,
            quietHours: 0,
            noData: 0,
            noLevelIncrease: 0,
            belowThreshold: 0,
            blockedByAemet: 0,
            sendError: 0,
            removedInvalidToken: 0,
          },
        });
      }

      const stats = zoneStats.get(zoneKey);
      if (!stats.place && place) stats.place = place;
      return stats;
    }

    for (const doc of snap.docs) {
      const sub = doc.data();
      const lang = normalizeLang(sub.lang);

      tasks.push(
        (async () => {
          let zoneKey = "unknown";
          let place = "";

          try {
            zoneKey = makeZoneKey(sub.lat, sub.lon);
            const stats = getZoneStats(zoneKey);
            stats.tokensTotal++;

            let wPromise = weatherCache.get(zoneKey);

            if (!wPromise) {
              wPromise = getCachedWeather(sub.lat, sub.lon);
              weatherCache.set(zoneKey, wPromise);
            }

            const w = await wPromise;

            place = sub.place || w.place || "";
            if (!stats.place && place) stats.place = place;

            const localHour = new Date(now + w.tzOffset * 1000).getUTCHours();
            const isNight = localHour < 7 || localHour >= 20;

            console.log("[UV DAYCHECK]", {
              docId: doc.id,
              place,
              zoneKey,
              localHour,
              isNight,
            });

            if (isNight) {
              const prevLevel = Number(sub.lastUvLevel ?? 0);

              console.log("[UV RESET NIGHT]", {
                docId: doc.id,
                place,
                zoneKey,
                localHour,
                prevLevel,
              });

              stats.tokensSkipped++;
              stats.reasons.night++;

              if (prevLevel !== 0) {
                await doc.ref.set(
                  {
                    lastUvLevel: 0,
                  },
                  { merge: true }
                );
              }

              return;
            }

            const quiet = isQuietHours(now, w.tzOffset);
            if (quiet) {
              console.log("[UV SKIP QUIET HOURS]", {
                docId: doc.id,
                place,
                zoneKey,
                localHour,
              });

              stats.tokensSkipped++;
              stats.reasons.quietHours++;

              return;
            }

            let uvi = await getCachedUV(sub.lat, sub.lon);

            console.log("[UV CACHE ZONE]", {
              zoneKey,
              uvi,
              sampleLat: sub.lat,
              sampleLon: sub.lon,
            });

            if (uvi == null) {
              console.log("[UV FALLBACK] trying OpenWeather", {
                zoneKey,
                sampleLat: sub.lat,
                sampleLon: sub.lon,
              });

              const fallbackUvi = await getUVfromOpenWeather(sub.lat, sub.lon);

              if (fallbackUvi != null) {
                uvi = fallbackUvi;

                const key = locationKey(sub.lat, sub.lon);

                await db.collection("uvCache").doc(key).set(
                  {
                    key,
                    lat: Number(sub.lat),
                    lon: Number(sub.lon),
                    uvi,
                    source: "openweather_fallback",
                    updatedAt: Date.now(),
                  },
                  { merge: true }
                );

                console.log("[UV CACHE SAVE][fallback]", {
                  key,
                  uvi,
                  source: "openweather_fallback",
                });
              }
            }

            if (uvi == null) {
              console.warn("[UV NO DATA AFTER FALLBACK]", {
                zoneKey,
                sampleLat: sub.lat,
                sampleLon: sub.lon,
              });

              stats.reasons.noData++;
              uvi = 0;
            }

            stats.lastUvi = uvi;

            const info = getUvInfo(uvi);
            const prevLevel = Number(sub.lastUvLevel ?? 0);

            // ───────── CALOR PER POSSIBLE COMBINACIÓ ─────────
            const hi = w.temp < 18 ? w.temp : calcHI(w.temp, w.hum);
            const heatInfo = levelFromINSST(hi);

            // ───────── CONSULTA AEMET PER PRIORITZACIÓ ─────────
            let aemetLevel = 0;
            let aemetEvent = "";

            try {
              const aemetSnap = await db
                .collection("aemetZones")
                .doc(zoneKey)
                .get();

              if (aemetSnap.exists) {
                const aemetData = aemetSnap.data() || {};
                const updatedAt = Number(aemetData.updatedAt ?? 0);
                const ageMinutes = (now - updatedAt) / 60000;

                if (ageMinutes <= 90) {
                  aemetLevel = Number(aemetData.level ?? 0);
                  aemetEvent = aemetData.event || "";
                }
              }
            } catch (e) {
              console.warn("[UV][AEMET CHECK ERROR]", {
                docId: doc.id,
                zoneKey,
                error: e.message,
              });
            }

            const combinedMessage = buildCombinedRiskMessage({
              lang,
              uvInfo: info,
              uvi,
              heatInfo,
              hi,
              aemetLevel,
              aemetEvent,
            });

            if (combinedMessage) {
              console.log("[COMBINED RISK MESSAGE]", {
                docId: doc.id,
                place,
                zoneKey,
                title: combinedMessage.title,
                body: combinedMessage.body,
                type: combinedMessage.type,
              });
            }

            console.log("[UV]", {
              docId: doc.id,
              place,
              zoneKey,
              uvi,
              hi,
              prevLevel,
              nextLevel: info.level,
              heatLevel: heatInfo.level,
              threshold: sub.threshold,
              aemetLevel,
              aemetEvent,
            });

            const updates = {
              lastUvLevel: info.level,
            };

            const levelIncreases = shouldNotifyLevelIncrease(
              prevLevel,
              info.level
            );

            const thresholdOk = meetsUserThreshold(
              info.level,
              sub.threshold
            );

            if (info.level <= 0) {
              stats.tokensSkipped++;
              stats.reasons.noLevelIncrease++;
            } else if (!levelIncreases) {
              stats.tokensSkipped++;
              stats.reasons.noLevelIncrease++;
            } else if (!thresholdOk) {
              stats.tokensSkipped++;
              stats.reasons.belowThreshold++;
            } else if (aemetLevel > 0) {
              stats.tokensSkipped++;
              stats.reasons.blockedByAemet++;

              console.log("[UV SKIP AEMET HIGHER]", {
                docId: doc.id,
                place,
                zoneKey,
                uvi,
                uvLevel: info.level,
                aemetLevel,
                aemetEvent,
              });
            } else {
              try {
                const combined = buildCombinedRiskMessage({
                  lang,
                  uvInfo: info,
                  uvi,
                  heatInfo,
                  hi,
                  aemetLevel,
                  aemetEvent,
                });

                const isCombined =
                  combined &&
                  combined.type === "heat_uv" &&
                  info.level > 0 &&
                  heatInfo.level > 0;

                if (isCombined) {
                  console.log("[UV][COMBINED][SEND]", {
                    docId: doc.id,
                    place,
                    zoneKey,
                    uvi,
                    hi,
                    uvLevel: info.level,
                    heatLevel: heatInfo.level,
                  });

                  await admin.messaging().send({
                    token: sub.token,
                    data: {
                      title: combined.title,
                      body: combined.body,
                      icon: "https://thermosafe.app/icons/icon-192.png",
                      badge: "https://thermosafe.app/icons/badge-72.png",
                      tag: "thermosafe-combined",
                      url: "https://thermosafe.app",
                      type: "combined",
                      lang,
                      place: place || "",
                      uvi: String(Math.round(uvi)),
                      hi: String(Math.round(hi)),
                      uvLevel: String(info.level),
                      heatLevel: String(heatInfo.level),
                    },
                    webpush: {
                      headers: {
                        TTL: "3600",
                        Urgency: "high",
                      },
                      fcmOptions: {
                        link: "https://thermosafe.app",
                      },
                    },
                  });

                  updates.lastUvAt = now;
                  updates.lastHeatAt = now;
                  updates.lastHeatLevel = heatInfo.level;
                  updates.lastNotified = now;
                } else {
                  await sendUvPush(sub.token, lang, info, uvi, place);

                  updates.lastUvAt = now;
                  updates.lastNotified = now;
                }

                stats.tokensSent++;

                console.log("[UV SENT]", {
                  docId: doc.id,
                  place,
                  zoneKey,
                  uvi,
                  hi,
                  prevLevel,
                  nextLevel: info.level,
                  combined: isCombined,
                });
              } catch (sendErr) {
                const removed = await removeInvalidSub(
                  doc.ref,
                  doc.id,
                  sendErr,
                  "UV"
                );

                stats.tokensSkipped++;

                if (removed) {
                  stats.reasons.removedInvalidToken++;
                  return;
                }

                stats.reasons.sendError++;
                throw sendErr;
              }
            }

            await doc.ref.set(updates, { merge: true });
          } catch (e) {
            const stats = getZoneStats(zoneKey, place);
            stats.reasons.sendError++;

            console.error("cron uv error", doc.id, e);
          }
        })()
      );
    }

    await Promise.allSettled(tasks);

    for (const stats of zoneStats.values()) {
      console.log("[UV SENT SUMMARY]", stats);
    }

    return null;
  });

  
// ─────────────────────────────────────────────
// 🚨 CRON AEMET / ALERTES OFICIALS
// - Agrupació per zones
// - Cache per zona dins la mateixa execució
// - Anti-repetició per alerta oficial
// - Elimina tokens invàlids
// - Resum final per zona
// ─────────────────────────────────────────────
exports.cronCheckAemetRisk = functions
  .region(REGION)
  .runWith({ secrets: [OPENWEATHER_KEY] })
  .pubsub.schedule("every 60 minutes")
  .timeZone("Europe/Madrid")
  .onRun(async () => {
    const now = Date.now();
    const snap = await db.collection("subs").limit(1000).get();
    if (snap.empty) return null;

    const alertsCache = new Map();
    const weatherCache = new Map();
    const zoneStats = new Map();

    function makeZoneKey(lat, lon) {
      return `${Number(lat).toFixed(1)},${Number(lon).toFixed(1)}`;
    }

    function makeAemetEventKey(info) {
      return [
        info.level ?? 0,
        info.event ?? "",
        info.sender ?? "",
        String(info.description ?? "").slice(0, 120),
      ].join("|");
    }

    function getZoneStats(zoneKey, place = "") {
      if (!zoneStats.has(zoneKey)) {
        zoneStats.set(zoneKey, {
          zoneKey,
          place,
          tokensTotal: 0,
          tokensSent: 0,
          tokensSkipped: 0,
          alertLevel: 0,
          alertEvent: "",
          reasons: {
            noAlerts: 0,
            noRisk: 0,
            repeatedAlert: 0,
            sendError: 0,
            removedInvalidToken: 0,
          },
        });
      }

      const stats = zoneStats.get(zoneKey);
      if (!stats.place && place) stats.place = place;
      return stats;
    }

    const tasks = snap.docs.map(async (doc) => {
      const sub = doc.data();
      const lang = normalizeLang(sub.lang);

      let zoneKey = "unknown";
      let place = "";

      try {
        zoneKey = makeZoneKey(sub.lat, sub.lon);
        const zoneRef = db.collection("aemetZones").doc(zoneKey);

        const stats = getZoneStats(zoneKey);
        stats.tokensTotal++;

        // ───────── ALERTES CACHE PER ZONA ─────────
        let alertsPromise = alertsCache.get(zoneKey);

        if (!alertsPromise) {
          alertsPromise = getWeatherAlerts(sub.lat, sub.lon);
          alertsCache.set(zoneKey, alertsPromise);
        }

        const alerts = await alertsPromise;

        // ───────── SENSE ALERTES: GUARDA ESTAT 0 PER ZONA ─────────
        if (!alerts || alerts.length === 0) {
          await zoneRef.set(
            {
              zoneKey,
              level: 0,
              event: "",
              sender: "",
              description: "",
              updatedAt: Date.now(),
            },
            { merge: true }
          );

          stats.tokensSkipped++;
          stats.reasons.noAlerts++;

          console.log("[AEMET][ZONE SAVE NO ALERT]", {
            zoneKey,
            level: 0,
          });

          return;
        }

        const info = getAemetLevelFromAlerts(alerts);

        // ───────── GUARDA ESTAT AEMET PER ZONA ─────────
        await zoneRef.set(
          {
            zoneKey,
            level: info?.level ?? 0,
            event: info?.event || "",
            sender: info?.sender || "",
            description: info?.description || "",
            updatedAt: Date.now(),
          },
          { merge: true }
        );

        stats.alertLevel = info?.level ?? 0;
        stats.alertEvent = info?.event ?? "";

        if (!info || (info.level ?? 0) === 0) {
          stats.tokensSkipped++;
          stats.reasons.noRisk++;
          return;
        }

        // ───────── WEATHER CACHE PER ZONA, NOMÉS PER PLACE ─────────
        let wPromise = weatherCache.get(zoneKey);

        if (!wPromise) {
          wPromise = getCachedWeather(sub.lat, sub.lon);
          weatherCache.set(zoneKey, wPromise);
        }

        const w = await wPromise;
        place = sub.place || w?.place || "";

        if (!stats.place && place) stats.place = place;

        const eventKey = makeAemetEventKey(info);
        const prevEventKey = sub.lastAemetEventKey || "";

        // ───────── ANTI-REPETICIÓ ─────────
        if (prevEventKey === eventKey) {
          stats.tokensSkipped++;
          stats.reasons.repeatedAlert++;

          console.log("[AEMET][SKIP REPEATED]", {
            docId: doc.id,
            place,
            zoneKey,
            level: info.level,
            event: info.event,
          });

          return;
        }

        try {
          await sendAemetPush(sub.token, lang, info, place);

          await doc.ref.set(
            {
              lastAemetAt: now,
              lastNotified: now,
              lastAemetLevel: info.level,
              lastAemetEvent: info.event || "",
              lastAemetSender: info.sender || "",
              lastAemetEventKey: eventKey,
            },
            { merge: true }
          );

          stats.tokensSent++;

          console.log("[AEMET][SENT]", {
            docId: doc.id,
            place,
            zoneKey,
            level: info.level,
            event: info.event,
            sender: info.sender,
          });
        } catch (sendErr) {
          const removed = await removeInvalidSub(
            doc.ref,
            doc.id,
            sendErr,
            "AEMET"
          );

          stats.tokensSkipped++;

          if (removed) {
            stats.reasons.removedInvalidToken++;
            return;
          }

          stats.reasons.sendError++;
          throw sendErr;
        }
      } catch (err) {
        const stats = getZoneStats(zoneKey, place);
        stats.reasons.sendError++;

        console.error("cron aemet error", doc.id, err);
      }
    });

    await Promise.allSettled(tasks);

    for (const stats of zoneStats.values()) {
      console.log("[AEMET SENT SUMMARY]", stats);
    }

    return null;
  });

// ─────────────────────────────────────────────
// Endpoint de prova manual — només 1 token
// ─────────────────────────────────────────────
exports.sendTestNotification = functions
  .region(REGION)
  .https.onRequest(async (req, res) => {
    res.set("Access-Control-Allow-Origin", "*");
    res.set("Access-Control-Allow-Methods", "GET, OPTIONS");
    res.set("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") {
      return res.status(204).end();
    }

    const token = String(req.query.token || "").trim();
    const type = String(req.query.type || "test").trim().toLowerCase();
    const place = String(req.query.place || "").trim();
    const lang = normalizeLang(req.query.lang || "ca");

    if (!token) {
      return res.status(400).json({ ok: false, error: "missing token" });
    }

    try {
      let title = "ThermoSafe";
      let body =
        {
          ca: "🔔 Notificació de prova",
          es: "🔔 Notificación de prueba",
          eu: "🔔 Proba-jakinarazpena",
          gl: "🔔 Notificación de proba",
          en: "🔔 Test notification",
        }[lang] ?? "🔔 Test notification";

      let tag = "thermosafe-test";

      if (type === "heat") {
        title =
          {
            ca: "🔥 ThermoSafe – Calor",
            es: "🔥 ThermoSafe – Calor",
            eu: "🔥 ThermoSafe – Beroa",
            gl: "🔥 ThermoSafe – Calor",
            en: "🔥 ThermoSafe – Heat",
          }[lang] ?? "🔥 ThermoSafe – Heat";

        body =
          {
            ca: "Risc per calor alt. Prova manual.",
            es: "Riesgo alto por calor. Prueba manual.",
            eu: "Bero-arrisku handia. Eskuzko proba.",
            gl: "Risco alto por calor. Proba manual.",
            en: "High heat risk. Manual test.",
          }[lang] ?? "High heat risk. Manual test.";

        tag = "thermosafe-heat";
      } else if (type === "cold") {
        title =
          {
            ca: "❄️ ThermoSafe – Fred",
            es: "❄️ ThermoSafe – Frío",
            eu: "❄️ ThermoSafe – Hotza",
            gl: "❄️ ThermoSafe – Frío",
            en: "❄️ ThermoSafe – Cold",
          }[lang] ?? "❄️ ThermoSafe – Cold";

        body =
          {
            ca: "Fred extrem. Prova manual.",
            es: "Frío extremo. Prueba manual.",
            eu: "Muturreko hotza. Eskuzko proba.",
            gl: "Frío extremo. Proba manual.",
            en: "Extreme cold. Manual test.",
          }[lang] ?? "Extreme cold. Manual test.";

        tag = "thermosafe-cold";
      } else if (type === "wind") {
        title =
          {
            ca: "🌬️ ThermoSafe – Vent",
            es: "🌬️ ThermoSafe – Viento",
            eu: "🌬️ ThermoSafe – Haizea",
            gl: "🌬️ ThermoSafe – Vento",
            en: "🌬️ ThermoSafe – Wind",
          }[lang] ?? "🌬️ ThermoSafe – Wind";

        body =
          {
            ca: "Vent fort. Prova manual.",
            es: "Viento fuerte. Prueba manual.",
            eu: "Haize handia. Eskuzko proba.",
            gl: "Vento forte. Proba manual.",
            en: "Strong wind. Manual test.",
          }[lang] ?? "Strong wind. Manual test.";

        tag = "thermosafe-wind";
      } else if (type === "uv") {
        title =
          {
            ca: "☀️ ThermoSafe – UV",
            es: "☀️ ThermoSafe – UV",
            eu: "☀️ ThermoSafe – UV",
            gl: "☀️ ThermoSafe – UV",
            en: "☀️ ThermoSafe – UV",
          }[lang] ?? "☀️ ThermoSafe – UV";

        body =
          {
            ca: "Índex UV alt. Prova manual.",
            es: "Índice UV alto. Prueba manual.",
            eu: "UV indize altua. Eskuzko proba.",
            gl: "Índice UV alto. Proba manual.",
            en: "High UV index. Manual test.",
          }[lang] ?? "High UV index. Manual test.";

        tag = "thermosafe-uv";
      } else if (type === "aemet") {
        title =
          {
            ca: "🚨 ThermoSafe – Avís oficial",
            es: "🚨 ThermoSafe – Aviso oficial",
            eu: "🚨 ThermoSafe – Abisu ofiziala",
            gl: "🚨 ThermoSafe – Aviso oficial",
            en: "🚨 ThermoSafe – Official alert",
          }[lang] ?? "🚨 ThermoSafe – Official alert";

        body =
          {
            ca: "Avís oficial actiu. Prova manual.",
            es: "Aviso oficial activo. Prueba manual.",
            eu: "Abisu ofizial aktiboa. Eskuzko proba.",
            gl: "Aviso oficial activo. Proba manual.",
            en: "Active official alert. Manual test.",
          }[lang] ?? "Active official alert. Manual test.";

        tag = "thermosafe-aemet";
      }

      const payload = {
        token,
        data: {
          title,
          body,
          tag,
          type,
          lang,
          place,
          url: "https://thermosafe.app",
          click_action: "https://thermosafe.app",
          icon: "https://thermosafe.app/icons/icon-192.png",
          badge: "https://thermosafe.app/icons/badge-72.png",
        },
        webpush: {
          headers: {
            TTL: "3600",
            Urgency: "high",
          },
          fcmOptions: {
            link: "https://thermosafe.app",
          },
        },
      };

      const messageId = await admin.messaging().send(payload);

      return res.status(200).json({
        ok: true,
        messageId,
        type,
        lang,
      });
    } catch (e) {
      console.error("[TEST PUSH] send error", e);

      return res.status(500).json({
        ok: false,
        error: e?.message || "send error",
        code: e?.errorInfo?.code || e?.code || "",
      });
    }
  });

// ─────────────────────────────────────────────
// ☀️ TEST MANUAL UV
// - Llegeix subs
// - Calcula UV actual
// - Envia només si hi ha nivell > 0
// - Respecta threshold usuari
// - Neteja subs invàlides si fallen
// ─────────────────────────────────────────────
exports.runUvNow = functions
  .region(REGION)
  .runWith({ secrets: [OPENUV_KEY, OPENWEATHER_KEY] })
  .https.onRequest(async (req, res) => {
    console.log("[MANUAL UV] start");

    try {
      const snap = await db.collection("subs").limit(50).get();

      if (snap.empty) {
        console.log("[MANUAL UV] no subs");
        return res.json({ ok: true, subs: 0 });
      }

      const tasks = [];

      for (const doc of snap.docs) {
        const sub = doc.data();

        tasks.push(
          (async () => {
            try {
              const lang = normalizeLang(sub.lang);
              const place = sub.place || "";
              let uvi = await getCachedUV(sub.lat, sub.lon);

              if (uvi == null) {
                const fallbackUvi = await getUVfromOpenWeather(sub.lat, sub.lon);

                if (fallbackUvi != null) {
                  uvi = fallbackUvi;

                  const key = locationKey(sub.lat, sub.lon);

                  await db.collection("uvCache").doc(key).set(
                    {
                      key,
                      lat: Number(sub.lat),
                      lon: Number(sub.lon),
                      uvi,
                      source: "openweather_fallback_manual",
                      updatedAt: Date.now(),
                    },
                    { merge: true }
                  );

                  console.log("[MANUAL UV CACHE SAVE][fallback]", {
                    key,
                    uvi,
                    source: "openweather_fallback_manual",
                  });
                }
              }

              if (uvi == null) uvi = 0;
              const info = getUvInfo(uvi);

              console.log("[MANUAL UV]", {
                docId: doc.id,
                place,
                uvi,
                level: info.level,
                tokenPreview: String(sub.token || "").slice(0, 20),
              });

              if (!info || info.level === 0) return;
              if (!meetsUserThreshold(info.level, sub.threshold)) return;

              await sendUvPush(sub.token, lang, info, uvi, place);

              console.log("[MANUAL UV][SENT]", {
                docId: doc.id,
                place,
                uvi,
                level: info.level,
                tokenPreview: String(sub.token || "").slice(0, 20),
              });
            } catch (err) {
              const removed = await removeInvalidSub(
                doc.ref,
                doc.id,
                err,
                "UV-MANUAL"
              );

              if (removed) return;

              console.error("[MANUAL UV][ERROR]", doc.id, err);
            }
          })()
        );
      }

      await Promise.allSettled(tasks);

      console.log("[MANUAL UV] done");
      return res.json({ ok: true });
    } catch (e) {
      console.error("[MANUAL UV][FATAL]", e);
      return res.status(500).json({
        ok: false,
        error: e?.message || "manual uv error",
      });
    }
  });

// ─────────────────────────────────────────────
// 🧪 TEST MANUAL COMBINAT — NO envia push
// - Simula calor + UV + AEMET
// - Retorna JSON
// - No escriu a Firestore
// - No modifica subs
// ─────────────────────────────────────────────
exports.testCombinedRiskNow = functions
  .region(REGION)
  .https.onRequest(async (req, res) => {
    res.set("Access-Control-Allow-Origin", "*");
    res.set("Access-Control-Allow-Methods", "GET, OPTIONS");
    res.set("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") {
      return res.status(204).end();
    }

    try {
      const lang = normalizeLang(req.query.lang || "ca");

      // Valors simulats per provar sense esperar l'estiu
      const hi = Number(req.query.hi || 34);
      const uvi = Number(req.query.uvi || 7.2);
      const aemetLevel = Number(req.query.aemetLevel || 0);
      const aemetEvent = String(req.query.aemetEvent || "");

      const heatInfo = levelFromINSST(hi);
      const uvInfo = getUvInfo(uvi);

      const combined = buildCombinedRiskMessage({
        lang,
        uvInfo,
        uvi,
        heatInfo,
        hi,
        aemetLevel,
        aemetEvent,
      });

      const hasHeat = heatInfo?.level > 0;
      const hasUv = uvInfo?.level > 0;
      const hasAemet = aemetLevel > 0;

      const summary = {
        hasAemet,
        hasHeat,
        hasUv,
        heatLevel: heatInfo?.level ?? 0,
        uvLevel: uvInfo?.level ?? 0,
        aemetLevel,
        combinedType: combined?.type || null,
        priority:
          hasAemet
            ? "aemet"
            : hasHeat && hasUv
            ? "heat_uv"
            : hasHeat
            ? "heat"
            : hasUv
            ? "uv"
            : "none",
      };

      console.log("[TEST COMBINED RISK]", {
        lang,
        hi,
        uvi,
        aemetLevel,
        aemetEvent,
        heatLevel: heatInfo.level,
        uvLevel: uvInfo.level,
        combined,
        summary,
      });

      return res.status(200).json({
        ok: true,
        mode: "test-only-no-push",
        input: {
          lang,
          hi,
          uvi,
          aemetLevel,
          aemetEvent,
        },
        heatInfo: {
          level: heatInfo.level,
          label: heatInfo[lang] || heatInfo.ca || heatInfo.en || "",
        },
        uvInfo: {
          level: uvInfo.level,
          risk: uvInfo.risk,
        },
        combined,
        summary,
      });
    } catch (e) {
      console.error("[TEST COMBINED RISK][ERROR]", e);

      return res.status(500).json({
        ok: false,
        error: e?.message || "combined risk test error",
      });
    }
  });