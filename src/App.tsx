/* ───────────────────────────────────────────
   src/App.tsx  —  100 % camins relatius
   ─────────────────────────────────────────── */
   import { getUVFromOW } from "./services/openWeatherUVI";
   import React, { useEffect, useRef, useState } from 'react';
   import { useTranslation } from 'react-i18next';
   import './i18n';
  
   
   
   /* —— serveis ———————————————————————————— */
   //import { getWeatherByCoords, getWeatherByCity } from './services/weatherService';
    import { 
    getWeatherByCity, 
    getWeatherByCoords, 
    getWeatherAlerts, 
    getWindDirection 
  } from "./services/weatherService";
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

// =====================================================
// Traducció completa i robusta dels avisos AEMET
// =====================================================

type LangKey = 'ca' | 'es' | 'eu' | 'gl';

export function translateAemetDescription(desc: string, lang: LangKey): string {
  if (!desc) return "";

  // 1) Normalització inicial
  let t = desc
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")  // treu accents
    .replace(/\s+/g, " ")
    .trim();

  // 2) Normalització de guions Unicode (– — ― etc.)
  t = t.replace(/[-‐-‒–—―]/g, " ");

  // 3) Correccions habituals d'AEMET
  t = t.replace("lluiva", "lluvia");       // faltes comuns
  t = t.replace("one hour", "one hour");  // unifica
  t = t.replace("onehour", "one hour");

  // =====================================================================
  // 4) Traducció especial → AEMET envia sovint l'event "Mode"
  // =====================================================================
  if (t === "mode") {
    if (lang === "es") return "Modo operativo";
    if (lang === "ca") return "Mode operatiu";
    if (lang === "eu") return "Modu operatiboa";
    if (lang === "gl") return "Modo operativo";
  }

  // =====================================================================
  // 5) DETECCIÓ UNIVERSAL DE PRECIPITACIÓ ACUMULADA (tots els formats)
  // =====================================================================

  const precipRegex = /(\d+)\s?mm/;

  const isAccumulated =
    t.includes("precip") ||   // precipitation, precipitación, etc.
    t.includes("accum") ||    // accumulated / acumulada
    t.includes("acum") ||     // acomulada (falta d'AEMET)
    t.includes("hour") ||     // one hour, last hour
    t.includes("lluvia");     // AEMET a vegades envía "lluvia 20 mm"

  if (isAccumulated) {
    const mm = t.match(precipRegex);
    if (mm) {
      const n = mm[1];

      if (lang === "es") return `Lluvia: ${n} mm (últimas horas)`;
      if (lang === "ca") return `Pluja: ${n} mm (últimes hores)`;
      if (lang === "eu") return `Euria: ${n} mm (azken orduak)`;
      if (lang === "gl") return `Chuva: ${n} mm (últimas horas)`;
    }
  }

  // =====================================================================
  // 6) DETECCIÓ DE TIPOLOGIA GENERAL (tempesta, vent, neu, pluja...)
  // =====================================================================

  const types = {
    rain: { ca: "pluja", es: "lluvia", eu: "euria", gl: "chuva" },
    storm: { ca: "tempesta", es: "tormenta", eu: "ekaitza", gl: "treboada" },
    wind: { ca: "vent", es: "viento", eu: "haizea", gl: "vento" },
    snow: { ca: "neu", es: "nieve", eu: "elurra", gl: "neve" },
    cold: { ca: "fred", es: "frío", eu: "hotza", gl: "frío" }
  };

  let type: keyof typeof types | null = null;

  if (t.includes("rain") || t.includes("lluvia")) type = "rain";
  else if (t.includes("storm") || t.includes("tormenta")) type = "storm";
  else if (t.includes("wind") || t.includes("viento")) type = "wind";
  else if (t.includes("snow") || t.includes("nieve")) type = "snow";
  else if (t.includes("cold") || t.includes("frio")) type = "cold";

  if (type) {
    const mm = t.match(precipRegex);
    let base = types[type][lang];

    if (mm) base += `: ${mm[1]} mm`;

    return base.charAt(0).toUpperCase() + base.slice(1);
  }

  // =====================================================================
  // 7) Si no encaixa cap cas → torna l'original traduït si és possible
  // =====================================================================

  return desc;
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


const d = new Date();
const day = d.getDate();
const month = d.getMonth(); // Gener = 0, Juny = 5, Setembre = 8

// Estiu real: del 21 de juny (21/6) al 23 de setembre (23/9)
const summer =
  (month === 5 && day >= 21) || // Juny: a partir del dia 21
  (month === 6) ||              // Juliol: tot
  (month === 7) ||              // Agost: tot
  (month === 8 && day <= 23);   // Setembre: fins al dia 23

const isDaytime = () => {
  const hour = d.getHours();
  return summer
    ? hour >= 7 && hour <= 19  // Si és estiu, es considera dia de 7h a 19h
    : hour >= 8 && hour <= 18; // Si no és estiu, de 8h a 18h
};

/* === [WIND] constants & helpers === */
type WindRisk = 'none' | 'breezy' | 'moderate' | 'strong' | 'very_strong';
type ColdRisk = 'cap' | 'lleu' | 'moderat' | 'alt' | 'molt alt' | 'extrem';


/** Llindars de risc segons la velocitat del vent (km/h) */
const WIND_THRESHOLDS_KMH = {
  breezy: 20,   // a partir d’aquí brisa forta
  moderate: 35, // vent moderat
  strong: 50,   // vent fort
  very_strong: 70 // vent molt fort
} as const;


/** Classifica el risc de vent segons km/h */
function getWindRisk(kmh: number): WindRisk {
  if (kmh >= WIND_THRESHOLDS_KMH.very_strong) return 'very_strong';
  if (kmh >= WIND_THRESHOLDS_KMH.strong) return 'strong';
  if (kmh >= WIND_THRESHOLDS_KMH.moderate) return 'moderate';
  if (kmh >= WIND_THRESHOLDS_KMH.breezy) return 'breezy';
  return 'none';
}

// 🌬️ Colors per risc de vent
const WIND_COLORS = {
  none: "#4CAF50",        // Verd: cap risc
  breezy: "#8BC34A",      // Verd clar: baix
  moderate: "#FFC107",    // Groc: moderat
  strong: "#FF9800",      // Taronja: fort
  very_strong: "#F44336"  // Vermell: molt fort
} as const;


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

type Level = "moderate" | "high" | "very_high";
type Lang  = "ca" | "es" | "eu" | "gl";

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



/* ──────── component ──────── */
export default function App() {
  /* i18next */
  const [loading, setLoading] = useState(false);
  const { t, i18n } = useTranslation();

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
  const browserLang = navigator.language.slice(0, 2).toLowerCase();
  const supportedLangs = ['ca', 'es', 'gl', 'eu'];
  const lang = supportedLangs.includes(browserLang) ? browserLang : 'ca';

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
const lastWindRiskRef = useRef<WindRisk>('none');
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
  const [day, setDay] = useState(isDaytime());
  const [coldRisk, setColdRisk] = useState<'cap' | 'lleu' | 'moderat' | 'alt' | 'molt alt' | 'extrem'>('cap');

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

useEffect(() => {
  // ... el teu codi actual de càrrega de dades
}, [city]); 

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

/* === [COLD] risc per fred (amb efecte wind-chill) === */
function getColdRisk(temp: number, windKmh: number): string {
  // 🧮 Índex de refredament pel vent (wind-chill)
  const wc =
    13.12 +
    0.6215 * temp -
    11.37 * Math.pow(windKmh, 0.16) +
    0.3965 * temp * Math.pow(windKmh, 0.16);

  // 🌡️ Classificació segons temperatura percebuda
  if (wc <= -40) return 'extrem';
  if (wc <= -25) return 'molt alt';
  if (wc <= -15) return 'alt';
  if (wc <= -5) return 'moderada';
  if (wc <= 0) return 'lleu';
  return 'cap';
}


/* === [COLD] notifier amb cooldown (multilingüe i sense error await) === */
const COLD_ALERT_MIN_INTERVAL_MIN = 60; // 1 hora

async function maybeNotifyCold(temp: number, windKmh: number) {
  // Evita fer res si no està activat l’avís
  if (!enableColdAlerts) return;

  const coldRiskValue = getColdRisk(temp, windKmh);
  setColdRisk(coldRiskValue as ColdRisk);

  // Cooldown per evitar notificacions massa seguides
  const now = Date.now();
  const lastColdAlert = Number(localStorage.getItem('lastColdAlert')) || 0;
  if (now - lastColdAlert < COLD_ALERT_MIN_INTERVAL_MIN * 60 * 1000) return;

  // 🔹 Envia notificació si hi ha qualsevol risc (lleu, moderada, alt, molt alt o extrem)
  if (
    coldRiskValue === "lleu" ||
    coldRiskValue === "moderada" ||
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

/* === [UV] Notificador segons índex UV === */
async function maybeNotifyUV(uvi: number | null) {
  if (!pushEnabled || uvi == null) return;

  console.debug("[DEBUG] Verificant notificació UV. Valor:", uvi);

  if (uvi >= 8) {
    showBrowserNotification(
      t("notify.uvTitle"),
      t("notify.uvVeryHigh")
    );
  } else if (uvi >= 6) {
    showBrowserNotification(
      t("notify.uvTitle"),
      t("notify.uvHigh")
    );
  } else if (uvi >= 3) {
    showBrowserNotification(
      t("notify.uvTitle"),
      t("notify.uvModerate")
    );
  }
}

// Missatges independents
const [msgHeat, setMsgHeat] = useState<string | null>(null);
const [msgCold, setMsgCold] = useState<string | null>(null);
const [msgWind, setMsgWind] = useState<string | null>(null);

// 🛠 Carrega totes les preferències ABANS de carregar dades
useEffect(() => {
    try {
        const savedWind = localStorage.getItem("enableWindAlerts");
        if (savedWind !== null) setEnableWindAlerts(JSON.parse(savedWind));

        const savedCold = localStorage.getItem("enableColdAlerts");
        if (savedCold !== null) setEnableColdAlerts(JSON.parse(savedCold));

        const savedUv = localStorage.getItem("enableUvAlerts");
        if (savedUv !== null) setEnableUvAlerts(JSON.parse(savedUv));

        const savedPush = localStorage.getItem("pushEnabled");
        if (savedPush !== null) setPushEnabled(JSON.parse(savedPush));

    } catch (err) {
        console.error("[DEBUG] Error carregant preferències:", err);
    }
}, []);   // IMPORTANT: només una vegada en arrencar

  /** Desa la preferència de l’usuari */
useEffect(() => {
  localStorage.setItem('enableWindAlerts', JSON.stringify(enableWindAlerts));
}, [enableWindAlerts]);

async function onTogglePush(next: boolean) {
  setBusy(true);
  setMsgHeat(null);
  try {
    if (next) {
      const token = await enableRiskAlerts({ threshold: "moderate" });
      setPushEnabled(true);
      setPushToken(token);
      setMsgHeat(t('push.enabled'));
    } else {
      await disableRiskAlerts(pushToken);
      setPushEnabled(false);
      setPushToken(null);
      setMsgHeat(t('push.disabled'));
    }
  } catch (e: any) {
    console.error(e);
    const key =
      e?.message?.includes('permís') ? 'permissionDenied' :
      e?.message?.includes('GPS') ? 'noGps' :
      e?.message?.includes('Push') ? 'notSupported' :
      e?.message?.includes('token') ? 'noToken' :
      null;

    setMsgHeat(key ? t(`push.errors.${key}`) : (e?.message ?? t('error_generic')));
  }
}

/* === CONFIGURACIÓ GENERAL === */
const API_KEY = "ebd4ce67a42857776f4463c756e18b45"; // 🔑 substitueix per la teva clau real
const lang = i18n.language || "ca";



const fetchWeather = async (cityName: string) => {
  try {
    setLoading(true);
    setCurrentSource("search");

    const data = await getWeatherByCity(cityName, lang, API_KEY);
    setTemp(data.main.temp);
    setHi(data.main.feels_like);
    setHum(data.main.humidity);
    setWind(data.wind.speed * 3.6);

    const wDir = getWindDirection(data.wind.deg);
    setWindDirection(wDir);
    setSky(data.weather?.[0]?.description || "");
    setIcon(data.weather?.[0]?.icon || "");

    const { lat, lon } = data.coord || {};
    setCity(data.name);
    setRealCity(data.name);

    console.log("[DEBUG] Coordenades per alertes:", lat, lon);

   // ⚠️ Obtén avisos si tenim coordenades
if (lat && lon) {
    const alerts = await getWeatherAlerts(lat, lon, lang, API_KEY);

    if (!alerts || alerts.length === 0) {
        setAlerts([]);
    } else {
        setAlerts(alerts);
    }
}

    setErr("");
  } catch (err) {
    console.error("[DEBUG] Error obtenint dades de ciutat:", err);
    setErr(t("errorCity"));
    setAlerts([]);
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
  const id2 = setInterval(() => setDay(isDaytime()), 10 * 60 * 1000);

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

    // Envia notificació si el vent és fort o molt fort (traduït segons idioma)
    if (pushEnabled && (risk === 'strong' || risk === 'very_strong')) {
      showBrowserNotification(
        `💨 ${t('notify.windTitle')}`,
        `${t('notify.windBody', { risk })}`
      );
    }
  } else {
    setWindRisk('none');
  }
}, [wind, pushEnabled, t]);


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

  const today = new Date().toISOString().split('T')[0];
  const ir = await fetchSolarIrr(lat, lon, today);
  const uv = await getUVI(lat, lon);

  setTemp(tp);
  setHum(hm);
  setIrr(ir);
  setUvi(uv);
  setCity(nm);

  /* 🌡️ CLAMP HEAT-INDEX */
  const hiVal =
    tp < 18
      ? tp
      : Math.abs(fl - tp) < 1 && hm > 60
      ? calcHI(tp, hm)
      : fl;

  setHi(hiVal);
  sendIfAtLeastModerate(hiVal);
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

    console.log(`[DEBUG] Coordenades GPS obtingudes: ${lat}, ${lon}`);

// 🌦️ 2. Obté dades del temps per coordenades
const d = await getWeatherByCoords(lat, lon, lang, API_KEY);
setData(d);
console.log(`[DEBUG] Dades rebudes per GPS:`, d);
setDataSource("gps");

// ☀️ Obté UVI d’OpenWeather
const uvi = await getUVFromOW(lat, lon);
setUvi(uvi);
console.log("[DEBUG] UV actual:", uvi);

// 📊 Assigna valors bàsics de meteorologia
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
try {
  nm = (await getLocationNameFromCoords(lat, lon)) || d.name || "Ubicació desconeguda";
  if (!nm || nm === "Ubicació desconeguda") {
    console.warn("[WARN] Nom buit o desconegut, reintentant en 1 segon...");
    await new Promise(res => setTimeout(res, 1000));
    nm = (await getLocationNameFromCoords(lat, lon)) || d.name || "Ubicació desconeguda";
  }
  console.log(`[DEBUG] Ciutat trobada per coordenades: ${nm}`);
} catch (e) {
  console.warn("[WARN] No s'ha pogut obtenir el nom de ciutat:", e);
  nm = d.name || "Ubicació desconeguda";
}

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

    // 💨 5. Vent (passa m/s a km/h)
    const wKmH = Math.round((d.wind.speed || 0) * 3.6 * 10) / 10;
    setWind(wKmH);
    setWindDirection(getWindDirection(d.wind.deg));

    // ❄️ 6. Càlcul de risc per fred (wind-chill)
    let effForCold = d.main.temp;
    if (d.main.temp <= 10 && wKmH >= 5) {
      const wcVal =
        13.12 +
        0.6215 * d.main.temp -
        11.37 * Math.pow(wKmH, 0.16) +
        0.3965 * d.main.temp * Math.pow(wKmH, 0.16);
      const wcRound = Math.round(wcVal * 10) / 10;
      setWc(wcRound);
      effForCold = wcRound;
    } else {
      setWc(null);
    }

    const coldRisk = getColdRisk(effForCold, wKmH);
    setColdRisk(coldRisk as ColdRisk);

    // ⚠️ 7. Avisos meteorològics oficials (OpenWeather 3.0)
    const alerts = await getWeatherAlerts(lat, lon, lang, API_KEY);
    setAlerts(alerts);
    if (alerts.length > 0)
      console.log(`[DEBUG] Avisos meteorològics rebuts:`, alerts);


    // 🔥 8. Notificacions segons risc
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
    setErr(t('errorCity'));
    return;
  }

  try {
    // 🌦️ Obté dades del temps per ciutat
   const d = await getWeatherByCity(input, "en");
    setData(d);
    console.log("[DEBUG] Dades rebudes per GPS:", d);
    // 🏙️ Coordenades i nom de ciutat
    const { lat, lon } = (d as any).coord || { lat: null, lon: null };
    const nm = (await getLocationNameFromCoords(lat, lon)) || d.name;
    setRealCity(nm);
    setCity(nm);
    setDataSource('search'); // 🔍 Indica que la font és una cerca manual
    setInput('');

    // 🌤️ Actualitza estat del cel
    setSky(d.weather?.[0]?.description || '');
    setIcon(d.weather?.[0]?.icon || '');
    console.log(`🟩 [SKY - search] Actualitzat a: ${d.weather?.[0]?.description} (${nm || input})`);

    // 🌬️ Vent
    const wKmh = Math.round(d.wind.speed * 3.6 * 10) / 10;
    setWind(wKmh);

    // ❄️ Wind-chill (si fa fred i vent)
    let effForCold = d.main.temp; // per defecte, la real
    if (d.main.temp <= 10 && wKmh >= 5) {
      const wcVal =
        13.12 +
        0.6215 * d.main.temp -
        11.37 * Math.pow(wKmh, 0.16) +
        0.3965 * d.main.temp * Math.pow(wKmh, 0.16);
      const wcRound = Math.round(wcVal * 10) / 10;
      setWc(wcRound);
      effForCold = wcRound;
    } else {
      setWc(null);
    }

    // 🧊 Calcula i desa el risc de fred amb la temperatura efectiva
    const coldRisk = getColdRisk(effForCold, wKmh);
    setColdRisk(coldRisk as ColdRisk);

    // ✅ Mostra notificació si puja el risc
    await maybeNotifyCold(effForCold, wKmh);

    // 🔄 Actualitza estat general
    await updateAll(d.main.temp, d.main.humidity, d.main.feels_like, lat, lon, nm);
    setErr('');

    // 🔥 Altres notificacions
    await maybeNotifyHeat(d.main.feels_like);
    await maybeNotifyWind(wKmh);
    setReady(true);

  } catch (e) {
    setErr(t('errorCity'));
  }
};

  /* ──────── render ──────── */
  const safeLangUV = ['ca', 'es', 'eu', 'gl'].includes(i18n.language) ? i18n.language : undefined;

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
    if (input.trim() === "") return;
    setCity(input);
    fetchWeather(input);
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

  {/* 🔔 Botó per activar/desactivar avisos meteorològics */}
<div
  style={{
    display: "flex",
    alignItems: "center",
    gap: "12px",
    marginTop: "12px",
    marginBottom: "12px",
  }}
>
  <button
  onClick={() => {
    const newVal = !notificationsEnabled;
    setNotificationsEnabled(newVal);
    localStorage.setItem("notificationsEnabled", JSON.stringify(newVal));

    console.log(
      `[TOGGLE] Notificacions meteorològiques: ${
        newVal ? "ACTIVADES" : "DESACTIVADES"
      }`
    );
  }}
  style={{
    backgroundColor: notificationsEnabled ? "#4CAF50" : "#888",
    color: "white",
    padding: "8px 14px",
    border: "none",
    borderRadius: "8px",
    cursor: "pointer",
    fontSize: "0.9rem",
    fontWeight: "600",
    display: "flex",
    alignItems: "center",
    gap: "8px"
  }}
>
  {/* ICONA: normal si activat, tachada si desactivat */}
  <span>{notificationsEnabled ? "🔔" : "🔕"}</span>

  {/* TEXT TRADUÏT */}
  {notificationsEnabled
    ? t("notifications.enabled")
    : t("notifications.disabled")}
</button>
</div>

</div>
  
    
  
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
  
  {loading && (
  <p style={{ 
    color: "#1e90ff", 
    fontStyle: "italic", 
    marginBottom: "1rem", 
    textAlign: "center" 
  }}>
    {t("loading")}
  </p>
)}

     {/* 📊 DADES */}
{city && (
  <LocationDisplay
    city={city}
    realCity={realCity}
    lang={i18n.language === 'es' ? 'es' : 'ca'}
    label={t('location')}
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

    {/* 🌡️ Dades meteorològiques */}
    <>
<p>{t("humidity")}: {hum !== null ? `${hum}%` : "–"}</p>
<p>{t("feels_like")}: <strong>{hi !== null ? `${hi.toFixed(1)}°C` : "–"}</strong></p>
<p>{t("measured_temp")}: {temp !== null ? `${temp.toFixed(1)}°C` : "–"}</p>
  </>

  
          {/* 🌤️ ESTAT DEL CEL */}
          {data?.weather?.[0] && (
            <div className="sky-row">
              <img
                src={`https://openweathermap.org/img/wn/${data.weather[0].icon}@2x.png`}
                alt={data.weather[0].description}
                className="sky-icon"
                width="32"
                height="32"
              />
              <span className="sky-label">
                <strong>{t('sky_state')}:</strong>{' '}
                {t(`weather_desc.${data.weather[0].description.toLowerCase()}`) !== `weather_desc.${data.weather[0].description.toLowerCase()}`
  ? t(`weather_desc.${data.weather[0].description.toLowerCase()}`)
  : data.weather[0].description}
              </span>
            </div>
          )}

                    {/* 🕒 Marca temporal d'actualització */}

                    {data?.dt ? (
            <p className="update-time">
              🕒 {t('last_update')}: {formatLastUpdate(data.dt)}
            </p>
          ) : null}


{/* 💨 VENT */}
{wind !== null && (
  <div
    style={{
      backgroundColor: WIND_COLORS[windRisk as keyof typeof WIND_COLORS],
      color: windRisk === "none" ? "#000" : "#fff",
      borderRadius: "6px",
      padding: "0.5rem 0.75rem",
      marginTop: "0.5rem",
      textAlign: "left",
      fontWeight: "bold",
      display: "flex",            // 🔹 activa flexbox
      flexDirection: "column",    // 🔹 col·loca el text en columna
      alignItems: "flex-start"    // 🔹 alinea tot el contingut a l’esquerra
    }}
  >
    💨 {t("wind_risk")}:{" "}
    {windRisk === "none"
      ? t("no_risk_wind")
      : t("wind_" + windRisk)}
    <br />
    <small>
  {t("wind")}: {wind?.toFixed(1)} km/h
  {windDirection && ` (${windDirection})`}
</small>
  </div>
)}

{/* ❄️ FRED */}
{coldRisk !== 'cap' && (
  <p>❄️ {t('cold_risk')}: <b>{coldRisk}</b></p>
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


          {/* ⚠️ Avisos meteorològics oficials */}
{alerts.length > 0 ? (
  alerts.map((alert, i) => {
    let rawText = alert.event?.toLowerCase() || "";

    // 🔍 Simplifica el text per trobar la categoria
    if (rawText.includes("storm")) rawText = "storm";
    else if (rawText.includes("rain")) rawText = "rain";
    else if (rawText.includes("snow")) rawText = "snow";
    else if (rawText.includes("wind")) rawText = "wind";
    else if (rawText.includes("heat")) rawText = "heat";
    else if (rawText.includes("cold")) rawText = "cold";
    else if (rawText.includes("mode")) rawText = "mode"; // <-- Afegit per Vigo

    // 🧠 Traducció amb la teva funció PRO
    const title = translateAemetDescription(alert.event || "", i18n.language as LangKey);
    const body  = translateAemetDescription(alert.description || "", i18n.language as LangKey);

    // 🎨 Colors i icones
    let borderColor = "#ffeb3b";
    let icon = "⚠️";

    if (rawText === "storm") {
      borderColor = "#ff9800"; icon = "⛈️";
    } else if (rawText === "rain") {
      borderColor = "#4fc3f7"; icon = "🌧️";
    } else if (rawText === "heat") {
      borderColor = "#f44336"; icon = "🔥";
    } else if (rawText === "snow") {
      borderColor = "#90caf9"; icon = "❄️";
    } else if (rawText === "wind") {
      borderColor = "#81d4fa"; icon = "🌬️";
    } else if (rawText === "cold") {
      borderColor = "#4dd0e1"; icon = "🥶";
    } else if (rawText === "mode") {
      borderColor = "#b39ddb"; icon = "ℹ️"; // <-- Afegit cas Vigo
    }

    return (
      <div
        key={i}
        className="weather-alert"
        style={{
          borderLeft: `6px solid ${borderColor}`,
          marginBottom: "10px",
          paddingLeft: "10px",
        }}
      >

        <strong>
          {icon} {title}
        </strong>

        {body && (
          <div style={{ opacity: 0.8 }}>
            {body}
          </div>
        )}

        <div style={{ fontSize: "0.75em", opacity: 0.6, marginTop: "3px" }}>
          {alert.sender_name} ·{" "}
          {new Date(alert.start * 1000).toLocaleString()} →{" "}
          {new Date(alert.end * 1000).toLocaleString()}
        </div>
      </div>
    );
  })
) : (
  <p>☀️ {t("no_alerts")}</p>
)}
  
          {/* 📋 RECOMANACIONS */}
          <Recommendations
            temp={hi!}
            lang={i18n.language as any}
            isDay={day}
          />
  
         {/* 🔗 Enllaços oficials */}
  <div className="official-links">
  <p>{t("official_links")}:</p>
  <ul>
    <li>
      <a
        href="https://www.insst.es"
        target="_blank"
        rel="noopener noreferrer"
        className="official-link"
      >
        🔗 {t("link_insst")}
      </a>
    </li>
    <li>
      <a
        href="https://www.sanidad.gob.es/excesoTemperaturas2025/meteosalud.do"
        target="_blank"
        rel="noopener noreferrer"
        className="official-link"
      >
        🔗 {t("link_aemet")}
      </a>
    </li>
  </ul>
</div>
  
         {/* 🟩 ESCALA-UV */}
{['ca', 'es', 'eu', 'gl'].includes(i18n.language) ? (
  <UVScale lang={i18n.language as any} />
) : (
  !err && <p>{t('loading')}</p>
)}

{err && <p style={{ color: 'red' }}>{err}</p>}
</div>
);
}

/* === Mostrar notificació al navegador === */
function showBrowserNotification(title: string, body: string) {
  if (typeof window === "undefined" || !("Notification" in window)) return;

  // funció interna per mostrar la notificació
  const notify = () => new Notification(title, { body });

  // Si ja tenim permís, mostra la notificació directament
  if (Notification.permission === "granted") {
    notify();
  }
  // Si encara no s’ha denegat, demanam permís a l’usuari
  else if (Notification.permission !== "denied") {
    Notification.requestPermission().then((perm) => {
      if (perm === "granted") notify();
    });
  }
}
//Thermosafe, un projecte de Esteve Montalvo i Camps 