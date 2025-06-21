import React, { useEffect, useState } from 'react';
import { getWeatherByCoords, getWeatherByCity } from './services/weatherAPI';
import { getUVI } from './services/uviAPI';
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

function getIrradianceRecommendations(lang: string): string {
  return lang === 'es'
    ? '👒 Usa sombrero, gafas de sol y protección solar. Evita actividades físicas bajo el sol intenso.'
    : '👒 Usa barret, ulleres de sol i crema solar. Evita activitats físiques sota el sol intens.';
}

async function fetchSolarIrradiance(lat: number, lon: number, date: string): Promise<number | null> {
  try {
    const url = `https://power.larc.nasa.gov/api/temporal/daily/point?parameters=ALLSKY_SFC_SW_DWN&start=${date}&end=${date}&latitude=${lat}&longitude=${lon}&format=JSON&community=RE`;
    const response = await fetch(url);
    const data = await response.json();
    return data.properties.parameter.ALLSKY_SFC_SW_DWN[date] ?? null;
  } catch (error) {
    console.error('Error fetching solar irradiance:', error);
    return null;
  }
}

function App() {
  const lang = navigator.language.startsWith('es') ? 'es' : 'ca';

  const t = {
    title: lang === 'es' ? 'ThermoSafe – Riesgo por calor ☀️' : 'ThermoSafe – Risc per calor 🌞',
    location: lang === 'es' ? '📍 Ubicación' : '📍 Localització',
    humidity: lang === 'es' ? '💧 Humedad' : '💧 Humitat',
    heatIndex: lang === 'es' ? '🌡️ Índice de calor percibido' : '🌡️ Índex de calor percebut',
    irradiance: lang === 'es' ? '☀️ Irradiancia solar' : '☀️ Irradiància solar',
    uvi: lang === 'es' ? '🔆 Índice UV' : '🔆 Índex UV',
    highIrradianceWarning: lang === 'es' ? '⚠️ Irradiancia solar muy alta. Evita la exposición prolongada al sol.' : '⚠️ Irradiància solar molt alta. Evita l’exposició prolongada al sol.',
    highUVIWarning: lang === 'es' ? '⚠️ Índice UV muy alto. Protección solar imprescindible!' : '⚠️ Índex UV molt alt. Protecció solar imprescindible!',
    irradianceTips: getIrradianceRecommendations(lang),
    searchPlaceholder: lang === 'es' ? 'Introduce una ciudad o pueblo' : 'Introdueix una ciutat o poble',
    buttonSearch: lang === 'es' ? '🔍 Consultar' : '🔍 Consulta',
    useGPS: lang === 'es' ? '📍 Usar ubicación actual' : '📍 Usar ubicació actual',
    alertText: lang === 'es'
      ? '🚨 ¡Riesgo EXTREMO de calor! Evita el esfuerzo e hidrátate constantemente.'
      : '🚨 Risc EXTREM de calor! Evita l’esforç i hidrata’t constantment!',
    loading: lang === 'es' ? 'Cargando datos meteorológicos…' : 'Carregant dades meteorològiques…',
    errorGPS: lang === 'es' ? 'No se pudo obtener la temperatura por GPS.' : 'No s’ha pogut obtenir la temperatura per GPS.',
    errorNoLocation: lang === 'es' ? 'No se pudo obtener la ubicación.' : 'No s’ha pogut obtenir la ubicació.',
    errorCity: lang === 'es' ? 'No se encontraron datos para esta ciudad.' : 'No s’ha pogut obtenir dades per aquesta localització.',
    alertRisk: lang === 'es' ? '⚠️ ¡Riesgo alto o extremo de calor!' : '⚠️ Risc alt o extrem de calor!',
    irradianceLegend: lang === 'es' ? '☀️ Niveles de irradiancia: <8 moderado · ≥8 alto' : '☀️ Nivells d’irradiància: <8 moderat · ≥8 alt',
    toggleLegend: lang === 'es' ? 'ℹ️ Mostrar/Ocultar llegenda' : 'ℹ️ Mostra/Oculta llegenda',
  };

  const [temp, setTemp] = useState<number | null>(null);
  const [humidity, setHumidity] = useState<number | null>(null);
  const [city, setCity] = useState<string | null>(null);
  const [heatIndex, setHeatIndex] = useState<number | null>(null);
  const [irradiance, setIrradiance] = useState<number | null>(null);
  const [uvi, setUVI] = useState<number | null>(null);
  const [error, setError] = useState<string>('');
  const [cityInput, setCityInput] = useState<string>('');
  const [showLegend, setShowLegend] = useState<boolean>(false);

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
          const lat = position.coords.latitude;
          const lon = position.coords.longitude;
          const today = new Date().toISOString().split('T')[0];

          const data = await getWeatherByCoords(lat, lon);
          const tempValue = data.main.temp;
          const humidityValue = data.main.humidity;
          const solarValue = await fetchSolarIrradiance(lat, lon, today);
          const uviValue = await getUVI(lat, lon);

          setTemp(tempValue);
          setHumidity(humidityValue);
          setIrradiance(solarValue);
          setUVI(uviValue);
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
      const cityLat = data.coord.lat;
      const cityLon = data.coord.lon;
      const today = new Date().toISOString().split('T')[0];
      const solarValue = await fetchSolarIrradiance(cityLat, cityLon, today);
      const uviValue = await getUVI(cityLat, cityLon);

      setTemp(tempValue);
      setHumidity(humidityValue);
      setIrradiance(solarValue);
      setUVI(uviValue);
      setCity(data.name);

      const hi = calculateHeatIndex(tempValue, humidityValue);
      setHeatIndex(hi);
      setError('');
      if (hi >= 38) triggerAlarm();
    } catch (err) {
      setError(t.errorCity);
    }
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

        <div style={{ marginTop: '1rem' }}>
          <button onClick={() => handleGeolocation(false)}>{t.useGPS}</button>
        </div>
      </div>

      {heatIndex !== null && heatIndex >= 40 && (
        <div className="alert-banner">{t.alertText}</div>
      )}

      {irradiance !== null && irradiance >= 8 && (
        <div className="alert-banner">
          <p>{t.highIrradianceWarning}</p>
          <p>{t.irradianceTips}</p>
        </div>
      )}

      {uvi !== null && uvi >= 8 && (
        <div className="alert-banner">
          <p>{t.highUVIWarning}</p>
          <p>{t.irradianceTips}</p>
        </div>
      )}

      {temp !== null && humidity !== null ? (
        <>
          {city && <h2>{t.location}: {city}</h2>}
          <p>{t.humidity}: {humidity}%</p>
          <p>{t.heatIndex}: <strong>{heatIndex} °C</strong></p>
          {irradiance !== null && <p>{t.irradiance}: <strong>{irradiance} kWh/m²/dia</strong></p>}
          {uvi !== null && <p>{t.uvi}: <strong>{uvi}</strong></p>}
          {irradiance !== null && (
            <>
              <button onClick={() => setShowLegend(!showLegend)}>{t.toggleLegend}</button>
              {showLegend && <p style={{ fontSize: '0.85rem', color: '#666' }}>{t.irradianceLegend}</p>}
            </>
          )}
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
