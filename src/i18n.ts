import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import ca from './i18n/locales/ca.json';
import es from './i18n/locales/es.json';
import en from './i18n/locales/en.json';
import eu from './i18n/locales/eu.json';
import gl from './i18n/locales/gl.json';

/* 🚫 Amaga TOTS els "missingKey" abans que surtin */
i18n.on('missingKey', () => {});

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      ca: { translation: ca },
      es: { translation: es },
      en: { translation: en },
      eu: { translation: eu },
      gl: { translation: gl }
    },

    fallbackLng: 'ca',
    supportedLngs: ['ca', 'es', 'en', 'eu', 'gl'],

    detection: {
      order: ['querystring', 'localStorage', 'navigator'],
      caches: ['localStorage']
    },

    interpolation: { escapeValue: false },

    // 🔥 APAGA logs interns d’i18next
    debug: false,

    // 🔇 Apaga missingKeys+
    missingKeyHandler: () => {}
  });

// 🔇 Apaga completament esdeveniment missingKey
i18n.on('missingKey', () => {});

export default i18n;