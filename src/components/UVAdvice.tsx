import React from 'react';

interface UVAdviceProps {
  uvi: number;
  lang: 'ca' | 'es';
}

const UVAdvice: React.FC<UVAdviceProps> = ({ uvi, lang }) => {
  let level = '';
  let color = '';
  let message = '';

  if (uvi < 3) {
    level = lang === 'es' ? 'Bajo' : 'Baix';
    color = '#4caf50'; // verd
    message = ''; // No mostrar consells extra
  } else if (uvi < 6) {
    level = lang === 'es' ? 'Moderado' : 'Moderat';
    color = '#ffeb3b'; // groc
    message =
      lang === 'es'
        ? 'Evita el sol de 12h a 16h. Protección extra.'
        : 'Evita el sol de 12h a 16h. Protecció extra.';
  } else if (uvi < 8) {
    level = lang === 'es' ? 'Alto' : 'Alt';
    color = '#ff9800'; // taronja
    message =
      lang === 'es'
        ? 'Evita el sol de 12h a 16h. Protección extra.'
        : 'Evita el sol de 12h a 16h. Protecció extra.';
  } else if (uvi < 11) {
    level = lang === 'es' ? 'Muy alto' : 'Molt alt';
    color = '#f44336'; // vermell
    message =
      lang === 'es'
        ? 'Evita el sol en horas centrales y usa protección máxima.'
        : 'Evita el sol en hores centrals i utilitza protecció màxima.';
  } else {
    level = lang === 'es' ? 'Extremo' : 'Extrem';
    color = '#9c27b0'; // porpra
    message =
      lang === 'es'
        ? 'Evita totalmente la exposición solar. Riesgo muy elevado.'
        : 'Evita totalment l’exposició solar. Risc molt elevat.';
  }

  return (
    <div
      style={{
        backgroundColor: color,
        color: '#000',
        padding: '1rem',
        borderRadius: '8px',
        marginTop: '1rem',
      }}
    >
      <strong>
        🔆 {lang === 'es' ? 'Índice UV' : 'Índex UV'}: {uvi.toFixed(1)} — {level}
      </strong>
      {message && <p style={{ marginTop: '0.5rem' }}>{message}</p>}
    </div>
  );
};

export default UVAdvice;