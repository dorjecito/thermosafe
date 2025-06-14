import React from 'react';

interface Props {
  temp: number;
}

export default function RiskLevelDisplay({ temp }: Props) {
  let level = 'Desconegut';
  let color = 'gray';

  if (temp < 28) {
    level = 'Baix';
    color = 'green';
  } else if (temp < 33) {
    level = 'Moderat';
    color = 'goldenrod';
  } else if (temp < 40) {
    level = 'Alt';
    color = 'orange';
  } else {
    level = 'Extrem';
    color = 'red';
  }

  return (
    <div>
      <h2>Risc per calor: <span style={{ color }}>{level}</span></h2>
      <p>Temperatura actual: {temp} °C</p>
    </div>
  );
}
