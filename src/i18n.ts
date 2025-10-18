/* ------------------------------------------------------------------
 * 🌍 i18n.ts - Configuració d’i18next per a React (ThermoSafe)
 * ------------------------------------------------------------------ */
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

/* ─── Importa els arxius de traducció ────────────────────────────── */
import ca from './i18n/locales/ca.json';
import es from './i18n/locales/es.json';
import en from './i18n/locales/en.json';
import eu from './i18n/locales/eu.json';
import gl from './i18n/locales/gl.json';

/* ─── Inicialitza i18next ───────────────────────────────────────── */
i18n
  .use(LanguageDetector)   // 👈 detecta idioma del navegador
  .use(initReactI18next)
  .init({
    resources: {
      ca: { translation: ca },
      es: { translation: es },
      en: { translation: en },
      eu: { translation: eu },
      gl: { translation: gl }
    },

    fallbackLng: 'ca',   // 👈 català per defecte
    supportedLngs: ['ca', 'es', 'en', 'eu', 'gl'],

    detection: {
      order: ['querystring', 'localStorage', 'navigator'],
      caches: ['localStorage']
    },

    interpolation: { escapeValue: false },

    debug: import.meta.env.MODE === 'development'
  });

export default i18n;