import React from 'react';
import { useTranslation } from 'react-i18next';

interface Props {
  temp: number;
}

export default function Recommendations({ temp }: Props) {
  const { t } = useTranslation();
  const hora = new Date().getHours();
  const esVespreONit = hora >= 20 || hora < 6;

  let tips: string[] = [];

  if (esVespreONit) {
    if (temp < 25) {
      tips = [t('night_safe'), t('night_water')];
    } else if (temp < 30) {
      tips = [t('night_moderate'), t('night_water'), t('night_clothes')];
    } else {
      tips = [t('night_extreme'), t('night_ventilator'), t('night_heavy_meal')];
    }
  } else {
    if (temp < 25) {
      tips = t('day_safe', { returnObjects: true });
    } else if (temp < 30) {
      tips = t('day_mild', { returnObjects: true });
    } else if (temp < 35) {
      tips = t('day_moderate', { returnObjects: true });
    } else {
      tips = t('day_high', { returnObjects: true });
    }
  }

  return (
    <div>
      <h3>{t('recommendations_title') ?? 'Recomanacions:'}</h3>
      {esVespreONit && (
        <p><strong>{t('night_label')}</strong></p>
      )}
      <ul>
        {tips.map((tip, index) => (
          <li key={index}>{tip}</li>
        ))}
      </ul>
    </div>
  );
}