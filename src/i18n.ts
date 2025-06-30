/* ------------------------------------------------------------------
 *  i18n.ts - Configuració d’i18next per a React
 * ------------------------------------------------------------------ */

import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

/* ─── Importa els arxius de traducció ────────────────────────────── */
import ca from './i18n/locales/ca.json';
import es from './i18n/locales/es.json';
import en from './i18n/locales/en.json';
import eu from './i18n/locales/eu.json';
import gl from './i18n/locales/gl.json';

/* ─── Inicialitza i18next ───────────────────────────────────────── */
i18n
  .use(initReactI18next)           // integra i18next amb React
  .init({
    /* Recursos carregats al bundle */
    resources: {
      ca: { translation: ca },
      es: { translation: es },
      en: { translation: en },
      eu: { translation: eu },
      gl: { translation: gl }
    },

    /* Idioma a utilitzar:
       · Primer intentem detectar-lo des del navegador (p. ex. “es-ES” → “es”)
       · Si no coincideix amb cap traducció, fem servir el de reserva (‘ca’) */
    lng: navigator.language.split('-')[0],   // ‘ca’, ‘es’, ‘en’, ‘eu’, ‘gl’, …
    fallbackLng: 'ca',

    /* Altres opcions */
    interpolation: { escapeValue: false },   // React ja escapa per defecte
    debug: import.meta.env.MODE === 'development'
  });

export default i18n;