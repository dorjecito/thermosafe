// src/components/Recommendations.tsx
import React from 'react';
import { getHeatRisk } from '../utils/heatRisk';

type Lang = 'ca' | 'es' | 'eu' | 'gl';

interface Props {
  /** Índex de calor o sensació tèrmica (ST) */
  temp: number;
  lang: Lang;
  /** true = dia · false = nit */
  isDay: boolean;
}

/* ─────────── Textos ─────────── */
const txt = {
  ca: {
    title: 'Recomanacions:',
    safe      : 'Condicions segures. Mantén la hidratació habitual.',
    mild      : 'Possible fatiga per calor. Beu aigua sovint i descansa a l’ombra.',
    mod       : 'Risc moderat. Pauses cada 20 min, roba lleugera i hidrata’t.',
    high      : 'Risc alt. Evita l’esforç intens i incrementa les pauses.',
    ext       : 'Risc extrem. Atura l’activitat i refresca’t de seguida.',
    nightCool : 'Nit fresca: abriga’t adequadament i mantén l’espai ventilat.',
    nightSafe : 'Condicions segures. Mantén una bona ventilació.',
    nightHeat : 'Si fa calor a la nit, ventila bé l’espai i dorm amb roba lleugera.',
  },
  es: {
    title: 'Recomendaciones:',
    safe      : 'Condiciones seguras. Mantén la hidratación habitual.',
    mild      : 'Posible fatiga por calor. Bebe agua y descansa a la sombra.',
    mod       : 'Riesgo moderado. Pausas cada 20 min, ropa ligera e hidrátate.',
    high      : 'Riesgo alto. Evita el esfuerzo intenso y aumenta las pausas.',
    ext       : 'Riesgo extremo. Detén la actividad y refréscate.',
    nightCool : 'Noche fresca: abrígate y ventila la habitación adecuadamente.',
    nightSafe : 'Condiciones seguras. Mantén buena ventilación.',
    nightHeat : 'Si hace calor por la noche, ventila bien y usa ropa ligera.',
  },
  eu: {
    title: 'Gomendioak:',
    safe      : 'Egoera segurua. Mantendu hidratazio arrunta.',
    mild      : 'Litekeena bero-nekearen agerpena. Edan ura maiz.',
    mod       : 'Arrisku moderatua. Geldialdiak 20 minuturo eta hidratazioa.',
    high      : 'Arrisku handia. Saihestu ahalegin handia.',
    ext       : 'Arrisku larria. Utzi jarduera eta freskatu berehala.',
    nightCool : 'Gau freskoa: estali zaitez eta aireztatu ondo gela.',
    nightSafe : 'Egoera segurua. Aireztapen ona mantendu.',
    nightHeat : 'Gauean bero badago, aireztatu eta erabili arropa arina.',
  },
  gl: {
    title: 'Recomendacións:',
    safe      : 'Condicións seguras. Mantén a hidratación habitual.',
    mild      : 'Posible fatiga por calor. Bebe auga con frecuencia.',
    mod       : 'Risco moderado. Pausas cada 20 min e hidrátate.',
    high      : 'Risco alto. Evita o esforzo intenso e incrementa as pausas.',
    ext       : 'Risco extremo. Detén a actividade e arrefréscate.',
    nightCool : 'Noite fresca: abrígate e asegúrate de boa ventilación.',
    nightSafe : 'Condicións seguras. Mantén boa ventilación.',
    nightHeat : 'Se fai calor pola noite, ventila ben e usa roupa lixeira.',
  },
} as const;

/* ─────────── Component ─────────── */
export default function Recommendations({ temp, lang, isDay }: Props): JSX.Element {
  const t = txt[lang];

  /* 1. Tall de seguretat per fred (<18 °C)  */
  const isCold = temp < 18;

  /* 2. Nivell de risc segons INSST (només si no és fred) */
  const level = isCold
    ? 'Cap risc'
    : (getHeatRisk(temp).level as
        | 'Cap risc'
        | 'Baix'
        | 'Moderat'
        | 'Alt'
        | 'Extrem');

  /* 3. Mapatge a clau de text per al dia */
  const map: Record<typeof level, keyof typeof t> = {
    'Cap risc': 'safe',
    'Baix'    : 'mild',
    'Moderat' : 'mod',
    'Alt'     : 'high',
    'Extrem'  : 'ext',
  };

  /* 4. Seleccionem la clau tenint en compte nit/dia */
  let key: keyof typeof t;

  if (temp < 18) {
    // Sempre mostrar recomanació de fred, sigui de dia o de nit
    key = 'nightCool';
  } else if (!isDay) {
    if (temp < 24) key = 'nightSafe';
    else           key = 'nightHeat';
  } else {
    key = map[level];
  }

  // DEBUG opcional
  // console.log('[Recommendations]', { temp, isDay, level, key });

  return (
    <div style={{ marginTop: '1rem' }}>
      <h3>{t.title}</h3>
      <p>{t[key]}</p>
    </div>
  );
}