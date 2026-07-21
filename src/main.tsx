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

// 🔔 Registre del Service Worker únic (PWA + Firebase)
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then(reg => console.log('🟢 Service Worker registrat correctament:', reg.scope))
      .catch(err => console.error('🔴 Error en registrar el Service Worker:', err));
  });
}
