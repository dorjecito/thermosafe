import React from 'react';
import { useTranslation } from 'react-i18next';

type Lang = 'ca' | 'es' | 'eu' | 'gl';

const LANGS: Array<{ code: Lang; label: string; flag: string }> = [
  { code: 'ca', label: 'Català',  flag: '/flags/ca.png' },
  { code: 'es', label: 'Español', flag: '/flags/es.png' },
  { code: 'eu', label: 'Euskara', flag: '/flags/eu.png' },
  { code: 'gl', label: 'Galego',  flag: '/flags/gl.png' },
];

export default function LanguageSwitcher() {
  const { i18n } = useTranslation();

  // Detecta l’idioma actual o usa 'ca' per defecte
  const current = (i18n.language || localStorage.getItem('ts-lang') || 'ca')
    .slice(0, 2) as Lang;

  const setLang = (lng: Lang) => {
    i18n.changeLanguage(lng);
    try {
      localStorage.setItem('ts-lang', lng);
    } catch (e) {
      console.warn('No s’ha pogut desar l’idioma al localStorage:', e);
    }
    // Força que el <html lang="xx"> s’actualitzi
    document.documentElement.lang = lng;
  };

  React.useEffect(() => {
    const saved = localStorage.getItem('ts-lang') as Lang | null;
    if (saved && saved !== i18n.language) {
      i18n.changeLanguage(saved);
      document.documentElement.lang = saved;
    }
  }, [i18n]);

  return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
      {LANGS.map(l => {
        const active = current === l.code;
        return (
          <button
            key={l.code}
            onClick={() => setLang(l.code)}
            aria-label={l.label}
            title={l.label}
            style={{
              border: active ? '2px solid #0ea5e9' : '1px solid #444',
              borderRadius: 8,
              padding: 2,
              background: active ? 'rgba(14,165,233,.15)' : 'transparent',
              cursor: 'pointer',
              lineHeight: 0,
            }}
          >
            <img
              src={l.flag}
              alt={l.label}
              width={28}
              height={20}
              style={{ display: 'block', borderRadius: 4 }}
            />
          </button>
        );
      })}
    </div>
  );
}