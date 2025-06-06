import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

// 📦 Importa els arxius de traducció
import ca from './i18n/locales/ca.json';
import es from './i18n/locales/es.json';
import en from './i18n/locales/en.json';

i18n
  .use(initReactI18next)
  .init({
    resources: {
      ca: { translation: ca },
      es: { translation: es },
      en: { translation: en }
    },
    fallbackLng: 'ca', // Idioma per defecte si el navegador no és compatible
    lng: navigator.language.split('-')[0], // Detecta 'ca', 'es' o 'en' automàticament
    interpolation: {
      escapeValue: false
    }
  });

export default i18n;
