import React from 'react';

interface Props {
  temp: number;
}

export default function RiskLevelDisplay({ temp }: Props) {
  let level = 'Desconegut';
  let color = 'gray';

  if (temp < 25) {
    level = 'Baix';
    color = 'green';
  } else if (temp < 30) {
    level = 'Mitjà';
    color = 'orange';
  } else if (temp < 35) {
    level = 'Alt';
    color = 'orangered';
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
