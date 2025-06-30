import React from 'react';

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
    mod:  'Risc alt de calor. Pauses cada 20 min, beu aigua sovint i, si l’EPI ho permet, roba lleugera i transpirable.',
    high: 'Risc molt alt. Evita l’esforç intens, hidrata’t sovint i incrementa les pauses a l’ombra.',
    ext:  'Risc extrem. Atura l’activitat i busca un lloc fresc immediatament.',
    night: 'Si fa calor a la nit, ventila bé l’espai i dorm amb roba lleugera.',
  },
  es: {
    title: 'Recomendaciones:',
    safe: 'Condiciones seguras. Mantén la hidratación habitual.',
    mild: 'Posible fatiga por calor. Bebe agua con frecuencia y descansa a la sombra.',
    mod:  'Riesgo alto de calor. Pausas cada 20 min, bebe agua con frecuencia y, si el EPI lo permite, usa ropa ligera y transpirable.',
    high: 'Riesgo muy alto. Evita el esfuerzo intenso, hidrátate a menudo y aumenta las pausas a la sombra.',
    ext:  'Riesgo extremo. Detén la actividad y busca un lugar fresco de inmediato.',
    night: 'Si hace calor por la noche, ventila bien y usa ropa ligera para dormir.',
  },
  eu: {
    title: 'Gomendioak:',
    safe: 'Egoera segurua. Mantendu ohiko hidratazioa.',
    mild: 'Litekeena bero nekearen agerpena. Edan ura sarri eta atseden hartu itzalean.',
    mod:  'Berorako arrisku handia. 20 minuturo atseden hartu, ura sarri edan eta, EPIak uzten badu, jantzi arin eta transpiragarria.',
    high: 'Arrisku oso handia. Saihestu ahalegin handia, hidrata zaitez sarri eta luzatu atsedenaldiak itzalean.',
    ext:  'Arrisku larria. Utzi jarduera eta bilatu berehala leku freskoa.',
    night: 'Gauez bero egiten badu, ondo aireztatu eta jantzi arin lo egiteko.',
  },
  gl: {
    title: 'Recomendacións:',
    safe: 'Condicións seguras. Mantén a hidratación habitual.',
    mild: 'Posible fatiga por calor. Bebe auga con frecuencia e repousa á sombra.',
    mod:  'Risco alto de calor. Pausas cada 20 min, bebe auga a miúdo e, se o EPI o permite, roupa lixeira e transpirable.',
    high: 'Risco moi alto. Evita o esforzo intenso, hidrátate a miúdo e incrementa as pausas á sombra.',
    ext:  'Risco extremo. Detén a actividade e procura un lugar fresco de inmediato.',
    night: 'Se fai calor pola noite, ventila ben e dorme con roupa lixeira.',
  },
} as const;

export default function Recommendations({ temp, lang, isDay }: Props): JSX.Element {
  const t = txt[lang];

  const msg =
    !isDay     ? t.night :
    temp < 27 ? t.safe  :
    temp < 32 ? t.mild  :
    temp < 40 ? t.mod   :
    temp < 55 ? t.high  :
                t.ext;

  return (
    <div style={{ marginTop: '1rem' }}>
      <h3>{t.title}</h3>
      <p>{msg}</p>
    </div>
  );
}