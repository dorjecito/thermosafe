import React from 'react';

interface LocationDisplayProps {
  city: string;
  realCity?: string;
  lang: 'ca' | 'es';
  label: string;
}

const LocationDisplay: React.FC<LocationDisplayProps> = ({
  city,
  realCity,
  lang,
  label,
}) => {
  return (
    <h2>
      {label}: {city}
      {realCity && realCity !== city && (
        <>
          {' ('}
          <span
            title={
              lang === 'es'
                ? 'Nombre del municipio según geolocalización'
                : 'Nom del municipi segons la geolocalització'
            }
          >
            {realCity}
          </span>
          {')'}
        </>
      )}
    </h2>
  );
};

export default LocationDisplay;