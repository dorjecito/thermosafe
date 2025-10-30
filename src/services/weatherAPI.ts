// src/services/weatherAPI.ts
import axios from 'axios';

const API_KEY = 'ebd4ce67a42857776f4463c756e18b45';
const BASE_URL = 'https://api.openweathermap.org/data/3.0/onecall';

// 🌦️ Tipus per a la resposta d'OpenWeather One Call
export interface WeatherResponse {
  current: {
    temp: number;        // Temperatura real (°C)
    feels_like: number;  // Sensació tèrmica (°C)
    humidity: number;    // Humitat (%)
    wind_speed: number;  // Velocitat del vent (m/s)
    weather: {
      description: string;
      icon: string;
    }[];
  };
  alerts?: {
    sender_name: string;  // Ex: "AEMET"
    event: string;        // Nom de l’avís ("Temperaturas máximas", etc.)
    description: string;  // Descripció de l’avís
    start: number;        // Inici (timestamp)
    end: number;          // Fi (timestamp)
  }[];
}

// 📍 Obté coordenades d’una ciutat
export async function getCoordsByCity(city: string): Promise<{ lat: number; lon: number }> {
  const geoUrl = `https://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(city)}&limit=1&appid=${API_KEY}`;
  const { data } = await axios.get(geoUrl);

  if (!data || data.length === 0) {
    throw new Error("No s'han trobat coordenades per a la ciutat.");
  }

  return { lat: data[0].lat, lon: data[0].lon };
}

// 🌡️ Obté dades meteorològiques completes + alertes
export async function getWeatherByCoords(lat: number, lon: number, lang: string = 'ca'): Promise<WeatherResponse> {
  const url = `${BASE_URL}?lat=${lat}&lon=${lon}&units=metric&lang=${lang}&appid=${API_KEY}`;
  const { data } = await axios.get<WeatherResponse>(url);

  // Mostra les alertes (AEMET) a la consola
  console.log("🔔 Alertes meteorològiques rebudes:", data.alerts);

  return data;
}

// 🌆 Obté dades a partir del nom d’una ciutat
export async function getWeatherByCity(city: string, lang: string = 'ca'): Promise<WeatherResponse> {
  const geoUrl = `https://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(city)}&limit=1&appid=${API_KEY}`;
  const geoRes = await axios.get(geoUrl);

  if (!geoRes.data || geoRes.data.length === 0) {
    throw new Error("No s'han trobat coordenades per a la ciutat.");
  }

  const { lat, lon } = geoRes.data[0];
  return getWeatherByCoords(lat, lon, lang);
}