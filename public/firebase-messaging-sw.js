// -- Firebase Messaging SW (v9 compat) --
importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-messaging-compat.js');

// 🔧 Config del teu projecte
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

// 🗣️ cadenes per idioma
const STR = {
  ca: { open: 'Obrir',  dismiss: 'Descartar'  },
  es: { open: 'Abrir',  dismiss: 'Descartar'  },
  eu: { open: 'Ireki',  dismiss: 'Baztertu'   },
  gl: { open: 'Abrir',  dismiss: 'Descartar'  },
};

// 🌐 URL destí (dev/prod)
const PROD_URL = 'https://thermosafe.app';
const DEV_URL  = self.location.origin;                      // p.ex. http://localhost:5173
const FALLBACK_URL = self.location.host.includes('localhost') ? DEV_URL : PROD_URL;

// 🧠 helper: afegeix municipi si ve al payload
function withPlace(body, place) {
  if (!place) return body;
  return `${place} · ${body}`; // format curt
}

// ✅ Rebre missatges en BACKGROUND (FCM)
messaging.onBackgroundMessage(async (payload) => {
  const n = payload.notification || {};
  const d = payload.data || {};

  const lang  = d.lang || 'ca';
  const url   = d.url || FALLBACK_URL;
  const place = d.place || '';

  const title = n.title || 'ThermoSafe – Avís INSST';
  const body  = withPlace(n.body || '', place);

  // Evita duplicats amb el mateix tag
  const tag = 'thermosafe-risk';
  const existing = await self.registration.getNotifications({ tag });
  existing.forEach(n => n.close());

  await self.registration.showNotification(title, {
    body,
    icon: '/icons/icon-192.png',
    badge: '/icons/badge-72.png',
    tag,
    data: { url, lang },
    actions: [
      { action: 'open',    title: STR[lang]?.open    || STR.ca.open },
      { action: 'dismiss', title: STR[lang]?.dismiss || STR.ca.dismiss },
    ],
    renotify: false, // perquè el “tag” substitueixi l’anterior
  });
});

// 🖱️ Obrir/focalitzar la pestanya quan es cliqui
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  if (event.action === 'dismiss') return;

  const rawUrl = event.notification?.data?.url || FALLBACK_URL;
  // Si l’URL és relatiu, fes-lo absolut sobre l’origen actual
  const finalUrl = rawUrl.startsWith('http') ? rawUrl : `${self.location.origin}${rawUrl}`;

  event.waitUntil((async () => {
    const all = await clients.matchAll({ type: 'window', includeUncontrolled: true });
    const existing = all.find(c => c.url.startsWith(finalUrl));
    if (existing) return existing.focus();
    return clients.openWindow(finalUrl);
  })());
});