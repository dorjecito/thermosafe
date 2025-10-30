import axios from "axios";

const API_KEY = "ebd4ce67a42857776f4463c756e18b45";
const BASE_URL = "https://api.openweathermap.org/data/2.5/weather";

// 🌦️ Tipus per a la resposta d'OpenWeather
export interface WeatherResponse {
  coord: {
    lat: number;
    lon: number;
  };
  weather: {
    id: number;
    main: string;
    description: string;
    icon: string;
  }[];
  base: string;
  main: {
    temp: number;
    feels_like: number;
    temp_min: number;
    temp_max: number;
    pressure: number;
    humidity: number;
  };
  visibility?: number;
  wind: {
    speed: number;
    deg: number;
  };
  clouds?: {
    all: number;
  };
  dt?: number;
  sys?: {
    country?: string;
    sunrise?: number;
    sunset?: number;
  };
  timezone?: number;
  id?: number;
  name: string;
  cod?: number;
}

// 📍 Obté dades per coordenades
export async function getWeatherByCoords(
  lat: number,
  lon: number,
  lang = "ca"
): Promise<WeatherResponse> {
  const url = `${BASE_URL}?lat=${lat}&lon=${lon}&appid=${API_KEY}&units=metric&lang=${lang}`;
  const response = await axios.get<WeatherResponse>(url);
  return response.data;
}

// 🌆 Obté dades per ciutat
export async function getWeatherByCity(
  city: string,
  lang = "ca"
): Promise<WeatherResponse> {
  const url = `${BASE_URL}?q=${encodeURIComponent(
    city
  )}&appid=${API_KEY}&units=metric&lang=${lang}`;
  const response = await axios.get<WeatherResponse>(url);
  return response.data;
}