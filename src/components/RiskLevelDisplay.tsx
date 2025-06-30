import React from 'react';

type Lang = 'ca' | 'es' | 'eu' | 'gl';

interface Props {
  temp: number;   // Heat-Index en °C
  lang: Lang;
}

const LABEL: Record<Lang, string> = {
  ca: 'Risc per calor:',
  es: 'Riesgo por calor:',
  eu: 'Bero arriskua:',
  gl: 'Risco por calor:'
};

const LEVEL: Record<'low' | 'moderate' | 'high' | 'extreme', Record<Lang, string>> = {
  low: {
    ca: 'Baix',
    es: 'Bajo',
    eu: 'Baxua',
    gl: 'Baixo'
  },
  moderate: {
    ca: 'Moderat',
    es: 'Moderado',
    eu: 'Moderatua',
    gl: 'Moderado'
  },
  high: {
    ca: 'Alt',
    es: 'Alto',
    eu: 'Handia',
    gl: 'Alto'
  },
  extreme: {
    ca: 'Extrem',
    es: 'Extremo',
    eu: 'Larri',
    gl: 'Extremo'
  }
};

export default function RiskLevelDisplay({ temp, lang }: Props) {
  let key: 'low' | 'moderate' | 'high' | 'extreme' = 'low';
  let color = 'green';

  if (temp >= 33 && temp < 40) {
    key = 'moderate';
    color = '#FFC107';
  } else if (temp >= 40 && temp < 45) {
    key = 'high';
    color = 'orange';
  } else if (temp >= 55) {
    key = 'extreme';
    color = 'red';
  }

  return (
    <h2>
      {LABEL[lang]}{' '}
      <span style={{ color }}>{LEVEL[key][lang]}</span>
    </h2>
  );
}