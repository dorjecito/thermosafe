// src/push/subscribe.ts
import { doc, setDoc, deleteDoc } from "firebase/firestore";
import { getToken } from "firebase/messaging";
import { db, messagingPromise } from "../firebase";

type Level = "moderate" | "high" | "very_high";
type Lang  = "ca" | "es" | "eu" | "gl";

async function registerSW() {
  if (!("serviceWorker" in navigator)) return null;
  return navigator.serviceWorker.register("/firebase-messaging-sw.js", { scope: "/" });
}

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
  const raw = (navigator.language || fallback).slice(0,2) as Lang;
  return (["ca","es","eu","gl"] as Lang[]).includes(raw) ? raw : fallback;
}

/** Activa push, obté token i desarà doc a Firestore: subs/{token} */
export async function enableRiskAlerts({ threshold = "moderate" as Level, lang }: { threshold?: Level; lang?: Lang } = {}) {
  // 1) permisos
  const ok = await askNotifPerm();
  if (!ok) throw new Error("Has denegat el permís de notificacions");

  // 2) coords
  const loc = await getCoords();
  if (!loc) throw new Error("No s'ha pogut obtenir la ubicació (GPS)");

  // 3) SW + Messaging
  const swReg = await registerSW();
  const messaging = await messagingPromise;
  if (!messaging || !swReg) throw new Error("El navegador no suporta Web Push");

  // 4) token FCM (posa aquí la teva VAPID pública)
  const vapidKey = "BNh8R1YOsrnV58xNBIOVi-aMIYCvTsPpdmn7hcKJ3lldQUZ8BF6qP_wEa84TnIwZ765YQxHGWc7fAdpegzgH184";
  const token = await getToken(messaging, { vapidKey, serviceWorkerRegistration: swReg });
  if (!token) throw new Error("No s'ha obtingut token FCM");

  // 5) idioma normalitzat
  const langNorm = lang ?? normalizeLang("ca");

  // 6) desa a Firestore (doc id = token)
  await setDoc(doc(db, "subs", token), {
    token,
    lat: loc.lat,
    lon: loc.lon,
    threshold,
    lang: langNorm,
    lastNotified: null,
    lastNotifiedDay: null,
    createdAt: Date.now(),
  }, { merge: true });

  // 7) persistència local (opcional)
  localStorage.setItem("fcmToken", token);

  return token;
}

/** Desactiva: elimina subs/{token} i neteja local */
export async function disableRiskAlerts(token: string | null) {
  if (!token) return;
  await deleteDoc(doc(db, "subs", token));
  localStorage.removeItem("fcmToken");
}
