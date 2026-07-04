/* ───────────────────────────────────────────
   src/App.tsx  —  100 % camins relatius
   ─────────────────────────────────────────── */
   import React, { useEffect, useMemo, useRef, useState } from 'react';
   import { useTranslation } from 'react-i18next';
   import './i18n';
   import "./App.css";
  
 /* ── serveis ── */
import {
  getWeatherByCity,
  getWeatherByCoords,
  getWeatherAlerts,
  getHourlyForecastByCoords,
} from "./services/weatherService";

import {
  HEAT_HIGH,
  UV_HIGH,
  UV_EXTREME,
  COLD_THRESHOLD,
  WINDCHILL_TEMP_MAX,
  WINDCHILL_WIND_MIN,
} from "./constants/riskThresholds";

import { getUVDetailFromOpenUV, getUVFromOpenUV } from "./services/openUV";
   
   /* —— utilitats ——————————————————————————— */
   import { getLocationNameFromCoords } from './utils/getLocationNameFromCoords';
   import { getHeatRisk } from './utils/heatRisk';
   import {windDegToCardinal16 as windDegreesToCardinal16,
   } from "./utils/windDirections";
   import { getWindRisk, type WindRisk } from "./utils/windRisk";
   import { buildAemetAiAlert, type LangKey } from "./utils/aemetAi";
   import { getContextualUVMessage } from "./utils/getContextualUVMessage";
   import { getWorkWindow, getWorkWindowText, getWorkWindowTitle } from "./utils/workWindow";
   import { getRiskIcons } from "./utils/getRiskIcons";
   import { getColdRisk, type ColdRisk } from "./utils/getColdRisk";
   import { getAlertIcon } from "./utils/getAlertIcon";
   import { pickPrimaryRisk } from "./utils/PickPrimaryRisk";
   import { calcHI } from "./utils/calcHI";
   import { getHeatDayPhase, isDayAtLocation, isLateDayAtLocation } from "./utils/isDayAtLocation";
   import { getPrimaryStatusBlock } from "./utils/getPrimaryStatusBlock";
   import { getPrimaryAdviceText } from "./utils/getPrimaryAdviceText";
   import { formatLastUpdate } from "./utils/formatLastUpdate";
	   import { getRemainingTime } from "./utils/getRemainingTime";
	   import { normalizeLang } from "./utils/normalizeLang";
	   import { getUvAdvice, getUvText, normalizeUviForDisplay } from "./utils/uv";
	   import { buildRiskTrend, type RiskTrendResult } from "./utils/riskTrend";
   import { safeUVFetch } from "./utils/safeUVFetch";
   import { evaluateRiskScore } from "./utils/riskScoreEngine";
   import { primaryRiskFromEngine } from "./utils/primaryRiskFromEngine";
   import { getWeatherContext } from "./utils/weatherContext";
   import { fetchSolarIrr } from "./utils/fetchSolarIrr";
   import UVContextCard from "./components/UVContextCard";
   import { resolveSkyDescription } from "./utils/resolveSkyDescription";
   import {
  enableRiskAlerts,
  disableRiskAlerts,
  updateRiskAlertLocation,
  updateRiskAlertLocationFromGps,
} from "./push/subscribe";
   
   /* —— components ————————————————————————— */
   import Recommendations     from './components/Recommendations';
   import UVAdvice            from './components/UVAdvice';
   import UVScale             from './components/UVScale';
   import LocationCard from "./components/LocationCard";
   import SafetyActions from "./components/SafetyActions";
   import UVSafeTime from "./components/UVSafeTime";
   import UVDetailPanel from "./components/UVDetailPanel";
   import SkinTypeInfo, { type SkinType } from "./components/SkinTypeInfo";
   import TopAlertBanner from "./components/TopAlertBanner";
   import CompactHeader from "./components/CompactHeader";
   import { useScrollCompactHeader } from "./hooks/useScrollCompactHeader";
   
   /* —— analítica (opcional) ———————————— */
   import { inject } from '@vercel/analytics';
   inject()

   import LanguageSwitcher from './components/LanguageSwitcher';
   import { getThermalRisk } from "./utils/getThermalRisk";

   /* —— hooks ———————————— */
   import { useRiskNotifications } from "./hooks/useRiskNotifications";
   import { useCitySuggestions } from "./hooks/useCitySuggestions";
   import { useSmartActivity, type ActivityLevel } from "./hooks/useSmartActivity";

function useStableValue<T>(value: T, delay = 800): T {
  const [stable, setStable] = useState(value);

  useEffect(() => {
    const id = setTimeout(() => setStable(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);

  return stable;
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

const getQuickTempToneClass = (value: number | null): string => {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "quick-temp-neutral";
  }

  if (value < 10) return "quick-temp-cold";
  if (value < 27) return "quick-temp-comfort";
  if (value < 32) return "quick-temp-heat-mild";
  if (value < 41) return "quick-temp-heat-moderate";
  return "quick-temp-heat-high";
};

/* ──────── component ──────── */
export default function App() {
  /* i18next */
  const [loading, setLoading] = useState(false);
  const [isInitialRiskReady, setIsInitialRiskReady] = useState(false);
  const { t, i18n } = useTranslation();

  // 🧴 Fototip (1–6)
  const [skinType, setSkinType] = useState<SkinType>(() => {
    const savedSkinType = Number(localStorage.getItem("skinType"));
    return savedSkinType >= 1 && savedSkinType <= 6
      ? (savedSkinType as SkinType)
      : 3;
  });
  const [showSkinInfo, setShowSkinInfo] = useState(false);
   const searchInputRef = useRef<HTMLInputElement | null>(null);
  

  // ✅ Traducció segura: si falta la clau, torna un fallback llegible
  const tr = (key: string, fallback: string) => {
    const out = t(key);
    return out && out !== key ? out : fallback;
  };

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
const [showActivityInfo, setShowActivityInfo] = useState(false);

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

useEffect(() => {
    localStorage.setItem("skinType", String(skinType));
}, [skinType]);

  /* state */
  const [data, setData] = useState<any | null>(null);
  const [temp, setTemp] = useState<number | null>(null);
  const [hum, setHum] = useState<number | null>(null);
  const [hi, setHi] = useState<number | null>(null);
  const [irr, setIrr] = useState<number | null>(null);
  const [uvi, setUvi] = useState<number | null>(null);
  const [uvMaxToday, setUvMaxToday] = useState<number | null>(null);
  const [wc, setWc] = useState<number | null>(null); // wind-chill
  const [clouds, setClouds] = useState<number | null>(null);
  const [weatherMain, setWeatherMain] = useState<string | null>(null);
  const [city, setCity] = useState<string | null>(null);
  const [realCity, setRealCity] = useState('');
  const [err, setErr] = useState('');
  const [input, setInput] = useState('')
  const [day, setDay] = useState(true);
  const [coldRisk, setColdRisk] = useState<'cap' | 'lleu' | 'moderat' | 'alt' | 'molt alt' | 'extrem'>('cap');
	  const [windDeg, setWindDeg] = useState<number | null>(null);
	  const [windKmh, setWindKmh] = useState<number | null>(null);
	  const [lat, setLat] = useState<number | null>(null);
	  const [lon, setLon] = useState<number | null>(null);
	  const [riskTrend, setRiskTrend] = useState<RiskTrendResult | null>(null);
	  const [riskTrendLoading, setRiskTrendLoading] = useState(false);
	  const searchBoxRef = useRef<HTMLDivElement | null>(null);
	  const showCompactHeader = useScrollCompactHeader(120);

 useEffect(() => {
  const handleClickOutside = (event: MouseEvent) => {
    if (!searchBoxRef.current) return;

    const target = event.target as Node | null;
    if (target && searchBoxRef.current.contains(target)) return;

    setShowSuggestions(false);
    setShowSearchHelp(false);
  };

  document.addEventListener("click", handleClickOutside);

  return () => {
    document.removeEventListener("click", handleClickOutside);
  };
}, []); 

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

function startRequest(source: "gps" | "search") {
  const id = Date.now();
  latestRequestRef.current = { source, id };
  return id;
}

function isStaleRequest(source: "gps" | "search", id: number) {
  return (
    latestRequestRef.current.source !== source ||
    latestRequestRef.current.id !== id
  );
}

const [alerts, setAlerts] = useState<any[]>([]);

 const {
  level: activityLevel,
  enabled: activityEnabled,
  requesting: activityRequesting,
  error: activityError,
  activate,
  deactivate,              
} = useSmartActivity();

const ALERTS_CACHE_KEY = "thermosafe_last_alerts_fetch";

async function loadAlertsIfNeeded(
  nextLat: number,
  nextLon: number,
  lang: string,
  _isDayValue: boolean = true
) {
  const now = Date.now();

  let prevLat: number | null = null;
  let prevLon: number | null = null;
  let prevTs = 0;
  let cachedAlerts: any[] = [];
  let hasCachedAlerts = false;

  try {
    const raw = localStorage.getItem(ALERTS_CACHE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      prevLat = typeof parsed.lat === "number" ? parsed.lat : null;
      prevLon = typeof parsed.lon === "number" ? parsed.lon : null;
      prevTs = typeof parsed.ts === "number" ? parsed.ts : 0;
      hasCachedAlerts = Array.isArray(parsed.alerts);
      cachedAlerts = hasCachedAlerts ? parsed.alerts : [];
    }
  } catch (err) {
    console.warn("[ALERTS] Error llegint caché local:", err);
  }

  const sameArea =
    prevLat !== null &&
    prevLon !== null &&
    Math.abs(prevLat - nextLat) < 0.05 &&
    Math.abs(prevLon - nextLon) < 0.05;

  const tooSoon = now - prevTs < 30 * 60 * 1000;

  if (sameArea && tooSoon && hasCachedAlerts) {
    console.log("[ALERTS] Caché local reutilitzada");
    setAlerts(cachedAlerts);
    return;
  }

  try {
    const nextAlerts = await getWeatherAlerts(nextLat, nextLon, lang);
    const safeAlerts = Array.isArray(nextAlerts) ? nextAlerts : [];

    setAlerts(safeAlerts);

    localStorage.setItem(
      ALERTS_CACHE_KEY,
      JSON.stringify({
        lat: nextLat,
        lon: nextLon,
        ts: now,
        alerts: safeAlerts,
      })
    );

    console.log("[ALERTS] Avisos carregats:", safeAlerts.length);
  } catch (err) {
    console.warn("[ALERTS] Error carregant avisos:", err);

    if (hasCachedAlerts) {
      console.log("[ALERTS] Error API → reutilitzant caché");
      setAlerts(cachedAlerts);
    } else {
      setAlerts([]);
    }
  }
}

async function loadUvMaxToday(nextLat: number, nextLon: number) {
  try {
    const detail = await getUVDetailFromOpenUV(nextLat, nextLon);
    const maxToday =
      typeof detail?.uv_max === "number" && Number.isFinite(detail.uv_max)
        ? detail.uv_max
        : null;
    setUvMaxToday(maxToday);
  } catch (err) {
    console.warn("[UV] Error carregant UV màxim:", err);
    setUvMaxToday(null);
  }
}

/* === CONFIGURACIÓ GENERAL === */
const lang = i18n.resolvedLanguage?.slice(0,2) || "ca";

const {
  maybeNotifyCold,
  maybeNotifyWind,
  maybeNotifyUV,
  maybeNotifyHeat,
  msgHeat,
  setMsgHeat,
} = useRiskNotifications({
  t,
  city,
  realCity,
  pushEnabled,
  enableColdAlerts,
  enableWindAlerts,
  enableUvAlerts,
  dataSource,
});

const {
  suggestions,
  showSuggestions,
  setShowSuggestions,
  showSearchHelp,
  setShowSearchHelp,
  fetchCitySuggestions,
} = useCitySuggestions();

const closeSearchPanel = () => {
  setShowSuggestions(false);
  setShowSearchHelp(false);
  searchInputRef.current?.blur();
};

const activityLevelStable = useStableValue(activityLevel, 800);
// ⏱️ Manté activitat uns minuts encara que l’usuari s’aturi
const ACTIVITY_HOLD_MS = 3 * 60 * 1000;

const [heldActivityLevel, setHeldActivityLevel] = useState<ActivityLevel>(
  activityLevelStable
);

const [lastActiveAt, setLastActiveAt] = useState(Date.now());

useEffect(() => {
  const now = Date.now();

  // Si hi ha activitat real, guarda-la
  if (activityLevelStable !== "rest") {
    setHeldActivityLevel(activityLevelStable);

    setLastActiveAt(now);
    return;
  }

  // Temps restant abans de tornar a "repòs"
  const remaining = ACTIVITY_HOLD_MS - (now - lastActiveAt);

  // Si ja ha passat el temps, passa a repòs
  if (remaining <= 0) {
    setHeldActivityLevel("rest");
    return;
  }

  // Espera el temps restant abans de posar "repòs"
  const timer = window.setTimeout(() => {
    setHeldActivityLevel("rest");
  }, remaining);

  return () => window.clearTimeout(timer);
}, [activityLevelStable, lastActiveAt]);

const ACTIVITY_ICONS: Record<ActivityLevel, string> = {
  rest: "🧘",
  walk: "🚶",
  moderate: "🏃",
  intense: "🏃‍♂️💨",
};

const ACTIVITY_COLORS: Record<ActivityLevel, string> = {
  rest: "#6c757d",
  walk: "#2f9e44",
  moderate: "#f08c00",
  intense: "#d6336c",
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

async function onTogglePush(next: boolean) {
  setBusy(true);

  // ✅ no mostram textos d'estat (enabled/disabled)
  setMsgHeat(null);

    try {
    if (next) {
      const token = await enableRiskAlerts({
        threshold: "moderate",
        lang: normalizeLang(i18n.resolvedLanguage || i18n.language || "ca"),
      });
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

/* === FETCH WEATHER (ciutat cercada) === */
const fetchWeather = async (cityName: string) => {
  const requestId = startRequest("search");

  try {
    setIsInitialRiskReady(false);
    setLoading(true);
    setCurrentSource("search");
    setDataSource("search");

    const data = await getWeatherByCity(cityName, lang);

    if (isStaleRequest("search", requestId)) return;

    if (!data || !data.coord) {
      setErr(t("errorCity"));
      return;
    }

    setRealCity(cityName);
    setCity(cityName);
    setInput("");

    // 🌞 Dia/nit REAL per la ciutat
    const newLat = data.coord?.lat ?? null;
    const newLon = data.coord?.lon ?? null;

    const nowUtc = Math.floor(Date.now() / 1000);
    const tz = data.timezone ?? 0;
    const sunrise = data.sys?.sunrise;
    const sunset = data.sys?.sunset;

    const isDayHere = isDayAtLocation(nowUtc, tz, sunrise, sunset);
    setDay(isDayHere);

    const resolvedName =
      (newLat != null && newLon != null
        ? await getLocationNameFromCoords(newLat, newLon, lang)
        : null) ||
      data.name ||
      cityName ||
      "Ubicació desconeguda";

    if (isStaleRequest("search", requestId)) return;

    setCity(resolvedName);
    setRealCity(resolvedName);

    // 🌡 Temperatures bàsiques
    const tempReal = data.main?.temp ?? null;
    const feelsLike = data.main?.feels_like ?? null;
    const humidity = data.main?.humidity ?? null;

    setTemp(tempReal);
    setHi(feelsLike);
    setHum(humidity);
    setClouds(data.clouds?.all ?? 0);
    setWeatherMain(data.weather?.[0]?.main ?? null);

    // 💨 Vent
    const wKmH = (data.wind?.speed ?? 0) * 3.6;
    setWindKmh(wKmH);

    const deg = data.wind?.deg ?? null;
    setWindDeg(deg);

    // ❄️ Wind-chill
    let effForCold = tempReal ?? 0;
    let wcVal: number | null = null;

    if (
      tempReal !== null &&
      tempReal <= WINDCHILL_TEMP_MAX &&
      wKmH >= WINDCHILL_WIND_MIN
    ) {
      wcVal =
        13.12 +
        0.6215 * tempReal -
        11.37 * Math.pow(wKmH, 0.16) +
        0.3965 * tempReal * Math.pow(wKmH, 0.16);

      wcVal = Math.round(wcVal * 10) / 10;
      effForCold = wcVal;
    }

    setWc(wcVal);

    let computedColdRisk = "cap";
    if (effForCold <= COLD_THRESHOLD) {
      computedColdRisk = getColdRisk(effForCold, wKmH);
    }
    setColdRisk(computedColdRisk as ColdRisk);

    const rawDesc = data.weather?.[0]?.description || "";
    setSky(resolveSkyDescription(rawDesc, (key) => t(key)));
    setIcon(data.weather?.[0]?.icon || "");

    // ✅ Coordenades reals de la ciutat cercada
    if (newLat != null && newLon != null) {
      setLat(newLat);
      setLon(newLon);

      // 🟣 UVI (OpenUV)
      const uv = await getUVFromOpenUV(newLat, newLon);

      if (isStaleRequest("search", requestId)) return;

	      console.log("[SEARCH] UV rebut:", uv);
	      setUvi(uv);
	      await loadUvMaxToday(newLat, newLon);

	      console.log("[DEBUG] Coordenades ciutat cercada:", newLat, newLon);

      // ⚠️ Avisos oficials
      await loadAlertsIfNeeded(
        newLat,
        newLon,
        lang,
        isDayHere
	      );
		    } else {
		      setUvi(null);
		      setUvMaxToday(null);
		      setAlerts([]);
		    }
    closeSearchPanel();
	  } catch (err) {
	    console.error("[DEBUG] Error obtenint dades:", err);
	    setErr("Error obtenint dades de ciutat");
	  } finally {
    if (!isStaleRequest("search", requestId)) {
      setIsInitialRiskReady(true);
      setLoading(false);
    }
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
  if (windKmh !== null) {
    const risk = getWindRisk(windKmh);
    setWindRisk(risk);
  } else {
    setWindRisk('none');
  }
}, [windKmh]);

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
setIrr(ir ?? null);

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
  if (!silent) setErr('');

  console.log(`${colorCyan}✅ [updateAll] Dades actualitzades correctament per ${nm}${colorReset}`);
};

/* 📍 LOCALITZACIÓ ACTUAL */
const locate = async (silent = false) => {

  const requestId = startRequest("gps");

  try {
    if (!silent) {
      setIsInitialRiskReady(false);
      setLoading(true);
    }
    setCurrentSource("gps");
    setDataSource("gps");
    setInput('');

    // 📍 1. Obté coordenades del dispositiu
    const position = await new Promise<GeolocationPosition>((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject);
    });

    if (isStaleRequest("gps", requestId)) return;

const lat = position.coords.latitude;
const lon = position.coords.longitude;

// ✅ PUNT 4: desa coordenades a l’estat global (per components com UVSafeTime)
setLat(lat);
setLon(lon);

// 🔔 Si les notificacions estan activades, actualitza la ubicació del token.
// Si la nova ubicació és a 15 km o més de l'anterior, subscribe.ts reiniciarà els nivells a 0.
if (localStorage.getItem("fcmToken")) {
  updateRiskAlertLocation({ lat, lon, lang }).catch((e) =>
    console.warn("[PUSH] No s'ha pogut actualitzar la ubicació del token:", e)
  );
}

console.log(`[DEBUG] Coordenades GPS obtingudes: ${lat}, ${lon}`);

// 🌦️ // 2. Obté dades del temps per coordenades
const d = await getWeatherByCoords(lat, lon, lang);

if (isStaleRequest("gps", requestId)) return;
setData(d);
setDataSource("gps");

// 🌞 Dia/nit REAL per la ubicació GPS (timezone + sunrise/sunset)
const nowUtc = Math.floor(Date.now() / 1000);
const tz = d.timezone ?? 0;
const sunrise = d.sys?.sunrise;
const sunset = d.sys?.sunset;

const isDayHere = isDayAtLocation(nowUtc, tz, sunrise, sunset);
setDay(isDayHere);

// 🌞 Obté UVI real per la ubicació GPS
const uv = await safeUVFetch(lat, lon, isDayHere);

if (isStaleRequest("gps", requestId)) return;

setUvi(uv);
await loadUvMaxToday(lat, lon);
console.log("[DEBUG] UVI actual (nou):", uv);
console.log("[TEST] Tipus UV (nou):", typeof uv, "Valor:", uv);

// Meteo bàsica
setTemp(d.main?.temp ?? null);
setHum(d.main?.humidity ?? null);
setHi(d.main?.feels_like ?? null);
setClouds(d.clouds?.all ?? 0);
setWeatherMain(d.weather?.[0]?.main ?? null);

// 🔍 Mostra per consola per verificar
console.log(`[DEBUG] Temperatura: ${d.main?.temp}°C, Humitat: ${d.main?.humidity}%, Sensació: ${d.main?.feels_like}°C`);

    // 📍 3. Nom de ciutat (nom real segons coordenades)
let nm = "";

if (lat != null && lon != null) {
  try {
    nm = (await getLocationNameFromCoords(lat, lon, lang)) || "";

  if (isStaleRequest("gps", requestId)) return;

    // Retry només si realment ha tornat buit
   nm = nm?.trim() || d.name || "Ubicació desconeguda";

    console.log(`[DEBUG] Ciutat trobada per coordenades: ${nm}`);
  } catch (e) {
    console.warn("[WARN] Error obtenint nom de ciutat:", e);
  }
}

// Fallback final
nm = nm || d.name || "Ubicació desconeguda";

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
setWindKmh(wKmH);
setWindDeg(d.wind.deg);

// ❄️ 6. Wind-chill real
let tempReal = d.main.temp;
let effForCold = tempReal;
let wcVal: number | null = null;

if (tempReal <= WINDCHILL_TEMP_MAX && wKmH >= WINDCHILL_WIND_MIN) {
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

// ❄️ 8. Calcula risc per fred
const coldRiskValue = getColdRisk(effForCold, wKmH);
setColdRisk(coldRiskValue as ColdRisk);

// ⚠️ 9. Avisos oficials
await loadAlertsIfNeeded(
  lat,
  lon,
  lang,
  isDayHere
);

if (isStaleRequest("gps", requestId)) return;

// 🔥 10. Notificacions
if (!isStaleRequest("gps", requestId)) {
await maybeNotifyHeat(d.main.feels_like);
await maybeNotifyCold(effForCold, wKmH);
await maybeNotifyWind(wKmH);
	await maybeNotifyUV(uv);
	}

	if (isStaleRequest("gps", requestId)) return;
	    // ✅ Tot correcte
	    if (!silent) setErr("");
    if (!silent) closeSearchPanel();

	  } catch (error) {
	  console.error("[DEBUG] Error obtenint dades per GPS:", error);
	  if (!silent) setErr(t("errorGPS"));
} finally {
  if (!silent && !isStaleRequest("gps", requestId)) {
    setIsInitialRiskReady(true);
    setLoading(false);
  }
}
};

const search = async () => {
  const q = input.trim();

  if (!q) {
    setErr(t("errorCity"));
    return;
  }

  setErr("");
  await fetchWeather(q);
};

const handleSuggestionSelect = async (s: any) => {
  const label = [s.name, s.state, s.country].filter(Boolean).join(", ");

  setShowSuggestions(false);
  setShowSearchHelp(false);
  setErr("");

  try {
    setIsInitialRiskReady(false);
    setLoading(true);
    setCurrentSource("search");
    setDataSource("search");

    const data = await getWeatherByCoords(s.lat, s.lon, lang);

    setData(data);
    setLat(s.lat);
    setLon(s.lon);

    const nowUtc = Math.floor(Date.now() / 1000);
    const tz = data.timezone ?? 0;
    const sunrise = data.sys?.sunrise;
    const sunset = data.sys?.sunset;
    const isDayHere = isDayAtLocation(nowUtc, tz, sunrise, sunset);
    setDay(isDayHere);

    setCity(label);
	    setRealCity(label);

	    setInput("");

	    const tempReal = data.main.temp;
    setTemp(tempReal);
    setHi(data.main.feels_like);
    setHum(data.main.humidity);
    setClouds(data.clouds?.all ?? 0);
    setWeatherMain(data.weather?.[0]?.main ?? null);

    const wKmH = data.wind.speed * 3.6;
    setWindKmh(wKmH);

    const deg = data.wind.deg ?? null;
    setWindDeg(deg);

    let effForCold = tempReal;
    let wcVal: number | null = null;

    if (tempReal <= WINDCHILL_TEMP_MAX && wKmH >= WINDCHILL_WIND_MIN) {
      wcVal =
        13.12 +
        0.6215 * tempReal -
        11.37 * Math.pow(wKmH, 0.16) +
        0.3965 * tempReal * Math.pow(wKmH, 0.16);

      wcVal = Math.round(wcVal * 10) / 10;
      effForCold = wcVal;
    }

    setWc(wcVal);

    const coldRiskValue = getColdRisk(effForCold, wKmH);
    setColdRisk(coldRiskValue as ColdRisk);

    const rawDesc = data.weather?.[0]?.description || "";
    setSky(resolveSkyDescription(rawDesc, (key) => t(key)));
    setIcon(data.weather?.[0]?.icon || "");
	    const uv = await getUVFromOpenUV(s.lat, s.lon);
	    setUvi(uv);
	    await loadUvMaxToday(s.lat, s.lon);

	    await loadAlertsIfNeeded(
	      s.lat,
	      s.lon,
	      lang,
	      isDayHere
	    );
    closeSearchPanel();
	  } catch (err) {
	    console.error("[DEBUG] Error obtenint dades del suggeriment:", err);
	    setErr(t("errorCity"));
  } finally {
    setIsInitialRiskReady(true);
    setLoading(false);
  }
};

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

// Text de la direcció del vent en 16 punts, localitzat
const windText16 =
  windDeg !== null ? windDegreesToCardinal16(windDeg, i18n.language) : "";

/* === RISC TÈRMIC GENERAL (fora del map i fora d'avisos) === */
const risk = temp != null ? getThermalRisk(temp) : "cap";
const quickTempToneClass = getQuickTempToneClass(hi ?? temp);

// 🔥 Calcular risc de calor ajustat per activitat (rest, walk, moderate, intense)
const baseHeatRisk =
  hi !== null ? getHeatRisk(hi, "rest") : null;

const preventiveActivity: ActivityLevel = activityEnabled ? heldActivityLevel : "rest";

const heatRisk =
  hi !== null ? getHeatRisk(hi, preventiveActivity) : null;

const activityAffectsHeatRisk =
  activityEnabled &&
  baseHeatRisk !== null &&
  heatRisk !== null &&
  baseHeatRisk.class !== heatRisk.class;

const displayedActivityLevel = activityEnabled ? heldActivityLevel : activityLevelStable;

const nowTs = Math.floor(Date.now() / 1000);
const isLateDay = data
  ? isLateDayAtLocation(
      nowTs,
      data.timezone ?? 0,
      data.sys?.sunrise,
      data.sys?.sunset
    )
  : false;

const heatDayPhase = data
  ? getHeatDayPhase(
      nowTs,
      data.timezone ?? 0,
      data.sys?.sunrise,
      data.sys?.sunset
    )
  : day
  ? "day"
  : "night";

const aemetActive =
  Array.isArray(alerts) &&
  alerts.some(
    (alert) =>
      typeof alert?.start === "number" &&
      typeof alert?.end === "number" &&
      nowTs >= alert.start &&
      nowTs <= alert.end
  );

const aemetSoon =
  Array.isArray(alerts) &&
  alerts.some(
    (alert) =>
      typeof alert?.start === "number" &&
      alert.start > nowTs
  );

const activeAlert =
  Array.isArray(alerts) &&
  alerts.find(
    (alert) =>
      typeof alert?.start === "number" &&
      typeof alert?.end === "number" &&
      nowTs >= alert.start &&
      nowTs <= alert.end
  );

const currentLang = normalizeLang(i18n.resolvedLanguage || i18n.language || "ca");

const activeAlertDescription =
  typeof activeAlert?.description === "string"
    ? activeAlert.description
    : activeAlert?.description?.[currentLang] ||
      activeAlert?.description?.es ||
      Object.values(activeAlert?.description || {})
        .filter((v) => typeof v === "string" && v.trim().length > 0)
        .join(". ");

const activeAlertEvent = `${activeAlert?.event || ""} ${activeAlertDescription || ""}`.trim();

const currentFeelTemp = hi ?? temp ?? 99;
const nocturnalHeat = !day && currentFeelTemp >= 25;

const weatherContext = useMemo(
  () =>
    getWeatherContext({
      weatherMain,
      humidity: data?.main?.humidity ?? null,
      effectiveTemp: currentFeelTemp,
      cloudiness: data?.clouds?.all ?? null,
    }),
  [weatherMain, data?.main?.humidity, currentFeelTemp, data?.clouds?.all]
);

const engineRisk = useMemo(() => {
  if (!data || !isInitialRiskReady || loading) return null;

  return evaluateRiskScore({
    heatIndex: hi,
    activity: preventiveActivity,
    coldEffectiveTemp: wc ?? temp,
    windKmh,
    uvi,
  });
}, [
  data,
  isInitialRiskReady,
  loading,
  hi,
  preventiveActivity,
  wc,
  temp,
  windKmh,
  uvi,
]);

const workWindow = getWorkWindow({
  heatRisk,
  heatIndex: hi,
  coldRisk,
  windRisk,
  uvi,
  aemetActive: aemetActive || aemetSoon,
  weatherMain,
  activity: preventiveActivity,
  nocturnalHeat,
  engineRisk,
  weatherContext,
});

const workWindowLang = currentLang;
const workWindowTitle = getWorkWindowTitle(workWindowLang);
const workWindowText = getWorkWindowText(workWindow, workWindowLang, aemetActive, nocturnalHeat);

useEffect(() => {
  if (
    !data ||
    !isInitialRiskReady ||
    loading ||
    lat == null ||
    lon == null ||
    !Number.isFinite(lat) ||
    !Number.isFinite(lon) ||
    (typeof document !== "undefined" && document.hidden)
  ) {
    setRiskTrend(null);
    setRiskTrendLoading(false);
    return;
  }

  let cancelled = false;
  setRiskTrendLoading(true);

  const timer = window.setTimeout(async () => {
    try {
      const forecast = await getHourlyForecastByCoords(lat, lon, currentLang);
      if (cancelled) return;

      const trend = buildRiskTrend(forecast, {
        heatIndex: hi,
        temp,
        windKmh,
        uvi,
        activity: preventiveActivity,
      });

      setRiskTrend(trend);
    } catch (err) {
      if (!cancelled) {
        console.warn("[FORECAST] No s'ha pogut calcular la tendència:", err);
        setRiskTrend(null);
      }
    } finally {
      if (!cancelled) setRiskTrendLoading(false);
    }
  }, 500);

  return () => {
    cancelled = true;
    window.clearTimeout(timer);
  };
}, [
  data,
  isInitialRiskReady,
  loading,
  lat,
  lon,
  currentLang,
  hi,
  temp,
  windKmh,
  uvi,
  preventiveActivity,
]);

const pickPrimaryInput = {
  hi,
  effForCold: wc ?? temp,
  windRisk,
  uvi,
  heatRiskClass: heatRisk?.class,
};

const legacyPrimary = import.meta.env.DEV
  ? pickPrimaryRisk(pickPrimaryInput)
  : null;

const enginePrimary = engineRisk
  ? primaryRiskFromEngine(engineRisk)
  : { kind: "none" as const, severity: 0 as const, labelKey: "none" };
const primary = enginePrimary;

const primaryAdvice = getPrimaryAdviceText({
  primary,
  coldRisk,
  heatRisk,
  hi,
  temp,
  uvi,
  windRisk,
  t,
});

const isRainy =
  weatherMain === "Rain" ||
  weatherMain === "Drizzle" ||
  weatherMain === "Thunderstorm";

const isVeryCloudy = (clouds ?? 0) >= 85;

const isClearlyColdNow = currentFeelTemp < 8;

const isColdRisk = typeof risk === "string" && risk.startsWith("cold_");

const shouldHideUVBlock =
  isRainy ||
  (isVeryCloudy && isClearlyColdNow) ||
  isColdRisk;

const contextualUVMessage =
  typeof uvi === "number" && Number.isFinite(uvi)
    ? getContextualUVMessage(uvi)
    : "";

const primaryStatusInput = {
  alerts,
  primary,
  heatRisk,
  coldRisk,
  windRisk,
  uvi,
  day,
  isLateDay,
  heatDayPhase,
  nocturnalHeat,
  primaryAdvice,
  contextualUVMessage,
  t,
};

const primaryStatus = getPrimaryStatusBlock(primaryStatusInput);

useEffect(() => {
  if (!import.meta.env.DEV || !legacyPrimary || !engineRisk) return;

  const engineDiverges =
    enginePrimary.kind !== legacyPrimary.kind ||
    enginePrimary.severity !== legacyPrimary.severity ||
    enginePrimary.labelKey !== legacyPrimary.labelKey;

  if (engineDiverges) {
    console.warn("[RiskScoreEngine][DEV] Divergència amb legacyPrimary", {
      legacyPrimary: {
        input: pickPrimaryInput,
        output: legacyPrimary,
      },
      enginePrimary: {
        output: enginePrimary,
        activeFactorsSorted: engineRisk?.activeFactorsSorted,
      },
    });
  }
}, [
  engineRisk,
  enginePrimary,
  legacyPrimary,
  pickPrimaryInput,
]);

const appTitleClass =
  primary.kind === "heat"
    ? primary.severity >= HEAT_HIGH
      ? "app-title app-title-heat-high"
      : "app-title app-title-heat"
    : primary.kind === "cold"
    ? "app-title app-title-cold"
    : primary.kind === "wind"
    ? "app-title app-title-wind"
    : primary.kind === "uv"
    ? "app-title app-title-uv"
    : "app-title app-title-safe";

const riskIcons = getRiskIcons(
  heatRisk,
  coldRisk,
  windRisk,
  uvi
);

const uiLabels = {
  ca: {
    viewAllAlerts: "Veure totes les alertes",
    hideAlerts: "Amagar alertes",
    currentUv: "Índex UV actual",
    uvMaxToday: "UV màxim avui",
    moreUv: "Veure més informació UV",
    lessUv: "Amagar informació UV",
    skinType: "Fototip de pell",
  },
  es: {
    viewAllAlerts: "Ver todas las alertas",
    hideAlerts: "Ocultar alertas",
    currentUv: "Índice UV actual",
    uvMaxToday: "UV máximo hoy",
    moreUv: "Ver más información UV",
    lessUv: "Ocultar información UV",
    skinType: "Fototipo de piel",
  },
  eu: {
    viewAllAlerts: "Ikusi alerta guztiak",
    hideAlerts: "Ezkutatu alertak",
    currentUv: "Uneko UV indizea",
    uvMaxToday: "Gaurko UV maximoa",
    moreUv: "Ikusi UV informazio gehiago",
    lessUv: "Ezkutatu UV informazioa",
    skinType: "Azalaren fototipoa",
  },
  gl: {
    viewAllAlerts: "Ver todas as alertas",
    hideAlerts: "Agochar alertas",
    currentUv: "Índice UV actual",
    uvMaxToday: "UV máximo hoxe",
    moreUv: "Ver máis información UV",
    lessUv: "Agochar información UV",
    skinType: "Fototipo de pel",
  },
  en: {
    viewAllAlerts: "View all alerts",
    hideAlerts: "Hide alerts",
    currentUv: "Current UV index",
    uvMaxToday: "Today's max UV",
    moreUv: "View more UV information",
    lessUv: "Hide UV information",
    skinType: "Skin phototype",
  },
} as const;

const localUi = uiLabels[currentLang] || uiLabels.ca;
const alertCards = alerts.map((alert, i) => {
  const desc =
    typeof alert.description === "string"
      ? alert.description
      : alert.description?.[i18n.language] ||
        alert.description?.es ||
        Object.values(alert.description || {})
          .filter((v) => typeof v === "string" && v.trim().length > 0)
          .join(". ");

  const ai = buildAemetAiAlert(
    alert.event || "",
    desc,
    i18n.language as LangKey
  );

  return { alert, ai, i };
});

const renderAlertCard = ({ alert, ai, i }: (typeof alertCards)[number]) => (
  <div
    key={`${alert.event}-${alert.start ?? i}-${alert.end ?? ""}`}
    className="aemet-alert-card alert-ext"
  >
    <div className="aemet-alert-title">
      {getAlertIcon(alert.event)} {ai.title}
    </div>

    {typeof alert?.start === "number" && typeof alert?.end === "number" && (
      <div className="aemet-alert-time">
        🕒 {formatAlertTime(alert.start, lang)} → {formatAlertTime(alert.end, lang)}
        {isAlertActiveNow(alert.start, alert.end) && (
          <span> · {t("alert_time.active")}</span>
        )}
        <br />
        ⏳ {getRemainingTime(alert.end, lang, t)}
      </div>
    )}

    <details className="aemet-alert-details">
      <summary className="aemet-alert-summary">
        <span className="summary-closed">{t("show_details")}</span>
        <span className="summary-open">{t("hide_details")}</span>
      </summary>

      <div className="aemet-alert-description">{ai.body}</div>
    </details>

    <div className="aemet-alert-source">
      {(alert.sender_name || "").toLowerCase().includes("aemet") ||
      (alert.event || "").toLowerCase().includes("aemet")
        ? "AEMET · Agencia Estatal de Meteorología"
        : alert.sender_name || t("official_source") || "Font oficial"}
    </div>
  </div>
);

const uvSummaryValue = normalizeUviForDisplay(uvi);
const uvMaxSummaryValue =
  normalizeUviForDisplay(uvMaxToday) ?? uvSummaryValue;
const uvSummaryText = getUvText(uvSummaryValue, currentLang);
const uvSummaryAdvice = getUvAdvice(uvSummaryValue, currentLang);
const isRiskRenderReady = Boolean(data && isInitialRiskReady && !loading);
const locationTimezoneOffsetSec =
  typeof data?.timezone === "number" ? data.timezone : null;
const browserTimezoneOffsetSec = -new Date().getTimezoneOffset() * 60;
const trendUsesDifferentTimezone =
  locationTimezoneOffsetSec !== null &&
  Math.abs(locationTimezoneOffsetSec - browserTimezoneOffsetSec) >= 30 * 60;
const formatTrendTime = (date: Date | null) => {
  if (!date) return "";

  if (locationTimezoneOffsetSec === null) {
    return date.toLocaleTimeString(currentLang, { hour: "2-digit", minute: "2-digit" });
  }

  const locationDate = new Date(date.getTime() + locationTimezoneOffsetSec * 1000);
  return locationDate.toLocaleTimeString(currentLang, {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  });
};
const formatTrendFactorKey = (factors?: RiskTrendResult["factors"]) => {
  if (!factors || factors.length === 0) return "generic";
  const order: RiskTrendResult["factors"] = ["heat", "cold", "wind", "uv"];
  return [...new Set(factors)]
    .slice(0, 2)
    .sort((a, b) => order.indexOf(a) - order.indexOf(b))
    .join("_");
};
const trendStartTime = formatTrendTime(riskTrend?.peakStart ?? null);
const trendEndTime = formatTrendTime(riskTrend?.peakEnd ?? null);
const trendFactorKey = formatTrendFactorKey(riskTrend?.factors);
const baseRiskTrendText = riskTrendLoading
  ? t("riskTrend.loading")
  : !riskTrend
  ? t("riskTrend.unavailable")
  : riskTrend.direction === "stable"
  ? t(`riskTrend.${riskTrend.direction}`)
  : riskTrend.direction === "improving"
  ? t(`riskTrend.improving_${trendFactorKey}`, {
      defaultValue: t("riskTrend.improving"),
    })
  : t(`riskTrend.${riskTrend.direction}At_${trendFactorKey}`, {
      start: trendStartTime,
      end: trendEndTime,
      defaultValue: t(`riskTrend.${riskTrend.direction}At`, {
        start: trendStartTime,
        end: trendEndTime,
      }),
    });
const shouldShowTrendLocalTime =
  Boolean(riskTrend) &&
  !riskTrendLoading &&
  trendUsesDifferentTimezone &&
  Boolean(trendStartTime && trendEndTime) &&
  riskTrend?.direction !== "stable" &&
  riskTrend?.direction !== "improving";
const riskTrendText = [
  baseRiskTrendText,
  shouldShowTrendLocalTime ? t("riskTrend.localTimeSuffix") : "",
  riskTrend?.partial && !riskTrendLoading ? t("riskTrend.partialSuffix") : "",
]
  .filter(Boolean)
  .join(" ");
const riskTrendIcon = riskTrendLoading
  ? "…"
  : !riskTrend
  ? "·"
  : riskTrend.direction === "improving"
  ? "↘"
  : riskTrend.direction === "stable"
  ? "→"
  : "↗";

//Return ok

return (
  <div className="container">
    <CompactHeader
      visible={showCompactHeader}
      city={city}
      temp={temp}
    />
    <div className={`top-sticky-ui ${showCompactHeader ? "compact-mode" : ""}`}>
      {/* 🔄 Selector d’idioma */}
      <div className="search-panel-lang-row">
        <LanguageSwitcher />
      </div>

      <div className="app-header">
        <h1 className={appTitleClass}>
  ThermoSafe – {t("risk.current")} {riskIcons}
</h1>
      </div>

	      <div ref={searchBoxRef} className="search-panel">
	  <form
    onSubmit={(e) => {
      e.preventDefault();
      const q = input.trim();
      if (!q) return;

      setErr("");
      fetchWeather(q);
    }}
	    className="search-panel-form"
	  >
    <input
      type="text"
      value={input}
      onChange={(e) => {
        const value = e.target.value;
        setInput(value);
        setShowSearchHelp(false);
        fetchCitySuggestions(value);
      }}
      placeholder={t("search_placeholder")}
	      className="search-panel-input"
	    />

    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        setShowSuggestions(false);
        setShowSearchHelp((v) => !v);
      }}
      aria-label={t("search_help_title") || "Ajuda de cerca"}
      title={t("search_help_title") || "Ajuda de cerca"}
	      className="search-panel-help-btn"
	    >
      ℹ️
    </button>

    <button
      type="submit"
      disabled={!input.trim()}
	      className="search-panel-submit"
	      style={{
	        backgroundColor: input.trim() ? "#1e90ff" : "#999",
	        cursor: input.trim() ? "pointer" : "not-allowed",
	        opacity: input.trim() ? 1 : 0.6,
	      }}
    >
      {t("search_button")}
    </button>
  </form>

  {showSearchHelp && (
    <div
      onClick={(e) => e.stopPropagation()}
	      className="search-panel-help"
	    >
      {t("search_help") ||
        "Escriu almenys 4 lletres. Els suggeriments poden requerir gairebé el nom complet de la ciutat."}
    </div>
  )}

  {!showSearchHelp && showSuggestions && suggestions.length > 0 && (
    <div
	      className="search-panel-suggestions"
	    >
      {suggestions.map((s, i) => {
        const label = [s.name, s.state, s.country].filter(Boolean).join(", ");

        return (
  <button
    key={i}
    type="button"
    onClick={() => handleSuggestionSelect(s)}
            style={{
              display: "block",
              width: "100%",
              textAlign: "left",
              padding: "12px 14px",
              border: "none",
              borderBottom: i < suggestions.length - 1 ? "1px solid #eee" : "none",
              background: "white",
              color: "#111",
              cursor: "pointer",
              fontSize: "0.95rem",
            }}
          >
            {label}
          </button>
        );
      })}
    </div>
  )}

  {err && (
    <div className="error-message">
      {err}
    </div>
  )}

	  <div className="search-panel-gps-row">
	    <button className="gps-btn gps-button" onClick={() => locate(false)}>
      {t("gps_button")}
    </button>
  </div>
</div>
</div>

    {/* Espai perquè la capçalera fixa no tapi el contingut */}
    <div className={`top-sticky-spacer ${showCompactHeader ? "compact-spacer" : ""}`} />

{/* 🔔 Interruptor per activar/desactivar avisos meteorològics */}
<div
  className="top-action-grid"
  style={{
    display: "flex",
    alignItems: "stretch",
    gap: "12px",
    flexWrap: "wrap",
    marginTop: "10px",
    marginBottom: "10px",
    fontSize: "1.1rem",
    fontWeight: "500",
  }}
>
  {/* 🔔 Botó REAL: activar/desactivar PUSH (FCM + Firestore) */}
  <div
    className="push-control-wrap"
    style={{
      display: "flex",
      alignItems: "center",
      gap: "10px",
      marginTop: "12px",
      marginBottom: "12px",
      flex: "1 1 0",
      minWidth: "0",
      maxWidth: "100%",
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
        justifyContent: "center",
        gap: "8px",
        transition: "all 0.2s ease",
        flex: 1,
        width: "100%",
        maxWidth: "100%",
        whiteSpace: "normal",
        textAlign: "center",
      }}
    >
      <span>{pushEnabled ? "🔔" : "🔕"}</span>
      {t("notifications.label")}:
      <strong>
        {pushEnabled ? t("notifications.on") : t("notifications.off")}
      </strong>
    </button>
  </div>

  {/* (opcional) Missatge d’estat/errada del push */}
  {msgHeat && (
    <p style={{ marginTop: "0.25rem", opacity: 0.9, width: "100%" }}>
      {msgHeat}
    </p>
  )}

  <div
    className="activity-control-wrap"
    style={{
      display: "flex",
      alignItems: "center",
      gap: "8px",
      flex: "1 1 0",
      minWidth: "0",
      maxWidth: "100%",
    }}
  >
    <button
      onClick={() => {
        if (activityEnabled) deactivate();
        else activate();
      }}
      disabled={activityRequesting}
      className="btn-activity"
      style={{
        backgroundColor: activityEnabled
          ? activityAffectsHeatRisk
            ? ACTIVITY_COLORS[displayedActivityLevel]
            : "#4b5563"
          : "#555",
        color: "white",
        padding: "8px 14px",
        borderRadius: "8px",
        border: "none",
        cursor: activityRequesting ? "progress" : "pointer",
        opacity: activityRequesting ? 0.82 : 1,
        fontWeight: 600,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexWrap: "wrap",
        gap: "0.4rem",
        flex: 1,
        minWidth: "0",
        maxWidth: "100%",
        whiteSpace: "normal",
        textAlign: "center",
        lineHeight: 1.25,
        minHeight: "44px",
        width: "100%",
      }}
    >
      {activityRequesting ? (
        <>
          ⏳ {t("activity.requesting")}
        </>
      ) : activityEnabled ? (
        <>
          {ACTIVITY_ICONS[displayedActivityLevel]}
          <span>
            {t("activity.active_label")}: {t(`activity.${displayedActivityLevel}`)}
          </span>
          <span className="activity-impact-note">
            {activityAffectsHeatRisk
              ? t("activity.adjusts_risk")
              : t("activity.no_impact")}
          </span>
        </>
      ) : (
        <>
          💤 {t("activity.inactive")}
        </>
      )}
    </button>

    <button
      type="button"
      className="activity-info-icon"
      aria-label={t("activity.info_label")}
      onClick={(event) => {
        event.stopPropagation();
        setShowActivityInfo(true);
      }}
    >
      ⓘ
    </button>
  </div>

  {activityError && (
    <p style={{ color: "salmon", marginTop: "0.25rem", width: "100%" }}>
      ⚠ {activityError}
    </p>
  )}

  {showActivityInfo && (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="activity-info-title"
      className="activity-info-overlay"
      onClick={() => setShowActivityInfo(false)}
    >
      <div
        className="activity-info-dialog"
        onClick={(event) => event.stopPropagation()}
      >
        <h3 id="activity-info-title">{t("activity.info_title")}</h3>
        <p>{t("activity.info_body")}</p>
        <p>{t("activity.info_privacy")}</p>
        <button
          type="button"
          className="activity-info-close"
          onClick={() => setShowActivityInfo(false)}
        >
          {t("activity.info_close")}
        </button>
      </div>
    </div>
  )}
</div>

{isRiskRenderReady && (
  <TopAlertBanner
    primary={primary}
    heatRisk={heatRisk}
    uvi={uvi}
    day={day}
    weatherMain={weatherMain}
    clouds={clouds}
    irr={irr}
    aemetActive={aemetActive}
    aemetSoon={aemetSoon}
    weatherContext={weatherContext}
    t={t}
    UV_HIGH={UV_HIGH}
    UV_EXTREME={UV_EXTREME}
  />
)}

{isRiskRenderReady ? (
  <>
     {/* 📊 DADES */}
{city && (
  <LocationCard
  city={city}
  realCity={realCity}
  label={t("location")}
/>
)}

{/* ⭐ ESTAT PRINCIPAL */}
{!aemetActive && (
  <div className={primaryStatus.className}>
    <div className="status-card-header">
      <span className="status-card-icon">{primaryStatus.icon}</span>
      <h2 className="status-card-title">{primaryStatus.title}</h2>
    </div>

    <p className="status-card-text">{primaryStatus.text}</p>
  </div>
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

{/* 🔔 AVISOS AEMET (Targetes noves) */}
{alerts.length > 0 && (
  <div style={{ marginTop: "1.5rem" }}>
    {alertCards.slice(0, 1).map(renderAlertCard)}

    {alertCards.length > 1 && (
      <details className="aemet-alert-details" style={{ marginTop: "0.75rem" }}>
        <summary className="aemet-alert-summary">
          <span className="summary-closed">
            {localUi.viewAllAlerts} ({alertCards.length - 1})
          </span>
          <span className="summary-open">{localUi.hideAlerts}</span>
        </summary>

        {alertCards.slice(1).map(renderAlertCard)}
      </details>
    )}
  </div>
)}

<div className={`work-window-card work-window-${workWindow}`}>
  <div className="work-window-header">
    <span className={`work-window-dot work-window-dot-${workWindow}`}></span>
    <h3 className="work-window-title">{workWindowTitle}</h3>
  </div>

  <p className="work-window-text">{workWindowText}</p>

  <div
    className={`risk-trend-card risk-trend-${riskTrend?.direction || "unavailable"}`}
    data-partial={riskTrend?.partial ? "true" : "false"}
    data-stale={riskTrend?.stale ? "true" : "false"}
  >
    <span className="risk-trend-icon" aria-hidden="true">{riskTrendIcon}</span>
    <span>{riskTrendText}</span>
  </div>
</div>

{/* ============================================================
   ✅ RECOMANACIONS PRINCIPALS
   Ara les governa directament el component Recommendations
   ============================================================ */}
<Recommendations
    temp={hi ?? data?.main?.temp ?? 0}
    lang={i18n.resolvedLanguage || i18n.language || "ca"}
    isDay={day}
    activity={preventiveActivity}
    humidity={data?.main?.humidity ?? undefined}
    aemetActive={aemetActive}
    aemetSoon={aemetSoon}
    alertType={activeAlertEvent}
    uvi={uvi}
    weatherMain={data?.weather?.[0]?.main ?? ""}
    weatherDescription={data?.weather?.[0]?.description ?? ""}
    cloudiness={data?.clouds?.all ?? null}
    windKmh={windKmh}
    currentHour={new Date().getHours()}
    heatDayPhase={heatDayPhase}
    coldRisk={coldRisk ?? undefined}
    coldEffectiveTemp={wc ?? temp}
    riskFactors={engineRisk?.activeFactorsSorted}
    weatherContext={weatherContext}

  />

{/* 🌡️ RESUM RÀPID */}
<div className={`quick-summary-card quick-summary-${risk}`}>
  <div className={`quick-temp ${quickTempToneClass}`}>
    {temp !== null ? `${temp.toFixed(1)}°C` : "—"}
  </div>

  <div className="quick-meta quick-meta-inline">
    <span>{hi !== null ? `${t("feels_like")}: ${hi.toFixed(1)}°C` : "—"}</span>
    <span>💨 {windKmh !== null ? `${windKmh.toFixed(1)} km/h` : "—"}</span>
    <span>☀️ {uvi !== null ? uvi.toFixed(1) : "—"}</span>
  </div>
</div>

  {/* 🌡️ CONDICIONS ACTUALS */}
<div className="block-conditions block-conditions-compact">
  <h3 className="conditions-compact-title">{t("current_conditions")}</h3>

  <div className="conditions-inline">
    <span className="condition-item">
      <strong>{t("humidity")}:</strong>{" "}
      {hum !== null ? `${hum}%` : "—"}
    </span>
    <span className="condition-item">
      <strong>{t("wind_direction")}:</strong>{" "}
      {windDeg !== null
        ? `${windText16} (${windDeg.toFixed(0)}°)`
        : "—"}
    </span>
    <span className="condition-item">
      <strong>{t("cloudiness")}:</strong>{" "}
      {typeof clouds === "number" ? `${clouds}%` :
      `${data?.clouds?.all ?? "—"}${typeof data?.clouds?.all === "number" ? "%" : ""}`}
    </span>
  </div>
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
  <div className="card sky-card sky-card-compact">
    <div className="sky-inline">
      <h3>{t("sky_state")}:</h3>
      {icon && (
        <img
          src={`https://openweathermap.org/img/wn/${icon}@2x.png`}
          alt={sky}
          className="sky-icon"
          width="28"
          height="28"
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

{/* 🌞 INFORMACIÓ SOLAR */}
{!shouldHideUVBlock && (
  <div className={`uv-block ${day ? "" : "uv-night"}`}>
    <h3 className="uv-title">{t("solar_info")}</h3>

	    {(() => {
	      const lang = normalizeLang(
	        i18n.resolvedLanguage || i18n.language || "ca"
	      ) as any;
	      const uvCompactLevel = uvSummaryText.replace(/\s*\([^)]*\)/g, "");
	      const uvCompactAdvice = uvSummaryAdvice
	        ? uvSummaryAdvice.split(".")[0] + "."
	        : "";

	      return (
	        <>
		          {/* ☀️ Durant el dia */}
		          {day && (
		            <>
		              <div className="uv-context-card uv-context-card--info uv-summary-compact">
		                <span className="uv-context-text">
		                  <strong>UV {uvSummaryValue != null ? uvSummaryValue.toFixed(1) : "—"}</strong>
		                  {" · "}
		                  {uvCompactLevel}
		                  {uvCompactAdvice && (
		                    <span className="uv-compact-advice">{uvCompactAdvice}</span>
		                  )}
		                </span>
		              </div>

		              <details className="aemet-alert-details" style={{ marginTop: "0.75rem" }}>
	                <summary className="aemet-alert-summary">
	                  <span className="summary-closed">{localUi.moreUv}</span>
		                  <span className="summary-open">{localUi.lessUv}</span>
		                </summary>

		                <p className="uv-max-detail">
		                  <strong>{localUi.uvMaxToday}:</strong>{" "}
		                  {uvMaxSummaryValue != null ? uvMaxSummaryValue.toFixed(1) : "—"}
		                </p>

		                <UVAdvice
	                  uvi={uvi}
	                  lang={i18n.resolvedLanguage || i18n.language || "ca"}
	                  weatherMain={data?.weather?.[0]?.main ?? null}
	                  cloudiness={data?.clouds?.all}
	                  weatherContext={weatherContext}
	                />

	                <UVContextCard
	                uvi={uvi}
	                lang={i18n.resolvedLanguage || i18n.language || "ca"}
	                />

	                {/* ℹ️ Nota informativa UV */}
	                <p className="uv-source-note">
	                  ℹ️ {t("uv_source_note") ??
	                    "Els valors d’índex UV poden variar segons l’hora i la font meteorològica (OpenUV, NASA o OpenWeather)."}
	                </p>

	                {/* ⏱ Temps segur d’exposició */}
	               <UVSafeTime
	                  lat={lat}
	                  lon={lon}
	                  lang={lang}
	                  uvi={uvi}
	                  skinType={skinType}
	                  onSkinTypeChange={setSkinType}
	                />

	                {/* 📊 Detall UV (OpenUV) */}
	                {lat != null && lon != null && (
	                  <UVDetailPanel
	                    lat={lat}
	                    lon={lon}
	                    lang={lang}
	                  />
	                )}
	              </details>
	            </>
	          )}

          {/* 🌙 Durant la nit */}
          {!day && (
            <p className="data-label" style={{ opacity: 0.85 }}>
              🌙 {t("uv_night_info") ??
                "És de nit. No hi ha risc per radiació UV."}
            </p>
          )}
	        </>
	      );
	    })()}

	    <div className="uv-integrated-controls">
	      <UVScale
	        lang={currentLang as any}
	        uvi={uvi ?? 0}
	      />

	      <div className="uv-skin-toggle-wrap">
	        <button
	          className="secondary-toggle-btn uv-skin-toggle"
	          onClick={() => setShowSkinInfo(v => !v)}
	        >
	          🧴 {localUi.skinType}
	        </button>

	        {showSkinInfo && (
	          <SkinTypeInfo
	            lang={currentLang as "ca" | "es" | "eu" | "gl" | "en"}
	            value={skinType}
	            onChange={setSkinType}
	          />
	        )}
	      </div>
	    </div>
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

	  </>
) : (
  !err && (
    <div className={`loading-weather-card ${loading ? "is-loading" : ""}`} aria-busy={loading}>
      <span className="loading-weather-icon" aria-hidden="true">↻</span>
      <p>{t("loading") || "Carregant dades meteorològiques..."}</p>
    </div>
  )
)}
{err && <p style={{ color: 'red' }}>{err}</p>}
</div>
);
}
