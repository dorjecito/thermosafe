// 🔔 Subscripció i gestió de notificacions push ThermoSafe
// --------------------------------------------------------
import { doc, setDoc, deleteDoc, getDoc } from "firebase/firestore";
import { getToken } from "firebase/messaging";
import { db, messagingPromise } from "../firebase";

// 🔹 Tipus bàsics
type Level = "moderate" | "high" | "very_high";
type Lang = "ca" | "es" | "eu" | "gl";

type SavedLocation = {
  lat: number;
  lon: number;
  place?: string;
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
};

// --------------------------------------------------------
// ⚙️ Config
const RESET_DISTANCE_KM = 15;

// --------------------------------------------------------
// 🟢 Permís de notificacions
async function askNotifPerm(): Promise<boolean> {
  if (!("Notification" in window)) return false;
  const res = await Notification.requestPermission();
  return res === "granted";
}

// --------------------------------------------------------
// 📍 Coordenades (GPS)
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

// --------------------------------------------------------
// 🌍 Idioma normalitzat segons navegador
function normalizeLang(fallback: Lang = "ca"): Lang {
  const raw = (navigator.language || fallback).slice(0, 2) as Lang;
  return (["ca", "es", "eu", "gl"] as Lang[]).includes(raw) ? raw : fallback;
}

// --------------------------------------------------------
// 📏 Distància entre dues coordenades (Haversine)
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
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// --------------------------------------------------------
// 🛠️ Registra el Service Worker específic de Firebase Messaging
async function getFirebaseMessagingSwRegistration(): Promise<ServiceWorkerRegistration> {
  if (!("serviceWorker" in navigator)) {
    throw new Error("Aquest navegador no suporta Service Worker");
  }

  const reg = await navigator.serviceWorker.register("/firebase-messaging-sw.js", {
    scope: "/firebase-cloud-messaging-push-scope",
    updateViaCache: "none",
  });

  await navigator.serviceWorker.ready;

  console.log("✅ Firebase Messaging SW registrat:", reg.scope);
  return reg;
}

// --------------------------------------------------------
// 🔑 Recupera el token FCM actual
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

  console.log("🔑 Token FCM actual:", token);
  return token;
}

// --------------------------------------------------------
// 📍 Actualitza ubicació guardada de la subscripció actual
export async function updateRiskAlertLocation({
  lat,
  lon,
  place,
}: SavedLocation): Promise<boolean> {
  const token =
    localStorage.getItem("fcmToken") || (await getCurrentFcmToken());

  if (!token) {
    console.warn("⚠️ No hi ha token FCM disponible per actualitzar ubicació.");
    return false;
  }

  try {
    await setDoc(
      doc(db, "subs", token),
      {
        token,
        lat,
        lon,
        ...(place ? { place } : {}),
        updatedAt: Date.now(),
      },
      { merge: true }
    );

    console.log("📍 Ubicació de notificacions actualitzada:", {
      tokenPreview: token.slice(0, 20),
      lat,
      lon,
      place: place || "",
    });

    return true;
  } catch (e) {
    console.error("⚠️ Error actualitzant ubicació de notificacions:", e);
    return false;
  }
}

// --------------------------------------------------------
// 📍 Actualitza ubicació de notificacions amb GPS actual
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

// --------------------------------------------------------
// ✅ Activa push, obté token i desa doc a Firestore: subs/{token}
export async function enableRiskAlerts({
  threshold = "moderate" as Level,
  lang,
}: { threshold?: Level; lang?: Lang } = {}) {
  console.log("🟢 Iniciant activació de notificacions push...");

  const ok = await askNotifPerm();
  if (!ok) throw new Error("Has denegat el permís de notificacions");

  const loc = await getCoords();
  if (!loc) throw new Error("No s'ha pogut obtenir la ubicació (GPS)");

  const swReg = await getFirebaseMessagingSwRegistration();

  const messaging = await messagingPromise;
  if (!messaging) throw new Error("El navegador no suporta Web Push");

  const vapidKey =
    "BNh8R1YOsrnV58xNBIOVi-aMIYCvTsPpdmn7hcKJ3lldQUZ8BF6qP_wEa84TnIwZ765YQxHGWc7fAdpegzgH184";

  const token = await getToken(messaging, {
    vapidKey,
    serviceWorkerRegistration: swReg,
  });

  if (!token || token.length < 50) {
    throw new Error("Token FCM invàlid o buit");
  }

  console.log("🔑 Token FCM obtingut:", token);

  const langNorm = lang ?? normalizeLang("ca");
  console.log("🌍 Idioma:", langNorm);
  console.log("📍 Coordenades:", loc);

  const ref = doc(db, "subs", token);
  const snap = await getDoc(ref);
  const now = Date.now();

  try {
    if (!snap.exists()) {
      await setDoc(
        ref,
        {
          token,
          lat: loc.lat,
          lon: loc.lon,
          threshold,
          lang: langNorm,

          lastNotified: null,
          lastNotifiedDay: null,
          createdAt: now,
          updatedAt: now,

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
        },
        { merge: true }
      );

      console.log("✅ Subscripció nova creada a Firestore.");
    } else {
      const prev = snap.data() as SubDoc;

      const prevLat = Number(prev.lat);
      const prevLon = Number(prev.lon);

      const distanceKm =
        Number.isFinite(prevLat) && Number.isFinite(prevLon)
          ? haversineKm(prevLat, prevLon, loc.lat, loc.lon)
          : Infinity;

      const mustResetLevels = distanceKm >= RESET_DISTANCE_KM;

      const updatePayload: Partial<SubDoc> = {
        token,
        lat: loc.lat,
        lon: loc.lon,
        threshold,
        lang: langNorm,
        updatedAt: now,
      };

      if (mustResetLevels) {
        updatePayload.lastNotified = null;
        updatePayload.lastNotifiedDay = null;

        updatePayload.lastHeatLevel = 0;
        updatePayload.lastHeatAt = 0;

        updatePayload.lastColdLevel = 0;
        updatePayload.lastColdAt = 0;

        updatePayload.lastWindLevel = 0;
        updatePayload.lastWindAt = 0;

        updatePayload.lastUvLevel = 0;
        updatePayload.lastUvAt = 0;

        updatePayload.lastAemetLevel = 0;
        updatePayload.lastAemetAt = 0;
      }

      await setDoc(ref, updatePayload, { merge: true });

      console.log("✅ Subscripció existent actualitzada a Firestore.", {
        tokenPreview: token.slice(0, 20),
        distanceKm: Math.round(distanceKm * 100) / 100,
        mustResetLevels,
      });
    }
  } catch (e) {
    console.error("⚠️ Error desant la subscripció a Firestore:", e);
    throw e;
  }

  localStorage.setItem("fcmToken", token);

  console.log("✅ Activació completada correctament.");
  return token;
}

// --------------------------------------------------------
// 🔴 Desactiva: elimina subs/{token} i neteja local
export async function disableRiskAlerts(token: string | null) {
  if (!token) return;

  try {
    await deleteDoc(doc(db, "subs", token));
    localStorage.removeItem("fcmToken");
    console.log("🧹 Subscripció eliminada de Firestore i localStorage.");
  } catch (e) {
    console.error("⚠️ Error eliminant subscripció:", e);
  }
}