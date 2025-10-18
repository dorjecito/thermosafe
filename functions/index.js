// ─────────────────────────────────────────────
// Imports i setup
// ─────────────────────────────────────────────
const admin = require('firebase-admin');
const functions = require('firebase-functions');

admin.initializeApp();
const db = admin.firestore();

const OPENWEATHER_KEY = functions.config().openweather?.key;
const REGION = 'europe-west1';

// ─────────────────────────────────────────────
// Neteja de subscripcions velles o invàlides
// ─────────────────────────────────────────────
const INACTIVITY_DAYS = 90;    // elimina subs sense activitat en ≥90 dies
const PAGE_SIZE = 500;         // lectura paginada de Firestore
const VALIDATION_CONC = 100;   // validacions FCM en paral·lel

function chunk(arr, n) {
  const out = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
}

// Valida un token SENSE enviar cap push (dry run)
async function isTokenValid(token) {
  if (!token) return false;
  try {
    await admin.messaging().send(
      {
        token,
        notification: { title: 'ping', body: 'dry-run' },
      },
      /* dryRun = */ true
    );
    return true;
  } catch (e) {
    const msg = String(e?.errorInfo?.code || e?.message || '');
    // Tokens clarament invàlids:
    if (msg.includes('registration-token-not-registered')) return false;
    if (msg.includes('invalid-argument')) return false;
    // Altres errors puntuals de xarxa → considera'ls vàlids
    console.warn('[cleanup] dry-run error no definitiu:', msg);
    return true;
  }
}

function daysBetweenNow(ms) {
  const age = Date.now() - Number(ms || 0);
  return age / (1000 * 60 * 60 * 24);
}

// Executa cada dia a les 03:00 (hora Madrid)
exports.cleanupSubs = functions
  .region(REGION)                 // p.ex. 'europe-west1'
  .pubsub.schedule('0 3 * * *')   // cron diari 03:00
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

      // Validació tokens en lots
      for (const batch of chunk(docs, VALIDATION_CONC)) {
        const validations = batch.map(async (doc) => {
          const d = doc.data() || {};
          const token = d.token;
          totalChecked++;

          // regla d'inactivitat (últim avís o creació)
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
// Llindars INSST
// ─────────────────────────────────────────────
const TH = { MODERATE: 31, HIGH: 38, VERY_HIGH: 46 }; // °C

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

// ─────────────────────────────────────────────
// Auxiliars
// ─────────────────────────────────────────────
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

function yyyyMMdd(nowUtcMs, tzOffsetSec) {
  const d = new Date(nowUtcMs + tzOffsetSec * 1000);
  const y = d.getFullYear();
  const m = `${d.getMonth() + 1}`.padStart(2, '0');
  const day = `${d.getDate()}`.padStart(2, '0');
  return `${y}-${m}-${day}`;
}

async function getWeather(lat, lon) {
  const url = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${OPENWEATHER_KEY}&units=metric`;
  const r = await fetch(url);
  if (!r.ok) throw new Error(`OpenWeather ${r.status}`);
  const j = await r.json();
  return {
    temp: j.main?.temp,
    hum: j.main?.humidity,
    feels: j.main?.feels_like,
    tzOffset: j.timezone
  };
}

function meetsUserThreshold(level, userThreshold) {
  const order = { moderate: 1, high: 2, very_high: 3 };
  return level >= order[userThreshold];
}

// ─────────────────────────────────────────────
/** Helpers per texts */
// ─────────────────────────────────────────────
function makeTitle(lang) {
  return ({
    ca: '🌡️ ThermoSafe – Avís INSST',
    es: '🌡️ ThermoSafe – Aviso INSST',
    eu: '🌡️ ThermoSafe – INSST abisua',
    gl: '🌡️ ThermoSafe – Aviso INSST'
  }[lang]) ?? '🌡️ ThermoSafe – Avís INSST';
}

// etiqueta “índex de calor” per idioma
const HI_LABEL = {
  ca: 'Índex de calor',
  es: 'Índice de calor',
  eu: 'Bero‑indizea',
  gl: 'Índice de calor'
};

// ❗️IMPORTANT: el body NO afegeix municipi (va a data.place)
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

// ─────────────────────────────────────────────
/** PUSH: payload xulo (place només a DATA) */
// ─────────────────────────────────────────────
async function sendPush(token, lang, level, hi, labelByLang, place) {
  if (level === 0) return;

  const title = makeTitle(lang);
  const body = makeBody(lang, labelByLang, hi); // ← sense municipi

  const data = {
    url: 'https://thermosafe.app',
    level: String(level),
    hi: String(Math.round(hi)),
    lang,
    place: place || '' // ← el SW el mostrarà com a prefix
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
        actions: [
          { action: 'open', title: lang === 'es' ? 'Abrir ThermoSafe' : lang === 'eu' ? 'Ireki ThermoSafe' : lang === 'gl' ? 'Abrir ThermoSafe' : 'Obrir ThermoSafe' },
          { action: 'tips', title: lang === 'es' ? 'Ver recom.' : lang === 'eu' ? 'Gomendioak' : lang === 'gl' ? 'Ver recom.' : 'Veure recom.' }
        ],
        data
      },
      fcmOptions: { link: 'https://thermosafe.app' },
      headers: { TTL: '3600' }
    },
    data
  });
}

// ─────────────────────────────────────────────
/** CRON programat (cada 30 min) */
// ─────────────────────────────────────────────
exports.cronCheckHeatRisk = functions
  .region(REGION)
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
          const hi = w.temp < 18 ? w.temp :
            (Math.abs(w.feels - w.temp) < 1 && w.hum > 60) ? calcHI(w.temp, w.hum) : w.feels;

          const { level, ca, es, eu, gl } = levelFromINSST(hi);

          if (isQuietHours(now, w.tzOffset)) return;
          const today = yyyyMMdd(now, w.tzOffset);
          if (sub.lastNotifiedDay === today) return;

          if (!meetsUserThreshold(level, sub.threshold)) return;

          await sendPush(sub.token, lang, level, hi, { ca, es, eu, gl }, sub.place);
          await doc.ref.set({ lastNotified: now, lastNotifiedDay: today }, { merge: true });
        } catch (e) {
          console.error('cron sub error', doc.id, e);
        }
      })());
    }

    await Promise.allSettled(tasks);
    return null;
  });

// ─────────────────────────────────────────────
/** Endpoint de prova manual */
// ─────────────────────────────────────────────
exports.sendTestNotification = functions
  .region(REGION)
  .https.onRequest(async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
    if (req.method === 'OPTIONS') return res.status(204).end();

    const token = String(req.query.token || '');
    const lang  = String((req.query.lang || 'ca')).slice(0, 2);
    const hi    = Number(req.query.hi || 33);
    const place = String(req.query.place || '');

    if (!token) return res.status(400).json({ ok: false, error: 'missing token' });

    try {
      const { level, ca, es, eu, gl } = levelFromINSST(hi);
      await sendPush(token, ['ca','es','eu','gl'].includes(lang) ? lang : 'ca', level, hi, { ca, es, eu, gl }, place);
      res.json({ ok: true, level });
    } catch (e) {
      console.error(e);
      res.status(500).json({ ok: false, error: e?.message || 'send error' });
    }
  });