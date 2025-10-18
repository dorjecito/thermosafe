import React from 'react';

type Lang = 'ca' | 'es' | 'eu' | 'gl';

interface UVAdviceProps {
  uvi: number;
  lang: Lang;
}

/* text i missatges per idioma */
const texts = {
  ca: {
    idx: 'Índex UV',
    levels: ['Baix', 'Moderat', 'Alt', 'Molt alt', 'Extrem'],
    msgs: [
      '',
      'Evita el sol de 12h a 16h. Protecció extra.',
      'Evita el sol de 12h a 16h. Protecció extra.',
      'Evita el sol en hores centrals i utilitza protecció màxima.',
      'Evita totalment l’exposició solar. Risc molt elevat.'
    ]
  },
  es: {
    idx: 'Índice UV',
    levels: ['Bajo', 'Moderado', 'Alto', 'Muy alto', 'Extremo'],
    msgs: [
      '',
      'Evita el sol de 12h a 16h. Protección extra.',
      'Evita el sol de 12h a 16h. Protección extra.',
      'Evita el sol en horas centrales y usa protección máxima.',
      'Evita totalmente la exposición solar. Riesgo muy elevado.'
    ]
  },
  eu: {
    idx: 'UV indizea',
    levels: ['Baxua', 'Moderatua', 'Altua', 'Oso altua', 'Muturrekoa'],
    msgs: [
      '',
      '12etatik 16etara eguzkia saihestu. Babes gehigarria.',
      '12etatik 16etara eguzkia saihestu. Babes gehigarria.',
      'Eguneko ordu erdian eguzkia saihestu eta babes maximoa erabili.',
      'Saihestu guztiz eguzki-esposizioa. Arrisku oso handia.'
    ]
  },
  gl: {
    idx: 'Índice UV',
    levels: ['Baixo', 'Moderado', 'Alto', 'Moi alto', 'Extremo'],
    msgs: [
      '',
      'Evita o sol de 12h a 16h. Protección extra.',
      'Evita o sol de 12h a 16h. Protección extra.',
      'Evita o sol nas horas centrais e usa protección máxima.',
      'Evita totalmente a exposición solar. Risco moi elevado.'
    ]
  }
} as const;

/* rangs UV → banda 0-4 */
const band = (uvi: number) => (uvi < 3 ? 0 : uvi < 6 ? 1 : uvi < 8 ? 2 : uvi < 11 ? 3 : 4);

/* colors per banda */
const colors = ['#4caf50', '#ffeb3b', '#ff9800', '#f44336', '#9c27b0'];

const UVAdvice: React.FC<UVAdviceProps> = ({ uvi, lang }) => {
  const b = band(uvi);
  const L = texts[lang] ?? texts.ca;

  return (
    <div
      style={{
        backgroundColor: colors[b],
        color: '#000',
        padding: '1rem',
        borderRadius: 8,
        marginTop: '1rem'
      }}
    >
      <strong>
        🔆 {L.idx}: {uvi.toFixed(1)} — {L.levels[b]}
      </strong>
      {L.msgs[b] && <p style={{ marginTop: '.5rem' }}>{L.msgs[b]}</p>}
    </div>
  );
};

export default UVAdvice;