import React from 'react';

interface Props {
  temp: number;
}

export default function Recommendations({ temp }: Props) {
  let tips: string[] = [];

  if (temp < 25) {
    tips = ['Condicions segures. Mantén la hidratació habitual.'];
  } else if (temp < 30) {
    tips = ['Beu aigua cada 30 minuts.', 'Fes descansos a l’ombra cada hora.'];
  } else if (temp < 35) {
    tips = [
      'Beu aigua cada 20 minuts.',
      'Evita l’esforç físic intens al migdia.',
      'Fes descansos freqüents.',
    ];
  } else {
    tips = [
      'Evita treballar a ple sol si és possible.',
      'Fes pauses cada 20 minuts a l’ombra.',
      'Roba lleugera, barret, molta hidratació.',
      'Avís a responsables si apareixen marejos o rampes.',
    ];
  }

  return (
    <div>
      <h3>Recomanacions:</h3>
      <ul>
        {tips.map((tip, index) => <li key={index}>{tip}</li>)}
      </ul>
    </div>
  );
}
