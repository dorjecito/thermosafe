// src/components/Recommendations.tsx
import React from 'react';
import { getHeatRisk } from '../utils/heatRisk';

type Lang = 'ca' | 'es' | 'eu' | 'gl';

interface Props {
  temp: number;   // índex de calor percebut (ST)
  lang: Lang;
  isDay: boolean; // true = dia · false = nit
}

/* ─── Textos de recomanació ───────────────────────────── */
const txt = {
  ca: {
    title: 'Recomanacions:',
    safe : 'Condicions segures. Mantén la hidratació habitual.',
    mild : 'Possible fatiga per calor. Beu aigua sovint i descansa a l’ombra.',
    mod  : 'Risc moderat de calor. Pauses cada 20 min, hidrata’t i, si l’EPI ho permet, roba lleugera i transpirable. Evita l’esforç més intens entre les 12 h i les 16 h.',
    high : 'Risc alt. Evita l’esforç intens, hidrata’t sovint i incrementa les pauses a l’ombra. Evita l’esforç més intens entre les 12 h i les 16 h.',
    ext  : 'Risc extrem. Atura l’activitat i refresca’t immediatament. Evita qualsevol esforç entre les 12 h i les 16 h.',
    nightSafe: 'Si fa calor a la nit, ventila bé l’espai i dorm amb roba lleugera.',
    nightMod : 'La calor nocturna pot afectar el descans. Ventila, hidrata’t i vesteix roba fresca.',
    nightHigh: 'Risc alt també de nit. Beu sovint i garanteix bona ventilació.',
    nightExt : 'Risc extrem. Dorm en un lloc fresc i hidratat; evita esforços.',
  },

  es: {
    title: 'Recomendaciones:',
    safe : 'Condiciones seguras. Mantén la hidratación habitual.',
    mild : 'Posible fatiga por calor. Bebe agua con frecuencia y descansa a la sombra.',
    mod  : 'Riesgo moderado. Pausas cada 20 min, hidrátate y, si el EPI lo permite, ropa ligera y transpirable. Evita el esfuerzo más intenso entre las 12 h y las 16 h.',
    high : 'Riesgo alto. Evita el esfuerzo intenso, hidrátate a menudo y amplía las pausas a la sombra. Evita el esfuerzo más intenso entre las 12 h y las 16 h.',
    ext  : 'Riesgo extremo. Detén la actividad y refréscate de inmediato. Evita cualquier esfuerzo entre las 12 h y las 16 h.',
    nightSafe: 'Si hace calor por la noche, ventila bien y usa ropa ligera para dormir.',
    nightMod : 'El calor nocturno puede afectar al descanso. Ventila, hidrátate y usa ropa fresca.',
    nightHigh: 'Riesgo alto también por la noche. Bebe a menudo y garantiza ventilación.',
    nightExt : 'Riesgo extremo. Duerme en un espacio fresco e hidratado; evita esfuerzos nocturnos.',
  },

  eu: {
    title: 'Gomendioak:',
    safe : 'Egoera segurua. Mantendu ohiko hidratazioa.',
    mild : 'Litekeena bero nekearen agerpena. Edan ura maiz eta atseden hartu itzalean.',
    mod  : 'Berorako arrisku moderatua. Geldialdiak 20 minuturo, hidratazioa eta, EPIak uzten badu, jantzi arin eta transpiragarria. Saihestu ahalegin handiena 12:00-16:00.',
    high : 'Arrisku handia. Saihestu ahalegin handia, hidrata zaitez sarri eta luzatu atsedenaldiak itzalean. Saihestu ahalegin handiena 12:00-16:00.',
    ext  : 'Arrisku larria. Utzi jarduera eta freskatu berehala. Saihestu edozein ahalegin 12:00-16:00.',
    nightSafe: 'Gau beroa bada, ondo aireztatu gela eta erabili arropa arina lo egiteko.',
    nightMod : 'Gaueko beroak atsedenari eragin diezaioke. Aireztatu gela, edan ura eta jantzi arropa arina.',
    nightHigh: 'Gauez ere arrisku handia. Edan maiz ura eta ziurtatu gela freskoa eta aireztatua dela.',
    nightExt : 'Arrisku larria. Lo egin toki fresko eta aireztatuan; edan ura oheratu aurretik.',
  },

  gl: {
    title: 'Recomendacións:',
    safe : 'Condicións seguras. Mantén a hidratación habitual.',
    mild : 'Posible fatiga por calor. Bebe auga con frecuencia e repousa á sombra.',
    mod  : 'Risco moderado. Pausas cada 20 min, hidrátate e, se o EPI o permite, usa roupa lixeira e transpirable. Evita o esforzo máis intenso entre as 12 h e as 16 h.',
    high : 'Risco alto. Evita o esforzo intenso, hidrátate a miúdo e incrementa as pausas á sombra. Evita o esforzo máis intenso entre as 12 h e as 16 h.',
    ext  : 'Risco extremo. Detén a actividade e arrefréscate de inmediato. Evita calquera esforzo entre as 12 h e as 16 h.',
    nightSafe: 'Se fai calor pola noite, ventila ben e dorme con roupa lixeira.',
    nightMod : 'A calor nocturna pode afectar ao descanso. Ventila, bebe auga e usa roupa fresca.',
    nightHigh: 'Risco alto tamén pola noite. Hidrátate con frecuencia e asegura ventilación.',
    nightExt : 'Risco extremo. Durme nun espazo fresco e hidratado; evita esforzos nocturnos.',
  },
} as const;

/* ─── Component ─────────────────────────────────────── */
export default function Recommendations({ temp, lang, isDay }: Props): JSX.Element {
  const t = txt[lang];

  /* Mapegem el nivell de risc (getHeatRisk) al clau del text */
  const level     = getHeatRisk(temp).level;                 // 'Baix' | 'Moderat'…
  const level2key = { 'Cap risc':'safe', Baix:'mild', Moderat:'mod', Alt:'high', Extrem:'ext' } as const;
  const key       = level2key[level as keyof typeof level2key];

  const nightKey: Record<typeof key, keyof typeof t> = {
    safe:'nightSafe', mild:'nightSafe', mod:'nightMod', high:'nightHigh', ext:'nightExt',
  };

  const msg = isDay ? t[key] : t[nightKey[key]];

  return (
    <div style={{ marginTop:'1rem' }}>
      <h3>{t.title}</h3>
      <p>{msg}</p>
    </div>
  );
}