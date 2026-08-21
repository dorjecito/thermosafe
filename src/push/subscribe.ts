// 🔔 Subscripció i gestió de notificacions push ThermoSafe
// --------------------------------------------------------
import {
  doc,
  setDoc,
  deleteDoc,
  getDoc,
  serverTimestamp,
  type FieldValue,
  type Timestamp,
} from "firebase/firestore";
import { getToken } from "firebase/messaging";
import { db, messagingPromise } from "../firebase";
import {
  buildTokenLastSyncedPayload,
  saveTokenLastSyncedLocally,
  writeWithOptionalTokenSyncFallback,
} from "../utils/tokenSyncMetadata";
import { waitForServiceWorkerRegistrationActive } from "../utils/firebaseMessagingSw";

type Level = "moderate" | "high" | "very_high";
type Lang = "ca" | "es" | "eu" | "gl" | "en";

type SavedLocation = {
  lat: number;
  lon: number;
  place?: string;
  lang?: Lang;
};

type SubDoc = {
  token: string;
  lat: number;
  lon: number;
  place?: string;
  threshold?: Level;
  lang?: Lang;
  lastNotified?: number | null;
  lastNotifiedDay?: string | null;
  lastDailyResetDay?: string | null;
  createdAt?: number;
  updatedAt?: number;
  lastHeatLevel?: number;
  lastHeatAt?: number;
  lastColdLevel?: number;
  lastColdAt?: number;
  lastWindLevel?: number;
  lastWindAt?: number;
  lastUvLevel?: number;
  lastUvAt?: number;
  lastAemetLevel?: number;
  lastAemetAt?: number;
  tokenLastSyncedAt?: Timestamp | FieldValue | null;
};

const RESET_DISTANCE_KM = 15;
const MIN_UPDATE_DISTANCE_KM = 0.1; // 100 metres

async function askNotifPerm(): Promise<boolean> {
  if (!("Notification" in window)) return false;
  const res = await Notification.requestPermission();
  return res === "granted";
}

async function getCoords(): Promise<{ lat: number; lon: number } | null> {
  if (!("geolocation" in navigator)) return null;

  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lon: p.coords.longitude }),
      () => resolve(null),
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 }
    );
  });
}

function normalizeLang(fallback: Lang = "ca"): Lang {
  const raw = (navigator.language || fallback).slice(0, 2) as Lang;
  return (["ca", "es", "eu", "gl", "en"] as Lang[]).includes(raw)
    ? raw
    : fallback;
}

function normalizeLangValue(lang: string | undefined, fallback: Lang = "ca"): Lang {
  const raw = (lang || fallback).slice(0, 2).toLowerCase() as Lang;
  return (["ca", "es", "eu", "gl", "en"] as Lang[]).includes(raw)
    ? raw
    : fallback;
}

function normalizePlaceValue(place: string | undefined): string | undefined {
  const normalized = place?.trim();
  return normalized ? normalized : undefined;
}

function haversineKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const R = 6371;

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) ** 2;

  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function resetRiskLevelsPayload() {
  return {
    lastNotified: null,
    lastNotifiedDay: null,
    lastDailyResetDay: null,

    lastHeatLevel: 0,
    lastHeatAt: 0,

    lastColdLevel: 0,
    lastColdAt: 0,

    lastWindLevel: 0,
    lastWindAt: 0,

    lastUvLevel: 0,
    lastUvAt: 0,

    lastAemetLevel: 0,
    lastAemetAt: 0,
  };
}

function tokenLastSyncedPayload() {
  return buildTokenLastSyncedPayload(serverTimestamp());
}

function rememberSuccessfulTokenSync() {
  saveTokenLastSyncedLocally(localStorage);
}

function logNotifications(message: string, details?: unknown) {
  if (!import.meta.env.DEV) return;
  if (details === undefined) {
    console.log(`[Notifications] ${message}`);
  } else {
    console.log(`[Notifications] ${message}`, details);
  }
}

function warnNotifications(message: string, error?: unknown) {
  if (!import.meta.env.DEV) return;
  if (error === undefined) {
    console.warn(`[Notifications] ${message}`);
  } else {
    console.warn(`[Notifications] ${message}`, error);
  }
}

function getNotificationErrorDetails(stage: string, error: unknown) {
  return {
    stage,
    name: error instanceof Error ? error.name : undefined,
    code:
      typeof error === "object" && error !== null && "code" in error
        ? String((error as { code?: unknown }).code)
        : undefined,
    message: error instanceof Error ? error.message : String(error),
  };
}

function warnNotificationStageError(stage: string, error: unknown) {
  warnNotifications(
    "Error de diagnòstic en activar notificacions push.",
    getNotificationErrorDetails(stage, error)
  );
}

async function writeSubDocWithOptionalTokenSync<T extends Record<string, unknown>>(
  ref: ReturnType<typeof doc>,
  payload: T,
  stage = "setDoc"
) {
  return writeWithOptionalTokenSyncFallback(
    payload,
    async (payloadToWrite) => {
      logNotifications("Just abans de setDoc().", {
        stage,
        hasTokenLastSyncedAt: "tokenLastSyncedAt" in payloadToWrite,
      });

      try {
        await setDoc(ref, payloadToWrite, { merge: true });
        logNotifications("setDoc() OK.", {
          stage,
          hasTokenLastSyncedAt: "tokenLastSyncedAt" in payloadToWrite,
        });
      } catch (error) {
        warnNotificationStageError(stage, error);
        throw error;
      }
    },
    rememberSuccessfulTokenSync,
    (error) =>
      warnNotifications(
        "No s'ha pogut desar tokenLastSyncedAt. La subscripció continua sent vàlida.",
        error
      )
  );
}

async function getFirebaseMessagingSwRegistration(): Promise<ServiceWorkerRegistration> {
  if (!("serviceWorker" in navigator)) {
    throw new Error("Aquest navegador no suporta Service Worker");
  }

  const reg = await navigator.serviceWorker.register("/firebase-messaging-sw.js", {
    scope: "/firebase-cloud-messaging-push-scope",
    updateViaCache: "none",
  });

  await waitForServiceWorkerRegistrationActive(reg);

  logNotifications("Firebase Messaging SW registrat.", { scope: reg.scope });
  return reg;
}

export async function getCurrentFcmToken(): Promise<string | null> {
  const swReg = await getFirebaseMessagingSwRegistration();

  const messaging = await messagingPromise;
  if (!messaging) throw new Error("El navegador no suporta Web Push");

  const vapidKey =
    "BNh8R1YOsrnV58xNBIOVi-aMIYCvTsPpdmn7hcKJ3lldQUZ8BF6qP_wEa84TnIwZ765YQxHGWc7fAdpegzgH184";

  const token = await getToken(messaging, {
    vapidKey,
    serviceWorkerRegistration: swReg,
  });

  if (!token || token.length < 50) return null;

  if (import.meta.env.DEV) {
    console.log("🔑 Token FCM disponible:", {
      tokenAvailable: true,
      tokenLength: token.length,
    });
  }
  return token;
}

export async function updateRiskAlertLocation({
  lat,
  lon,
  place,
  lang,
}: SavedLocation): Promise<boolean> {
  const token =
    localStorage.getItem("fcmToken") || (await getCurrentFcmToken());

  if (!token) {
    console.warn("⚠️ No hi ha token FCM disponible per actualitzar ubicació.");
    return false;
  }

  try {
    const ref = doc(db, "subs", token);
    const snap = await getDoc(ref);
    const now = Date.now();

    let distanceKm = 0;
    let mustResetLevels = false;
    let prevLang: Lang | undefined;
    let prevPlace: string | undefined;
    const langNorm = lang ? normalizeLangValue(lang) : undefined;
    const placeNorm = normalizePlaceValue(place);

    if (snap.exists()) {
      const prev = snap.data() as SubDoc;
      const prevLat = Number(prev.lat);
      const prevLon = Number(prev.lon);
      prevLang = prev.lang;
      prevPlace = normalizePlaceValue(prev.place);

      distanceKm =
        Number.isFinite(prevLat) && Number.isFinite(prevLon)
          ? haversineKm(prevLat, prevLon, lat, lon)
          : Infinity;

      mustResetLevels = distanceKm >= RESET_DISTANCE_KM;
    }

    const roundedDistanceKm = Math.round(distanceKm * 100) / 100;
    const langChanged = Boolean(langNorm && langNorm !== prevLang);
    const placeChanged = Boolean(placeNorm && placeNorm !== prevPlace);

    if (
      snap.exists() &&
      distanceKm < MIN_UPDATE_DISTANCE_KM &&
      !langChanged &&
      !placeChanged
    ) {
      await writeSubDocWithOptionalTokenSync(
        ref,
        {
          token,
          updatedAt: now,
          ...tokenLastSyncedPayload(),
        }
      );

      if (import.meta.env.DEV) {
        logNotifications("Ubicació de notificacions sense canvis rellevants.", {
          tokenAvailable: true,
          tokenLength: token.length,
          place: placeNorm || "",
          distanceKm: roundedDistanceKm,
          minUpdateKm: MIN_UPDATE_DISTANCE_KM,
          mustResetLevels: false,
        });
      }

      return true;
    }

    const payload: Partial<SubDoc> = {
      token,
      lat,
      lon,
      ...(placeNorm ? { place: placeNorm } : {}),
      ...(langNorm ? { lang: langNorm } : {}),
      updatedAt: now,
      ...tokenLastSyncedPayload(),
      ...(mustResetLevels ? resetRiskLevelsPayload() : {}),
    };

    await writeSubDocWithOptionalTokenSync(ref, payload as Record<string, unknown>);

    if (import.meta.env.DEV) {
      logNotifications("Ubicació de notificacions actualitzada.", {
        tokenAvailable: true,
        tokenLength: token.length,
        place: placeNorm || "",
        distanceKm: roundedDistanceKm,
        mustResetLevels,
      });
    }

    return true;
  } catch (e) {
    warnNotifications(
      "No s'ha pogut actualitzar la ubicació. La subscripció continua sent vàlida.",
      e
    );
    return false;
  }
}

export async function updateRiskAlertLanguage(lang: Lang): Promise<boolean> {
  const token = localStorage.getItem("fcmToken");

  if (!token) {
    logNotifications("No hi ha token FCM per actualitzar l'idioma de notificacions.");
    return false;
  }

  try {
    const ref = doc(db, "subs", token);
    const snap = await getDoc(ref);

    if (!snap.exists()) {
      logNotifications("No existeix subscripció a Firestore per actualitzar idioma.");
      return false;
    }

    await writeSubDocWithOptionalTokenSync(
      ref,
      {
        lang: normalizeLangValue(lang),
        updatedAt: Date.now(),
        ...tokenLastSyncedPayload(),
      }
    );

    logNotifications("Idioma de notificacions actualitzat.", { lang });
    return true;
  } catch (e) {
    warnNotifications("No s'ha pogut actualitzar l'idioma de notificacions.", e);
    return false;
  }
}

export async function updateRiskAlertLocationFromGps(
  place?: string
): Promise<boolean> {
  const loc = await getCoords();

  if (!loc) {
    console.warn("⚠️ No s'ha pogut obtenir GPS per actualitzar ubicació.");
    return false;
  }

  return updateRiskAlertLocation({
    lat: loc.lat,
    lon: loc.lon,
    place,
  });
}

export async function enableRiskAlerts({
  threshold = "moderate" as Level,
  lang,
  place,
}: { threshold?: Level; lang?: Lang; place?: string } = {}) {
  let stage = "start";

  try {
    logNotifications("Iniciant activació de notificacions push.");

    stage = "Notification.requestPermission";
    const ok = await askNotifPerm();
    if (!ok) throw new Error("Has denegat el permís de notificacions");
    logNotifications("Permís de notificacions OK.", {
      permission: Notification.permission,
    });

    stage = "geolocation.getCurrentPosition";
    const loc = await getCoords();
    if (!loc) throw new Error("No s'ha pogut obtenir la ubicació (GPS)");
    logNotifications("GPS OK.", {
      latAvailable: Number.isFinite(loc.lat),
      lonAvailable: Number.isFinite(loc.lon),
    });

    stage = "serviceWorker.register";
    const swReg = await getFirebaseMessagingSwRegistration();

    stage = "messaging.isSupported";
    const messaging = await messagingPromise;
    if (!messaging) throw new Error("El navegador no suporta Web Push");

    const vapidKey =
      "BNh8R1YOsrnV58xNBIOVi-aMIYCvTsPpdmn7hcKJ3lldQUZ8BF6qP_wEa84TnIwZ765YQxHGWc7fAdpegzgH184";

    stage = "getToken";
    logNotifications("Just abans de getToken().", {
      serviceWorkerScope: swReg.scope,
      hasVapidKey: Boolean(vapidKey),
    });
    const token = await getToken(messaging, {
      vapidKey,
      serviceWorkerRegistration: swReg,
    });

    if (!token || token.length < 50) {
      throw new Error("Token FCM invàlid o buit");
    }

    logNotifications("getToken() OK.", {
      tokenAvailable: true,
      tokenLength: token.length,
    });

    const langNorm = lang ? normalizeLangValue(lang) : normalizeLang("ca");
    const placeNorm = normalizePlaceValue(place);
    const ref = doc(db, "subs", token);

    stage = "getDoc";
    logNotifications("Just abans de getDoc().");
    const snap = await getDoc(ref);
    logNotifications("getDoc() OK.", {
      exists: snap.exists(),
    });

    const now = Date.now();

    if (!snap.exists()) {
      stage = "setDoc:create";
      await writeSubDocWithOptionalTokenSync(
        ref,
        {
          token,
          lat: loc.lat,
          lon: loc.lon,
          threshold,
          lang: langNorm,
          ...(placeNorm ? { place: placeNorm } : {}),
          createdAt: now,
          updatedAt: now,
          ...tokenLastSyncedPayload(),
          ...resetRiskLevelsPayload(),
        },
        stage
      );

      logNotifications("Subscripció nova creada a Firestore.");
    } else {
      const prev = snap.data() as SubDoc;

      const prevLat = Number(prev.lat);
      const prevLon = Number(prev.lon);

      const distanceKm =
        Number.isFinite(prevLat) && Number.isFinite(prevLon)
          ? haversineKm(prevLat, prevLon, loc.lat, loc.lon)
          : Infinity;

      const mustResetLevels = distanceKm >= RESET_DISTANCE_KM;

      stage = "setDoc:update";
      await writeSubDocWithOptionalTokenSync(
        ref,
        {
          token,
          lat: loc.lat,
          lon: loc.lon,
          threshold,
          lang: langNorm,
          ...(placeNorm ? { place: placeNorm } : {}),
          updatedAt: now,
          ...tokenLastSyncedPayload(),
          ...(mustResetLevels ? resetRiskLevelsPayload() : {}),
        },
        stage
      );

      if (import.meta.env.DEV) {
        logNotifications("Subscripció existent actualitzada a Firestore.", {
          tokenAvailable: true,
          tokenLength: token.length,
          distanceKm: Math.round(distanceKm * 100) / 100,
          mustResetLevels,
        });
      }
    }

    stage = "localStorage.setItem";
    localStorage.setItem("fcmToken", token);
    logNotifications("localStorage fcmToken guardat.", {
      tokenAvailable: true,
      tokenLength: token.length,
    });

    stage = "complete";
    logNotifications("Final correcte de enableRiskAlerts().");
    logNotifications("Activació completada correctament.");
    return token;
  } catch (error) {
    warnNotificationStageError(stage, error);
    throw error;
  }
}

export async function disableRiskAlerts(token: string | null) {
  if (!token) return;

  try {
    await deleteDoc(doc(db, "subs", token));
    localStorage.removeItem("fcmToken");
    logNotifications("Subscripció eliminada de Firestore i localStorage.");
  } catch (e) {
    console.error("⚠️ Error eliminant subscripció:", e);
  }
}
