import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";

import ca from "./i18n/locales/ca.json";
import es from "./i18n/locales/es.json";
import en from "./i18n/locales/en.json";
import eu from "./i18n/locales/eu.json";
import gl from "./i18n/locales/gl.json";

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

    // ✅ Anglès com a llengua pont quan no hi ha coincidència
    fallbackLng: "en",

    supportedLngs: ["ca", "es", "en", "eu", "gl"],

    detection: {
      order: ["querystring", "localStorage", "navigator"],
      caches: ["localStorage"]
    },

    interpolation: { escapeValue: false },

    debug: false,

    // ✅ Evita retorns estranys si falta una clau
    returnNull: false,
    returnEmptyString: false,

    // ✅ No guardar claus mancants
    saveMissing: false,
    missingKeyHandler: () => {},

    // ✅ Humanitza claus mancants (ex: weather_desc.few_clouds → "few clouds")
    parseMissingKeyHandler: (key) => {
      const last = key.split(".").pop() || key;
      return last.replace(/_/g, " ");
    }
  });

export default i18n;
