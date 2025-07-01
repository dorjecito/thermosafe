// src/components/UVScale.tsx
import React, { useState } from 'react';

type Lang = 'ca' | 'es' | 'eu' | 'gl';

interface UVScaleProps {
  lang: Lang;
}

/* ─── Traduccions generals ─────────────────────────── */
const ui = {
  ca: {
    toggle: 'ℹ️ Mostra/Oculta escala UV',
    heading: '🔆 Escala oficial de l’índex UV',
  },
  es: {
    toggle: 'ℹ️ Mostrar/Ocultar escala UV',
    heading: '🔆 Escala oficial del índice UV',
  },
  eu: {
    toggle: 'ℹ️ Erakutsi/Ezkutatu UV eskala',
    heading: '🔆 UV indizearen eskala ofiziala',
  },
  gl: {
    toggle: 'ℹ️ Amosar/Ocultar escala UV',
    heading: '🔆 Escala oficial do índice UV',
  },
} as const;

/* ─── Dades de la taula UV (traduïdes) ─────────────── */
const escalaUV = [
  {
    rang: '0–2',
    color: '#6EC664',
    nivell: { ca: 'Baix', es: 'Bajo', eu: 'Baxua', gl: 'Baixo' },
    consell: {
      ca: 'Protecció mínima necessària.',
      es: 'Protección mínima necesaria.',
      eu: 'Gutxieneko babesa behar da.',
      gl: 'Protección mínima necesaria.',
    },
  },
  {
    rang: '3–5',
    color: '#F9D648',
    nivell: { ca: 'Moderat', es: 'Moderado', eu: 'Moderatua', gl: 'Moderado' },
    consell: {
      ca: 'Gorra, ulleres de sol i SPF 30+.',
      es: 'Gorra, gafas de sol y SPF 30+.',
      eu: 'Txapela, betaurrekoak eta SPF 30+.',
      gl: 'Sombreiro, lentes de sol e SPF 30+.',
    },
  },
  {
    rang: '6–7',
    color: '#F88C2B',
    nivell: { ca: 'Alt', es: 'Alto', eu: 'Altua', gl: 'Alto' },
    consell: {
      ca: 'Evita el sol de 12 h a 16 h. Protecció extra.',
      es: 'Evita el sol de 12 h a 16 h. Protección extra.',
      eu: 'Saihestu eguzkia 12:00–16:00. Babes gehigarria.',
      gl: 'Evita o sol de 12 h a 16 h. Protección extra.',
    },
  },
  {
    rang: '8–10',
    color: '#E03E2D',
    nivell: { ca: 'Molt alt', es: 'Muy alto', eu: 'Oso altua', gl: 'Moi alto' },
    consell: {
      ca: 'Evita exposició directa. Usa roba i SPF 50+.',
      es: 'Evita la exposición directa. Usa ropa y SPF 50+.',
      eu: 'Saihestu esposizio zuzena. Erabili arropa eta SPF 50+.',
      gl: 'Evita a exposición directa. Usa roupa e SPF 50+.',
    },
  },
  {
    rang: '11+',
    color: '#A347BA',
    nivell: { ca: 'Extrem', es: 'Extremo', eu: 'Muturrekoa', gl: 'Extremo' },
    consell: {
      ca: 'Risc greu. Queda’t a l’ombra o dins casa.',
      es: 'Riesgo grave. Quédate a la sombra o en interior.',
      eu: 'Arrisku larria. Gelditu itzalean edo barrualdean.',
      gl: 'Risco grave. Queda á sombra ou no interior.',
    },
  },
] as const;

/* ─── Component ────────────────────────────────────── */
export default function UVScale({ lang }: UVScaleProps) {
  const [visible, setVisible] = useState(false);
  const { toggle, heading } = ui[lang];

  return (
    <div style={{ marginTop: '2rem' }}>
      <button onClick={() => setVisible(!visible)} style={{ marginBottom: '1rem' }}>
        {toggle}
      </button>

      {visible && (
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
                <p style={{ margin: '0.3rem 0 0' }}>{nivell.consell[lang]}</p>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
