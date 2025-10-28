import axios from 'axios';

const API_KEY = 'ebd4ce67a42857776f4463c756e18b45';
const BASE_URL = 'https://api.openweathermap.org/data/2.5/weather';

// 🌦️ Tipus per a la resposta d'OpenWeather
export interface WeatherResponse {
  main: {
    temp: number;         // °C
    feels_like: number;   // °C (la “sensació” que ja dona OW)
    humidity: number;     // %
  };
  wind: {
    speed: number;        // m/s (OpenWeather la retorna així)
  };
  coord?: {
    lat: number;
    lon: number;
  };
  name: string;           // Nom del lloc
  // ☁️ Afegit per a l’estat del cel
  weather?: {
    description: string;
    icon: string;
  }[];
}

// 📍 Obté dades per coordenades
export async function getWeatherByCoords(lat: number, lon: number): Promise<WeatherResponse> {
  const url = `${BASE_URL}?lat=${lat}&lon=${lon}&appid=${API_KEY}&units=metric&lang=en`;
  const response = await axios.get<WeatherResponse>(url);
  return response.data;
}

// 🌆 Obté dades per ciutat
export async function getWeatherByCity(city: string): Promise<WeatherResponse> {
  const url = `${BASE_URL}?q=${encodeURIComponent(city)}&appid=${API_KEY}&units=metric&lang=en`;
  const response = await axios.get<WeatherResponse>(url);
  return response.data;
}