importScripts("https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/9.23.0/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey: "AIzaSyBHCzruP7U2NsHGt6t0LhvRavlHknrIox8U8",
  authDomain: "thermosafe-58f46.firebaseapp.com",
  projectId: "thermosafe-58f46",
  storageBucket: "thermosafe-58f46.appspot.com",
  messagingSenderId: "293147213871",
  appId: "1:293147213871:web:b7f5a128174dbf57e886da",
  measurementId: "G-5N8W2FL5Z4",
});

const messaging = firebase.messaging();

function buildNotificationFromPayload(payload) {
  const notification = payload?.notification || {};
  const data = payload?.data || {};

  const title = data.title || notification.title || "ThermoSafe – Avís";
  const body = data.body || notification.body || "";
  const lang = data.lang || "ca";
  const icon = data.icon || "/icons/icon-192.png";
  const badge = data.badge || "/icons/badge-72.png";
  const tag = data.tag || "thermosafe-notification";

  return {
    title,
    options: {
      body,
      icon,
      badge,
      tag,
      renotify: true,
      requireInteraction: true,
      data,
      actions: [
        { action: "open", title: lang === "es" ? "Abrir" : "Obrir" },
        { action: "dismiss", title: lang === "es" ? "Descartar" : "Tancar" },
      ],
    },
  };
}

messaging.onBackgroundMessage((payload) => {
  const { title, options } = buildNotificationFromPayload(payload);
  return self.registration.showNotification(title, options);
});

self.addEventListener("push", (event) => {
  if (!event.data) return;

  let payload = {};
  try {
    payload = event.data.json();
  } catch (e) {
    payload = {
      notification: {
        title: "ThermoSafe – Avís",
        body: event.data.text(),
      },
      data: {
        url: "https://thermosafe.app",
      },
    };
  }

  const { title, options } = buildNotificationFromPayload(payload);
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  if (event.action === "dismiss") return;

  const targetUrl =
    event.notification?.data?.url ||
    event.notification?.data?.click_action ||
    "https://thermosafe.app";

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ("focus" in client) return client.focus();
      }
      return clients.openWindow(targetUrl);
    })
  );
});