import React, { useEffect, useState } from 'react';
import './i18n';
import { useTranslation } from 'react-i18next';
import { getWeatherByCoords, getWeatherByCity } from './services/weatherAPI';
import { getUVI } from './services/uviAPI';
import RiskLevelDisplay from './components/RiskLevelDisplay';
import Recommendations from './components/Recommendations';
import UVAdvice from './components/UVAdvice';
import UVScale from './components/UVScale';
import { getLocationNameFromCoords } from './utils/getLocationNameFromCoords';
import LocationDisplay from './components/LocationDisplay';
import { getHeatRisk } from './utils/heatRisk';
import { inject } from '@vercel/analytics';

inject();

/* ───────── helpers ───────── */
const calcHI = (t: number, h: number) =>
  Math.round(
    (
      -8.784695 +
      1.61139411 * t +
      2.338549 * h -
      0.14611605 * t * h -
      0.012308094 * t * t -
      0.016424828 * h * h +
      0.002211732 * t * t * h +
      0.00072546 * t * h * h -
      0.000003582 * t * t * h * h
    ) * 10,
  ) / 10;

const isDaytime = () => {
  const h = new Date().getHours();
  const m = new Date().getMonth();
  const summer = m >= 5 && m <= 8;         // juny-setembre
  return summer ? h >= 7 && h <= 21 : h >= 8 && h <= 18;
};

const fetchSolarIrr = async (lat: number, lon: number, d: string) => {
  try {
    const url =
      `https://power.larc.nasa.gov/api/temporal/daily/point?parameters=ALLSKY_SFC_SW_DWN&start=${d}` +
      `&end=${d}&latitude=${lat}&longitude=${lon}&format=JSON&community=RE`;
    const r = await fetch(url);
    const j = await r.json();
    return j.properties.parameter.ALLSKY_SFC_SW_DWN[d] ?? null;
  } catch {
    return null;
  }
};

/* ───────── textos locals ───────── */
const TXT = {
  es: {
    t: 'ThermoSafe – Riesgo por calor ☀️',
    loc: '📍 Ubicación',
    hum: '💧 Humedad',
    hi: '🌡️ Índice de calor percibido',
    irr: '☀️ Irradiancia solar',
    uv: '🔆 Índice UV',
    hiIrr: '⚠️ Irradiancia solar muy alta. Evita la exposición prolongada al sol.',
    hiUV: '⚠️ Índice UV muy alto. ¡Protección solar imprescindible!',
    irrTips: '👒 Usa sombrero, gafas de sol y protector solar. Evita actividad física bajo sol intenso.',
    ph: 'Introduce una ciudad o pueblo',
    btn: '🔍 Consultar',
    gps: '📍 Usar ubicación actual',
    aExt: '🚨 ¡Riesgo EXTREMO de calor! Evita el esfuerzo e hidrátate constantemente.',
    aHi: '⚠️ ¡Riesgo alto o extremo de calor!',
    load: 'Cargando datos meteorológicos…',
    eGps: 'No se pudo obtener la temperatura por GPS.',
    eLoc: 'No se pudo obtener la ubicación.',
    eCity: 'No se encontraron datos para esta ciudad.',
    irrLeg: '☀️ Niveles de irradiancia: <8 moderado · ≥8 alto',
    legBtn: 'ℹ️ Mostrar/Ocultar leyenda',
    real: 'Temperatura real',
  },
  ca: {
    t: 'ThermoSafe – Risc per calor 🌞',
    loc: '📍 Localització',
    hum: '💧 Humitat',
    hi: '🌡️ Índex de calor percebut',
    irr: '☀️ Irradiància solar',
    uv: '🔆 Índex UV',
    hiIrr: '⚠️ Irradiància solar molt alta. Evita l’exposició prolongada al sol.',
    hiUV: '⚠️ Índex UV molt alt. Protecció solar imprescindible!',
    irrTips: '👒 Usa barret, ulleres de sol i crema solar. Evita activitats físiques sota el sol intens.',
    ph: 'Introdueix una ciutat o poble',
    btn: '🔍 Consulta',
    gps: '📍 Usar ubicació actual',
    aExt: '🚨 Risc EXTREM de calor! Evita l’esforç i hidrata’t constantment!',
    aHi: '⚠️ Risc alt o extrem de calor!',
    load: 'Carregant dades meteorològiques…',
    eGps: 'No s’ha pogut obtenir la temperatura per GPS.',
    eLoc: 'No s’ha pogut obtenir la ubicació.',
    eCity: 'No s’han trobat dades per aquesta localització.',
    irrLeg: '☀️ Nivells d’irradiància: <8 moderat · ≥8 alt',
    legBtn: 'ℹ️ Mostra/Oculta llegenda',
    real: 'Temperatura real',
  },
  eu: {
    t: 'ThermoSafe – Bero arriskua ☀️',
    loc: '📍 Kokapena',
    hum: '💧 Hezetasuna',
    hi: '🌡️ Sentsazio termikoa',
    irr: '☀️ Eguzki erradiazioa',
    uv: '🔆 UV indizea',
    hiIrr: '⚠️ Eguzki erradiazio oso handia. Saihestu eguzkipean denbora luzea.',
    hiUV: '⚠️ UV indize oso altua. Babes eguzkiarra ezinbestekoa!',
    irrTips: '👒 Erabili txapela, betaurrekoak eta eguzki-krema. Saihestu jarduera fisiko bizia.',
    ph: 'Sartu hiri edo herri bat',
    btn: '🔍 Bilatu',
    gps: '📍 Erabili uneko kokapena',
    aExt: '🚨 BERO ARRISKU LARRIA! Saihestu ahaleginak eta hidratatu etengabe!',
    aHi: '⚠️ Bero arrisku handia edo larria!',
    load: 'Eguraldi-datuak kargatzen…',
    eGps: 'Ezin izan da GPS bidezko tenperatura lortu.',
    eLoc: 'Ezin izan da kokapena zehaztu.',
    eCity: 'Ezin izan da daturik lortu kokapen honetarako.',
    irrLeg: '☀️ Erradiazio mailak: <8 moderatua · ≥8 altua',
    legBtn: 'ℹ️ Erakutsi/Ezkutatu legenda',
    real: 'Benetako tenperatura',
  },
  gl: {
    t: 'ThermoSafe – Risco por calor 🌞',
    loc: '📍 Localización',
    hum: '💧 Humidade',
    hi: '🌡️ Índice de calor percibido',
    irr: '☀️ Irradiancia solar',
    uv: '🔆 Índice UV',
    hiIrr: '⚠️ Irradiancia solar moi alta. Evita a exposición prolongada ao sol.',
    hiUV: '⚠️ Índice UV moi alto. Protección solar imprescindible!',
    irrTips: '👒 Usa sombreiro, lentes de sol e crema solar. Evita actividade física intensa.',
    ph: 'Introduce unha cidade ou vila',
    btn: '🔍 Consultar',
    gps: '📍 Usar localización actual',
    aExt: '🚨 RISCO EXTREMO de calor! Evita o esforzo e hidrátate constantemente!',
    aHi: '⚠️ Risco alto ou extremo por calor!',
    load: 'Cargando datos meteorolóxicos…',
    eGps: 'Non se puido obter a temperatura por GPS.',
    eLoc: 'Non se puido determinar a localización.',
    eCity: 'Non se puideron obter datos para esta localización.',
    irrLeg: '☀️ Niveis de irradiancia: <8 moderado · ≥8 alto',
    legBtn: 'ℹ️ Amosar/Ocultar lenda',
    real: 'Temperatura real',
  },
} as const;

/* ───────── component ───────── */
export default function App() {
  const supported = ['es', 'ca', 'eu', 'gl'] as const;
  const nav       = navigator.language.slice(0, 2).toLowerCase();
  const lang: (typeof supported)[number] = supported.includes(nav as any) ? (nav as any) : 'ca';

  /* sincronitza i18next perquè els altres components puguin usar t() */
  const { i18n } = useTranslation();
  useEffect(() => { i18n.changeLanguage(lang); }, [lang, i18n]);

  const t = TXT[lang];

  /* ─ state ─ */
  const [temp, setTemp] = useState<number | null>(null);
  const [hum , setHum ] = useState<number | null>(null);
  const [hi  , setHi  ] = useState<number | null>(null);
  const [irr , setIrr ] = useState<number | null>(null);
  const [uvi , setUvi ] = useState<number | null>(null);

  const [city    , setCity    ] = useState<string | null>(null);
  const [realCity, setRealCity] = useState('');
  const [err     , setErr     ] = useState('');
  const [input   , setInput   ] = useState('');
  const [leg     , setLeg     ] = useState(false);
  const [day     , setDay     ] = useState(isDaytime());

  /* ─ auto refresh ─ */
  useEffect(() => {
    locate();
    const id1 = setInterval(() => locate(true), 30 * 60 * 1000);
    const id2 = setInterval(() => setDay(isDaytime()), 10 * 60 * 1000);
    return () => { clearInterval(id1); clearInterval(id2); };
  }, []);

  /* ─ helpers ─ */
  const alarm = () => {
    alert(t.aHi);
    new Audio('/alarma_vaixell_guerra.mp3').play().catch(() => {});
    navigator.vibrate?.([500, 300, 500]);
  };

  const updateAll = async (
    tp: number, hm: number, fl: number,
    lat: number, lon: number, nm: string,
    silent = false,
  ) => {
    const today = new Date().toISOString().split('T')[0];
    const ir = await fetchSolarIrr(lat, lon, today);
    const uv = await getUVI(lat, lon);

    setTemp(tp); setHum(hm); setIrr(ir); setUvi(uv); setCity(nm);

    const hiVal = Math.abs(fl - tp) < 1 && hm > 60 ? calcHI(tp, hm) : fl;
    setHi(hiVal);
    if (getHeatRisk(hiVal).isHigh) alarm();
    if (!silent) setErr('');
  };

  const locate = (silent = false) => {
    navigator.geolocation.getCurrentPosition(
      async p => {
        try {
          const { latitude: lat, longitude: lon } = p.coords;
          const d  = await getWeatherByCoords(lat, lon);
          const nm = (await getLocationNameFromCoords(lat, lon)) || d.name;
          await updateAll(d.main.temp, d.main.humidity, d.main.feels_like, lat, lon, nm, silent);
          setInput(''); setRealCity('');
        } catch { !silent && setErr(t.eGps); }
      },
      () => !silent && setErr(t.eLoc),
    );
  };

  const search = async () => {
    if (!input.trim()) { setErr(t.eCity); return; }
    try {
      const d = await getWeatherByCity(input);
      const { lat, lon } = d.coord;
      const nm = (await getLocationNameFromCoords(lat, lon)) || d.name;
      await updateAll(d.main.temp, d.main.humidity, d.main.feels_like, lat, lon, nm);
      setRealCity(nm); setInput('');
    } catch { setErr(t.eCity); }
  };

  /* ─ render ─ */
  const safeLangUV = (['ca', 'es', 'eu', 'gl'] as const).includes(lang) ? lang : undefined;

  return (
    <div className="container">
      <h1>{t.t}</h1>

      {/* buscador */}
      <div style={{ marginBottom: '1rem' }}>
        <input value={input} onChange={e => setInput(e.target.value)} placeholder={t.ph} />
        <button onClick={search}>{t.btn}</button>
        <div style={{ marginTop: '1rem' }}>
          <button onClick={() => locate(false)}>{t.gps}</button>
        </div>
      </div>

      {/* alertes */}
      {hi !== null && getHeatRisk(hi).isHigh && (
        <div className="alert-banner">{getHeatRisk(hi).isExtreme ? t.aExt : t.aHi}</div>
      )}
      {irr !== null && irr >= 8 && (
        <div className="alert-banner">
          <p>{t.hiIrr}</p><p>{t.irrTips}</p>
        </div>
      )}

      {/* dades */}
      {temp !== null && hum !== null ? (
        <>
          {city && (
            <LocationDisplay
              city={city} realCity={realCity}
              lang={lang === 'es' ? 'es' : 'ca'}
              label={t.loc}
            />
          )}

          <p>{t.hum}: {hum}%</p>
          <p>{t.hi}: <strong>{hi} °C</strong></p>
          <p>📈 {t.real}: {temp} °C</p>

          {irr !== null && (
            <>
              <p>{t.irr}: <strong>{irr} kWh/m²/dia</strong></p>
              <button onClick={() => setLeg(!leg)}>{t.legBtn}</button>
              {leg && <p style={{ fontSize: '.85rem' }}>{t.irrLeg}</p>}
            </>
          )}

          {uvi !== null && day && <UVAdvice uvi={uvi} lang={lang} />}

          <div style={{ marginTop: '1.5rem' }}>
            <RiskLevelDisplay temp={hi!} lang={lang} />
          </div>

          <Recommendations temp={hi!} lang={lang} isDay={day} />

          {safeLangUV && <UVScale lang={safeLangUV} />}
        </>
      ) : (
        !err && <p>{t.load}</p>
      )}

      {err && <p style={{ color: 'red' }}>{err}</p>}
    </div>
  );
}