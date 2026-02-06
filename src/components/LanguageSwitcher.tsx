import React from "react";
import { useTranslation } from "react-i18next";

type Lang = "ca" | "es" | "eu" | "gl" | "en";

const LANGS: Array<{ code: Lang; label: string; flag: string }> = [
  { code: "ca", label: "Català", flag: "/flags/ca.png" },
  { code: "es", label: "Español", flag: "/flags/es.png" },
  { code: "eu", label: "Euskara", flag: "/flags/eu.png" },
  { code: "gl", label: "Galego", flag: "/flags/gl.png" },
  { code: "en", label: "English", flag: "/flags/en.png" }
];

const STORAGE_KEY = "ts-lang";

function safeGetStoredLang(): Lang | null {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (!v) return null;
    const code = v.slice(0, 2) as Lang;
    return (["ca", "es", "eu", "gl", "en"] as Lang[]).includes(code) ? code : null;
  } catch {
    return null;
  }
}

function safeSetStoredLang(lng: Lang) {
  try {
    localStorage.setItem(STORAGE_KEY, lng);
  } catch (e) {
    console.warn("No s’ha pogut desar l’idioma al localStorage:", e);
  }
}

export default function LanguageSwitcher() {
  const { i18n } = useTranslation();

  // Idioma actual (millor resolvedLanguage quan hi ha detector)
  const currentRaw = (i18n.resolvedLanguage || i18n.language || "ca").toLowerCase();
  const current = (currentRaw.slice(0, 2) as Lang) || "ca";

  const setLang = (lng: Lang) => {
    i18n.changeLanguage(lng);
    safeSetStoredLang(lng);
    document.documentElement.lang = lng;
  };

  React.useEffect(() => {
    const saved = safeGetStoredLang();
    if (!saved) return;

    // Normalitza el que ve d’i18n (en-GB -> en)
    const now = ((i18n.resolvedLanguage || i18n.language || "ca").slice(0, 2) as Lang) || "ca";

    if (saved !== now) {
      i18n.changeLanguage(saved);
    }
    document.documentElement.lang = saved;
  }, [i18n]);

  return (
    <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
      {LANGS.map((l) => {
        const active = current === l.code;

        return (
          <button
            key={l.code}
            onClick={() => setLang(l.code)}
            aria-label={l.label}
            title={l.label}
            style={{
              border: active ? "2px solid #0ea5e9" : "1px solid #444",
              borderRadius: 8,
              padding: 2,
              background: active ? "rgba(14,165,233,.15)" : "transparent",
              cursor: "pointer",
              lineHeight: 0
            }}
          >
            <img
              src={l.flag}
              alt={l.label}
              width={28}
              height={20}
              style={{ display: "block", borderRadius: 4 }}
            />
          </button>
        );
      })}
    </div>
  );
}
