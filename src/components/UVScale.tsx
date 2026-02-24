// src/components/UVScale.tsx
import React, { useState, useMemo } from 'react';
import SunCalc from 'suncalc';

type Lang = 'ca' | 'es' | 'eu' | 'gl' | 'en';

interface UVScaleProps {
  lang: Lang;
  uvi: number;
  lat?: number;
  lon?: number;
}

/* ─── Traduccions generals ─────────────────────────── */
const ui = {
  ca: {
    toggle: 'ℹ️ Mostra/Oculta escala UV',
    heading: '🔆 Escala oficial de l’índex UV',
    night: '🌙 Ara és de nit. L’índex UV no és rellevant.',
  },
  es: {
    toggle: 'ℹ️ Mostrar/Ocultar escala UV',
    heading: '🔆 Escala oficial del índice UV',
    night: '🌙 Ahora es de noche. El índice UV no es relevante.',
  },
  eu: {
    toggle: 'ℹ️ Erakutsi/Ezkutatu UV eskala',
    heading: '🔆 UV indizearen eskala ofiziala',
    night: '🌙 Gaua da. UV indizea ez da garrantzitsua.',
  },
  gl: {
    toggle: 'ℹ️ Amosar/Ocultar escala UV',
    heading: '🔆 Escala oficial do índice UV',
    night: '🌙 É de noite. O índice UV non é relevante.',
  },
  en: {
    toggle: 'ℹ️ Show/Hide UV scale',
    heading: '🔆 Official UV Index Scale',
    night: '🌙 It is currently nighttime. The UV Index is not relevant.',
  },
} as const;

/* ─── Dades de la taula UV (traduïdes) ─────────────── */
const escalaUV = [
  {
    rang: '0–2',
    color: '#6EC664',
    nivell: { ca: 'Baix', es: 'Bajo', eu: 'Baxua', gl: 'Baixo', en: 'Low' },
    consell: {
      ca: 'Protecció mínima necessària.',
      es: 'Protección mínima necesaria.',
      eu: 'Gutxieneko babesa behar da.',
      gl: 'Protección mínima necesaria.',
      en: 'Minimal protection required.',
    },
  },
  {
    rang: '3–5',
    color: '#F9D648',
    nivell: { ca: 'Moderat', es: 'Moderado', eu: 'Moderatua', gl: 'Moderado', en: 'Moderate' },
    consell: {
      ca: 'Gorra, ulleres de sol i SPF 30+.',
      es: 'Gorra, gafas de sol y SPF 30+.',
      eu: 'Txapela, betaurrekoak eta SPF 30+.',
      gl: 'Sombreiro, lentes de sol e SPF 30+.',
      en: 'Hat, sunglasses and SPF 30+ sunscreen.',
    },
  },
  {
    rang: '6–7',
    color: '#F88C2B',
    nivell: { ca: 'Alt', es: 'Alto', eu: 'Altua', gl: 'Alto', en: 'High' },
    consell: {
      ca: 'Evita el sol de 12 h a 16 h. Protecció extra.',
      es: 'Evita el sol de 12 h a 16 h. Protección extra.',
      eu: 'Saihestu eguzkia 12:00–16:00. Babes gehigarria.',
      gl: 'Evita o sol de 12 h a 16 h. Protección extra.',
      en: 'Avoid sun exposure between 12 pm and 4 pm. Extra protection required.',
    },
  },
  {
    rang: '8–10',
    color: '#E03E2D',
    nivell: { ca: 'Molt alt', es: 'Muy alto', eu: 'Oso altua', gl: 'Moi alto', en: 'Very High' },
    consell: {
      ca: 'Evita exposició directa. Usa roba i SPF 50+.',
      es: 'Evita la exposición directa. Usa ropa y SPF 50+.',
      eu: 'Saihestu esposizio zuzena. Erabili arropa eta SPF 50+.',
      gl: 'Evita a exposición directa. Usa roupa e SPF 50+.',
      en: 'Avoid direct exposure. Wear protective clothing and SPF 50+.',
    },
  },
  {
    rang: '11+',
    color: '#A347BA',
    nivell: { ca: 'Extrem', es: 'Extremo', eu: 'Muturrekoa', gl: 'Extremo', en: 'Extreme' },
    consell: {
      ca: 'Risc greu. Queda’t a l’ombra o dins casa.',
      es: 'Riesgo grave. Quédate a la sombra o en interior.',
      eu: 'Arrisku larria. Gelditu itzalean edo barrualdean.',
      gl: 'Risco grave. Queda á sombra ou no interior.',
      en: 'Severe risk. Stay in the shade or indoors.',
    },
  },
] as const;

/* ─── Component ────────────────────────────────────── */
export default function UVScale({ lang, uvi, lat, lon }: UVScaleProps) {
  const [visible, setVisible] = useState(false);
  const { toggle, heading, night } = ui[lang];

  const isDaylight = useMemo(() => {
    if (typeof lat !== 'number' || typeof lon !== 'number') return true;
    try {
      const now = new Date();
      const { sunrise, sunset } = SunCalc.getTimes(now, lat, lon);
      return now > sunrise && now < sunset;
    } catch {
      return true;
    }
  }, [lat, lon]);

  return (
    <div style={{ marginTop: '2rem' }}>
      <button onClick={() => setVisible(!visible)} style={{ marginBottom: '1rem' }}>
        {toggle}
      </button>

      {visible && (
        <>
          {isDaylight ? (
            <>
              <h2 style={{ marginBottom: '1rem' }}>{heading}</h2>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {escalaUV.map((nivell, i) => (
                  <div
                    key={i}
                    style={{
                      backgroundColor: nivell.color,
                      color: 'white',
                      padding: '0.75rem 1rem',
                      borderRadius: '6px',
                      boxShadow: '0 1px 4px rgba(0,0,0,0.2)',
                    }}
                  >
                    <strong style={{ fontSize: '1.05rem' }}>
                      UV {nivell.rang} — {nivell.nivell[lang]}
                    </strong>
                    <p style={{ margin: '0.3rem 0 0' }}>
                      {nivell.consell[lang]}
                    </p>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <p>{night}</p>
          )}
        </>
      )}
    </div>
  );
}