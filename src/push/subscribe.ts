// 🔔 Subscripció i gestió de notificacions push ThermoSafe
// --------------------------------------------------------
import { doc, setDoc, deleteDoc } from "firebase/firestore";
import { getToken } from "firebase/messaging";
import { db, messagingPromise } from "../firebase";

// 🔹 Tipus bàsics
type Level = "moderate" | "high" | "very_high";
type Lang  = "ca" | "es" | "eu" | "gl";

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
// ✅ Activa push, obté token i desa doc a Firestore: subs/{token}
export async function enableRiskAlerts({
  threshold = "moderate" as Level,
  lang,
}: { threshold?: Level; lang?: Lang } = {}) {

  console.log("🟢 Iniciant activació de notificacions push...");

  // 1️⃣ Permisos
  const ok = await askNotifPerm();
  if (!ok) throw new Error("Has denegat el permís de notificacions");

  // 2️⃣ Coordenades
  const loc = await getCoords();
  if (!loc) throw new Error("No s'ha pogut obtenir la ubicació (GPS)");

  // 3️⃣ Service Worker actiu (espera que estigui llest)
  const swReg = await navigator.serviceWorker.ready;
  if (!swReg) throw new Error("No s'ha pogut inicialitzar el Service Worker");

  // 4️⃣ Inicialitza Firebase Messaging
  const messaging = await messagingPromise;
  if (!messaging) throw new Error("El navegador no suporta Web Push");

  // 5️⃣ Obté el token FCM (clau pública VAPID)
  const vapidKey = "BNh8R1YOsrnV58xNBIOVi-aMIYCvTsPpdmn7hcKJ3lldQUZ8BF6qP_wEa84TnIwZ765YQxHGWc7fAdpegzgH184";
  const token = await getToken(messaging, { vapidKey, serviceWorkerRegistration: swReg });

  if (!token || token.length < 50) throw new Error("Token FCM invàlid o buit");

  console.log("🔑 Token FCM obtingut:", token);

  // 6️⃣ Idioma normalitzat
  const langNorm = lang ?? normalizeLang("ca");
  console.log("🌍 Idioma:", langNorm);
  console.log("📍 Coordenades:", loc);

  // 7️⃣ Desa la subscripció a Firestore
  try {
    await setDoc(
      doc(db, "subs", token),
      {
        token,
        lat: loc.lat,
        lon: loc.lon,
        threshold,
        lang: langNorm,
        lastNotified: null,
        lastNotifiedDay: null,
        createdAt: Date.now(),
      },
      { merge: true }
    );
    console.log("✅ Subscripció desada correctament a Firestore.");
  } catch (e) {
    console.error("⚠️ Error desant la subscripció a Firestore:", e);
  }

  // 8️⃣ Desa també localment (opcional)
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