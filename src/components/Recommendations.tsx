// src/components/Recommendations.tsx
import React from 'react';
import { getHeatRisk } from '../utils/heatRisk';

type Lang = 'ca' | 'es' | 'eu' | 'gl';

interface Props {
  temp: number;
  lang: Lang;
  isDay: boolean;
}

const txt = {
  ca: {
    title: 'Recomanacions:',
    safe: 'Condicions segures. Mantén la hidratació habitual.',
    mild: 'Possible fatiga per calor. Beu aigua sovint i descansa a l’ombra.',
    moderate: 'Risc moderat. Pauses cada 20 min, roba lleugera i hidrata’t.',
    high: 'Risc alt. Evita l’esforç intens i incrementa les pauses.',
    ext: 'Risc extrem. Atura l’activitat i refresca’t de seguida.',
    nightCool: 'Nit fresca: abriga’t adequadament i mantén l’espai ventilat.',
    nightSafe: 'Condicions segures. Mantén una bona ventilació.',
    nightHeat: 'Si fa calor a la nit, ventila bé l’espai i dorm amb roba lleugera.',
  },
  es: {
    title: 'Recomendaciones:',
    safe: 'Condiciones seguras. Mantén la hidratación habitual.',
    mild: 'Posible fatiga por calor. Bebe agua y descansa a la sombra.',
    moderate: 'Riesgo moderado. Pausas cada 20 min, ropa ligera e hidrátate.',
    high: 'Riesgo alto. Evita el esfuerzo intenso y aumenta las pausas.',
    ext: 'Riesgo extremo. Detén la actividad y refréscate.',
    nightCool: 'Noche fresca: abrígate y ventila la habitación adecuadamente.',
    nightSafe: 'Condiciones seguras. Mantén buena ventilación.',
    nightHeat: 'Si hace calor por la noche, ventila bien y usa ropa ligera.',
  },
  eu: {
    title: 'Gomendioak:',
    safe: 'Egoera segurua. Mantendu hidratazio arrunta.',
    mild: 'Litekeena bero-nekearen agerpena. Edan ura maiz.',
    moderate: 'Arrisku moderatua. Geldialdiak 20 minuturo eta hidratazioa.',
    high: 'Arrisku handia. Saihestu ahalegin handia.',
    ext: 'Arrisku larria. Utzi jarduera eta freskatu berehala.',
    nightCool: 'Gau freskoa: estali zaitez eta aireztatu ondo gela.',
    nightSafe: 'Egoera segurua. Aireztapen ona mantendu.',
    nightHeat: 'Gauean bero badago, aireztatu eta erabili arropa arina.',
  },
  gl: {
    title: 'Recomendacións:',
    safe: 'Condicións seguras. Mantén a hidratación habitual.',
    mild: 'Posible fatiga por calor. Bebe auga con frecuencia.',
    moderate: 'Risco moderado. Pausas cada 20 min e hidrátate.',
    high: 'Risco alto. Evita o esforzo intenso e incrementa as pausas.',
    ext: 'Risco extremo. Detén a actividade e arrefréscate.',
    nightCool: 'Noite fresca: abrígate e asegúrate de boa ventilación.',
    nightSafe: 'Condicións seguras. Mantén boa ventilación.',
    nightHeat: 'Se fai calor pola noite, ventila ben e usa roupa lixeira.',
  },
} as const;

export default function Recommendations({ temp, lang, isDay }: Props): JSX.Element {
  const t = txt[lang];

  if (!isDay) {
    if (temp < 18) {
      return (
        <div className="recommendation-box">
          <p className="recommendation-title nightCool">{t.title}</p>
          <p>{t.nightCool}</p>
        </div>
      );
    }

    const classKey = temp < 24 ? 'nightSafe' : 'nightHeat';
    return (
      <div className="recommendation-box">
        <p className={`recommendation-title ${classKey}`}>{t.title}</p>
        <p>{t[classKey]}</p>
      </div>
    );
  }

  // Casos diürns
  const level = getHeatRisk(temp).level as 'Cap risc' | 'Baix' | 'Moderat' | 'Alt' | 'Extrem';

  const map: Record<typeof level, keyof typeof t> = {
    'Cap risc': 'safe',
    'Baix':     'mild',
    'Moderat':  'moderate',
    'Alt':      'high',
    'Extrem':   'ext',
  };

  const key = map[level];

  return (
    <div className="recommendation-box">
      <p className={`recommendation-title ${key}`}>{t.title}</p>
      <p>{t[key]}</p>
    </div>
  );
}
