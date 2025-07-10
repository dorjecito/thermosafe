// src/components/RiskLevelDisplay.tsx
import React from 'react';
import { getHeatRisk } from '../utils/heatRisk';

type Lang = 'ca' | 'es' | 'eu' | 'gl';

interface Props {
  temp: number;
  lang: Lang;
}

const LABEL: Record<Lang, string> = {
  ca: 'Risc per calor:',
  es: 'Riesgo por calor:',
  eu: 'Bero arriskua:',
  gl: 'Risco por calor:',
};

const LEVEL: Record<'Cap risc'|'Baix'|'Moderat'|'Alt'|'Extrem', Record<Lang, string>> = {
  'Cap risc': { ca: 'Cap risc',  es: 'Sin riesgo',   eu: 'Arriskurik ez', gl: 'Sen risco' },
  'Baix':     { ca: 'Baix',      es: 'Bajo',         eu: 'Baxua',         gl: 'Baixo'     },
  'Moderat':  { ca: 'Moderat',   es: 'Moderado',     eu: 'Moderatua',     gl: 'Moderado'  },
  'Alt':      { ca: 'Alt',       es: 'Alto',         eu: 'Handia',        gl: 'Alto'      },
  'Extrem':   { ca: 'Extrem',    es: 'Extremo',      eu: 'Larri',         gl: 'Extremo'   },
};

export default function RiskLevelDisplay({ temp, lang }: Props): JSX.Element {
  const { level } = getHeatRisk(temp);

  // Assignem la classe corresponent segons el nivell
  const levelClass: Record<'Cap risc'|'Baix'|'Moderat'|'Alt'|'Extrem', string> = {
    'Cap risc': 'safe',
    'Baix':     'mild',
    'Moderat':  'moderate',
    'Alt':      'high',
    'Extrem':   'ext',
  };

  return (
    <h2>
      {LABEL[lang]}{' '}
      <span className={`risk-level ${levelClass[level]}`}>
        {LEVEL[level][lang]}
      </span>
    </h2>
  );
}
