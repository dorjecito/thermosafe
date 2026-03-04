/* ───────────────────────────────────────────
   src/App.tsx  —  100 % camins relatius
   ─────────────────────────────────────────── */
   import React, { useEffect, useRef, useState } from 'react';
   import { useTranslation } from 'react-i18next';
   import './i18n';
  
 /* ── serveis ── */
import {
  getWeatherByCity,
  getWeatherByCoords,
  getWeatherAlerts,
  getWindDirection,
} from "./services/weatherService";

import { getUVFromOpenUV } from "./services/openUV";
   
   /* —— utilitats ——————————————————————————— */
   import { getLocationNameFromCoords } from './utils/getLocationNameFromCoords';
   import { getHeatRisk } from './utils/heatRisk';
   import {windDegToCardinal16 as windDegreesToCardinal16,
   windArrowRotation as getWindRotationFromDegrees,
   } from "./utils/windDirections";
   import { getWindRisk, WIND_COLORS, type WindRisk } from "./utils/windRisk";
   import { buildAemetAiAlert, translateAemetAuto, type LangKey } from "./utils/aemetAi";
   import { getCoords } from "./utils/geolocation";


   /* —— components ————————————————————————— */
   //import LocationDisplay     from './components/LocationDisplay';
   //import RiskLevelDisplay    from './components/RiskLevelDisplay';
   import Recommendations     from './components/Recommendations';
   import UVAdvice            from './components/UVAdvice';
   import UVScale             from './components/UVScale';
   import LocationCard from "./components/LocationCard";
   import SafetyActions from "./components/SafetyActions";
   import UVSafeTime from "./components/UVSafeTime";
   import UVDetailPanel from "./components/UVDetailPanel";
   //import SkinTypeSelect, { type SkinType } from "./components/SkinTypeSelect";
   import SkinTypeInfo, { type SkinType } from "./components/SkinTypeInfo";
   


   
   /* —— analítica (opcional) ———————————— */
   import { inject } from '@vercel/analytics';
   inject()

   import LanguageSwitcher from './components/LanguageSwitcher';
   import { enableRiskAlerts, disableRiskAlerts } from "./push/subscribe";
   import { getThermalRisk } from "./utils/getThermalRisk";
   import { useSmartActivity } from "./hooks/useSmartActivity";
   //import { getUvLevel, getUvText, getUvAdvice } from "./utils/uv";
   

   /* ============================================================
   🔥 Risc de calor + activitat
   ============================================================ */

// Ordre de risc de calor (coherent amb getHeatRisk)
const HEAT_RISK_LEVELS = [
  "heat_safe",
  "heat_mild",
  "heat_moderate",
  "heat_high",
  "heat_extreme",
] as const;

type HeatRiskKey = (typeof HEAT_RISK_LEVELS)[number];

type ActivityLevel = "rest" | "walk" | "moderate" | "intense";


// Quants nivells puja cada activitat
const ACTIVITY_BOOST: Record<ActivityLevel, number> = {
  rest: 0,
  walk: 1,
  moderate: 2,
  intense: 3,
};

/**
 * Ajusta el risc de calor segons el nivell d’activitat.
 * Exemple:
 *   base: heat_mild + activity "moderate" → heat_high
 */
function applyActivityToHeatRisk(baseRisk: string, activity: ActivityLevel): string {
  // Si el risc no és de calor, el deixam igual
  if (!baseRisk.startsWith("heat_")) return baseRisk;

  const idx = HEAT_RISK_LEVELS.indexOf(baseRisk as HeatRiskKey);
  if (idx === -1) return baseRisk;

  const boost = ACTIVITY_BOOST[activity] ?? 0;
  const newIdx = Math.min(idx + boost, HEAT_RISK_LEVELS.length - 1);

  return HEAT_RISK_LEVELS[newIdx];
}

function useStableValue<T>(value: T, delay = 800): T {
  const [stable, setStable] = useState(value);

  useEffect(() => {
    const id = setTimeout(() => setStable(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);

  return stable;
}

function normalizeLang(lng: string): "ca" | "es" | "eu" | "gl" | "en" {
  const s = lng.slice(0, 2);
  if (s === "ca" || s === "es" || s === "eu" || s === "gl" || s === "en" ) return s;
  return "ca";
}

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

// =========================
// 🌞 Funció d'hores de dia segons estació
// =========================

export function isDaytime(): boolean {
  const d = new Date();
  const day = d.getDate();
  const month = d.getMonth(); // gener=0, juny=5...

  // Estiu real: 21/6 → 23/9
  const isSummer =
    (month === 5 && day >= 21) || // juny des del 21
    month === 6 ||                // juliol
    month === 7 ||                // agost
    (month === 8 && day <= 23);   // setembre fins 23

  const hour = d.getHours();

  if (isSummer) {
    return hour >= 7 && hour < 19;  // estiu
  } else {
    return hour >= 8 && hour < 18;  // hivern
  }
}

// =========================
// 🌍 Dia/nit REAL segons la ciutat consultada (timezone + sunrise/sunset)
// =========================
function isDayAtLocation(
  nowUtcSec: number,
  timezoneOffsetSec: number,
  sunriseUtcSec?: number,
  sunsetUtcSec?: number
): boolean {
  // fallback: si no tenim sunrise/sunset, assumim "dia" (o el que tu vulguis)
  if (!sunriseUtcSec || !sunsetUtcSec) return true;

  const localNow = nowUtcSec + timezoneOffsetSec;
  const localSunrise = sunriseUtcSec + timezoneOffsetSec;
  const localSunset = sunsetUtcSec + timezoneOffsetSec;

  return localNow >= localSunrise && localNow < localSunset;
}

// =========================
// 🌞 Funció central UV amb control estacional
// =========================

// =========================
// 🌞 Funció central UV (bloqueja OpenUV si és nit A LA CIUTAT)
// =========================
async function safeUVFetch(
  lat: number,
  lon: number,
  isDay: boolean
): Promise<number | null> {

  if (!isDay) {
  console.log("[UV] Nit a la ubicació consultada → no es consulta OpenUV");
  return 0; // UV nocturn = 0
}

  try {
    console.log("[UV] És de dia a la ubicació → consultant OpenUV…");
    const uv = await getUVFromOpenUV(lat, lon);
    return typeof uv === "number" ? uv : null;
  } catch (err) {
    console.error("[UV] Error consultant OpenUV:", err);
    return null;
  }
}


// ── Llindars per INSST (adaptats)
const TH = { MODERATE: 27, HIGH: 32, VERY_HIGH: 41 } as const;

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

async function askNotificationPermission(): Promise<boolean> {
  if (!("Notification" in window)) return false;
  const res = await Notification.requestPermission();
  return res === "granted";
}

const formatAlertTime = (unixSeconds: number, lang: string) => {
  const d = new Date(unixSeconds * 1000);
  return d.toLocaleString(lang, {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const isAlertActiveNow = (start: number, end: number) => {
  const now = Date.now() / 1000;
  return now >= start && now <= end;
};

/* ──────── component ──────── */
export default function App() {
  /* i18next */
  const [loading, setLoading] = useState(false);
  const { t, i18n } = useTranslation();

  // 🧴 Fototip (1–6)
  type SkinType = 1 | 2 | 3 | 4 | 5 | 6;
  const [skinType, setSkinType] = useState<SkinType>(3);
  const [showSkinInfo, setShowSkinInfo] = useState(false);
  

  // ✅ Traducció segura: si falta la clau, torna un fallback llegible
  const tr = (key: string, fallback: string) => {
    const out = t(key);
    return out && out !== key ? out : fallback;
  };

  const langUI = i18n.language; // ex: "en", "en-US", "ca"

  const getRemainingTime = (endUnix: number, lang: string) => {
    const now = Date.now() / 1000;
    const diff = Math.floor(endUnix - now);

    if (diff <= 0) return t("alert_time.ended");

    const hours = Math.floor(diff / 3600);
    const minutes = Math.floor((diff % 3600) / 60);

    if (hours > 0) return t("alert_time.remaining_hours", { hours, minutes });

    return t("alert_time.remaining_minutes", { minutes });
  

  
}

/* 🔔 Estat global per activar/desactivar alertes meteorològiques */
const [notificationsEnabled, setNotificationsEnabled] = useState<boolean>(() => {
  try {
    const stored = localStorage.getItem("notificationsEnabled");
    return stored ? JSON.parse(stored) : true;   // per defecte: activat
  } catch {
    return true;
  }
});

// Desa la preferència quan canvïi
useEffect(() => {
  localStorage.setItem(
    "notificationsEnabled",
    JSON.stringify(notificationsEnabled)
  );
}, [notificationsEnabled]);

  useEffect(() => {
  const browserLang = navigator.language?.slice(0, 2) || "ca";

  const supportedLangs = ["ca", "es", "eu", "gl", "en"];

  const lang = supportedLangs.includes(browserLang)
    ? browserLang
    : "ca";

  if (i18n.language !== lang) {
    i18n.changeLanguage(lang);
  }
}, []); 



// --- Recupera l'estat del push i preferències al carregar la PWA ---
useEffect(() => {
    const savedPush = localStorage.getItem("pushEnabled");
    if (savedPush === "true") {
        setPushEnabled(true);
    }

    const savedCold = localStorage.getItem("enableColdAlerts");
    if (savedCold !== null) setEnableColdAlerts(JSON.parse(savedCold));

    const savedUv = localStorage.getItem("enableUvAlerts");
    if (savedUv !== null) setEnableUvAlerts(JSON.parse(savedUv));

    const savedWind = localStorage.getItem("enableWindAlerts");
    if (savedWind !== null) setEnableWindAlerts(JSON.parse(savedWind));
}, []);

// 🌀 Estat i refs per a risc de vent
const [windRisk, setWindRisk] = useState<WindRisk>('none');
//const lastWindRiskRef = useRef<WindRisk>('none');
const [enableWindAlerts, setEnableWindAlerts] = useState<boolean>(() => {
  try {
    return JSON.parse(localStorage.getItem('enableWindAlerts') || 'true');
  } catch {
    return true;
  }
});

// 🧊 Estat i preferència per a risc de fred
const [enableColdAlerts, setEnableColdAlerts] = useState<boolean>(() => {
  try {
    return JSON.parse(localStorage.getItem('enableColdAlerts') || 'false');
  } catch {
    return false;
  }
});

// 🌞 Estat i preferència per a risc UV
const [enableUvAlerts, setEnableUvAlerts] = useState<boolean>(() => {
  try {
    return JSON.parse(localStorage.getItem('enableUvAlerts')!) || false;
  } catch {
    return false;
  }
});

// --- ESTAT PUSH ---
const [pushEnabled, setPushEnabled] = useState(false);
const [pushToken, setPushToken] = useState<string | null>(null);
const [busy, setBusy] = useState(false);

// Guarda automàticament totes les preferències quan canvien
useEffect(() => {
    localStorage.setItem("enableWindAlerts", JSON.stringify(enableWindAlerts));
}, [enableWindAlerts]);

useEffect(() => {
    localStorage.setItem("enableColdAlerts", JSON.stringify(enableColdAlerts));
}, [enableColdAlerts]);

useEffect(() => {
    localStorage.setItem("enableUvAlerts", JSON.stringify(enableUvAlerts));
}, [enableUvAlerts]);

useEffect(() => {
    localStorage.setItem("pushEnabled", JSON.stringify(pushEnabled));
}, [pushEnabled]);

// Tradueix etiqueta risc vent
const windRiskLabel = (r: WindRisk) =>
  r === 'none' ? t('no_risk_wind') : t('wind_' + r);


  /* state */
  const [forecast, setForecast] = useState<any | null>(null);
  const [data, setData] = useState<any | null>(null);
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
  const [day, setDay] = useState(true);
  const [coldRisk, setColdRisk] = useState<'cap' | 'lleu' | 'moderat' | 'alt' | 'molt alt' | 'extrem'>('cap');
  const [windDeg, setWindDeg] = useState<number | null>(null);
  const [effForCold, setEffForCold] = useState<number | null>(null);
  const [windKmh, setWindKmh] = useState<number | null>(null);
  const [lat, setLat] = useState<number | null>(null);
  const [lon, setLon] = useState<number | null>(null);

// ☁️ Estat del cel
const [sky, setSky] = useState<string>('');
const [icon, setIcon] = useState<string>('');

// 🛰️ Font de les dades (GPS o cerca manual)
const [dataSource, setDataSource] = useState<'gps' | 'search' | null>(null);

// Font actual (GPS o cerca manual)
const [currentSource, setCurrentSource] = useState<'gps' | 'search'>('gps');
const [showSource, setShowSource] = useState(false);

// Token per ignorar respostes antigues que arribin tard
const latestRequestRef = useRef<{ source: 'gps' | 'search'; id: number }>({ source: 'gps', id: 0 });

const [windDirection, setWindDirection] = useState<string>('');

const [alerts, setAlerts] = useState<any[]>([]);

const [ready, setReady] = useState(false);

//const [activityEnabled, setActivityEnabled] = useState(false);

const COLD_COLORS = {
  cap: "#d9d9d9",      // gris: cap risc
  lleu: "#76b0ff",     // blau suau
  moderat: "#4a90e2",  // blau mitjà
  alt: "#1f5fbf",      // blau fosc
  "molt alt": "#123c80",
  extrem: "#0a2754",
};

 const {
  level: activityLevel,
  delta: activityDelta,
  enabled: activityEnabled,
  requesting: activityRequesting,
  error: activityError,
  activate,
  deactivate,              
} = useSmartActivity();

const activityLevelStable = useStableValue(activityLevel, 800);
const activityDeltaStable = useStableValue(activityDelta, 800);

const ACTIVITY_LABELS: Record<string, string> = {
  rest: "Repòs",
  low: "Caminar",
  moderate: "Esforç moderat",
  high: "Còrrer",
  unknown: "Detectant…"
};

const ACTIVITY_ICONS: Record<string, string> = {
  rest: "🧘",
  low: "🚶",
  moderate: "🏃",
  high: "🏃‍♂️💨",
  unknown: "🔄"
};

const ACTIVITY_COLORS: Record<string, string> = {
  rest: "#6c757d",
  low: "#2f9e44",
  moderate: "#f08c00",
  high: "#d6336c",
  unknown: "#6c757d"
};

// 🔔 Demana permís de notificació automàticament
useEffect(() => {
  if (typeof window !== "undefined" && "Notification" in window) {
    if (Notification.permission === "default") {
      Notification.requestPermission().then((perm) => {
        console.log(`[DEBUG] Permís de notificacions: ${perm}`);
      });
    } else {
      console.log(`[DEBUG] Permís ja establert: ${Notification.permission}`);
    }
  }
}, []);

// 🔁 Mostra "Font: ..." uns segons quan canvia l'origen de dades
useEffect(() => {
  if (!currentSource) return;

  console.log(`[DEBUG] Font canviada: ${currentSource}`);
  setShowSource(true);

  const timer = setTimeout(() => {
    setShowSource(false);
  }, 5000); // amaga el missatge després de 5 segons

  return () => clearTimeout(timer);
}, [currentSource]);

type ColdRisk =
  | "cap"
  | "lleu"
  | "moderat"
  | "alt"
  | "molt alt"
  | "extrem";

/** === RISC PER FRED · VERSIÓ PRO === */
function getColdRisk(tempEff: number | null, windKmh: number | null): ColdRisk {
  // Validació mínima
  if (tempEff === null || isNaN(tempEff)) return "cap";

  // 🧊 PRIORITAT: només risc si fa fred de debò (≤ 0°C)
  if (tempEff > 0) return "cap";

  // Classificació científica segons temperatura efectiva (wind-chill real)
  if (tempEff <= -40) return "extrem";     // Mort en minuts (Dudinka, Yakutia, Alaska)
  if (tempEff <= -25) return "molt alt";   // Frostbite molt ràpid
  if (tempEff <= -15) return "alt";        // Risc sever si s'està a l'exterior
  if (tempEff <= -5)  return "moderat";    // Risc moderat segons exposició
  if (tempEff <= 0)   return "lleu";       // Llegendament perillós

  return "cap";
} 

/* === [COLD] notifier amb cooldown (multilingüe i sense error await) === */
const COLD_ALERT_MIN_INTERVAL_MIN = 60; // 1 hora

async function maybeNotifyCold(temp: number, windKmh: number) {
  // Evita fer res si no està activat l’avís
  if (!enableColdAlerts) return;

// 🧊 Calcula risc de fred per notificació
const coldRiskValue = getColdRisk(temp, windKmh);
setColdRisk(coldRiskValue as ColdRisk);

  // Cooldown per evitar notificacions massa seguides
  const now = Date.now();
  const lastColdAlert = Number(localStorage.getItem('lastColdAlert')) || 0;
  if (now - lastColdAlert < COLD_ALERT_MIN_INTERVAL_MIN * 60 * 1000) return;

  // 🔹 Envia notificació si hi ha qualsevol risc (lleu, moderada, alt, molt alt o extrem)
  if (
    coldRiskValue === "lleu" ||
    coldRiskValue === "moderat" ||
    coldRiskValue === "alt" ||
    coldRiskValue === "molt alt" ||
    coldRiskValue === "extrem"
  ) {
    const title = `❄️ ${t('notify.coldTitle')}`;
const msg = t('notify.coldBody', {
  risk: t(`coldRisk.${coldRiskValue}`),
  temp: temp.toFixed(1)
});

showBrowserNotification(title, msg);
localStorage.setItem('lastColdAlert', now.toString());
console.log(`[DEBUG] Notificació fred enviada (${coldRiskValue})`);
  } else {
    console.log("[DEBUG] Condicions sense risc per fred: notificació no enviada");
  }
}

 /* === [WIND] notifier amb cooldown (versió definitiva) === */
const WIND_ALERT_MIN_INTERVAL_MIN = 60; // 1 hora

async function maybeNotifyWind(kmh: number) {
  // No fem res si no està activat l'avís
  if (!enableWindAlerts) return;

  const risk = getWindRisk(kmh);
  setWindRisk(risk);

  const prev = (localStorage.getItem('lastWindRisk') as WindRisk) || 'none';
  const lastAt = Number(localStorage.getItem('lastWindAlertAt') || '0');
  const cooldownOk = (Date.now() - lastAt) / 60000 >= WIND_ALERT_MIN_INTERVAL_MIN;

  const rank: Record<WindRisk, number> = {
    none: 0,
    breezy: 1,
    moderate: 2,
    strong: 3,
    very_strong: 4,
  };

   const crossedUp = rank[risk] > rank[prev] && rank[risk] >= rank['moderate'];



  // --- Mostra notificació si risc puja i no hi ha cooldown ---
if (crossedUp && cooldownOk) {
  const title = `💨 ${t('notify.windTitle')}`;
  const msg = t('notify.windBody', {
  risk: t('windRisk.' + risk),
  speed: kmh.toFixed(1)
});

  showBrowserNotification(title, msg);
  localStorage.setItem('lastWindAlertAt', Date.now().toString());
  localStorage.setItem('lastWindRisk', risk);
  console.log(`[DEBUG] Notificació de vent enviada (${risk})`);
}

  if (prev !== risk) {
    localStorage.setItem('lastWindRisk', risk);
  }
}

/* === [UV] Notificador segons índex UV (robust) === */
async function maybeNotifyUV(uvi: number | null) {
  if (!pushEnabled || uvi == null) return;

  const title = tr("notify.uvTitle", "☀️ Índex UV");

  if (uvi >= 8) {
    showBrowserNotification(title, tr("notify.uvVeryHigh", "🚨 UV molt alt. Protecció imprescindible."));
  } else if (uvi >= 6) {
    showBrowserNotification(title, tr("notify.uvHigh", "⚠️ UV alt. Crema, gorra i ombra."));
  } else if (uvi >= 3) {
    showBrowserNotification(title, tr("notify.uvModerate", "🟡 UV moderat. Protegeix-te si estàs al sol."));
  }
}

// Missatges independents
const [msgHeat, setMsgHeat] = useState<string | null>(null);
const [msgCold, setMsgCold] = useState<string | null>(null);
const [msgWind, setMsgWind] = useState<string | null>(null);

async function onTogglePush(next: boolean) {
  setBusy(true);

  // ✅ no mostram textos d'estat (enabled/disabled)
  setMsgHeat(null);

  try {
    if (next) {
      const token = await enableRiskAlerts({ threshold: "moderate" });
      setPushEnabled(true);
      setPushToken(token);
      // ❌ eliminat: setMsgHeat(t("push.enabled"));
    } else {
      await disableRiskAlerts(pushToken);
      setPushEnabled(false);
      setPushToken(null);
      // ❌ eliminat: setMsgHeat(t("push.disabled"));
    }
  } catch (e: any) {
    console.error(e);

    const key =
      e?.message?.includes("permís") ? "permissionDenied" :
      e?.message?.includes("GPS") ? "noGps" :
      e?.message?.includes("Push") ? "notSupported" :
      e?.message?.includes("token") ? "noToken" :
      null;

    // ✅ només errors visibles
    setMsgHeat(key ? t(`push.errors.${key}`) : (e?.message ?? t("error_generic")));
  } finally {
    setBusy(false);
  }
}

/* === CONFIGURACIÓ GENERAL === */
const API_KEY = "ebd4ce67a42857776f4463c756e18b45"; // 🔑 substitueix per la teva clau real
const lang = i18n.resolvedLanguage?.slice(0,2) || "ca";



/* === FETCH WEATHER (ciutat cercada) === */
const fetchWeather = async (cityName: string) => {
  try {
    setLoading(true);
    setCurrentSource("search");

    const data = await getWeatherByCity(cityName, lang, API_KEY);
    // 🌞 Dia/nit REAL per la ciutat (no per Mallorca)
    const newLat = data.coord?.lat ?? null;
    const newLon = data.coord?.lon ?? null;
    const nowUtc = Math.floor(Date.now() / 1000);
    const tz = data.timezone ?? 0;           // segons (OpenWeather)
    const sunrise = data.sys?.sunrise;       // UTC seconds
    const sunset = data.sys?.sunset;         // UTC seconds
    setDay(isDayAtLocation(nowUtc, tz, sunrise, sunset));


    // 🌡 Temperatures bàsiques
    const tempReal = data.main.temp;
    setTemp(tempReal);
    setHi(data.main.feels_like);
    setHum(data.main.humidity);

    // 💨 Vent: calcula un cop i reutilitza
    const wKmH = data.wind.speed * 3.6;
    setWind(wKmH);
    setWindKmh(wKmH);

    const deg = data.wind.deg ?? null;
    setWindDeg(deg);
    setWindDirection(windDegreesToCardinal16(deg, lang));

    // ❄️ WIND-CHILL per ciutat cercada
    let effForCold = tempReal;          // per defecte, la real
    let wcVal: number | null = null;

    // Càlcul oficial només si ≤10 ºC i vent ≥5 km/h
    if (tempReal <= 10 && wKmH >= 5) {
      wcVal =
        13.12 +
        0.6215 * tempReal -
        11.37 * Math.pow(wKmH, 0.16) +
        0.3965 * tempReal * Math.pow(wKmH, 0.16);

      wcVal = Math.round(wcVal * 10) / 10;
      effForCold = wcVal;               // la “percebuda” passa a ser el wind-chill
    }

    // Guarda wind-chill + temperatura efectiva
    setWc(wcVal);
    setEffForCold(effForCold);

    // ❄️ Calcula RISC PER FRED segons temperatura efectiva i vent
    const coldRiskValue = getColdRisk(effForCold, wKmH);
    setColdRisk(coldRiskValue as ColdRisk);


    // ❄️ 3) Calcula RISC PER FRED només si fa fred de veritat
    let computedColdRisk = "cap";

    if (effForCold <= 5) {
      computedColdRisk = getColdRisk(effForCold, wKmH);
    }

    setColdRisk(computedColdRisk as ColdRisk);


    // 🌤 Cel i icona
    const rawDesc = (data.weather?.[0]?.description || "").trim();

    const normalize = (s: string) => s.trim().toLowerCase();
    const humanize = (s: string) => s.replace(/_/g, " "); // per mostrar-ho bé si no hi ha traducció

    const candidates = [
      normalize(rawDesc),                 // "few clouds"
      normalize(humanize(rawDesc)),       // "lleugerament ennuvolat" (si et ve amb _)
    ];

    let finalSky = humanize(rawDesc); // fallback per defecte (sense "_")

    for (const k of candidates) {
      const keyPath = `weather_desc.${k}`;
      const out = t(keyPath);

      // ✅ Accepta només si REALMENT ha traduït (normalment el valor és diferent i capitalitzat)
      if (out && out !== keyPath && out !== k && out !== rawDesc) {
        finalSky = out;
        break;
      }
    }

    setSky(finalSky);
    setIcon(data.weather?.[0]?.icon || "");

// ✅ Coordenades reals de la ciutat cercada (OpenWeather)
if (newLat != null && newLon != null) {
  setLat(newLat);
  setLon(newLon);

  // 🟣 UVI (OpenUV) per la ciutat cercada
  const uv = await getUVFromOpenUV(newLat, newLon);
  console.log("[SEARCH] UV rebut:", uv);
  setUvi(uv);

  console.log("[DEBUG] Coordenades ciutat cercada:", newLat, newLon);

  // ⚠️ Avisos oficials per la ciutat cercada
  const alerts = await getWeatherAlerts(newLat, newLon, lang, API_KEY);
  setAlerts(alerts || []);
} else {
  setUvi(null);
  setAlerts([]);
}

  } catch (err) {
    console.error("[DEBUG] Error obtenint dades:", err);
    setErr("Error obtenint dades de ciutat");
  } finally {
    setLoading(false);
  }
};

  /* 🌍 Auto-refresh i inicialització segura de localització */
useEffect(() => {
  const initLocate = async () => {
    try {
      // Espera que React i i18n estiguin inicialitzats
      await new Promise((res) => setTimeout(res, 500));

      if (!("geolocation" in navigator)) {
        console.warn("[WARN] Geolocalització no disponible al navegador.");
        return;
      }

      // Comprova permisos de geolocalització
      const perm = await navigator.permissions.query({ name: "geolocation" as PermissionName });

      if (perm.state === "granted") {
        console.log("[DEBUG] Permís GPS ja concedit → ubicació inicial");
        await locate();
      } else if (perm.state === "prompt") {
        console.log("[DEBUG] Demanant permís de GPS a l'usuari...");
        navigator.geolocation.getCurrentPosition(
          async () => await locate(),
          (err) => console.warn("[WARN] Permís de geolocalització rebutjat:", err)
        );
      } else {
        console.warn("[WARN] Permís de geolocalització denegat o restringit.");
      }
    } catch (e) {
      console.error("[DEBUG] Error inicialitzant localització:", e);
    }
  };

  // Executa només al primer render
  initLocate();

  // ♻️ Auto-refresh cada 30 min + actualització dia/nit cada 10 min
  const id1 = setInterval(() => locate(true), 30 * 60 * 1000);
  const id2 = setInterval(() => {
  if (!data) return;
  const nowUtc = Math.floor(Date.now() / 1000);
  const tz = data.timezone ?? 0;
  const sunrise = data.sys?.sunrise;
  const sunset = data.sys?.sunset;
  setDay(isDayAtLocation(nowUtc, tz, sunrise, sunset));
}, 10 * 60 * 1000);


  return () => {
    clearInterval(id1);
    clearInterval(id2);
  };
}, [lang]);

// 💨 Actualitza el risc de vent quan canvia la velocitat i envia avís si és fort
useEffect(() => {
  if (wind !== null) {
    const risk = getWindRisk(wind);
    setWindRisk(risk);
  } else {
    setWindRisk('none');
  }
}, [wind]);

/* 🌍 HELPER: Actualitza dades generals sense sobreescriure el cel */
const updateAll = async (
  tp: number,
  hm: number,
  fl: number,
  lat: number,
  lon: number,
  nm: string,
  silent = false,
) => {

  // 🎨 Colors per consola
  const colorReset = "\x1b[0m";
  const colorYellow = "\x1b[33m";
  const colorGreen = "\x1b[32m";
  const colorCyan = "\x1b[36m";

  // ⛔ Evita sobreescriure l’estat del cel si la crida antiga (GPS) arriba després d’una cerca manual
  if (currentSource === 'search' && nm !== city) {
    console.log(
      `${colorYellow}⚠️ [updateAll] Ignorat: resposta antiga de GPS (actualment: ${city}, rebut: ${nm})${colorReset}`
    );
    return;
  }

  // 🟢 Log quan s'executa correctament
  console.log(
    `${colorGreen}📡 [updateAll] Executat per ${currentSource.toUpperCase()} → ciutat: ${nm} (${lat?.toFixed(
      2
    )}, ${lon?.toFixed(2)})${colorReset}`
  );



  setTemp(tp);
  setHum(hm);
  setCity(nm);

// ☀️ Obté irradiància i índex UV (OpenWeather + NASA POWER)
try {
  const today = new Date().toISOString().split("T")[0];

  const ir = await fetchSolarIrr(lat, lon, today);
  const uv = await safeUVFetch(lat, lon, day);
setUvi(uv ?? null);
await maybeNotifyUV(uv);

} catch (err) {
  console.error("[DEBUG] Error obtenint IR/UV a updateAll:", err);
}

  /* 🌡️ CLAMP HEAT-INDEX */
  const hiVal =
    tp < 18
      ? tp
      : Math.abs(fl - tp) < 1 && hm > 60
      ? calcHI(tp, hm)
      : fl;

  setHi(hiVal);
  //sendIfAtLeastModerate(hiVal);
  if (!silent) setErr('');

  console.log(`${colorCyan}✅ [updateAll] Dades actualitzades correctament per ${nm}${colorReset}`);
};

/* 📍 LOCALITZACIÓ ACTUAL */
const locate = async (silent = false) => {
  try {
    if (!silent) setLoading(true);
    setCurrentSource("gps");
    setInput('');

    // 📍 1. Obté coordenades del dispositiu
    const position = await new Promise<GeolocationPosition>((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject);
    });

    const lat = position.coords.latitude;
const lon = position.coords.longitude;

// ✅ PUNT 4: desa coordenades a l’estat global (per components com UVSafeTime)
setLat(lat);
setLon(lon);

console.log(`[DEBUG] Coordenades GPS obtingudes: ${lat}, ${lon}`);

// 🌦️ // 2. Obté dades del temps per coordenades
const d = await getWeatherByCoords(lat, lon, lang, API_KEY);
setData(d);
setDataSource("gps");

// 🌞 Dia/nit REAL per la ubicació GPS (timezone + sunrise/sunset)
const nowUtc = Math.floor(Date.now() / 1000);
const tz = d.timezone ?? 0;
const sunrise = d.sys?.sunrise;
const sunset = d.sys?.sunset;
setDay(isDayAtLocation(nowUtc, tz, sunrise, sunset));

// 🌞 Obté UVI d’OpenWeather
const uv = await safeUVFetch(lat, lon, day);
setUvi(uv);
console.log("[DEBUG] UVI actual (nou):", uv);
console.log("[TEST] Tipus UV (nou):", typeof uv, "Valor:", uv);

// Meteo bàsica
setTemp(d.main?.temp ?? null);
setHum(d.main?.humidity ?? null);
setHi(d.main?.feels_like ?? null);

// Opcional: si tens irradiació o altres camps
// setIrr(d.main?.pressure ?? null);
// setUvi(null);

// 🔍 Mostra per consola per verificar
console.log(`[DEBUG] Temperatura: ${d.main?.temp}°C, Humitat: ${d.main?.humidity}%, Sensació: ${d.main?.feels_like}°C`);

    // 📍 3. Nom de ciutat (nom real segons coordenades)
let nm = "";

if (lat != null && lon != null) {
  try {
    nm = (await getLocationNameFromCoords(lat, lon)) || "";

    // Retry només si realment ha tornat buit
   nm = nm?.trim() || d.name || "Ubicació desconeguda";

    console.log(`[DEBUG] Ciutat trobada per coordenades: ${nm}`);
  } catch (e) {
    console.warn("[WARN] Error obtenint nom de ciutat:", e);
  }
}

// Fallback final
nm = nm || d.name || "Ubicació desconeguda";

setCity(nm);
setRealCity(nm);

// ✅ Desa sempre abans del render
setCity(nm);
setRealCity(nm);
setDataSource("gps");

function normalizeSky(desc: string): string {
  return desc
    .toLowerCase()
    .normalize("NFD")                      // separa accents
    .replace(/[\u0300-\u036f]/g, "")       // elimina accents
    .replace(/\s+/g, "_")                  // espais → _
    .replace(/[^\w_]/g, "")                // elimina caràcters rars
    .trim();
}

const rawDesc = d.weather?.[0]?.description || "";
const key = normalizeSky(rawDesc);

// Si existeix al JSON → traducció
// Si no existeix → fa servir el text normalitzat sense warnings
const translatedDesc = t(`weather_desc.${key}`, key);

setSky(translatedDesc);
setIcon(d.weather?.[0]?.icon || "");
console.log(`[SKY – locate] Actualitzat a: ${translatedDesc}`);

/* ────────────────────────────────────────────────
   🌬️ VENT + ❄️ FRED (WINDCHILL & COLD RISK)
   Bloc complet, net i infal·lible
─────────────────────────────────────────────────── */

// --- RESET COMPLET ABANS DE LA CONSULTA ---
setTemp(null);
setWc(null);
setColdRisk(null as any);

// 🌡️ Temperatura real i sensació tèrmica (GPS)
setTemp(d.main.temp);
setHi(d.main.feels_like);
setHum(d.main.humidity);

// 💨 Conversió de vent
const wKmH = Math.round((d.wind.speed ?? 0) * 3.6 * 10) / 10;
setWind(wKmH);
setWindKmh(wKmH);
setWindDirection(getWindDirection(d.wind.deg));
setWindDeg(d.wind.deg);

// ❄️ 6. Wind-chill real
let tempReal = d.main.temp;
let effForCold = tempReal;
let wcVal: number | null = null;

if (tempReal <= 10 && wKmH >= 5) {
  wcVal =
    13.12 +
    0.6215 * tempReal -
    11.37 * Math.pow(wKmH, 0.16) +
    0.3965 * tempReal * Math.pow(wKmH, 0.16);

  wcVal = Math.round(wcVal * 10) / 10;
}

if (wcVal !== null) {
  effForCold = wcVal;
}

// Guarda la temperatura percebuda i wind-chill
setWc(wcVal);
setEffForCold(effForCold);

// ❄️ 8. Calcula risc per fred
const coldRiskValue = getColdRisk(effForCold, wKmH);
setColdRisk(coldRiskValue as ColdRisk);

// ⚠️ 9. Avisos oficials
const alerts = await getWeatherAlerts(lat, lon, lang, API_KEY);
setAlerts(alerts);
if (alerts.length > 0) {
  console.log("[DEBUG] Avisos meteorològics rebuts:", alerts);
}

// 🔥 10. Notificacions
await maybeNotifyHeat(d.main.feels_like);
await maybeNotifyCold(effForCold, wKmH);
await maybeNotifyWind(wKmH);
await maybeNotifyUV(uvi);

setReady(true);
    // ✅ Tot correcte
    if (!silent) setErr("");

  } catch (error) {
    console.error("[DEBUG] Error obtenint dades per GPS:", error);
    if (!silent) setErr(t("errorGPS"));
  } finally {
    if (!silent) setLoading(false);
  }
};

/* 🔍 CERCA PER CIUTAT */
const search = async () => {
  if (!input.trim()) {
    setErr(t("errorCity"));
    return;
  }

  try {
    // 🌦️ Obté dades del temps per ciutat
    const d = await getWeatherByCity(input, lang, API_KEY);
    setData(d);
    console.log("[DEBUG] Dades rebudes per ciutat:", d);

    // Coordenades i nom real
    const { lat, lon } = d.coord || { lat: null, lon: null };
    const nm =
      (await getLocationNameFromCoords(lat, lon)) ||
      d.name ||
      input ||
      "Ubicació desconeguda";

    setRealCity(nm);
    setCity(nm);
    setDataSource("search");
    setInput("");

    // 🌤️ Estat del cel
    setSky(d.weather?.[0]?.description || "");
    setIcon(d.weather?.[0]?.icon || "");
    console.log(
      `🟩 [SKY – search] Actualitzat a: ${d.weather?.[0]?.description} (${nm})`
    );

    // 🌬️ Vent
    const wKmH = Math.round((d.wind.speed * 3.6) * 10) / 10;
    setWind(wKmH);
    setWindKmh(wKmH); // <— IMPORTANT
    setWindDeg(d.wind.deg);

    // ❄️ Wind-chill real
    let effForCold = d.main.temp;
    let wcVal = null;

    // Desa la temperatura efectiva
    setEffForCold(effForCold);

    // 🔥 Actualitza estat general
    await updateAll(
      d.main.temp,
      d.main.humidity,
      d.main.feels_like,
      lat!,
      lon!,
      nm
    );

    setErr("");

    // 🔔 Notificacions
    await maybeNotifyCold(effForCold, wKmH);
    await maybeNotifyHeat(d.main.feels_like);
    await maybeNotifyWind(wKmH);

    setReady(true);
  } catch (e) {
    console.error("[DEBUG] Error obtenint dades:", e);
    setErr(t("errorCity"));
  }
};

  /* ──────── render ──────── */
  // Sempre agafa el llenguatge actual, però limitat a 2 lletres
const safeLangUV = i18n.language?.slice(0,2) || 'ca';
// ✅ llengua robusta per components que usen TXT intern
const lang2 = normalizeLang(i18n.resolvedLanguage || i18n.language || "ca");


useEffect(() => {
  const tok = localStorage.getItem("fcmToken");
  if (tok) {
    setPushEnabled(true);
    setPushToken(tok);
  }
}, []);

(window as any).maybeNotifyWind = maybeNotifyWind;
(window as any).maybeNotifyCold = maybeNotifyCold;
(window as any).maybeNotifyHeat = maybeNotifyHeat;
(window as any).maybeNotifyUV = maybeNotifyUV;

/* === [HEAT] notifier amb llindars INSST === */
async function maybeNotifyHeat(hi: number | null) {
  if (!pushEnabled || hi == null) return;

  // 🌡️ Llindars segons INSST (Risc per calor)
if (hi >= 54) {
  showBrowserNotification(
    `🔥 ${t('notify.heatTitle')}`,
    t('notify.heatBody', {
      risk: t('heatRisk.extreme'),
      hi: hi.toFixed(1)
    })
  );
  console.log("[DEBUG] Notificació calor enviada (risc extrem)");
} 
else if (hi >= 41) {
  showBrowserNotification(
    `🌋 ${t('notify.heatTitle')}`,
    t('notify.heatBody', {
      risk: t('heatRisk.high'),
      hi: hi.toFixed(1)
    })
  );
  console.log("[DEBUG] Notificació calor enviada (risc alt)");
} 
else if (hi >= 32) {
  showBrowserNotification(
    `☀️ ${t('notify.heatTitle')}`,
    t('notify.heatBody', {
      risk: t('heatRisk.moderate'),
      hi: hi.toFixed(1)
    })
  );
  console.log("[DEBUG] Notificació calor enviada (risc moderat)");
} 
else if (hi >= 27) {
  showBrowserNotification(
    `🌤️ ${t('notify.heatTitle')}`,
    t('notify.heatBody', {
      risk: t('heatRisk.low'),
      hi: hi.toFixed(1)
    })
  );
  console.log("[DEBUG] Notificació calor enviada (risc lleu)");
} 
else {
  console.log("[DEBUG] Condicions sense risc per calor: notificació no enviada");
}
}

function formatLastUpdate(timestamp: number): string {
  const now = Date.now() / 1000;
  const diff = Math.floor(now - timestamp);

  if (diff < 60) return `${diff} s`;
  if (diff < 3600) return `${Math.floor(diff / 60)} min`;
  const h = Math.floor(diff / 3600);
  return `${h} h`;
}

// ============================================================
// 🎯 PRIORITAT DE RISC (principal vs secundari)
// Regla: Severitat primer, després: Calor > Fred > Vent > UV
// ============================================================

type PrimaryKind = "heat" | "cold" | "wind" | "uv" | "none";
type Severity = 0 | 1 | 2 | 3 | 4; // 0 cap, 4 extrem

function pickPrimaryRisk(args: {
  hi: number | null;              // sensació/heat-index
  effForCold: number | null;      // temperatura efectiva per fred (windchill)
  windRisk: string;               // none|breezy|moderate|strong|very_strong
  uvi: number | null;
}): { kind: PrimaryKind; severity: Severity; labelKey: string } {
  const { hi, effForCold, windRisk, uvi } = args;

  // --- 1) CALOR (basat en llindars INSST que ja uses) ---
  let heatSev: Severity = 0;
  let heatKey = "heat_safe";
  if (typeof hi === "number") {
    if (hi >= 54) { heatSev = 4; heatKey = "heat_extreme"; }
    else if (hi >= 41) { heatSev = 3; heatKey = "heat_high"; }
    else if (hi >= 32) { heatSev = 2; heatKey = "heat_moderate"; }
    else if (hi >= 27) { heatSev = 1; heatKey = "heat_mild"; }
  }

  // --- 2) FRED (segons la teva classificació cap/lleu/moderat/alt/molt alt/extrem) ---
  let coldSev: Severity = 0;
  let coldKey = "cold_safe";
  if (typeof effForCold === "number") {
    // Nota: el teu getColdRisk retorna strings. Aquí ho estimam directament pel valor.
    // (Si vols, després ho connectam exactament amb getColdRisk.)
    if (effForCold <= -40) { coldSev = 4; coldKey = "cold_extreme"; }
    else if (effForCold <= -25) { coldSev = 3; coldKey = "cold_very_high"; }
    else if (effForCold <= -15) { coldSev = 3; coldKey = "cold_high"; }     // mateix nivell de severitat "alta"
    else if (effForCold <= -5)  { coldSev = 2; coldKey = "cold_moderate"; }
    else if (effForCold <= 0)   { coldSev = 1; coldKey = "cold_mild"; }
  }

  // --- 3) VENT ---
  const windMap: Record<string, Severity> = {
    none: 0,
    breezy: 1,
    moderate: 2,
    strong: 3,
    very_strong: 4,
    extreme: 4,
  };
  const windSev: Severity = windMap[windRisk] ?? 0;
  const windKey = windSev === 0 ? "wind_none" : `wind_${windRisk}`;

// --- 4) UV ---
let uvSev: Severity = 0;
let uvKey = "uv_low";

if (typeof uvi === "number" && Number.isFinite(uvi)) {

  // Protecció contra valors negatius (OpenUV pot retornar -1 en casos rars)
  const uviSafe = Math.max(0, uvi);

  // ⚠️ Classificació OMS amb valor REAL (NO arrodonit)
  if (uviSafe >= 11) {
    uvSev = 4;
    uvKey = "uv_extreme";

  } else if (uviSafe >= 8) {
    uvSev = 3;
    uvKey = "uv_very_high";

  } else if (uviSafe >= 6) {
    uvSev = 2;
    uvKey = "uv_high";

  } else if (uviSafe >= 3) {
    uvSev = 1;
    uvKey = "uv_moderate";

  } else {
    uvSev = 0;
    uvKey = "uv_low";
  }
}

  // Candidates (amb ordre de desempat: Calor > Fred > Vent > UV)
  const candidates: Array<{ kind: PrimaryKind; sev: Severity; key: string; tie: number }> = [
    { kind: "heat", sev: heatSev, key: heatKey, tie: 4 },
    { kind: "cold", sev: coldSev, key: coldKey, tie: 3 },
    { kind: "wind", sev: windSev, key: windKey, tie: 2 },
    { kind: "uv",   sev: uvSev,   key: uvKey,   tie: 1 },
  ];

  // Tria per severitat, i a igual severitat tria el tie més alt
  candidates.sort((a, b) => (b.sev - a.sev) || (b.tie - a.tie));
  const top = candidates[0];

  if (!top || top.sev === 0) return { kind: "none", severity: 0, labelKey: "none" };
  return { kind: top.kind, severity: top.sev, labelKey: top.key };
}


// Text de la direcció del vent en 16 punts, localitzat
const windText16 =
  windDeg !== null ? windDegreesToCardinal16(windDeg, i18n.language) : "";

/* === RISC TÈRMIC GENERAL (fora del map i fora d'avisos) === */
const risk = temp != null ? getThermalRisk(temp) : "cap";

// 🌡️ Temperatura per recomanacions (robusta i anti-NaN)
const baseRecTemp =
  typeof hi === "number"
    ? hi
    : typeof temp === "number"
    ? temp
    : null;

const activityExtra =
  activityEnabled ? (Number(activityDeltaStable) || 0) : 0;

const recTempRaw = baseRecTemp == null ? null : baseRecTemp + activityExtra;

// ✅ només acceptam números finits
const recTemp =
  typeof recTempRaw === "number" && Number.isFinite(recTempRaw)
    ? Math.round(recTempRaw * 10) / 10
    : null;;

// === Traducció multilingüe correcta per al risc de fred ===
const riskKeyRaw = risk.replace("cold_", "");   // mild / moderate / severe

// Map a les claus reals del JSON
const riskKeyMap: Record<string, string> = {
  mild: "lleu",
  moderate: "moderat",
  severe: "extrem"
};

const primary = pickPrimaryRisk({
  hi,
  effForCold,
  windRisk,
  uvi,
});

// ============================================================
// 🧠 Recomanació principal (UV / Vent) quan el risc principal NO és tèrmic
// ============================================================
function getPrimaryAdviceText(): string | null {
  // ☀️ UV
  if (primary.kind === "uv" && typeof uvi === "number") {
    let uvLevel: "moderate" | "high" | "very_high" | "extreme" = "moderate";
    if (uvi >= 6 && uvi < 8) uvLevel = "high";
    else if (uvi >= 8 && uvi < 11) uvLevel = "very_high";
    else if (uvi >= 11) uvLevel = "extreme";

    const key = `officialAdviceDynamic.uv.${uvLevel}`;
    const text = t(key);
    return text !== key ? text : null;
  }

  // 💨 Vent
  if (primary.kind === "wind" && windRisk && windRisk !== "none") {
    const key = `officialAdviceDynamic.wind.${windRisk}`;
    const text = t(key);
    return text !== key ? text : null;
  }

  return null;
}

const primaryAdvice = getPrimaryAdviceText();

const riskKey = riskKeyMap[riskKeyRaw] || "cap";

// Traducció a l’idioma actiu
const coldRiskLabel = t(`coldRisk.${riskKey}`);

// 🔥 Calcular risc de calor ajustat per activitat (rest, walk, moderate, intense)
const heatRisk = hi !== null ? getHeatRisk(hi, activityLevel) : null;

// 🎯 Temperatura per recomanacions (sempre que tinguem algun valor)
const recTempPrimaryRaw =
  (typeof effForCold === "number" ? effForCold : null) ??
  (typeof hi === "number" ? hi : null) ??
  (typeof temp === "number" ? temp : null);

const recTempPrimary =
  typeof recTempPrimaryRaw === "number" && Number.isFinite(recTempPrimaryRaw)
    ? Math.round(
        (recTempPrimaryRaw +
          (activityEnabled ? (Number(activityDeltaStable) || 0) : 0)) * 10
      ) / 10
    : null;

return (
    <div className="container">
      {/* 🔄 Selector d’idioma */}
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "1rem" }}>
        <LanguageSwitcher />
      </div>
  
      <h1>{t('title')}</h1>


   <form
 onSubmit={(e) => {
  e.preventDefault();
  const q = input.trim();
  if (!q) return;

  // opcional: evita “barreges” visuals mentre carrega
  setErr("");
  setRealCity(q);   // així, com a mínim, no quedarà el valor antic
  setCity(q);

  fetchWeather(q);
}}
  style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "1rem" }}
>
  <input
    type="text"
    value={input}
    onChange={(e) => setInput(e.target.value)}
    placeholder={t("search_placeholder")}
    style={{
      flex: 1,
      padding: "0.5rem",
      borderRadius: "8px",
      border: "1px solid #ccc",
    }}
  />

  <button
    type="submit"
    disabled={!input.trim()}
    style={{
      padding: "0.5rem 1rem",
      borderRadius: "8px",
      border: "none",
      backgroundColor: input.trim() ? "#1e90ff" : "#999",
      color: "white",
      cursor: input.trim() ? "pointer" : "not-allowed",
      opacity: input.trim() ? 1 : 0.6,
      transition: "all 0.2s ease",
    }}
  >
    {t("search_button")}
  </button>
</form>

<div style={{ marginTop: "1rem" }}>
  <button onClick={() => locate(false)}>{t("gps_button")}</button>
</div>

{/* 🔔 Interruptor per activar/desactivar avisos meteorològics */}
<div
  style={{
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    marginTop: '10px',
    marginBottom: '10px',
    fontSize: '1.1rem',
    fontWeight: '500'
  }}
>

{/* 🔔 Botó REAL: activar/desactivar PUSH (FCM + Firestore) */}
<div
  style={{
    display: "flex",
    alignItems: "center",
    gap: "10px",
    marginTop: "12px",
    marginBottom: "12px",
  }}
>
  <button
    onClick={() => onTogglePush(!pushEnabled)}
    style={{
      backgroundColor: pushEnabled ? "#2f9e44" : "#555",
      color: "white",
      padding: "8px 14px",
      border: "none",
      borderRadius: "8px",
      cursor: "pointer",
      fontSize: "0.9rem",
      fontWeight: 600,
      display: "flex",
      alignItems: "center",
      gap: "8px",
      transition: "all 0.2s ease"
    }}
  >
    <span>{pushEnabled ? "🔔" : "🔕"}</span>
    {t("notifications.label")}:
    <strong>
      {pushEnabled
        ? t("notifications.on")
        : t("notifications.off")}
    </strong>
  </button>
</div>

{/* (opcional) Missatge d’estat/errada del push */}
{msgHeat && (
  <p style={{ marginTop: "0.25rem", opacity: 0.9 }}>
    {msgHeat}
  </p>
)}

<button
  onClick={() => {
    if (activityEnabled) deactivate();
    else activate();
  }}
  className="btn-activity"
  style={{
    backgroundColor: activityEnabled
      ? ACTIVITY_COLORS[activityLevelStable]
      : "#555",
    color: "white",
    padding: "0.4rem 0.8rem",
    borderRadius: "6px",
    border: "none",
    cursor: "pointer",
    fontWeight: 600,
    display: "flex",
    alignItems: "center",
    gap: "0.4rem"
  }}
>
  {activityEnabled ? (
    <>
      {ACTIVITY_ICONS[activityLevelStable]}
      {t("activity.active_label")}: {t(`activity.${activityLevelStable}`)}
      ({activityDeltaStable}°C {t("activity.extra")})
    </>
  ) : (
    <>
      💤 {t("activity.inactive")}
    </>
  )}
</button>

{activityError && (
  <p style={{ color: "salmon", marginTop: "0.25rem" }}>
    ⚠ {activityError}
  </p>
)}

</div>

{/* ⚠️ BANNER PRINCIPAL (només 1) */}
{(() => {
  // 1) CALOR (prioritat màxima)
  if (primary.kind === "heat" && heatRisk && heatRisk.isHigh) {
    return (
      <div className="alert-banner">
        {heatRisk.isExtreme ? t("alert_extreme") : t("alertRisk")}
      </div>
    );
  }

  // UVI arrodonit + clamp 0
  const hasUvi = typeof uvi === "number" && Number.isFinite(uvi);
  const uviRounded = hasUvi ? Math.max(0, Math.round(uvi)) : null;

  // 2) UV EXTREM (11+) — es mostra encara que UV no sigui primary
  if (uviRounded !== null && uviRounded >= 11) {
    const key = "extremeUVIWarning";
    const raw = t(key);
    const safeText = raw === key ? t("highUVIWarning") : raw;

    return (
      <div className="alert-banner">
        <p>{safeText}</p>
      </div>
    );
  }

  // 3) UV MOLT ALT (8–10) — només si UV és primary
  if (uviRounded !== null && uviRounded >= 8 && primary.kind === "uv") {
    return (
      <div className="alert-banner">
        <p>{t("highUVIWarning")}</p>
      </div>
    );
  }

  // 4) IRRADIÀNCIA — només si no hi ha cap risc principal
  if (primary.kind === "none" && irr !== null && irr >= 8) {
    return (
      <div className="alert-banner">
        <p>{t("highIrradianceWarning")}</p>
        <p>{t("irradianceTips")}</p>
      </div>
    );
  }

  return null;
})()}

     {/* 📊 DADES */}
{city && (
  <LocationCard
  city={city}
  realCity={realCity}
  label={t("location")}
/>

)}

   {/* 🛰️ Font de dades (GPS o Cerca manual) */}
{showSource && currentSource === 'gps' && (
  <p style={{ fontSize: '0.9em', color: '#6cf', transition: 'opacity 0.5s' }}>
    🛰️ Font: GPS
  </p>
)}
{showSource && currentSource === 'search' && (
  <p style={{ fontSize: '0.9em', color: '#ffb347', transition: 'opacity 0.5s' }}>
    🔍 Font: Cerca manual
  </p>
)}

  {/* 🌡️ CONDICIONS ACTUALS */}
<div
  className="block-temp"
  style={{
    backgroundColor: "#eaf3ff",
    borderRadius: "6px",
    padding: "0.9rem 1.1rem",
    marginTop: "1rem",
    marginBottom: "1rem",
    textAlign: "left",
    boxShadow: "0 2px 6px rgba(0,0,0,0.1)",
  }}
>
  <h3 style={{ marginTop: 0, marginBottom: "0.6rem", fontWeight: 600 }}>
    {t("current_conditions")}
  </h3>

<p>
  <strong>{t("real_temp")}:</strong>{" "}
  {temp !== null ? temp.toFixed(1) + "°C" : "—"}
</p>

  <p>
    <strong>{t("feels_like")}:</strong>{" "}
    {hi !== null ? hi.toFixed(1) + "°C" : "—"}
  </p>

  <p>
    <strong>{t("humidity")}:</strong>{" "}
    {hum !== null ? `${hum}%` : "—"}
  </p>

  {wind !== null && (
    <p>
      <strong>{t("wind")}:</strong>{" "}
      {wind.toFixed(1)} km/h{" "}
      {windDeg !== null ? `· ${windText16} (${windDeg.toFixed(0)}º)` : ""}
    </p>
  )}

</div>

{/* 🕒 Targeta d'actualització */}
{data?.dt && (
  <div className="update-card">
    <span className="update-icon">🕒</span>
    <span className="update-text">
      {t("last_update")}: {formatLastUpdate(data.dt)}
    </span>
  </div>
)}

          {/* 🌤️ ESTAT DEL CEL */}
{sky && (
  <div className="card sky-card">
    <h3>{t("sky_state")}</h3>

    <div className="sky-row">
      {icon && (
        <img
          src={`https://openweathermap.org/img/wn/${icon}@2x.png`}
          alt={sky}
          className="sky-icon"
          width="32"
          height="32"
        />
      )}

      <span className="sky-label">
        {t(`weather_desc.${sky.toLowerCase()}`) !==
        `weather_desc.${sky.toLowerCase()}`
          ? t(`weather_desc.${sky.toLowerCase()}`)
          : sky}
      </span>
    </div>
  </div>
)}

{risk.startsWith("cold_") && (
  <div
    className="cold-card"
    style={{
      backgroundColor:
        risk === "cold_mild"
          ? "#cfe8ff"
          : risk === "cold_moderate"
          ? "#7fb4ff"
          : "#4a7dff",
      borderLeft:
        risk === "cold_mild"
          ? "6px solid #8ed0ff"
          : risk === "cold_moderate"
          ? "6px solid #4ea1ff"
          : "6px solid #1e5fff",
      color: "#000",
      padding: "0.9rem",
      borderRadius: "8px",
      marginTop: "1rem",
      boxShadow: "0 0 6px rgba(0,0,0,0.25)",
      fontWeight: 500,
    }}
  >
    {/* Títol */}
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "0.55rem",
        fontSize: "1.05rem",
        marginBottom: "0.35rem",
      }}
    >
      <span style={{ fontSize: "1.25rem" }}>
        {risk === "cold_mild"
          ? "❄️"
          : risk === "cold_moderate"
          ? "❄️❄️"
          : "❄️❄️❄️"}
      </span>

      {/* ✔️ Traduït */}
      <span>
  {t("cold_risk_title")}: {coldRiskLabel}
</span>
    </div>

    {/* Temperatura efectiva (✔️ també traduïda) */}
    {wc !== null && (
      <p style={{ marginTop: "0.3rem", opacity: 0.85 }}>
        {t("effectiveTemp")}: <strong>{wc}°C</strong>
      </p>
    )}
  </div>
)}

{/* 💨 RISC PER VENT (només risc) */}
{windRisk && (
  <div
    style={{
      backgroundColor: WIND_COLORS[windRisk as keyof typeof WIND_COLORS],
      color: windRisk === "none" ? "#000" : "#fff",
      borderRadius: "6px",
      padding: "0.55rem 0.85rem",
      marginTop: "0.75rem",
      textAlign: "left",
      fontWeight: 600,
      display: "flex",
      alignItems: "center",
      gap: "0.5rem",
    }}
  >
    <span style={{ fontSize: "1.15rem" }}>💨</span>
    <span>{t("wind_risk")}:</span>
    <span>{t(`windRisk.${windRisk}`)}</span>

    {/* (Opcional) km/h en petit a la dreta */}
    {wind !== null && (
      <span style={{ marginLeft: "auto", opacity: 0.85, fontWeight: 500 }}>
        {wind.toFixed(1)} km/h
      </span>
    )}
  </div>
)}
{/* 🌞 INFORMACIÓ SOLAR */}
<div className={`uv-block ${day ? "" : "uv-night"}`}>
  <h3 className="uv-title">{t("solar_info")}</h3>

  {day && (
    <UVAdvice
      uvi={uvi}
      lang={i18n.resolvedLanguage || i18n.language || "ca"}
    />
  )}

  {day && (
    <UVSafeTime
      lat={lat}
      lon={lon}
      lang={normalizeLang(i18n.resolvedLanguage || i18n.language || "ca") as any}
    />
  )}

  {/* ✅ AFEGIT */}
  {day && lat != null && lon != null && (
    <UVDetailPanel
      lat={lat}
      lon={lon}
      lang={normalizeLang(i18n.resolvedLanguage || i18n.language || "ca") as any}
    />
  )}

  {!day && (
    <p className="data-label" style={{ opacity: 0.85 }}>
      🌙 {t("uv_night_info") ?? "És de nit. No hi ha risc per radiació UV."}
    </p>
  )}
</div>

{/* 🔔 AVISOS AEMET (Targetes noves) */}
{alerts.length > 0 && (
  <div style={{ marginTop: "1.5rem" }}>
    {alerts.map((alert, i) => {

      // 🔍 Normalitza la descripció
      const desc =
  typeof alert.description === "string"
    ? alert.description
    : alert.description?.[i18n.language] ||
      alert.description?.es ||
      Object.values(alert.description || {})
        .filter((v) => typeof v === "string" && v.trim().length > 0)
        .join(". ");

      // 🎯 Processat IA per títol + cos
      const ai = buildAemetAiAlert(
        alert.event || "",
        desc,
        i18n.language as LangKey
      );

      // DEBUG opcional
      if (typeof window !== "undefined") {
        (window as any).maybeNotifyHeat = maybeNotifyHeat;
        (window as any).maybeNotifyCold = maybeNotifyCold;
        (window as any).maybeNotifyWind = maybeNotifyWind;
      }

      /* ============================================================
   📌 RECOMANACIONS DINÀMIQUES — DEPÈN DEL TIPUS DE RISC
   ============================================================ */

const dynamicAdvice: string[] = [];

/* 1) RISC PER CALOR (heat_mild, heat_moderate, heat_high, heat_extreme…) */
if (risk.startsWith("heat")) {
  const level = risk.replace("heat_", ""); // mild / moderate / high / extreme
  const key = `officialAdviceDynamic.heat.${level}`;
  const text = t(key);

  if (text !== key) dynamicAdvice.push(text);
}

/* 2) RISC PER FRED (cold_mild, cold_moderate…) */
if (risk.startsWith("cold")) {
  const level = risk.replace("cold_", "");
  const key = `officialAdviceDynamic.cold.${level}`;
  const text = t(key);

  if (text !== key) dynamicAdvice.push(text);
}

/* 3) RISC PER VENT (windRisk = breezy, moderate, strong, very_strong) */
if (windRisk && windRisk !== "none") {
  const key = `officialAdviceDynamic.wind.${windRisk}`;
  const text = t(key);

  if (text !== key) dynamicAdvice.push(text);
}

/* 4) RISC PER UV */
if (uvi != null && uvi >= 3) {
  let uvLevel = "moderate";

  if (uvi >= 6 && uvi < 8) uvLevel = "high";
  else if (uvi >= 8 && uvi < 11) uvLevel = "very_high";
  else if (uvi >= 11) uvLevel = "extreme";

  const key = `officialAdviceDynamic.uv.${uvLevel}`;
  const text = t(key);

  if (text !== key) dynamicAdvice.push(text);
}

      return (
  <div
    key={`${alert.event}-${alert.start ?? i}-${alert.end ?? ""}`}
    className="aemet-alert-card alert-ext"
  >
    {/* Títol */}
    <div className="aemet-alert-title">{ai.title}</div>

    {/* 🕒 Línia temporal + temps restant */}
    {typeof alert?.start === "number" && typeof alert?.end === "number" && (
      <div className="aemet-alert-time">
        🕒 {formatAlertTime(alert.start, lang)} → {formatAlertTime(alert.end, lang)}
        {isAlertActiveNow(alert.start, alert.end) && (
          <span> · {t("alert_time.active")}</span>
        )}
        <br />
        ⏳ {getRemainingTime(alert.end, lang)}
      </div>
    )}

    {/* Descripció */}
    <div className="aemet-alert-description">{ai.body}</div>

    {/* Peu – font oficial */}
    <div className="aemet-alert-source">
      {(
        (alert.sender_name || "").toLowerCase().includes("aemet") ||
        (alert.event || "").toLowerCase().includes("aemet")
      )
        ? "AEMET · Agencia Estatal de Meteorología"
        : alert.sender_name || t("official_source") || "Font oficial"}
    </div>
  </div>
);
    })}
  </div>
)}

{/* ============================================================
   ✅ RECOMANACIÓ PRINCIPAL (coherent amb UV/Vent)
   Si primaryAdvice existeix → mostram aquest bloc
   Si no → tornam al component Recommendations (calor/fred/nit)
   ============================================================ */}
{primaryAdvice?.trim() ? (
  <div className="recommendations-block">
    <h3 className="recommendations-title">
      🟢 {t("recommendations_title") || "Recomanacions:"}
    </h3>
    <p className="recommendations-text">{primaryAdvice}</p>
  </div>
) : recTempPrimary !== null ? (
  <Recommendations
  temp={recTempPrimary}
  lang={langUI}
  isDay={day}
/>
) : (
  <div className="recommendations-block">
    <h3 className="recommendations-title">
      🟢 {t("recommendations_title") || "Recomanacions:"}
    </h3>
    <p className="recommendations-text" style={{ opacity: 0.85 }}>
      {t("loading") || "Carregant recomanacions…"}
    </p>
  </div>
)}

{/* ✅ ACCIONS RÀPIDES */}
<SafetyActions
  lang={(i18n.resolvedLanguage || i18n.language || "ca").slice(0, 2) as any}
  risk={risk}
  uvi={uvi}
  windRisk={windRisk}
  city={realCity || city || ""}
/>

 {/* 🟩 ESCALA-UV */}
{['ca', 'es', 'eu', 'gl', 'gl'].includes(i18n.language) ? (
  <UVScale 
    lang={i18n.language as any} 
    uvi={uvi ?? 0}
/>
) : (
  !err && <p>{t('loading')}</p>
)}
{/* 🧴 FOTOTIP INFO (separat, estil UVScale) */}
<div style={{ marginTop: "1rem" }}>
  <button
    onClick={() => setShowSkinInfo(v => !v)}
    style={{ marginBottom: "0.75rem" }}
  >
    🧴 {t("skin.toggle")}
  </button>

  {showSkinInfo && (
    <SkinTypeInfo
      lang={
        (["ca", "es", "eu", "gl", "en"].includes(
          (i18n.resolvedLanguage || i18n.language || "ca").split("-")[0]
        )
          ? (i18n.resolvedLanguage || i18n.language || "ca").split("-")[0]
          : "ca") as "ca" | "es" | "eu" | "gl" | "en"
      }
      value={skinType}
      onChange={setSkinType}
    />
  )}
</div>
{err && <p style={{ color: 'red' }}>{err}</p>}
</div>
);
}

function showBrowserNotification(title: string, body: string) {
  if (typeof window === "undefined") return;
  if (!("Notification" in window)) return;
  if (!("serviceWorker" in navigator)) return;

  const show = async () => {
    const registration = await navigator.serviceWorker.ready;

    registration.showNotification(title, {
      body,
      icon: "/icons/icon-192.png",
      tag: "thermosafe-alert",
      //<renotify>: true
    });
  };

  if (Notification.permission === "granted") {
    show();
  } else if (Notification.permission !== "denied") {
    Notification.requestPermission().then((perm) => {
      if (perm === "granted") show();
    });
  }
}
//Thermosafe, un projecte de Esteve Montalvo i Camps 2026