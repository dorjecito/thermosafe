/* public/firebase-messaging-sw.js */
importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyBHcrvu7pUzNSH6Tk0LhvRavHknrIox8U8",
  authDomain: "thermosafe-58f46.firebaseapp.com",
  projectId: "thermosafe-58f46",
  storageBucket: "thermosafe-58f46.firebasestorage.app",
  messagingSenderId: "293147213871",
  appId: "1:293147213871:web:b7f5a12817d4bf57e886da",
  measurementId: "G-5BNW2FLZ54"
});

const messaging = firebase.messaging();

/* 🔔 Rebre missatges en BACKGROUND via FCM */
messaging.onBackgroundMessage((payload) => {
  console.log('[SW] onBackgroundMessage', payload);

  const n = payload.notification || {};
  const d = payload.data || {};
  const title = n.title || d.title || 'ThermoSafe';
  const body  = n.body  || d.body  || '';
  const url   = (payload.fcmOptions && payload.fcmOptions.link) || d.url || 'https://thermosafe.app';

  self.registration.showNotification(title, {
    body,
    icon: '/icons/icon-192.png',
    badge: '/icons/badge-72.png',
    data: { url },
    tag: d.tag || 'thermosafe-risk'
  });
});

/* 🔗 Obrir l’app en clicar la notificació */
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification?.data?.url || 'https://thermosafe.app';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      const had = list.find(c => c.url.startsWith(url));
      return had ? had.focus() : clients.openWindow(url);
    })
  );
});

