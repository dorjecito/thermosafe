/* ───────────────────────────────────────────
   src/App.tsx  —  100 % camins relatius
   ─────────────────────────────────────────── */

   import React, { useEffect, useRef, useState } from 'react';
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
  useEffect(() => {
  const browserLang = navigator.language.slice(0, 2).toLowerCase();
  const supportedLangs = ['ca', 'es', 'gl', 'eu'];
  const lang = supportedLangs.includes(browserLang) ? browserLang : 'ca';

  if (i18n.language !== lang) {
    i18n.changeLanguage(lang);
  }
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

// Desa preferències al localStorage
useEffect(() => {
  localStorage.setItem('enableWindAlerts', JSON.stringify(enableWindAlerts));
}, [enableWindAlerts]);

useEffect(() => {
  localStorage.setItem('enableColdAlerts', JSON.stringify(enableColdAlerts));
}, [enableColdAlerts]);

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
const COLD_ALERT_MIN_INTERVAL_MIN = 0.17; // 2 hores

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
const WIND_ALERT_MIN_INTERVAL_MIN = 0.17; // 2 hores

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
// --- ESTAT PUSH ---
const [pushEnabled, setPushEnabled] = useState(false);
const [pushToken, setPushToken] = useState<string | null>(null);
const [busy, setBusy] = useState(false);

// Missatges independents
const [msgHeat, setMsgHeat] = useState<string | null>(null);
const [msgCold, setMsgCold] = useState<string | null>(null);
const [msgWind, setMsgWind] = useState<string | null>(null);

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
      setLoading(true); // inicia el loader
      const response = await fetch(
        `https://api.openweathermap.org/data/2.5/weather?q=${cityName}&appid=${API_KEY}&units=metric&lang=${lang}`
      );
      const data = await response.json();
  
      if (data.cod === 200) {
    // Desa les dades meteorològiques
    setTemp(data.main.temp);
    setHi(data.main.feels_like);
    setHum(data.main.humidity);
    setWind(data.wind.speed * 3.6); // passa de m/s a km/h
  
    // Format correcte del nom de ciutat
    let cityFormatted = data.name.trim();
    if (cityFormatted.includes("(")) {
      cityFormatted = cityFormatted.split("(")[0].trim();
    }
    cityFormatted =
      cityFormatted.charAt(0).toUpperCase() + cityFormatted.slice(1).toLowerCase();
  
    setRealCity(cityFormatted);
  
    setErr("");
    console.log(`[CITY fetch] ${cityFormatted}: ${data.main.temp}°C`);
  } else {
    // ❌ Error: ciutat no trobada
    setErr("❌ Ciutat no trobada. Revisa el nom i torna-ho a intentar.");
    console.warn("Ciutat no trobada:", data);
  
    // Neteja dades antigues per evitar mostrar ubicacions errònies
    setRealCity("");
    setTemp(null);
    setHi(null);
    setHum(null);
    setWind(null);
  }
  
  } catch (error) {
    console.error("Error obtenint dades meteorològiques:", error);
    setErr("⚠️ Error al obtenir dades. Revisa la connexió o torna-ho a provar.");
  } finally {
    setLoading(false); // atura el loader
  }
  };


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

 /* 📍 LOCALITZACIÓ ACTUAL */
const locate = (silent = false) => {
  navigator.geolocation.getCurrentPosition(
    async (p) => {
      try {
        const { latitude: lat, longitude: lon } = p.coords;
        setInput(""); // ✅ buida el camp de cerca quan tornes a la ubicació actual

        // Obté dades del temps
        const d = await getWeatherByCoords(lat, lon);
        setData(d);

        // Nom de ciutat
        const nm = (await getLocationNameFromCoords(lat, lon)) || d.name;

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
  effForCold = wcRound; // fem servir la “T efectiva” pel risc de fred
} else {
  setWc(null);
}

// 🧊 Risc de fred amb la T efectiva
getColdRisk(effForCold, wind || 0);
const lastAt = Number(localStorage.getItem('lastColdAlertAt') || '0');
const cooldownOk = (Date.now() - lastAt) / 60000 >= COLD_ALERT_MIN_INTERVAL_MIN;

// ✅ Calcula i desa el risc de fred amb la temperatura efectiva
setColdRisk(getColdRisk(effForCold, wind || 0) as ColdRisk);

// 🔄 Actualitza estat general
await updateAll(d.main.temp, d.main.humidity, d.main.feels_like, lat, lon, nm);
setRealCity(nm);
setCity(nm);
setErr('');

await maybeNotifyHeat(hi);
await maybeNotifyCold(temp ?? 0, wind ?? 0);
await maybeNotifyWind(wind ?? 0);


        // Actualitza estat general
        await updateAll(d.main.temp, d.main.humidity, d.main.feels_like, lat, lon, nm);
        setRealCity(nm);
        setCity(nm);
        setErr('');

        await maybeNotifyHeat(d.main.feels_like);
        await maybeNotifyCold(d.main.temp, wKmh);
        await maybeNotifyWind(wKmh);


      } catch (e) {
        if (!silent) setErr(t('errorGPS'));
      }
    },
    () => {
      if (!silent) setErr(t('errorGPS'));
    }
  );
}

/* 🔍 CERCA PER CIUTAT */
const search = async () => {
  if (!input.trim()) {
    setErr(t('errorCity'));
    return;
  }
  try {
    const d = await getWeatherByCity(input);
    setData(d);

    const { lat, lon } = (d as any).coord || { lat: null, lon: null };
const nm = (await getLocationNameFromCoords(lat, lon)) || d.name;
setRealCity(nm);
setCity(nm);

// Vent
const wKmh = Math.round(d.wind.speed * 3.6 * 10) / 10;
setWind(wKmh);
maybeNotifyWind(wKmh);

// Calcula efecte del vent (wind-chill)
let effForCold = d.main.temp;

if (d.main.temp <= 10 && wKmh >= 5) {
  effForCold =
    13.12 +
    0.6215 * d.main.temp -
    11.37 * Math.pow(wKmh, 0.16) +
    0.3965 * d.main.temp * Math.pow(wKmh, 0.16);
}

// Calcula risc de fred amb temperatura efectiva
const cold = getColdRisk(effForCold, wKmh);
setColdRisk(cold as ColdRisk);

// Mostra notificació si puja el risc de fred
await maybeNotifyCold(effForCold, wKmh);




    // Wind-chill
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

  // === FRED ===
const coldTemp = d.main.temp; // temperatura real
const coldFeels = wc ? d.main.feels_like : d.main.temp; // usa el windchill si existeix

let coldRisk: ColdRisk = 'cap';

// Només calcula risc per fred si la temperatura real és baixa
if (coldTemp <= 10) {
  coldRisk = getColdRisk(coldFeels, wind || 0) as ColdRisk;
  console.log(`[DEBUG] Risc per fred: ${coldRisk} (T° ${coldFeels}°C)`);
} else {
  coldRisk = 'cap';
}

setColdRisk(coldRisk); // actualitza estat final

// 🧊 Comprova risc de fred i mostra notificació si escau
maybeNotifyCold(coldFeels, wind || 0);

if (enableColdAlerts && (coldRisk === 'alt' || coldRisk === 'extrem')) {
  showBrowserNotification(
    `❄️ ${t('notify.coldTitle')}`,
    t('notify.coldBody', {
      risk: t(`coldRisk.${coldRisk}`),
      temp: coldFeels.toFixed(1)
    })
  );
}


    // Actualitza estat general
    await updateAll(d.main.temp, d.main.humidity, d.main.feels_like, lat, lon, nm);
    setRealCity(nm);
    setCity(nm);
    setInput('');
    setErr('');
  } catch {
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

/* === [HEAT] notifier amb llindars INSST === */
async function maybeNotifyHeat(hi: number | null) {
  if (!pushEnabled || hi == null) return;

  // Llindars segons INSST (Risc per calor)
  if (hi >= 27 && hi < 32) {
  showBrowserNotification(
    `🌤️ ${t('notify.heatTitle')}`,
    t('notify.heatBody', {
      risk: t('heatRisk.moderate'),
      hi: hi.toFixed(1)
    })
  );
  console.log("[DEBUG] Notificació calor enviada (risc moderat)");
} else if (hi >= 32 && hi < 41) {
  showBrowserNotification(
    `🔥 ${t('notify.heatTitle')}`,
    t('notify.heatBody', {
      risk: t('heatRisk.high'),
      hi: hi.toFixed(1)
    })
  );
  console.log("[DEBUG] Notificació calor enviada (risc alt)");
} else if (hi >= 41) {
  showBrowserNotification(
    `🚨 ${t('notify.heatTitle')}`,
    t('notify.heatBody', {
      risk: t('heatRisk.extreme'),
      hi: hi.toFixed(1)
    })
  );
  console.log("[DEBUG] Notificació calor enviada (risc molt alt)");
}
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
  
   {/* 🔔 AVISOS PER RISC DE CALOR */}
<div style={{ margin: '0.5rem 0 1rem 0', display: 'flex', flexDirection: 'column', gap: 4 }}>
  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
    <input
      type="checkbox"
      id="ts-push"
      checked={pushEnabled}
      disabled={false}
      onChange={async (e) => {
        const next = e.target.checked;
        console.log(`[DEBUG] Avisos per CALOR ${next ? 'activats' : 'desactivats'}`);
        setPushEnabled(next);
        localStorage.setItem('pushEnabled', JSON.stringify(next));
        setMsgHeat(next ? t('push.enabled') : t('push.disabled'));
        await onTogglePush(next);
      }}
    />
    <label htmlFor="ts-push">{t('push.label')}</label>
  </div>

  {msgHeat && (
    <p style={{ marginLeft: '1.5rem', fontSize: '.9rem', color: '#ccc' }}>{msgHeat}</p>
  )}
</div>

{/* ❄️ AVISOS PER FRED EXTREM */}
<div style={{ margin: '0.25rem 0 1rem 0', display: 'flex', flexDirection: 'column', gap: 4 }}>
  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
    <input
      type="checkbox"
      id="cold-alert"
      checked={enableColdAlerts}
      onChange={(e) => {
        const next = e.target.checked;
        setEnableColdAlerts(next);
        localStorage.setItem('enableColdAlerts', JSON.stringify(next));
        console.log(`[DEBUG] Avisos per FRED ${next ? 'activats' : 'desactivats'}`);
        setMsgCold(next ? t('push.enabled') : t('push.disabled'));
      }}
    />
    <label htmlFor="cold-alert">{t('cold_alert_label')}</label>
  </div>

  {msgCold && <p className="notif-msg">{msgCold}</p>}
</div>

{/* 🌬️ AVISOS PER VENT FORT */}
<div style={{ margin: '0.25rem 0 1rem 0', display: 'flex', flexDirection: 'column', gap: 4 }}>
  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
    <input
      type="checkbox"
      id="wind-alert"
      checked={enableWindAlerts}
      onChange={(e) => {
        const next = e.target.checked;
        setEnableWindAlerts(next);
        localStorage.setItem('enableWindAlerts', JSON.stringify(next));
        console.log(`[DEBUG] Avisos per VENT ${next ? 'activats' : 'desactivats'}`);
        setMsgWind(next ? t('push.enabled') : t('push.disabled'));
      }}
    />
    <label htmlFor="wind-alert">{t('wind_alert_label')}</label>
  </div>

  {msgWind && <p className="notif-msg">{msgWind}</p>}
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
                {t(`weather_desc.${data.weather[0].description}`) || data.weather[0].description}
              </span>
            </div>
          )}


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
      {t("wind")}: {wind.toFixed(1)} km/h
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
  
          {/* 📐 ESCALA UV */}
          {['ca', 'es', 'eu', 'gl'].includes(i18n.language) && (
            <UVScale lang={i18n.language as any} />
          )}
        </>
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