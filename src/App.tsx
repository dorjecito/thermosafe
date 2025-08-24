/* ───────────────────────────────────────────
   src/App.tsx  —  100 % camins relatius
   ─────────────────────────────────────────── */

   import React, { useEffect, useState } from 'react';
   import { useTranslation } from 'react-i18next';
   import './i18n';
   
   
   /* —— serveis ———————————————————————————— */
   import { getWeatherByCoords, getWeatherByCity } from './services/weatherAPI';
   import { getUVI } from './services/uviAPI';
   
   /* —— utilitats ——————————————————————————— */
   import { getLocationNameFromCoords } from './utils/getLocationNameFromCoords';
   import { getHeatRisk } from './utils/heatRisk';
   
   /* —— components ————————————————————————— */
   import LocationDisplay     from './components/LocationDisplay';
   import RiskLevelDisplay    from './components/RiskLevelDisplay';
   import Recommendations     from './components/Recommendations';
   import UVAdvice            from './components/UVAdvice';
   import UVScale             from './components/UVScale';
   
   /* —— analítica (opcional) ———————————— */
   import { inject } from '@vercel/analytics';
   inject()

   //console.log("FB opts:", firebaseApp.options); // ha de mostrar apiKey i projectId

   import LanguageSwitcher from './components/LanguageSwitcher';
   import { enableRiskAlerts, disableRiskAlerts } from "./push/subscribe";

   
   


/* ──────── constants & helpers ──────── */
const calcHI = (t: number, h: number) => {
  /* Heat-Index – Rothfusz regression */
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
};

const isDaytime = () => {
  const h = new Date().getHours();
  const m = new Date().getMonth();
  const summer = m >= 5 && m <= 8; // juny–set.
  return summer ? h >= 7 && h <= 20 : h >= 8 && h <= 18;
};

// ── Llindars per INSST (ajusta si cal)
const TH = { MODERATE: 31, HIGH: 38, VERY_HIGH: 46 } as const;

// Envia la prova/push quan HI ≥ MODERAT
async function sendIfAtLeastModerate(hi: number | null) {
  if (hi == null) return;
  if (hi < TH.MODERATE) return;

  const token = localStorage.getItem("fcmToken");
  if (!token) return;

  try {
    // ⚠️ Substitueix REGIO-PROJECTE pel teu (ex: europe-west1-thermosafe-58f46)
    const url = `https://europe-west1-thermosafe-58f46.cloudfunctions.net/sendTestNotification?token=${encodeURIComponent(token)}`;
    await fetch(url);
    console.log("Notificació enviada ✅ (HI ≥ moderat)");
  } catch (err) {
    console.error("Error enviant notificació:", err);
  }
}


const fetchSolarIrr = async (lat: number, lon: number, d: string) => {
  try {
     const cleanDate = d.replaceAll("-", ""); // elimina els guions → "20250824"
  const url = 
    `https://power.larc.nasa.gov/api/temporal/daily/point?parameters=ALLSKY_SFC_SW_DWN&start=${cleanDate}` +
    `&end=${cleanDate}&latitude=${lat}&longitude=${lon}&format=JSON&community=re`;
    const r = await fetch(url);
    const j = await r.json();
    return j.properties.parameter.ALLSKY_SFC_SW_DWN[d] ?? null;
  } catch {
    return null;
  }
};

type Level = "moderate" | "high" | "very_high";
type Lang  = "ca" | "es" | "eu" | "gl";

async function registerSW() {
  if (!("serviceWorker" in navigator)) return null;
  return navigator.serviceWorker.register("/firebase-messaging-sw.js", { scope: "/" });
}
async function askNotificationPermission(): Promise<boolean> {
  if (!("Notification" in window)) return false;
  const res = await Notification.requestPermission();
  return res === "granted";
}


async function getCoords(): Promise<{ lat: number; lon: number } | null> {
  if (!("geolocation" in navigator)) return null;
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
      () => resolve(null),
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 }
    );
  });
}

/** Activa avisos i desa subscripció a Firestore */
/*async function enableRiskAlerts({ threshold = "moderate", lang }: { threshold?: Level; lang?: Lang } = {}) {
  console.log('[PUSH] start enableRiskAlerts');

  const granted = await askNotificationPermission();
  console.log('[PUSH] permission:', granted);
  if (!granted) throw new Error("Has denegat el permís de notificacions");

  const loc = await getCoords();
  console.log('[PUSH] coords:', loc);
  if (!loc) throw new Error("No s'ha pogut obtenir la ubicació (GPS)");

  const swReg = await registerSW();
  console.log('[PUSH] swReg ok?', !!swReg);
  const messaging = await messagingPromise;
  console.log('[PUSH] messaging available?', !!messaging);
  if (!messaging || !swReg) throw new Error("El navegador no suporta Web Push");

  let token: string | null = null;
  try {
    token = await getToken(messaging, {
      vapidKey: "BNh8R1YOsrnV58xNBIOVi-aMIYCvTsPpdmn7hcKJ3lldQUZ8BF6qP_wEa84TnIwZ765YQxHGWc7fAdpegzgH184",
      serviceWorkerRegistration: swReg,
    });
    console.log('[PUSH] getToken OK:', token);
  } catch (e: any) {
    console.error('[PUSH] getToken ERROR:', e?.code, e?.message || e);
    throw new Error(e?.message || 'Error a getToken()');
  }
  if (!token) throw new Error("No s'ha obtingut token FCM");

  localStorage.setItem("fcmToken", token);

  const navLang = ((lang ?? (navigator.language || "ca").slice(0, 2)) as Lang);
  const langNorm: Lang = (["ca", "es", "eu", "gl"] as Lang[]).includes(navLang) ? navLang : "ca";

  await setDoc(doc(db, "subs", token), {
    token,
    lat: loc.lat,
    lon: loc.lon,
    threshold,
    lang: langNorm,
    lastNotified: null,
    createdAt: Date.now(),
  }, { merge: true });

  onMessage(messaging, (p) => console.log("[PUSH] foreground message:", p));
  return token;
} */


/** Desactiva avisos: elimina el document de Firestore amb aquest token */
/*async function disableRiskAlerts(token: string | null) {
  if (!token) return;
  await deleteDoc(doc(db, "subs", token));
  // ✅ netejar local
  localStorage.removeItem("fcmToken");
}

/* 🔁 Aquestes funcions ja estan definides a push/subscribe.ts
   i no cal duplicar-les aquí a App.tsx.

async function enableRiskAlerts(...) { ... }

async function disableRiskAlerts(...) { ... }

*/

/* ──────── component ──────── */
export default function App() {
  /* i18next */
  const { t, i18n } = useTranslation();
  useEffect(() => {
  const browserLang = navigator.language.slice(0, 2).toLowerCase();
  const supportedLangs = ['ca', 'es', 'gl', 'eu'];
  const lang = supportedLangs.includes(browserLang) ? browserLang : 'ca';

  if (i18n.language !== lang) {
    i18n.changeLanguage(lang);
  }
}, []); 


  /* state */
  const [temp, setTemp] = useState<number | null>(null);
  const [hum, setHum] = useState<number | null>(null);
  const [hi, setHi] = useState<number | null>(null);
  const [irr, setIrr] = useState<number | null>(null);
  const [uvi, setUvi] = useState<number | null>(null);
  const [wind, setWind] = useState<number | null>(null); // km/h
  const [wc, setWc] = useState<number | null>(null); // wind-chill

  const [city, setCity] = useState<string | null>(null);
  const [realCity, setRealCity] = useState('');
  const [err, setErr] = useState('');
  const [input, setInput] = useState('');
  const [leg, setLeg] = useState(false);
  const [day, setDay] = useState(isDaytime());

// --- ESTAT PUSH ---
const [pushEnabled, setPushEnabled] = useState(false);
const [pushToken,   setPushToken]   = useState<string | null>(null);
const [busy,        setBusy]        = useState(false);
const [msg,         setMsg]         = useState<string | null>(null);

async function onTogglePush(next: boolean) {
  setBusy(true);
  setMsg(null);
  try {
    if (next) {
      const token = await enableRiskAlerts({ threshold: "moderate" });
      setPushEnabled(true);
      setPushToken(token);
      setMsg(t('push.enabled'));
    } else {
      await disableRiskAlerts(pushToken);
      setPushEnabled(false);
      setPushToken(null);
      setMsg(t('push.disabled'));
    }
    
  } catch (e: any) {
    console.error(e);
    const key =
      e?.message?.includes('permís') ? 'permissionDenied' :
      e?.message?.includes('GPS')     ? 'noGps' :
      e?.message?.includes('Push')    ? 'notSupported' :
      e?.message?.includes('token')   ? 'noToken' :
      null;
  
    setMsg(key ? t(`push.errors.${key}`) : (e?.message ?? t('error_generic')));
  }
}

  /* auto-refresh */
  useEffect(() => {
    locate();
    const id1 = setInterval(() => locate(true), 30 * 60 * 1000);
    const id2 = setInterval(() => setDay(isDaytime()), 10 * 60 * 1000);
    return () => {
      clearInterval(id1);
      clearInterval(id2);
    };
  }, []);

  /* helpers */
  const updateAll = async (
    tp: number,
    hm: number,
    fl: number,
    lat: number,
    lon: number,
    nm: string,
    silent = false,
  ) => {
    const today = new Date().toISOString().split('T')[0];
    const ir = await fetchSolarIrr(lat, lon, today);
    const uv = await getUVI(lat, lon);

    setTemp(tp);
    setHum(hm);
    setIrr(ir);
    setUvi(uv);
    setCity(nm);

    /*  🔒 CLAMP HEAT-INDEX  🔒
   • Si la temperatura real (tp) és <18 °C ➜ no hi ha risc de calor,
     usem directament tp com a “hi”.
   • Només amb ≥18 °C apliquem la fórmula (si hi ha prou humitat). */
const hiVal =
  tp < 18
    ? tp
    : Math.abs(fl - tp) < 1 && hm > 60
        ? calcHI(tp, hm)
        : fl;

    setHi(hiVal);
sendIfAtLeastModerate(hiVal);
    if (!silent) setErr('');
  };

  const locate = (silent = false) => {
    navigator.geolocation.getCurrentPosition(
      async (p) => {
        try {
          const { latitude: lat, longitude: lon } = p.coords;
          const d = await getWeatherByCoords(lat, lon);
          const nm = (await getLocationNameFromCoords(lat, lon)) || d.name;

          /* wind & wind-chill */
          setWind(Math.round(d.wind.speed * 3.6 * 10) / 10);
          setWc(null);

          await updateAll(d.main.temp, d.main.humidity, d.main.feels_like, lat, lon, nm, silent);
          setInput('');
          setRealCity('');
        } catch {
          !silent && setErr(t('errorGPS'));
        }
      },
      () => !silent && setErr(t('errorNoLocation')),
    );
  };

  const search = async () => {
    if (!input.trim()) {
      setErr(t('errorCity'));
      return;
    }
    try {
      const d = await getWeatherByCity(input);
      const { lat, lon } = d.coord;
      const nm = (await getLocationNameFromCoords(lat, lon)) || d.name;

      /* wind */
      const wKmh = Math.round(d.wind.speed * 3.6 * 10) / 10;
      setWind(wKmh);

      /* wind-chill (temperatura ≤ 10 °C & vent ≥ 5 km/h) */
      if (d.main.temp <= 10 && wKmh >= 5) {
        const wcVal =
          13.12 +
          0.6215 * d.main.temp -
          11.37 * Math.pow(wKmh, 0.16) +
          0.3965 * d.main.temp * Math.pow(wKmh, 0.16);
        setWc(Math.round(wcVal * 10) / 10);
      } else {
        setWc(null);
      }

      await updateAll(d.main.temp, d.main.humidity, d.main.feels_like, lat, lon, nm);
      setRealCity(nm);
      setInput('');
    } catch {
      setErr(t('errorCity'));
    }
  };

  /* ──────── render ──────── */
  const safeLangUV = ['ca', 'es', 'eu', 'gl'].includes(i18n.language) ? i18n.language : undefined;

async function onTogglePush(next: boolean) {
  setBusy(true);
  setMsg(null);

  try {
    if (next) {
      // Passa el llindar i la llengua actual
      const token = await enableRiskAlerts({
        threshold: "moderate",              // "moderate" | "high" | "very_high"
        lang: (i18n.language as any)        // "ca" | "es" | "eu" | "gl"
      });

      setPushEnabled(true);
      setPushToken(token);
      setMsg(t("push.enabled"));
      console.log("[PUSH] enabled. token:", token);
    } else {
      await disableRiskAlerts(pushToken);
      setPushEnabled(false);
      setPushToken(null);
      setMsg(t("push.disabled"));
      console.log("[PUSH] disabled");
    }
  } catch (e: any) {
    console.error("[PUSH] toggle error:", e);
    // Mapeig d’errors a claus de traducció
    const m = String(e?.message || "");
    const key =
      m.includes("permís") || m.toLowerCase().includes("permission") ? "permissionDenied" :
      m.includes("GPS")                                             ? "noGps" :
      m.toLowerCase().includes("push") ||
      m.toLowerCase().includes("service worker")                    ? "notSupported" :
      m.toLowerCase().includes("token")                             ? "noToken" :
      "error_generic";

    setMsg(t(`push.errors.${key}`));
  } finally {
    setBusy(false);
  }
}

useEffect(() => {
  const tok = localStorage.getItem("fcmToken");
  if (tok) {
    setPushEnabled(true);
    setPushToken(tok);
  }
}, []);


 return (
  
  <div className="container">
    {/* 🔄 Selector d’idioma */}
    <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "1rem" }}>
      <LanguageSwitcher />
    </div>

    <h1>{t('title')}</h1>

    {/* 🔍 SEARCH */}
    <div style={{ marginBottom: '1rem' }}>
      <input
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder={t('search_placeholder')}
      />
      <button onClick={search}>{t('search_button')}</button>
      <div style={{ marginTop: '1rem' }}>
        <button onClick={() => locate(false)}>{t('gps_button')}</button>
      </div>
    </div>

    {/* 🔔 AVISOS PER RISC DE CALOR */}
    <div style={{ margin: '0.5rem 0 1rem 0', display: 'flex', alignItems: 'center', gap: 8 }}>
      <input
        type="checkbox"
        id="ts-push"
        checked={pushEnabled}
        disabled={busy}
        onChange={(e) => onTogglePush(e.target.checked)}
      />
      <label htmlFor="ts-push">{t('push.label')}</label>
    </div>
    {msg && <p style={{ marginTop: '-0.5rem', fontSize: '.9rem' }}>{msg}</p>}

    {/* ⚠️ ALERTES */}
    {hi !== null && hi >= 18 && getHeatRisk(hi).isHigh && (
      <div className="alert-banner">
        {getHeatRisk(hi).isExtreme ? t('alert_extreme') : t('alertRisk')}
      </div>
    )}

    {irr !== null && irr >= 8 && (
      <div className="alert-banner">
        <p>{t('highIrradianceWarning')}</p>
        <p>{t('irradianceTips')}</p>
      </div>
    )}

    {/* 🌡️ DADES */}
    {temp !== null && hum !== null ? (
      <>
        {city && (
          <LocationDisplay
            city={city}
            realCity={realCity}
            lang={i18n.language === 'es' ? 'es' : 'ca'}
            label={t('location')}
          />
        )}

        <p>{t('humidity')}: {hum}%</p>

        <p>
          {t('feels_like')}: <strong>{temp >= 20 ? hi : (wc ?? hi)} °C</strong>
        </p>

        <p>{t('measured_temp')}: {temp} °C</p>

        {/* 💨 VENT */}
        {wind !== null && (
          <p>{t('wind')}: {wind.toFixed(1)} km/h</p>
        )}

        {irr !== null && (
          <div style={{ marginTop: '1rem', textAlign: 'center' }}>
            <p>{t('irradiance')}: <strong>{irr} kWh/m²/dia</strong></p>

            <div style={{ marginTop: '1.2rem' }}>
              <h3 style={{ marginBottom: '0.4rem' }}>🔆 {t('solarProtection')}</h3>
              <button
                onClick={() => setLeg(!leg)}
                style={{
                  backgroundColor: '#222',
                  border: '1px solid #444',
                  padding: '8px 16px',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  color: 'white',
                  fontSize: '0.9rem',
                }}
              >
                ℹ️ {t('toggleLegend')}
              </button>
            </div>

            {leg && (
              <p style={{ fontSize: '.85rem', marginTop: '0.5rem' }}>
                {t('irradianceLegend')}
              </p>
            )}
          </div>
        )}

        {uvi !== null && day && (
          <UVAdvice uvi={uvi} lang={i18n.language as any} />
        )}

        <div style={{ marginTop: '1.5rem' }}>
          <RiskLevelDisplay
            temp={hi!}
            lang={i18n.language as any}
            className={`risk-level ${getHeatRisk(hi!).class}`}
          />
        </div>

        <Recommendations
          temp={hi!}
          lang={i18n.language as any}
          isDay={day}
        />

        {['ca', 'es', 'eu', 'gl'].includes(i18n.language) && <UVScale lang={i18n.language as any} />}
      </>
    ) : (
      !err && <p>{t('loading')}</p>
    )}

    {err && <p style={{ color: 'red' }}>{err}</p>}
  </div>
);
}