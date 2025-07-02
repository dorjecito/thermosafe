// src/components/RiskLevelDisplay.tsx
import React from 'react';
import { getHeatRisk } from '../utils/heatRisk';   // ✔ un únic punt de veritat

type Lang = 'ca' | 'es' | 'eu' | 'gl';

interface Props {
  temp: number;   // Heat-Index (°C)
  lang: Lang;
}

/* etiquetes “Risc per calor:” en cada idioma */
const LABEL: Record<Lang, string> = {
  ca: 'Risc per calor:',
  es: 'Riesgo por calor:',
  eu: 'Bero arriskua:',
  gl: 'Risco por calor:',
};

/* traducció dels cinc nivells que treu getHeatRisk() */
const LEVEL: Record<'Cap risc'|'Baix'|'Moderat'|'Alt'|'Extrem', Record<Lang,string>> = {
  'Cap risc': { ca:'Cap risc',  es:'Sin riesgo',    eu:'Arriskurik ez', gl:'Sen risco' },
  'Baix'     : { ca:'Baix',      es:'Bajo',          eu:'Baxua',         gl:'Baixo'     },
  'Moderat'  : { ca:'Moderat',   es:'Moderado',      eu:'Moderatua',     gl:'Moderado'  },
  'Alt'      : { ca:'Alt',       es:'Alto',          eu:'Handia',        gl:'Alto'      },
  'Extrem'   : { ca:'Extrem',    es:'Extremo',       eu:'Larri',         gl:'Extremo'   },
};

export default function RiskLevelDisplay({ temp, lang }: Props): JSX.Element {
  const { level, color } = getHeatRisk(temp);    // ← mateix càlcul que uses a Recommendations

  return (
    <h2>
      {LABEL[lang]}{' '}
      <span style={{ color }}>{LEVEL[level][lang]}</span>
    </h2>
  );
}