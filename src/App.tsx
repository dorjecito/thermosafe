/* ───────────────────────────────────────────
   src/App.tsx  —  100 % camins relatius
   ─────────────────────────────────────────── */

   import React, { useEffect, useState } from 'react';
   import { useTranslation } from 'react-i18next';
   import './i18n';
   
   /* —— serveis ———————————————————————————— */
   import { getWeatherByCoords, getWeatherByCity } from './services/weatherAPI';
   import { getUVI } from './services/uviAPI';
   
   /* —— utilitats ——————————————————————————— */
   import { getLocationNameFromCoords } from './utils/getLocationNameFromCoords';
   import { getHeatRisk } from './utils/heatRisk';
   
   /* —— components ————————————————————————— */
   import LocationDisplay     from './components/LocationDisplay';
   import RiskLevelDisplay    from './components/RiskLevelDisplay';
   import Recommendations     from './components/Recommendations';
   import UVAdvice            from './components/UVAdvice';
   import UVScale             from './components/UVScale';
   
   /* —— analítica (opcional) ———————————— */
   import { inject } from '@vercel/analytics';
   inject()

/* ──────── constants & helpers ──────── */
const calcHI = (t: number, h: number) => {
  /* Heat-Index – Rothfusz regression */
  const hi =
    -8.784695 +
    1.61139411 * t +
    2.338549 * h -
    0.14611605 * t * h -
    0.012308094 * t * t -
    0.016424828 * h * h +
    0.002211732 * t * t * h +
    0.00072546 * t * h * h -
    0.000003582 * t * t * h * h;
  return Math.round(hi * 10) / 10;
};

const isDaytime = () => {
  const h = new Date().getHours();
  const m = new Date().getMonth();
  const summer = m >= 5 && m <= 8; // juny–set.
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

/* ──────── component ──────── */
export default function App() {
  /* i18next */
  const { t, i18n } = useTranslation();
  useEffect(() => {
  const browserLang = navigator.language.slice(0, 2).toLowerCase();
  const supportedLangs = ['ca', 'es', 'gl', 'eu'];
  const lang = supportedLangs.includes(browserLang) ? browserLang : 'ca';

  if (i18n.language !== lang) {
    i18n.changeLanguage(lang);
  }
}, []);


  /* state */
  const [temp, setTemp] = useState<number | null>(null);
  const [hum, setHum] = useState<number | null>(null);
  const [hi, setHi] = useState<number | null>(null);
  const [irr, setIrr] = useState<number | null>(null);
  const [uvi, setUvi] = useState<number | null>(null);
  const [wind, setWind] = useState<number | null>(null); // km/h
  const [wc, setWc] = useState<number | null>(null); // wind-chill

  const [city, setCity] = useState<string | null>(null);
  const [realCity, setRealCity] = useState('');
  const [err, setErr] = useState('');
  const [input, setInput] = useState('');
  const [leg, setLeg] = useState(false);
  const [day, setDay] = useState(isDaytime());

  /* auto-refresh */
  useEffect(() => {
    locate();
    const id1 = setInterval(() => locate(true), 30 * 60 * 1000);
    const id2 = setInterval(() => setDay(isDaytime()), 10 * 60 * 1000);
    return () => {
      clearInterval(id1);
      clearInterval(id2);
    };
  }, []);

  /* helpers */
  const updateAll = async (
    tp: number,
    hm: number,
    fl: number,
    lat: number,
    lon: number,
    nm: string,
    silent = false,
  ) => {
    const today = new Date().toISOString().split('T')[0];
    const ir = await fetchSolarIrr(lat, lon, today);
    const uv = await getUVI(lat, lon);

    setTemp(tp);
    setHum(hm);
    setIrr(ir);
    setUvi(uv);
    setCity(nm);

    /*  🔒 CLAMP HEAT-INDEX  🔒
   • Si la temperatura real (tp) és <18 °C ➜ no hi ha risc de calor,
     usem directament tp com a “hi”.
   • Només amb ≥18 °C apliquem la fórmula (si hi ha prou humitat). */
const hiVal =
  tp < 18
    ? tp
    : Math.abs(fl - tp) < 1 && hm > 60
        ? calcHI(tp, hm)
        : fl;

    setHi(hiVal);
    if (!silent) setErr('');
  };

  const locate = (silent = false) => {
    navigator.geolocation.getCurrentPosition(
      async (p) => {
        try {
          const { latitude: lat, longitude: lon } = p.coords;
          const d = await getWeatherByCoords(lat, lon);
          const nm = (await getLocationNameFromCoords(lat, lon)) || d.name;

          /* wind & wind-chill */
          setWind(Math.round(d.wind.speed * 3.6 * 10) / 10);
          setWc(null);

          await updateAll(d.main.temp, d.main.humidity, d.main.feels_like, lat, lon, nm, silent);
          setInput('');
          setRealCity('');
        } catch {
          !silent && setErr(t('errorGPS'));
        }
      },
      () => !silent && setErr(t('errorNoLocation')),
    );
  };

  const search = async () => {
    if (!input.trim()) {
      setErr(t('errorCity'));
      return;
    }
    try {
      const d = await getWeatherByCity(input);
      const { lat, lon } = d.coord;
      const nm = (await getLocationNameFromCoords(lat, lon)) || d.name;

      /* wind */
      const wKmh = Math.round(d.wind.speed * 3.6 * 10) / 10;
      setWind(wKmh);

      /* wind-chill (temperatura ≤ 10 °C & vent ≥ 5 km/h) */
      if (d.main.temp <= 10 && wKmh >= 5) {
        const wcVal =
          13.12 +
          0.6215 * d.main.temp -
          11.37 * Math.pow(wKmh, 0.16) +
          0.3965 * d.main.temp * Math.pow(wKmh, 0.16);
        setWc(Math.round(wcVal * 10) / 10);
      } else {
        setWc(null);
      }

      await updateAll(d.main.temp, d.main.humidity, d.main.feels_like, lat, lon, nm);
      setRealCity(nm);
      setInput('');
    } catch {
      setErr(t('errorCity'));
    }
  };

  /* ──────── render ──────── */
  const safeLangUV = ['ca', 'es', 'eu', 'gl'].includes(i18n.language) ? i18n.language : undefined;

  return (
    <div className="container">
      <h1>{t('title')}</h1>

      {/* 🔍 SEARCH */}
      <div style={{ marginBottom: '1rem' }}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={t('search_placeholder')}
        />
        <button onClick={search}>{t('search_button')}</button>
        <div style={{ marginTop: '1rem' }}>
          <button onClick={() => locate(false)}>{t('gps_button')}</button>
        </div>
      </div>

      {/* ⚠️ ALERTES */}
{hi !== null && hi >= 18 && getHeatRisk(hi).isHigh && (
  <div className="alert-banner">
    {getHeatRisk(hi).isExtreme ? t('alert_extreme') : t('alertRisk')}
  </div>
)}

{irr !== null && irr >= 8 && (
  <div className="alert-banner">
    <p>{t('highIrradianceWarning')}</p>
    <p>{t('irradianceTips')}</p>
  </div>
)}


     {/* 🌡️ DADES */}
{temp !== null && hum !== null ? (
  <>
    {city && (
      <LocationDisplay
        city={city}
        realCity={realCity}
        lang={i18n.language === 'es' ? 'es' : 'ca'}
        label={t('location')}
      />
    )}

    <p>{t('humidity')}: {hum}%</p>

    <p>{t('feels_like')}: <strong>{temp >= 20 ? hi : wc ?? hi} °C</strong></p>


    <p>{t('measured_temp')}: {temp} °C</p>

    {/* 💨 VENT */}
    {wind !== null && (
      <p>{t('wind')}: {wind.toFixed(1)} km/h</p>
    )}

{irr !== null && (
  <div style={{ marginTop: '1rem', textAlign: 'center' }}>
    <p>{t('irradiance')}: <strong>{irr} kWh/m²/dia</strong></p>

    <div style={{ marginTop: '1.2rem' }}>
      <h3 style={{ marginBottom: '0.4rem' }}>🔆 {t('solarProtection')}</h3>
      <button
        onClick={() => setLeg(!leg)}
        style={{
          backgroundColor: '#222',
          border: '1px solid #444',
          padding: '8px 16px',
          borderRadius: '8px',
          cursor: 'pointer',
          color: 'white',
          fontSize: '0.9rem',
        }}
      >
        ℹ️ {t('toggleLegend')}
      </button>
    </div>

    {leg && (
      <p style={{ fontSize: '.85rem', marginTop: '0.5rem' }}>
        {t('irradianceLegend')}
      </p>
    )}
  </div>
)}


    {uvi !== null && day && (
      <UVAdvice uvi={uvi} lang={i18n.language as any} />
    )}

    <div style={{ marginTop: '1.5rem' }}>
    <RiskLevelDisplay
  temp={hi!}
  lang={i18n.language as any}
  className={`risk-level ${getHeatRisk(hi!).class}`}
/>

    </div>

    <Recommendations
      temp={hi!}
      lang={i18n.language as any}
      isDay={day}
    />

    {safeLangUV && <UVScale lang={safeLangUV as any} />}
  </>
) : (
  !err && <p>{t('loading')}</p>
)}

{err && <p style={{ color: 'red' }}>{err}</p>}
</div> 
  );
}