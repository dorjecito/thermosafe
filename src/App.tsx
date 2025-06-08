import React, { useEffect, useState } from 'react';
import { getWeatherByCoords, getWeatherByCity } from './services/weatherAPI';
import RiskLevelDisplay from './components/RiskLevelDisplay';
import Recommendations from './components/Recommendations';

function calculateHeatIndex(temp: number, humidity: number): number {
  const T = temp;
  const R = humidity;
  const HI =
    -8.784695 +
    1.61139411 * T +
    2.338549 * R +
    -0.14611605 * T * R +
    -0.012308094 * T * T +
    -0.016424828 * R * R +
    0.002211732 * T * T * R +
    0.00072546 * T * R * R +
    -0.000003582 * T * T * R * R;
  return Math.round(HI * 10) / 10;
}

function App() {
  const lang = navigator.language.startsWith('es') ? 'es' : 'ca';

  const t = {
    title: lang === 'es' ? 'ThermoSafe – Riesgo por calor ☀️' : 'ThermoSafe – Risc per calor 🌞',
    location: lang === 'es' ? '📍 Ubicación' : '📍 Localització',
    humidity: lang === 'es' ? '💧 Humedad' : '💧 Humitat',
    heatIndex: lang === 'es' ? '🌡️ Índice de calor percibido' : '🌡️ Índex de calor percebut',
    searchPlaceholder: lang === 'es' ? 'Introduce una ciudad o pueblo' : 'Introdueix una ciutat o poble',
    buttonSearch: lang === 'es' ? '🔍 Consultar' : '🔍 Consulta',
    selectLabel: lang === 'es' ? 'Ciudades habituales:' : 'Ciutats habituals:',
    selectDefault: lang === 'es' ? '-- Selecciona --' : '-- Selecciona --',
    useGPS: lang === 'es' ? '📍 Usar ubicación actual' : '📍 Usar ubicació actual',
    alertText: lang === 'es'
      ? '🚨 ¡Riesgo EXTREMO de calor! Evita el esfuerzo e hidrátate constantemente.'
      : '🚨 Risc EXTREM de calor! Evita l’esforç i hidrata’t constantment!',
    loading: lang === 'es' ? 'Cargando datos meteorológicos…' : 'Carregant dades meteorològiques…',
    errorGPS: lang === 'es' ? 'No se pudo obtener la temperatura por GPS.' : 'No s’ha pogut obtenir la temperatura per GPS.',
    errorNoLocation: lang === 'es' ? 'No se pudo obtener la ubicación.' : 'No s’ha pogut obtenir la ubicació.',
    errorCity: lang === 'es' ? 'No se encontraron datos para esta ciudad.' : 'No s’ha pogut obtenir dades per aquesta localització.',
    alertRisk: lang === 'es' ? '⚠️ ¡Riesgo alto o extremo de calor!' : '⚠️ Risc alt o extrem de calor!',
  };

  const [temp, setTemp] = useState<number | null>(null);
  const [humidity, setHumidity] = useState<number | null>(null);
  const [city, setCity] = useState<string | null>(null);
  const [heatIndex, setHeatIndex] = useState<number | null>(null);
  const [error, setError] = useState<string>('');
  const [cityInput, setCityInput] = useState<string>('');

  useEffect(() => {
    handleGeolocation();
    const interval = setInterval(() => {
      console.log('[ThermoSafe] Verificant temperatura...');
      handleGeolocation(true);
    }, 30 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const triggerAlarm = () => {
    alert(t.alertRisk);
    const audio = new Audio('/alarma_vaixell_guerra.mp3');
    audio.play().catch((e) => console.warn('Error reproduint el so:', e));
    if (navigator.vibrate) {
      navigator.vibrate([500, 300, 500]);
    }
  };

  const handleGeolocation = (silent: boolean = false) => {
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const data = await getWeatherByCoords(
            position.coords.latitude,
            position.coords.longitude
          );
          const tempValue = data.main.temp;
          const humidityValue = data.main.humidity;

          setTemp(tempValue);
          setHumidity(humidityValue);
          setCity(data.name);

          const hi = calculateHeatIndex(tempValue, humidityValue);
          setHeatIndex(hi);
          setCityInput('');
          if (!silent) setError('');
          if (hi >= 38) triggerAlarm();
        } catch (err) {
          if (!silent) setError(t.errorGPS);
        }
      },
      () => {
        if (!silent) setError(t.errorNoLocation);
      }
    );
  };

  const handleCitySearch = async () => {
    try {
      const data = await getWeatherByCity(cityInput);
      const tempValue = data.main.temp;
      const humidityValue = data.main.humidity;

      setTemp(tempValue);
      setHumidity(humidityValue);
      setCity(data.name);

      const hi = calculateHeatIndex(tempValue, humidityValue);
      setHeatIndex(hi);
      setError('');
      if (hi >= 38) triggerAlarm();
    } catch (err) {
      setError(t.errorCity);
    }
  };

  const handleCitySearchFromSelect = async (selectedCity: string) => {
    setCityInput(selectedCity);
    await handleCitySearch();
  };

  return (
    <div className="container">
      <h1>{t.title}</h1>

      <div style={{ marginBottom: '1rem' }}>
        <input
          type="text"
          value={cityInput}
          onChange={(e) => setCityInput(e.target.value)}
          placeholder={t.searchPlaceholder}
        />
        <button onClick={handleCitySearch}>{t.buttonSearch}</button>

        <div style={{ marginTop: '0.5rem' }}>
          <label style={{ marginRight: '0.5rem' }}>{t.selectLabel}</label>
          <select onChange={(e) => handleCitySearchFromSelect(e.target.value)} defaultValue="">
            <option value="" disabled>{t.selectDefault}</option>
            {[
              'Alcúdia', 'Andratx', 'Artà', 'Binissalem', 'Bunyola', 'Calvià', 'Campos',
              'Ciutadella', 'Eivissa', 'Es Castell', 'Es Mercadal', 'Es Migjorn Gran',
              'Felanitx', 'Ferreries', 'Inca', 'Llucmajor', 'Maó', 'Manacor', 'Palma',
              'Pollença', 'Porreres', 'Sant Antoni de Portmany', 'Sant Francesc Xavier',
              'Sant Joan', 'Sant Josep de sa Talaia', 'Sant Llorenç des Cardassar',
              'Santa Eulària des Riu', 'Santa Margalida', 'Santanyí', 'Sineu', 'Sóller'
            ].map((ciutat) => (
              <option key={ciutat} value={ciutat}>{ciutat}</option>
            ))}
          </select>
        </div>

        <div style={{ marginTop: '1rem' }}>
          <button onClick={() => handleGeolocation(false)}>{t.useGPS}</button>
        </div>
      </div>

      {heatIndex !== null && heatIndex >= 40 && (
        <div className="alert-banner">{t.alertText}</div>
      )}

      {temp !== null && humidity !== null ? (
        <>
          {city && <h2>{t.location}: {city}</h2>}
          <p>{t.humidity}: {humidity}%</p>
          <p>{t.heatIndex}: <strong>{heatIndex} °C</strong></p>
          <RiskLevelDisplay temp={heatIndex!} />
          <Recommendations temp={heatIndex!} />
        </>
      ) : (
        !error && <p>{t.loading}</p>
      )}

      {error && <p style={{ color: 'red' }}>{error}</p>}
    </div>
  );
}

export default App;