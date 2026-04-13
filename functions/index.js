// ─────────────────────────────────────────────
// Imports i setup
// ─────────────────────────────────────────────
const admin = require('firebase-admin');
const functions = require('firebase-functions');
const { defineSecret } = require('firebase-functions/params');
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

admin.initializeApp();
const db = admin.firestore();

// ✅ Secret Manager
const OPENWEATHER_KEY = defineSecret('OPENWEATHER_KEY');
const OPENUV_KEY = defineSecret('OPENUV_KEY');

const REGION = 'europe-west1';

// ─────────────────────────────────────────────
// Neteja de subscripcions velles o invàlides
// ─────────────────────────────────────────────
const INACTIVITY_DAYS = 90;
const PAGE_SIZE = 500;
const VALIDATION_CONC = 100;

function chunk(arr, n) {
  const out = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
}

async function isTokenValid(token) {
  if (!token) return false;
  try {
    await admin.messaging().send(
      {
        token,
        notification: { title: 'ping', body: 'dry-run' },
      },
      true
    );
    return true;
  } catch (e) {
    const msg = String(e?.errorInfo?.code || e?.message || '');
    if (msg.includes('registration-token-not-registered')) return false;
    if (msg.includes('invalid-argument')) return false;
    console.warn('[cleanup] dry-run error no definitiu:', msg);
    return true;
  }
}

function daysBetweenNow(ms) {
  const age = Date.now() - Number(ms || 0);
  return age / (1000 * 60 * 60 * 24);
}

exports.cleanupSubs = functions
  .region(REGION)
  .pubsub.schedule('0 3 * * *')
  .timeZone('Europe/Madrid')
  .onRun(async () => {
    console.log('[cleanup] start');
    let lastDoc = null;
    let totalChecked = 0, totalDeleted = 0, totalInvalid = 0, totalStale = 0;

    while (true) {
      let q = db.collection('subs').orderBy('__name__').limit(PAGE_SIZE);
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

          const last = d.lastNotified ?? d.createdAt ?? 0;
          const stale = daysBetweenNow(last) > INACTIVITY_DAYS;
          const valid = await isTokenValid(token);

          if (!token || !valid || stale) {
            const why = !token ? 'missing token' : (!valid ? 'invalid token' : 'stale');
            if (!valid) totalInvalid++;
            if (stale) totalStale++;
            console.log('[cleanup] delete', doc.id, why);
            await doc.ref.delete();
            totalDeleted++;
          }
        });

        await Promise.allSettled(validations);
      }
    }

    console.log('[cleanup] done', { totalChecked, totalDeleted, totalInvalid, totalStale });
    return null;
  });

// ─────────────────────────────────────────────
// Llindars i helpers generals
// ─────────────────────────────────────────────

// 🔧 Ajustats perquè s’assemblin més a la lògica actual de ThermoSafe
const TH = { MODERATE: 27, HIGH: 32, VERY_HIGH: 41 };

function levelFromINSST(hi) {
  if (hi >= TH.VERY_HIGH) {
    return {
      level: 3,
      ca: 'Nivell 4 INSST – Risc molt alt',
      es: 'Nivel 4 INSST – Riesgo muy alto',
      eu: 'INSST 4 maila – Arrisku oso handia',
      gl: 'Nivel 4 INSST – Risco moi alto'
    };
  }
  if (hi >= TH.HIGH) {
    return {
      level: 2,
      ca: 'Nivell 3 INSST – Risc alt',
      es: 'Nivel 3 INSST – Riesgo alto',
      eu: 'INSST 3 maila – Arrisku handia',
      gl: 'Nivel 3 INSST – Risco alto'
    };
  }
  if (hi >= TH.MODERATE) {
    return {
      level: 1,
      ca: 'Nivell 2 INSST – Risc moderat',
      es: 'Nivel 2 INSST – Riesgo moderado',
      eu: 'INSST 2 maila – Arrisku moderatua',
      gl: 'Nivel 2 INSST – Risco moderado'
    };
  }
  return {
    level: 0,
    ca: 'Nivell 1 INSST – Sense risc apreciable',
    es: 'Nivel 1 INSST – Sin riesgo apreciable',
    eu: 'INSST 1 maila – Arrisku nabaririk gabe',
    gl: 'Nivel 1 INSST – Sen risco apreciable'
  };
}

const LANGS = ['ca', 'es', 'eu', 'gl'];

function calcHI(t, h) {
  const hi = -8.784695 + 1.61139411 * t + 2.338549 * h
    - 0.14611605 * t * h - 0.012308094 * t * t - 0.016424828 * h * h
    + 0.002211732 * t * t * h + 0.00072546 * t * h * h - 0.000003582 * t * t * h * h;
  return Math.round(hi * 10) / 10;
}

function isQuietHours(nowUtcMs, tzOffsetSec) {
  const d = new Date(nowUtcMs + tzOffsetSec * 1000);
  const h = d.getHours();
  return h >= 22 || h < 7;
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
    wind: j.wind?.speed, // m/s
    tzOffset: j.timezone,
    place: j.name || '',
    weatherMain: j.weather?.[0]?.main || '',
    weatherDescription: j.weather?.[0]?.description || ''
  };
}

async function getUV(lat, lon) {
  try {
    const r = await fetch(
      `https://api.openuv.io/api/v1/uv?lat=${lat}&lng=${lon}`,
      { headers: { 'x-access-token': OPENUV_KEY.value() } }
    );
    if (!r.ok) throw new Error(`OpenUV ${r.status}`);
    const j = await r.json();
    return typeof j?.result?.uv === 'number' ? j.result.uv : null;
  } catch (e) {
    console.warn('[uv] error', e?.message || e);
    return null;
  }
}

function meetsUserThreshold(level, userThreshold) {
  const order = { moderate: 1, high: 2, very_high: 3 };
  return level >= (order[userThreshold] ?? 1);
}

function shouldNotifyLevelIncrease(prevLevel, nextLevel) {
  const prev = Number.isFinite(Number(prevLevel)) ? Number(prevLevel) : 0;
  const next = Number.isFinite(Number(nextLevel)) ? Number(nextLevel) : 0;
  return next > prev;
}

// ─────────────────────────────────────────────
// Textos i notificacions · calor
// ─────────────────────────────────────────────
function makeTitle(lang) {
  return ({
    ca: '🌡️ ThermoSafe – Avís INSST',
    es: '🌡️ ThermoSafe – Aviso INSST',
    eu: '🌡️ ThermoSafe – INSST abisua',
    gl: '🌡️ ThermoSafe – Aviso INSST'
  }[lang]) ?? '🌡️ ThermoSafe – Avís INSST';
}

const HI_LABEL = {
  ca: 'Índex de calor',
  es: 'Índice de calor',
  eu: 'Bero-indizea',
  gl: 'Índice de calor'
};

function makeBody(lang, labelByLang, hi) {
  const label = labelByLang[lang] ?? labelByLang.ca;
  const hiStr = `${Math.round(hi)} °C`;
  const tail = ({
    ca: 'Obre ThermoSafe per recomanacions.',
    es: 'Abre ThermoSafe para recomendaciones.',
    eu: 'Ireki ThermoSafe gomendioetarako.',
    gl: 'Abre ThermoSafe para recomendacións.'
  }[lang]) ?? 'Open ThermoSafe for tips.';

  return `${label}. ${HI_LABEL[lang] ?? HI_LABEL.ca}: ${hiStr}. ${tail}`;
}

async function sendPush(token, lang, level, hi, labelByLang, place) {
  if (level === 0) return;

  const title = makeTitle(lang);
  const body = makeBody(lang, labelByLang, hi);

  const data = {
    url: 'https://thermosafe.app',
    type: 'heat',
    level: String(level),
    hi: String(Math.round(hi)),
    lang,
    place: place || ''
  };

  await admin.messaging().send({
    token,
    webpush: {
      notification: {
        title,
        body,
        icon: '/icons/icon-192.png',
        badge: '/icons/badge-72.png',
        tag: 'thermosafe-risk',
        renotify: true,
        requireInteraction: true,
        actions: [{ action: 'open', title: 'Obrir ThermoSafe' }],
        data
      },
      fcmOptions: { link: 'https://thermosafe.app' },
      headers: { TTL: '3600' }
    },
    data
  });
}

// ─────────────────────────────────────────────
// Textos i notificacions · fred
// ─────────────────────────────────────────────
function getColdInfo(windChill) {
  if (windChill <= -10) {
    return {
      level: 3,
      riskLevel: 'extrem',
      title: {
        ca: '❄️ ThermoSafe – Fred extrem',
        es: '❄️ ThermoSafe – Frío extremo',
        eu: '❄️ ThermoSafe – Muturreko hotza',
        gl: '❄️ ThermoSafe – Frío extremo'
      },
      body: {
        ca: `⚠️ Fred extrem (${windChill.toFixed(1)} °C). Evita exposició prolongada.`,
        es: `⚠️ Frío extremo (${windChill.toFixed(1)} °C). Evita exposición prolongada.`,
        eu: `⚠️ Muturreko hotza (${windChill.toFixed(1)} °C). Saihestu esposizio luzea.`,
        gl: `⚠️ Frío extremo (${windChill.toFixed(1)} °C). Evita exposición prolongada.`
      }
    };
  }

  if (windChill <= -5) {
    return {
      level: 2,
      riskLevel: 'alt',
      title: {
        ca: '❄️ ThermoSafe – Fred intens',
        es: '❄️ ThermoSafe – Frío intenso',
        eu: '❄️ ThermoSafe – Hotz handia',
        gl: '❄️ ThermoSafe – Frío intenso'
      },
      body: {
        ca: `Fred intens (${windChill.toFixed(1)} °C). Protegeix mans i cara.`,
        es: `Frío intenso (${windChill.toFixed(1)} °C). Protege manos y cara.`,
        eu: `Hotz handia (${windChill.toFixed(1)} °C). Babestu eskuak eta aurpegia.`,
        gl: `Frío intenso (${windChill.toFixed(1)} °C). Protexe mans e cara.`
      }
    };
  }

  if (windChill <= 4) {
    return {
      level: 1,
      riskLevel: 'moderat',
      title: {
        ca: '🧥 ThermoSafe – Fred moderat',
        es: '🧥 ThermoSafe – Frío moderado',
        eu: '🧥 ThermoSafe – Hotz moderatua',
        gl: '🧥 ThermoSafe – Frío moderado'
      },
      body: {
        ca: `Fred moderat (${windChill.toFixed(1)} °C). Usa roba d’abric.`,
        es: `Frío moderado (${windChill.toFixed(1)} °C). Usa ropa de abrigo.`,
        eu: `Hotz moderatua (${windChill.toFixed(1)} °C). Erabili arropa beroa.`,
        gl: `Frío moderado (${windChill.toFixed(1)} °C). Usa roupa de abrigo.`
      }
    };
  }

  return { level: 0, riskLevel: null, title: null, body: null };
}

async function sendColdPush(token, lang, info, windChill, place) {
  if (!info || info.level === 0) return;

  const title = info.title?.[lang] ?? info.title?.ca ?? '❄️ ThermoSafe';
  const body = info.body?.[lang] ?? info.body?.ca ?? `Fred (${windChill.toFixed(1)} °C)`;

  const data = {
    url: 'https://thermosafe.app',
    type: 'cold',
    level: String(info.level),
    lang,
    place: place || '',
    windChill: String(Math.round(windChill)),
    riskLevel: info.riskLevel || ''
  };

  await admin.messaging().send({
    token,
    webpush: {
      notification: {
        title,
        body,
        icon: '/icons/icon-192.png',
        badge: '/icons/badge-72.png',
        tag: 'thermosafe-cold',
        renotify: true,
        requireInteraction: true,
        actions: [{ action: 'open', title: 'Obrir ThermoSafe' }],
        data
      },
      fcmOptions: { link: 'https://thermosafe.app' },
      headers: { TTL: '3600' }
    },
    data
  });
}

// ─────────────────────────────────────────────
// Textos i notificacions · vent
// ─────────────────────────────────────────────
function getWindInfo(windKmh) {
  if (windKmh >= 65) {
    return {
      level: 3,
      risk: 'extrem',
      title: {
        ca: '🌪️ ThermoSafe – Vent molt fort',
        es: '🌪️ ThermoSafe – Viento muy fuerte',
        eu: '🌪️ ThermoSafe – Haize oso indartsua',
        gl: '🌪️ ThermoSafe – Vento moi forte'
      },
      body: {
        ca: `🌪️ Vent molt fort (${windKmh} km/h). Evita treballs a l’exterior.`,
        es: `🌪️ Viento muy fuerte (${windKmh} km/h). Evita trabajos en el exterior.`,
        eu: `🌪️ Haize oso indartsua (${windKmh} km/h). Saihestu kanpoko lanak.`,
        gl: `🌪️ Vento moi forte (${windKmh} km/h). Evita traballos no exterior.`
      }
    };
  }

  if (windKmh >= 45) {
    return {
      level: 2,
      risk: 'alt',
      title: {
        ca: '💨 ThermoSafe – Vent fort',
        es: '💨 ThermoSafe – Viento fuerte',
        eu: '💨 ThermoSafe – Haize handia',
        gl: '💨 ThermoSafe – Vento forte'
      },
      body: {
        ca: `💨 Vent fort (${windKmh} km/h). Retira objectes solts.`,
        es: `💨 Viento fuerte (${windKmh} km/h). Retira objetos sueltos.`,
        eu: `💨 Haize handia (${windKmh} km/h). Kendu objektu solteak.`,
        gl: `💨 Vento forte (${windKmh} km/h). Retira obxectos soltos.`
      }
    };
  }

  if (windKmh >= 25) {
    return {
      level: 1,
      risk: 'moderat',
      title: {
        ca: '🌬️ ThermoSafe – Vent moderat',
        es: '🌬️ ThermoSafe – Viento moderado',
        eu: '🌬️ ThermoSafe – Haize moderatua',
        gl: '🌬️ ThermoSafe – Vento moderado'
      },
      body: {
        ca: `🌬️ Vent moderat (${windKmh} km/h). Precaució a l’exterior.`,
        es: `🌬️ Viento moderado (${windKmh} km/h). Precaución en el exterior.`,
        eu: `🌬️ Haize moderatua (${windKmh} km/h). Kontuz kanpoan.`,
        gl: `🌬️ Vento moderado (${windKmh} km/h). Precaución no exterior.`
      }
    };
  }

  return { level: 0, risk: null, title: null, body: null };
}

async function sendWindPush(token, lang, info, windKmh, place) {
  if (!info || info.level === 0) return;

  const title = info.title?.[lang] ?? info.title?.ca ?? '🌬️ ThermoSafe';
  const body = info.body?.[lang] ?? info.body?.ca ?? `Vent (${windKmh} km/h)`;

  const data = {
    url: 'https://thermosafe.app',
    type: 'wind',
    level: String(info.level),
    lang,
    place: place || '',
    windKmh: String(windKmh),
    risk: info.risk || ''
  };

  await admin.messaging().send({
    token,
    webpush: {
      notification: {
        title,
        body,
        icon: '/icons/icon-192.png',
        badge: '/icons/badge-72.png',
        tag: 'thermosafe-wind',
        renotify: true,
        requireInteraction: true,
        actions: [{ action: 'open', title: 'Obrir ThermoSafe' }],
        data
      },
      fcmOptions: { link: 'https://thermosafe.app' },
      headers: { TTL: '3600' }
    },
    data
  });
}

// ─────────────────────────────────────────────
// Textos i notificacions · UV
// ─────────────────────────────────────────────
function getUvInfo(uvi) {
  if (uvi == null || Number.isNaN(uvi)) return { level: 0, risk: null, title: null, body: null };

  if (uvi >= 11) {
    return {
      level: 3,
      risk: 'extreme',
      title: {
        ca: '☀️ ThermoSafe – UV extrem',
        es: '☀️ ThermoSafe – UV extremo',
        eu: '☀️ ThermoSafe – UV muturrekoa',
        gl: '☀️ ThermoSafe – UV extremo'
      },
      body: {
        ca: `Índex UV extrem (${uvi.toFixed(1)}). Evita el sol directe.`,
        es: `Índice UV extremo (${uvi.toFixed(1)}). Evita el sol directo.`,
        eu: `UV indize muturrekoa (${uvi.toFixed(1)}). Saihestu eguzki zuzena.`,
        gl: `Índice UV extremo (${uvi.toFixed(1)}). Evita o sol directo.`
      }
    };
  }

  if (uvi >= 8) {
    return {
      level: 2,
      risk: 'very_high',
      title: {
        ca: '☀️ ThermoSafe – UV molt alt',
        es: '☀️ ThermoSafe – UV muy alto',
        eu: '☀️ ThermoSafe – UV oso altua',
        gl: '☀️ ThermoSafe – UV moi alto'
      },
      body: {
        ca: `Índex UV molt alt (${uvi.toFixed(1)}). Protecció solar imprescindible.`,
        es: `Índice UV muy alto (${uvi.toFixed(1)}). Protección solar imprescindible.`,
        eu: `UV indize oso altua (${uvi.toFixed(1)}). Eguzki-babesa ezinbestekoa.`,
        gl: `Índice UV moi alto (${uvi.toFixed(1)}). Protección solar imprescindible.`
      }
    };
  }

  if (uvi >= 6) {
    return {
      level: 1,
      risk: 'high',
      title: {
        ca: '☀️ ThermoSafe – UV alt',
        es: '☀️ ThermoSafe – UV alto',
        eu: '☀️ ThermoSafe – UV altua',
        gl: '☀️ ThermoSafe – UV alto'
      },
      body: {
        ca: `Índex UV alt (${uvi.toFixed(1)}). Usa crema, gorra i ombra.`,
        es: `Índice UV alto (${uvi.toFixed(1)}). Usa crema, gorra y sombra.`,
        eu: `UV indize altua (${uvi.toFixed(1)}). Erabili krema, txapela eta itzala.`,
        gl: `Índice UV alto (${uvi.toFixed(1)}). Usa crema, gorra e sombra.`
      }
    };
  }

  return { level: 0, risk: null, title: null, body: null };
}

async function sendUvPush(token, lang, info, uvi, place) {
  if (!info || info.level === 0) return;

  const title = info.title?.[lang] ?? info.title?.ca ?? '☀️ ThermoSafe';
  const body = info.body?.[lang] ?? info.body?.ca ?? `Índex UV (${uvi?.toFixed?.(1) ?? uvi})`;

  const data = {
    url: 'https://thermosafe.app',
    type: 'uv',
    level: String(info.level),
    lang,
    place: place || '',
    uvi: String(Math.round(uvi)),
    risk: info.risk || ''
  };

  await admin.messaging().send({
    token,
    webpush: {
      notification: {
        title,
        body,
        icon: '/icons/icon-192.png',
        badge: '/icons/badge-72.png',
        tag: 'thermosafe-uv',
        renotify: true,
        requireInteraction: true,
        actions: [{ action: 'open', title: 'Obrir ThermoSafe' }],
        data
      },
      fcmOptions: { link: 'https://thermosafe.app' },
      headers: { TTL: '3600' }
    },
    data
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
      event: '',
      sender: '',
      description: ''
    };
  }

  const first = alerts[0] || {};

  return {
    level: 1,
    event: String(first.event || ''),
    sender: String(first.sender_name || ''),
    description: String(first.description || '')
  };
}

async function sendAemetPush(token, lang, info, place) {
  if (!info || info.level === 0) return;

  const title = '🚨 ThermoSafe – Avís oficial';
  const body = `${info.event || 'Avís meteorològic actiu'}${place ? ' · ' + place : ''}`;

  const data = {
    url: 'https://thermosafe.app',
    type: 'aemet',
    level: String(info.level),
    lang,
    place: place || '',
    event: info.event || ''
  };

  await admin.messaging().send({
    token,
    webpush: {
      notification: {
        title,
        body,
        icon: '/icons/icon-192.png',
        badge: '/icons/badge-72.png',
        tag: 'thermosafe-aemet',
        renotify: true,
        requireInteraction: true,
        actions: [{ action: 'open', title: 'Obrir ThermoSafe' }],
        data
      },
      fcmOptions: {
        link: 'https://thermosafe.app'
      },
      headers: {
        TTL: '3600'
      }
    },
    data
  });
}
// ─────────────────────────────────────────────
// 🌡️ CRON RISC PER CALOR — només si puja de nivell
// ─────────────────────────────────────────────
exports.cronCheckHeatRisk = functions
  .region(REGION)
  .runWith({ secrets: [OPENWEATHER_KEY] })
  .pubsub.schedule('every 30 minutes')
  .timeZone('Europe/Madrid')
  .onRun(async () => {
    const now = Date.now();
    const snap = await db.collection('subs').limit(1000).get();
    if (snap.empty) return null;

    const tasks = [];

    for (const doc of snap.docs) {
      const sub = doc.data();
      const lang = LANGS.includes(sub.lang) ? sub.lang : 'ca';

      tasks.push((async () => {
        try {
          const w = await getWeather(sub.lat, sub.lon);
          if (isQuietHours(now, w.tzOffset)) return;

          const hi = w.temp < 18 ? w.temp : calcHI(w.temp, w.hum);
          const { level, ca, es, eu, gl } = levelFromINSST(hi);
          const prevLevel = Number(sub.lastHeatLevel ?? 0);

          console.log('[HEAT]', {
            docId: doc.id,
            place: sub.place || w.place || '',
            temp: w.temp,
            hum: w.hum,
            hi,
            prevLevel,
            nextLevel: level,
            threshold: sub.threshold
          });

          const updates = {
            lastHeatLevel: level,
          };

          if (
            shouldNotifyLevelIncrease(prevLevel, level) &&
            meetsUserThreshold(level, sub.threshold)
          ) {
            await sendPush(sub.token, lang, level, hi, { ca, es, eu, gl }, sub.place || w.place || '');

            updates.lastHeatAt = now;
            updates.lastNotified = now;
          }

          await doc.ref.set(updates, { merge: true });
        } catch (e) {
          console.error('cron heat error', doc.id, e);
        }
      })());
    }

    await Promise.allSettled(tasks);
    return null;
  });

// ─────────────────────────────────────────────
// ❄️ CRON FRED — només si puja de nivell
// ─────────────────────────────────────────────
exports.cronCheckColdRisk = functions
  .region(REGION)
  .runWith({ secrets: [OPENWEATHER_KEY] })
  .pubsub.schedule('every 30 minutes')
  .timeZone('Europe/Madrid')
  .onRun(async () => {
    const now = Date.now();
    const snap = await db.collection('subs').limit(1000).get();
    if (snap.empty) return null;

    const tasks = [];

    for (const doc of snap.docs) {
      const sub = doc.data();
      const lang = LANGS.includes(sub.lang) ? sub.lang : 'ca';

      tasks.push((async () => {
        try {
          const w = await getWeather(sub.lat, sub.lon);
          if (isQuietHours(now, w.tzOffset)) return;

          const windKmh = (w.wind ?? 0) * 3.6;

          const windChill =
            13.12 + 0.6215 * w.temp
            - 11.37 * Math.pow(windKmh, 0.16)
            + 0.3965 * w.temp * Math.pow(windKmh, 0.16);

          const info = getColdInfo(windChill);
          const prevLevel = Number(sub.lastColdLevel ?? 0);

          console.log('[COLD]', {
            docId: doc.id,
            place: sub.place || w.place || '',
            temp: w.temp,
            windKmh,
            windChill,
            prevLevel,
            nextLevel: info.level,
            threshold: sub.threshold
          });

          const updates = {
            lastColdLevel: info.level,
          };

          if (
            info.level > 0 &&
            shouldNotifyLevelIncrease(prevLevel, info.level) &&
            meetsUserThreshold(info.level, sub.threshold)
          ) {
            await sendColdPush(sub.token, lang, info, windChill, sub.place || w.place || '');

            updates.lastColdAt = now;
            updates.lastNotified = now;
          }

          await doc.ref.set(updates, { merge: true });
        } catch (e) {
          console.error('cron cold error', doc.id, e);
        }
      })());
    }

    await Promise.allSettled(tasks);
    return null;
  });

// ─────────────────────────────────────────────
// 🌬️ CRON VENT — només si puja de nivell
// ─────────────────────────────────────────────
exports.cronCheckWindRisk = functions
  .region(REGION)
  .runWith({ secrets: [OPENWEATHER_KEY] })
  .pubsub.schedule('every 30 minutes')
  .timeZone('Europe/Madrid')
  .onRun(async () => {
    const now = Date.now();
    const snap = await db.collection('subs').limit(1000).get();
    if (snap.empty) return null;

    const tasks = [];

    for (const doc of snap.docs) {
      const sub = doc.data();
      const lang = LANGS.includes(sub.lang) ? sub.lang : 'ca';

      tasks.push((async () => {
        try {
          const w = await getWeather(sub.lat, sub.lon);
          if (isQuietHours(now, w.tzOffset)) return;

          const windKmh = Math.round((w.wind ?? 0) * 3.6);
          const info = getWindInfo(windKmh);
          const prevLevel = Number(sub.lastWindLevel ?? 0);

          console.log('[WIND]', {
            docId: doc.id,
            place: sub.place || w.place || '',
            windKmh,
            prevLevel,
            nextLevel: info.level,
            threshold: sub.threshold
          });

          const updates = {
            lastWindLevel: info.level,
          };

          if (
            info.level > 0 &&
            shouldNotifyLevelIncrease(prevLevel, info.level) &&
            meetsUserThreshold(info.level, sub.threshold)
          ) {
            await sendWindPush(sub.token, lang, info, windKmh, sub.place || w.place || '');

            updates.lastWindAt = now;
            updates.lastNotified = now;
          }

          await doc.ref.set(updates, { merge: true });
        } catch (e) {
          console.error('cron wind error', doc.id, e);
        }
      })());
    }

    await Promise.allSettled(tasks);
    return null;
  });

// ─────────────────────────────────────────────
// ☀️ CRON UV (OpenUV) — només si puja de nivell
// ─────────────────────────────────────────────
exports.cronCheckUvRisk = functions
  .region(REGION)
  .runWith({ secrets: [OPENUV_KEY, OPENWEATHER_KEY] })
  .pubsub.schedule('every 60 minutes')
  .timeZone('Europe/Madrid')
  .onRun(async () => {
    const now = Date.now();
    const snap = await db.collection('subs').limit(1000).get();
    if (snap.empty) return null;

    const tasks = [];

    for (const doc of snap.docs) {
      const sub = doc.data();
      const lang = LANGS.includes(sub.lang) ? sub.lang : 'ca';

      tasks.push((async () => {
        try {
          const uvi = await getUV(sub.lat, sub.lon);
          const info = getUvInfo(uvi);

          // reutilitzam OpenWeather per saber franja horària local i no avisar de matinada
          const w = await getWeather(sub.lat, sub.lon);
          if (isQuietHours(now, w.tzOffset)) return;

          const prevLevel = Number(sub.lastUvLevel ?? 0);

          console.log('[UV]', {
            docId: doc.id,
            place: sub.place || w.place || '',
            uvi,
            prevLevel,
            nextLevel: info.level,
            threshold: sub.threshold
          });

          const updates = {
            lastUvLevel: info.level,
          };

          if (
            info.level > 0 &&
            shouldNotifyLevelIncrease(prevLevel, info.level) &&
            meetsUserThreshold(info.level, sub.threshold)
          ) {
            await sendUvPush(sub.token, lang, info, uvi, sub.place || w.place || '');

            updates.lastUvAt = now;
            updates.lastNotified = now;
          }

          await doc.ref.set(updates, { merge: true });
        } catch (e) {
          console.error('cron uv error', doc.id, e);
        }
      })());
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
  .pubsub.schedule('every 30 minutes')
  .timeZone('Europe/Madrid')
  .onRun(async () => {
    const now = Date.now();
    const snap = await db.collection('subs').limit(1000).get();
    if (snap.empty) return null;

    const tasks = [];

    for (const doc of snap.docs) {
      const sub = doc.data();
      const lang = LANGS.includes(sub.lang) ? sub.lang : 'ca';

      tasks.push((async () => {
        try {
          const w = await getWeather(sub.lat, sub.lon);

          if (isQuietHours(now, w.tzOffset)) return;

          const alerts = await getWeatherAlerts(sub.lat, sub.lon);
          const info = getAemetLevelFromAlerts(alerts);

          const prevLevel = Number(sub.lastAemetLevel ?? 0);

          console.log('[AEMET]', {
            docId: doc.id,
            prevLevel,
            nextLevel: info.level,
            event: info.event
          });

          const updates = {
            lastAemetLevel: info.level
          };

          if (info.level > prevLevel) {
            await sendAemetPush(
              sub.token,
              lang,
              info,
              sub.place || w.place || ''
            );

            updates.lastAemetAt = now;
            updates.lastNotified = now;
          }

          await doc.ref.set(updates, { merge: true });

        } catch (e) {
          console.error('cron aemet error', doc.id, e);
        }
      })());
    }

    await Promise.allSettled(tasks);
    return null;
  });

// ─────────────────────────────────────────────
// Endpoint de prova manual
// ─────────────────────────────────────────────
exports.sendTestNotification = functions
  .region(REGION)
  .https.onRequest(async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
    if (req.method === 'OPTIONS') return res.status(204).end();

    const token = String(req.query.token || '');
    const type = String(req.query.type || 'heat');

    if (!token) return res.status(400).json({ ok: false, error: 'missing token' });

    try {
      let title = 'ThermoSafe';
      let body = '';

      if (type === 'heat') body = '🔥 Risc per calor alt';
      else if (type === 'cold') body = '❄️ Fred extrem';
      else if (type === 'wind') body = '🌬️ Vent fort';
      else if (type === 'uv') body = '☀️ Índex UV alt';

      await admin.messaging().send({
        token,
        notification: { title, body },
        webpush: { fcmOptions: { link: 'https://thermosafe.app' } }
      });

      res.json({ ok: true });
    } catch (e) {
      console.error(e);
      res.status(500).json({ ok: false, error: e?.message || 'send error' });
    }
  });