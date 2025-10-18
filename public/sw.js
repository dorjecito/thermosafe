// -- Service Worker únic per ThermoSafe (PWA + FCM) --

// 🔹 Actualitza automàticament
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(clients.claim()));

// -- Firebase Messaging (compat) --
importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-messaging-compat.js');

// 🔧 Config Firebase
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

// ✅ Rebre missatges FCM en segon pla
messaging.onBackgroundMessage((payload) => {
  const notification = payload.notification || {};
  const data = payload.data || {};
  const title = notification.title || 'ThermoSafe – Avís';
  const body = notification.body || '';
  const lang = data.lang || 'ca';

  self.registration.showNotification(title, {
    body,
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    data,
    actions: [
      { action: 'open', title: lang === 'es' ? 'Abrir' : 'Obrir' },
      { action: 'dismiss', title: lang === 'es' ? 'Descartar' : 'Tancar' }
    ]
  });
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  if (event.action === 'dismiss') return;
  event.waitUntil(clients.openWindow('https://thermosafe.app'));
});