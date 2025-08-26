import './i18n'; // Això inicialitza el sistema de traducció
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.tsx';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);

// 🔔 Registre del Service Worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/firebase-messaging-sw.js')
      .then(registration => {
        console.log('✅ Service Worker registrat correctament:', registration);
      })
      .catch(error => {
        console.error('❌ Error en registrar el Service Worker:', error);
      });
  });
}