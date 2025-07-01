// src/components/Recommendations.tsx
import React from 'react';

type Lang = 'ca' | 'es' | 'eu' | 'gl';

interface Props {
  temp: number;   // índex de calor percebut (ST)
  lang: Lang;
  isDay: boolean; // true = dia, false = nit
}

/* ─── Textos de recomanació ───────────────────────────── */
const txt = {
  ca: {
    title: 'Recomanacions:',
    safe:      'Condicions segures. Mantén la hidratació habitual.',
    mild:      'Possible fatiga per calor. Beu aigua sovint i descansa a l’ombra.',
    mod:       'Risc alt de calor. Pauses cada 20 min, beu aigua sovint i, si l’EPI ho permet, roba lleugera i transpirable.',
    high:      'Risc molt alt. Evita l’esforç intens, hidrata’t sovint i incrementa les pauses a l’ombra.',
    ext:       'Risc extrem. Atura l’activitat i busca un lloc fresc immediatament.',
    nightSafe: 'Si fa calor a la nit, ventila bé l’espai i dorm amb roba lleugera.',
    nightMod:  'La calor nocturna pot afectar el descans. Ventila, hidrata’t i vesteix roba fresca.',
    nightHigh: 'Risc alt també de nit. Beu sovint i assegura’t que la zona estigui ventilada.',
    nightExt:  'Risc extrem. Dorm en un lloc fresc i hidratat, evita esforços i pren mesures de refrigeració.',
  },
  es: {
    title: 'Recomendaciones:',
    safe:      'Condiciones seguras. Mantén la hidratación habitual.',
    mild:      'Posible fatiga por calor. Bebe agua con frecuencia y descansa a la sombra.',
    mod:       'Riesgo alto. Pausas cada 20 min, bebe agua con frecuencia y, si el EPI lo permite, usa ropa ligera y transpirable.',
    high:      'Riesgo muy alto. Evita el esfuerzo intenso, hidrátate a menudo y aumenta las pausas a la sombra.',
    ext:       'Riesgo extremo. Detén la actividad y busca un lugar fresco de inmediato.',
    nightSafe: 'Si hace calor por la noche, ventila bien y usa ropa ligera para dormir.',
    nightMod:  'El calor nocturno puede afectar al descanso. Ventila, hidrátate y usa ropa fresca.',
    nightHigh: 'Riesgo alto también por la noche. Bebe a menudo y asegúrate de un espacio ventilado.',
    nightExt:  'Riesgo extremo. Duerme en un espacio fresco, hidratado y evita esfuerzos nocturnos.',
  },
  eu: {
    title: 'Gomendioak:',
    safe:      'Egoera segurua. Mantendu hidratazio arrunta.',
    mild:      'Litekeena bero nekearen agerpena. Edan ura maiz eta atseden hartu itzalean.',
    mod:       'Berorako arrisku handia. 20 minuturo atseden hartu, ura sarri edan eta, EPIak uzten badu, jantzi arin eta transpiragarria.',
    high:      'Arrisku oso handia. Saihestu ahalegin handia, hidrata zaitez sarri eta luzatu atsedenaldiak itzalean.',
    ext:       'Arrisku larria. Utzi jarduera eta bilatu berehala leku freskoa.',
    nightSafe: 'Gau beroa bada, ondo aireztatu gela eta erabili arropa arina lo egiteko.',
    nightMod:  'Gaueko beroak atsedenari eragin diezaioke. Aireztatu gela, edan ura eta lo egin arropa arinarekin.',
    nightHigh: 'Gauez ere arrisku handia. Edan maiz ura eta ziurtatu gela freskoa eta aireztatua dela.',
    nightExt:  'Arrisku larria. Lo egin toki fresko eta aireztatuan, edan ura oheratu aurretik eta saihestu esfortzurik.',
  },
  gl: {
    title: 'Recomendacións:',
    safe:      'Condicións seguras. Mantén a hidratación habitual.',
    mild:      'Posible fatiga por calor. Bebe auga con frecuencia e repousa á sombra.',
    mod:       'Risco alto. Pausas cada 20 min, bebe auga a miúdo e, se o EPI o permite, roupa lixeira e transpirable.',
    high:      'Risco moi alto. Evita o esforzo intenso, hidrátate a miúdo e incrementa as pausas á sombra.',
    ext:       'Risco extremo. Detén a actividade e procura un lugar fresco de inmediato.',
    nightSafe: 'Se fai calor pola noite, ventila ben e dorme con roupa lixeira.',
    nightMod:  'A calor nocturna pode afectar ao descanso. Ventila ben, bebe auga e usa roupa fresca.',
    nightHigh: 'Risco alto incluso pola noite. Hidrátate con frecuencia e asegúrate de durmir nun lugar fresco e aireado.',
    nightExt:  'Risco extremo. Durme nun espazo con refrixeración, hidrátate antes de deitarte e evita calquera esforzo.',
  },
} as const;

/* ─── Component ─────────────────────────────────────── */
export default function Recommendations({ temp, lang, isDay }: Props): JSX.Element {
  const t = txt[lang];

  /* 1. categoria de risc (segons escala INSST) */
  let key: 'safe' | 'mild' | 'mod' | 'high' | 'ext' = 'safe';
  if      (temp < 27) key = 'safe';
  else if (temp < 32) key = 'mild';
  else if (temp < 40) key = 'mod';
  else if (temp < 55) key = 'high';
  else                key = 'ext';

  /* 2. equivalències per a recomanació nocturna */
  const nightMap: Record<typeof key, keyof typeof t> = {
    safe: 'nightSafe',
    mild: 'nightSafe',   // reutilitza la mateixa de "safe"
    mod : 'nightMod',
    high: 'nightHigh',
    ext : 'nightExt',
  };

  const msg = isDay ? t[key] : t[nightMap[key]];

  return (
    <div style={{ marginTop: '1rem' }}>
      <h3>{t.title}</h3>
      <p>{msg}</p>
    </div>
  );
}