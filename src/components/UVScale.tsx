import React, { useState } from 'react';

interface UVScaleProps {
  lang: 'ca' | 'es';
}

const escalaUV = [
  { rang: "0–2", nivell: { ca: "Baix", es: "Bajo" }, color: "#6EC664", consell: { ca: "Protecció mínima necessària.", es: "Protección mínima necesaria." } },
  { rang: "3–5", nivell: { ca: "Moderat", es: "Moderado" }, color: "#F9D648", consell: { ca: "Gorra, ulleres de sol i SPF 30+.", es: "Gorra, gafas de sol y SPF 30+." } },
  { rang: "6–7", nivell: { ca: "Alt", es: "Alto" }, color: "#F88C2B", consell: { ca: "Evita el sol de 12h a 16h. Protecció extra.", es: "Evita el sol de 12h a 16h. Protección extra." } },
  { rang: "8–10", nivell: { ca: "Molt alt", es: "Muy alto" }, color: "#E03E2D", consell: { ca: "Evita exposició directa. Usa roba i SPF 50+.", es: "Evita la exposición directa. Usa ropa y SPF 50+." } },
  { rang: "11+", nivell: { ca: "Extrem", es: "Extremo" }, color: "#A347BA", consell: { ca: "Risc greu. Queda’t a l’ombra o dins casa.", es: "Riesgo grave. Quédate a la sombra o en interior." } }
];

export default function UVScale({ lang }: UVScaleProps) {
  const [visible, setVisible] = useState(false);

  const toggle = () => setVisible(!visible);
  const textToggle = lang === 'es' ? 'ℹ️ Mostrar/Ocultar escala UV' : 'ℹ️ Mostra/Oculta escala UV';

  return (
    <div style={{ marginTop: '2rem' }}>
      <button onClick={toggle} style={{ marginBottom: '1rem' }}>{textToggle}</button>
      {visible && (
        <>
          <h2 style={{ marginBottom: '1rem' }}>
            🔆 {lang === 'es' ? 'Escala oficial del índice UV' : 'Escala oficial de l’índex UV'}
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {escalaUV.map((nivell, i) => (
              <div
                key={i}
                style={{
                  backgroundColor: nivell.color,
                  color: 'white',
                  padding: '0.75rem 1rem',
                  borderRadius: '6px',
                  boxShadow: '0 1px 4px rgba(0,0,0,0.2)'
                }}
              >
                <strong style={{ fontSize: '1.05rem' }}>
                  UV {nivell.rang} — {nivell.nivell[lang]}
                </strong>
                <p style={{ margin: '0.3rem 0 0 0' }}>{nivell.consell[lang]}</p>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
