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
const LANGS = ["ca", "es", "eu", "gl"];

function levelFromINSST(hi) {
  if (hi >= TH.VERY_HIGH) {
    return {
      level: 3,
      ca: "Nivell 4 INSST – Risc molt alt",
      es: "Nivel 4 INSST – Riesgo muy alto",
      eu: "INSST 4 maila – Arrisku oso handia",
      gl: "Nivel 4 INSST – Risco moi alto",
    };
  }

  if (hi >= TH.HIGH) {
    return {
      level: 2,
      ca: "Nivell 3 INSST – Risc alt",
      es: "Nivel 3 INSST – Riesgo alto",
      eu: "INSST 3 maila – Arrisku handia",
      gl: "Nivel 3 INSST – Risco alto",
    };
  }

  if (hi >= TH.MODERATE) {
    return {
      level: 1,
      ca: "Nivell 2 INSST – Risc moderat",
      es: "Nivel 2 INSST – Riesgo moderado",
      eu: "INSST 2 maila – Arrisku moderatua",
      gl: "Nivel 2 INSST – Risco moderado",
    };
  }

  return {
    level: 0,
    ca: "Nivell 1 INSST – Sense risc apreciable",
    es: "Nivel 1 INSST – Sin riesgo apreciable",
    eu: "INSST 1 maila – Arrisku nabaririk gabe",
    gl: "Nivel 1 INSST – Sen risco apreciable",
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
  const h = d.getHours();
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
    }[lang] ?? "🌡️ ThermoSafe – Avís INSST"
  );
}

const HI_LABEL = {
  ca: "Índex de calor",
  es: "Índice de calor",
  eu: "Bero-indizea",
  gl: "Índice de calor",
};

function makeBody(lang, labelByLang, hi) {
  const label = labelByLang[lang] ?? labelByLang.ca;
  const hiStr = `${Math.round(hi)} °C`;
  const tail =
    {
      ca: "Obre ThermoSafe per recomanacions.",
      es: "Abre ThermoSafe para recomendaciones.",
      eu: "Ireki ThermoSafe gomendioetarako.",
      gl: "Abre ThermoSafe para recomendacións.",
    }[lang] ?? "Open ThermoSafe for tips.";

  return `${label}. ${HI_LABEL[lang] ?? HI_LABEL.ca}: ${hiStr}. ${tail}`;
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
      webpush: {
        notification: {
          title,
          body,
          icon: "/icons/icon-192.png",
          badge: "/icons/badge-72.png",
          tag: "thermosafe-risk",
          renotify: true,
          requireInteraction: true,
          actions: [{ action: "open", title: "Obrir ThermoSafe" }],
          data,
        },
        fcmOptions: { link: "https://thermosafe.app" },
        headers: { TTL: "3600" },
      },
      data,
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
      },
      body: {
        ca: `⚠️ Fred extrem (${windChill.toFixed(1)} °C). Evita exposició prolongada.`,
        es: `⚠️ Frío extremo (${windChill.toFixed(1)} °C). Evita exposición prolongada.`,
        eu: `⚠️ Muturreko hotza (${windChill.toFixed(1)} °C). Saihestu esposizio luzea.`,
        gl: `⚠️ Frío extremo (${windChill.toFixed(1)} °C). Evita exposición prolongada.`,
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
      },
      body: {
        ca: `Fred intens (${windChill.toFixed(1)} °C). Protegeix mans i cara.`,
        es: `Frío intenso (${windChill.toFixed(1)} °C). Protege manos y cara.`,
        eu: `Hotz handia (${windChill.toFixed(1)} °C). Babestu eskuak eta aurpegia.`,
        gl: `Frío intenso (${windChill.toFixed(1)} °C). Protexe mans e cara.`,
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
      },
      body: {
        ca: `Fred moderat (${windChill.toFixed(1)} °C). Usa roba d’abric.`,
        es: `Frío moderado (${windChill.toFixed(1)} °C). Usa ropa de abrigo.`,
        eu: `Hotz moderatua (${windChill.toFixed(1)} °C). Erabili arropa beroa.`,
        gl: `Frío moderado (${windChill.toFixed(1)} °C). Usa roupa de abrigo.`,
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
    webpush: {
      notification: {
        title,
        body,
        icon: "/icons/icon-192.png",
        badge: "/icons/badge-72.png",
        tag: "thermosafe-cold",
        renotify: true,
        requireInteraction: true,
        actions: [{ action: "open", title: "Obrir ThermoSafe" }],
        data,
      },
      fcmOptions: { link: "https://thermosafe.app" },
      headers: { TTL: "3600" },
    },
    data,
  });
}

// ─────────────────────────────────────────────
// Textos i notificacions · vent
// ─────────────────────────────────────────────
function getWindInfo(windKmh) {
  if (windKmh >= 65) {
    return {
      level: 3,
      risk: "extrem",
      title: {
        ca: "🌪️ ThermoSafe – Vent molt fort",
        es: "🌪️ ThermoSafe – Viento muy fuerte",
        eu: "🌪️ ThermoSafe – Haize oso indartsua",
        gl: "🌪️ ThermoSafe – Vento moi forte",
      },
      body: {
        ca: `🌪️ Vent molt fort (${windKmh} km/h). Evita treballs a l’exterior.`,
        es: `🌪️ Viento muy fuerte (${windKmh} km/h). Evita trabajos en el exterior.`,
        eu: `🌪️ Haize oso indartsua (${windKmh} km/h). Saihestu kanpoko lanak.`,
        gl: `🌪️ Vento moi forte (${windKmh} km/h). Evita traballos no exterior.`,
      },
    };
  }

  if (windKmh >= 45) {
    return {
      level: 2,
      risk: "alt",
      title: {
        ca: "💨 ThermoSafe – Vent fort",
        es: "💨 ThermoSafe – Viento fuerte",
        eu: "💨 ThermoSafe – Haize handia",
        gl: "💨 ThermoSafe – Vento forte",
      },
      body: {
        ca: `💨 Vent fort (${windKmh} km/h). Retira objectes solts.`,
        es: `💨 Viento fuerte (${windKmh} km/h). Retira objetos sueltos.`,
        eu: `💨 Haize handia (${windKmh} km/h). Kendu objektu solteak.`,
        gl: `💨 Vento forte (${windKmh} km/h). Retira obxectos soltos.`,
      },
    };
  }

  if (windKmh >= 25) {
    return {
      level: 1,
      risk: "moderat",
      title: {
        ca: "🌬️ ThermoSafe – Vent moderat",
        es: "🌬️ ThermoSafe – Viento moderado",
        eu: "🌬️ ThermoSafe – Haize moderatua",
        gl: "🌬️ ThermoSafe – Vento moderado",
      },
      body: {
        ca: `🌬️ Vent moderat (${windKmh} km/h). Precaució a l’exterior.`,
        es: `🌬️ Viento moderado (${windKmh} km/h). Precaución en el exterior.`,
        eu: `🌬️ Haize moderatua (${windKmh} km/h). Kontuz kanpoan.`,
        gl: `🌬️ Vento moderado (${windKmh} km/h). Precaución no exterior.`,
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
    webpush: {
      notification: {
        title,
        body,
        icon: "/icons/icon-192.png",
        badge: "/icons/badge-72.png",
        tag: "thermosafe-wind",
        renotify: true,
        requireInteraction: true,
        actions: [{ action: "open", title: "Obrir ThermoSafe" }],
        data,
      },
      fcmOptions: { link: "https://thermosafe.app" },
      headers: { TTL: "3600" },
    },
    data,
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
      },
      body: {
        ca: `Índex UV extrem (${uvi.toFixed(1)}). Evita el sol directe.`,
        es: `Índice UV extremo (${uvi.toFixed(1)}). Evita el sol directo.`,
        eu: `UV indize muturrekoa (${uvi.toFixed(1)}). Saihestu eguzki zuzena.`,
        gl: `Índice UV extremo (${uvi.toFixed(1)}). Evita o sol directo.`,
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
      },
      body: {
        ca: `Índex UV molt alt (${uvi.toFixed(1)}). Protecció solar imprescindible.`,
        es: `Índice UV muy alto (${uvi.toFixed(1)}). Protección solar imprescindible.`,
        eu: `UV indize oso altua (${uvi.toFixed(1)}). Eguzki-babesa ezinbestekoa.`,
        gl: `Índice UV moi alto (${uvi.toFixed(1)}). Protección solar imprescindible.`,
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
      },
      body: {
        ca: `Índex UV alt (${uvi.toFixed(1)}). Usa crema solar, gorra i ombra.`,
        es: `Índice UV alto (${uvi.toFixed(1)}). Usa crema solar, gorra y sombra.`,
        eu: `UV indize altua (${uvi.toFixed(1)}). Erabili krema, txapela eta itzala.`,
        gl: `Índice UV alto (${uvi.toFixed(1)}). Usa crema solar, gorra e sombra.`,
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
      },
      body: {
        ca: `Índex UV moderat (${uvi.toFixed(1)}). Recomanable crema solar, gorra i ombra.`,
        es: `Índice UV moderado (${uvi.toFixed(1)}). Recomendable crema solar, gorra y sombra.`,
        eu: `UV indize moderatua (${uvi.toFixed(1)}). Gomendagarria krema, txapela eta itzala.`,
        gl: `Índice UV moderado (${uvi.toFixed(1)}). Recomendable crema solar, gorra e sombra.`,
      },
    };
  }

  return { level: 0, risk: null, title: null, body: null };
}

async function sendUvPush(token, lang, info, uvi, place) {
  if (!info) return;

  const title = info.title?.[lang] ?? info.title?.ca ?? "☀️ ThermoSafe";
  const body =
    info.body?.[lang] ??
    info.body?.ca ??
    `Índex UV (${uvi?.toFixed?.(1) ?? uvi})`;

  const data = {
    url: "https://thermosafe.app",
    type: "uv",
    level: String(info.level),
    lang,
    place: place || "",
    uvi: String(Math.round(Number(uvi) || 0)),
    risk: info.risk || "",
    icon: "/icons/icon-192.png",
    badge: "/icons/badge-72.png",
    tag: "thermosafe-uv",
    title,
    body,
  };

  await admin.messaging().send({
    token,
    notification: {
      title,
      body,
    },
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
    android: {
      priority: "high",
      notification: {
        title,
        body,
      },
    },
    apns: {
      headers: {
        "apns-priority": "10",
      },
      payload: {
        aps: {
          alert: {
            title,
            body,
          },
          sound: "default",
          badge: 1,
        },
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
    }[lang] ?? "🚨 ThermoSafe – Avís oficial";

  const body = `${info.event || "Avís meteorològic actiu"}${place ? " · " + place : ""}`;

  const data = {
    url: "https://thermosafe.app",
    type: "aemet",
    level: String(info.level),
    lang,
    place: place || "",
    event: info.event || "",
  };

  await admin.messaging().send({
    token,
    webpush: {
      notification: {
        title,
        body,
        icon: "/icons/icon-192.png",
        badge: "/icons/badge-72.png",
        tag: "thermosafe-aemet",
        renotify: true,
        requireInteraction: true,
        actions: [{ action: "open", title: "Obrir ThermoSafe" }],
        data,
      },
      fcmOptions: { link: "https://thermosafe.app" },
      headers: { TTL: "3600" },
    },
    data,
  });
}

// ─────────────────────────────────────────────
// 🌦️ CRON METEO UNIFICAT — calor + fred + vent
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

    for (const doc of snap.docs) {
      const sub = doc.data();
      const lang = LANGS.includes(sub.lang) ? sub.lang : "ca";

      tasks.push(
        (async () => {
          try {
            const w = await getWeather(sub.lat, sub.lon);
            if (isQuietHours(now, w.tzOffset)) return;

            const place = sub.place || w.place || "";
            const updates = {};

            // ───────── CALOR ─────────
            const hi = w.temp < 18 ? w.temp : calcHI(w.temp, w.hum);
            const heatInfo = levelFromINSST(hi);
            const prevHeatLevel = Number(sub.lastHeatLevel ?? 0);

            updates.lastHeatLevel = heatInfo.level;

            console.log("[WEATHER][HEAT]", {
              docId: doc.id,
              place,
              temp: w.temp,
              hum: w.hum,
              hi,
              prevLevel: prevHeatLevel,
              nextLevel: heatInfo.level,
              threshold: sub.threshold,
            });

            if (
              shouldNotifyLevelIncrease(prevHeatLevel, heatInfo.level) &&
              meetsUserThreshold(heatInfo.level, sub.threshold)
            ) {
              try {
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
                  },
                  place
                );

                updates.lastHeatAt = now;
                updates.lastNotified = now;
              } catch (sendErr) {
                const removed = await removeInvalidSub(
                  doc.ref,
                  doc.id,
                  sendErr,
                  "WEATHER-HEAT"
                );
                if (removed) return;
                throw sendErr;
              }
            }

            // ───────── FRED ─────────
            const windKmhExact = (w.wind ?? 0) * 3.6;
            const windChill =
              13.12 +
              0.6215 * w.temp -
              11.37 * Math.pow(windKmhExact, 0.16) +
              0.3965 * w.temp * Math.pow(windKmhExact, 0.16);

            const coldInfo = getColdInfo(windChill);
            const prevColdLevel = Number(sub.lastColdLevel ?? 0);

            updates.lastColdLevel = coldInfo.level;

            console.log("[WEATHER][COLD]", {
              docId: doc.id,
              place,
              temp: w.temp,
              windKmh: windKmhExact,
              windChill,
              prevLevel: prevColdLevel,
              nextLevel: coldInfo.level,
              threshold: sub.threshold,
            });

            if (
              coldInfo.level > 0 &&
              shouldNotifyLevelIncrease(prevColdLevel, coldInfo.level) &&
              meetsUserThreshold(coldInfo.level, sub.threshold)
            ) {
              try {
                await sendColdPush(sub.token, lang, coldInfo, windChill, place);

                updates.lastColdAt = now;
                updates.lastNotified = now;
              } catch (sendErr) {
                const removed = await removeInvalidSub(
                  doc.ref,
                  doc.id,
                  sendErr,
                  "WEATHER-COLD"
                );
                if (removed) return;
                throw sendErr;
              }
            }

            // ───────── VENT ─────────
            const windKmh = Math.round((w.wind ?? 0) * 3.6);
            const windInfo = getWindInfo(windKmh);
            const prevWindLevel = Number(sub.lastWindLevel ?? 0);

            updates.lastWindLevel = windInfo.level;

            console.log("[WEATHER][WIND]", {
              docId: doc.id,
              place,
              windKmh,
              prevLevel: prevWindLevel,
              nextLevel: windInfo.level,
              threshold: sub.threshold,
            });

            if (
              windInfo.level > 0 &&
              shouldNotifyLevelIncrease(prevWindLevel, windInfo.level) &&
              meetsUserThreshold(windInfo.level, sub.threshold)
            ) {
              try {
                await sendWindPush(sub.token, lang, windInfo, windKmh, place);

                updates.lastWindAt = now;
                updates.lastNotified = now;
              } catch (sendErr) {
                const removed = await removeInvalidSub(
                  doc.ref,
                  doc.id,
                  sendErr,
                  "WEATHER-WIND"
                );
                if (removed) return;
                throw sendErr;
              }
            }

            await doc.ref.set(updates, { merge: true });
          } catch (e) {
            console.error("cron weather error", doc.id, e);
          }
        })()
      );
    }

    await Promise.allSettled(tasks);
    return null;
  });

// ─────────────────────────────────────────────
// ☀️ CRON UV ROBUST — OpenUV principal + fallback OpenWeather
// - Agrupació per zones
// - Reset nocturn
// - Només notifica si puja de nivell
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
    const uvCache = new Map();
    const weatherCache = new Map();

    function makeZoneKey(lat, lon) {
      return `${Number(lat).toFixed(1)},${Number(lon).toFixed(1)}`;
    }

    for (const doc of snap.docs) {
      const sub = doc.data();
      const lang = LANGS.includes(sub.lang) ? sub.lang : "ca";

      tasks.push(
        (async () => {
          try {
            const zoneKey = makeZoneKey(sub.lat, sub.lon);

            // 1) Weather cache per zona
            let w = weatherCache.get(zoneKey);
            if (!w) {
              w = await getWeather(sub.lat, sub.lon);
              weatherCache.set(zoneKey, w);
            }

            const place = sub.place || w.place || "";
            const localHour = new Date(now + w.tzOffset * 1000).getHours();
            const isNight = localHour < 7 || localHour >= 20;

            console.log("[UV DAYCHECK]", {
              docId: doc.id,
              place,
              zoneKey,
              localHour,
              isNight,
            });

            // 2) Reset nocturn
            if (isNight) {
              const prevLevel = Number(sub.lastUvLevel ?? 0);

              console.log("[UV RESET NIGHT]", {
                docId: doc.id,
                place,
                zoneKey,
                localHour,
                prevLevel,
              });

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
              return;
            }

            // 3) UV cache per zona
            let uvi = uvCache.get(zoneKey);

            if (uvi === undefined) {
              // 3a) OpenUV principal
              uvi = await getUV(sub.lat, sub.lon);

              if (uvi != null) {
                console.log("[UV FETCH ZONE][OpenUV]", {
                  zoneKey,
                  uvi,
                  sampleLat: sub.lat,
                  sampleLon: sub.lon,
                });
              }

              // 3b) Fallback OpenWeather
              if (uvi == null) {
                console.log("[UV FALLBACK] trying OpenWeather", {
                  zoneKey,
                  sampleLat: sub.lat,
                  sampleLon: sub.lon,
                });

                uvi = await getUVfromOpenWeather(sub.lat, sub.lon);

                console.log("[UV FETCH ZONE][OpenWeather]", {
                  zoneKey,
                  uvi,
                  sampleLat: sub.lat,
                  sampleLon: sub.lon,
                });
              }

              // 🔴 fallback final controlat (molt important)
              if (uvi == null) {
                console.warn("[UV NO DATA AFTER FALLBACK]", {
                  zoneKey,
                  sampleLat: sub.lat,
                  sampleLon: sub.lon,
                });
                uvi = 0;
              }

              // guardar a cache
              uvCache.set(zoneKey, uvi);

              } else {
                console.log("[UV CACHE HIT]", {
                  docId: doc.id,
                  place,
                  zoneKey,
                  uvi,
                });
              }

            const info = getUvInfo(uvi);
            const prevLevel = Number(sub.lastUvLevel ?? 0);

            console.log("[UV]", {
              docId: doc.id,
              place,
              zoneKey,
              uvi,
              prevLevel,
              nextLevel: info.level,
              threshold: sub.threshold,
            });

            const updates = {
              lastUvLevel: info.level,
            };

            if (
              info.level > 0 &&
              shouldNotifyLevelIncrease(prevLevel, info.level) &&
              meetsUserThreshold(info.level, sub.threshold)
            ) {
              try {
                await sendUvPush(sub.token, lang, info, uvi, place);

                updates.lastUvAt = now;
                updates.lastNotified = now;

                console.log("[UV SENT]", {
                  docId: doc.id,
                  place,
                  zoneKey,
                  uvi,
                  prevLevel,
                  nextLevel: info.level,
                });
              } catch (sendErr) {
                const removed = await removeInvalidSub(
                  doc.ref,
                  doc.id,
                  sendErr,
                  "UV"
                );

                if (!removed) throw sendErr;
                return;
              }
            }

            await doc.ref.set(updates, { merge: true });
          } catch (e) {
            console.error("cron uv error", doc.id, e);
          }
        })()
      );
    }

    await Promise.allSettled(tasks);
    return null;
  });

// ─────────────────────────────────────────────
// 🚨 CRON AEMET / ALERTES OFICIALS
// ─────────────────────────────────────────────
exports.cronCheckAemetRisk = functions
  .region(REGION)
  .runWith({ secrets: [OPENWEATHER_KEY] })
  .pubsub.schedule("every 60 minutes")
  .timeZone("Europe/Madrid")
  .onRun(async () => {
    const snap = await db.collection("subs").get();
    const subs = snap.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    }));

    const alertsCache = new Map();

    await Promise.allSettled(
      subs.map(async (sub) => {
        try {
          const zoneKey = `${Number(sub.lat).toFixed(1)},${Number(sub.lon).toFixed(1)}`;
          const lang = LANGS.includes(sub.lang) ? sub.lang : "ca";

          let alerts = alertsCache.get(zoneKey);

          if (!alerts) {
            alerts = await getWeatherAlerts(sub.lat, sub.lon);
            alertsCache.set(zoneKey, alerts);
          }

          if (!alerts || alerts.length === 0) return;

          const info = getAemetLevelFromAlerts(alerts);
          if (info.level === 0) return;

          await sendAemetPush(sub.token, lang, info, sub.place || "");
        } catch (err) {
          console.error("cron aemet error", sub.id, err);
        }
      })
    );

    return null;
  });

// ─────────────────────────────────────────────
// Endpoint de prova manual
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

    if (!token) {
      return res.status(400).json({ ok: false, error: "missing token" });
    }

    try {
      let title = "ThermoSafe";
      let body = "🔔 Notificació de prova";
      let tag = "thermosafe-test";

      if (type === "heat") {
        title = "🔥 ThermoSafe – Calor";
        body = "Risc per calor alt. Prova manual.";
        tag = "thermosafe-heat";
      } else if (type === "cold") {
        title = "❄️ ThermoSafe – Fred";
        body = "Fred extrem. Prova manual.";
        tag = "thermosafe-cold";
      } else if (type === "wind") {
        title = "🌬️ ThermoSafe – Vent";
        body = "Vent fort. Prova manual.";
        tag = "thermosafe-wind";
      } else if (type === "uv") {
        title = "☀️ ThermoSafe – UV";
        body = "Índex UV alt. Prova manual.";
        tag = "thermosafe-uv";
      } else if (type === "aemet") {
        title = "🚨 ThermoSafe – Avís oficial";
        body = "Avís oficial actiu. Prova manual.";
        tag = "thermosafe-aemet";
      }

      const payload = {
        token,
        webpush: {
          headers: {
            TTL: "3600",
            Urgency: "high",
          },
          fcmOptions: {
            link: "https://thermosafe.app",
          },
        },
        android: {
          priority: "high",
        },
        apns: {
          headers: {
            "apns-priority": "10",
          },
          payload: {
            aps: {
              sound: "default",
              badge: 1,
            },
          },
        },
        data: {
          title,
          body,
          tag,
          type,
          lang: "ca",
          url: "https://thermosafe.app",
          click_action: "https://thermosafe.app",
          icon: "https://thermosafe.app/icons/icon-192.png",
          badge: "https://thermosafe.app/icons/badge-72.png",
        },
      };

      console.log("[TEST PUSH] sending", {
        type,
        tokenPreview: token.slice(0, 20),
        title,
        body,
      });

      const messageId = await admin.messaging().send(payload);

      console.log("[TEST PUSH] sent OK", {
        messageId,
        type,
        tokenPreview: token.slice(0, 20),
      });

      return res.status(200).json({
        ok: true,
        messageId,
        type,
      });
    } catch (e) {
      console.error("[TEST PUSH] send error", {
        message: e?.message || String(e),
        code: e?.errorInfo?.code || e?.code || "",
        stack: e?.stack || "",
      });

      return res.status(500).json({
        ok: false,
        error: e?.message || "send error",
        code: e?.errorInfo?.code || e?.code || "",
      });
    }
  });

// ─────────────────────────────────────────────
// Endpoint manual per executar cleanup ara
// ─────────────────────────────────────────────
exports.runCleanupNow = functions
  .region(REGION)
  .https.onRequest(async (req, res) => {
    try {
      console.log("[cleanup-manual] start");

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

              console.log("[cleanup-manual] delete", doc.id, why, { lastActivity });
              await doc.ref.delete();
              totalDeleted++;
            }
          });

          await Promise.allSettled(validations);
        }
      }

      const result = { totalChecked, totalDeleted, totalInvalid, totalStale };
      console.log("[cleanup-manual] done", result);
      return res.json({ ok: true, ...result });
    } catch (e) {
      console.error("[cleanup-manual] error", e);
      return res
        .status(500)
        .json({ ok: false, error: e?.message || "cleanup error" });
    }
  });

  // ─────────────────────────────────────────────
// 🧪 TEST MANUAL UV
// ─────────────────────────────────────────────
exports.runUvNow = functions
  .region(REGION)
  .runWith({ secrets: [OPENUV_KEY] })  
  .https.onRequest(async (req, res) => {
    console.log('[MANUAL UV] start');

    const snap = await db.collection('subs').limit(10).get();

    for (const doc of snap.docs) {
      const sub = doc.data();

      const uvi = await getUV(sub.lat, sub.lon);
      const info = getUvInfo(uvi);

      console.log('[MANUAL UV]', {
        place: sub.place,
        uvi,
        level: info.level
      });

console.log("[MANUAL UV] enviant forçat", {
  place: sub.place || "",
  uvi,
  level: info.level,
  tokenPreview: String(sub.token || "").slice(0, 20),
});

await sendUvPush(
  sub.token,
  sub.lang || "ca",
  info || {
    level: 1,
    risk: "test",
    title: {
      ca: "☀️ ThermoSafe – Prova UV",
      es: "☀️ ThermoSafe – Prueba UV",
      eu: "☀️ ThermoSafe – UV proba",
      gl: "☀️ ThermoSafe – Proba UV",
    },
    body: {
      ca: `Prova manual UV (${Number(uvi || 0).toFixed(1)})`,
      es: `Prueba manual UV (${Number(uvi || 0).toFixed(1)})`,
      eu: `Eskuzko UV proba (${Number(uvi || 0).toFixed(1)})`,
      gl: `Proba manual UV (${Number(uvi || 0).toFixed(1)})`,
    },
  },
  uvi,
  sub.place || ""
);

console.log("[MANUAL UV] SENT");
    }

    res.json({ ok: true });
  });

  //emontalvo