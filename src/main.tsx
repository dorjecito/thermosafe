import './i18n'; // Això inicialitza el sistema de traducció
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.tsx';
import { startupEnd, startupMark, startupStart } from "./utils/startupAudit";

startupMark("app-start");
startupMark("bundle-initialized");
startupStart("react-render");
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
startupEnd("react-render");

// 🔔 Registre del Service Worker únic (PWA + Firebase)
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    startupStart("service-worker-register");
    navigator.serviceWorker
      .register('/sw.js')
      .then(reg => {
        startupEnd("service-worker-register", { status: "registered" });
        console.log('🟢 Service Worker registrat correctament:', reg.scope);
      })
      .catch(err => {
        startupEnd("service-worker-register", { status: "error" });
        console.error('🔴 Error en registrar el Service Worker:', err);
      });
  });
}
