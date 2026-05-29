import axios from "axios";

function buildWeatherUrl(
  params: Record<string, string | number>,
  apiKey?: string
) {
  const directKey =
    apiKey ||
    (import.meta.env.DEV
      ? import.meta.env.VITE_OPENWEATHER_API_KEY ||
        import.meta.env.VITE_OPENWEATHER_KEY ||
        import.meta.env.VITE_OWM_KEY
      : "");

  const url = new URL(
    directKey
      ? "https://api.openweathermap.org/data/2.5/weather"
      : "/api/openweather",
    directKey ? undefined : window.location.origin
  );

  if (!directKey) url.searchParams.set("route", "weather");

  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, String(value));
  }

  if (directKey) url.searchParams.set("appid", directKey);

  return directKey ? url.toString() : `${url.pathname}${url.search}`;
}

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
  lang: string
): Promise<WeatherResponse> {
  const url = buildWeatherUrl({ lat, lon, units: "metric", lang });
  const response = await axios.get<WeatherResponse>(url);
  return response.data;
}

// 🌆 Obté dades per ciutat
export async function getWeatherByCity(
  city: string,
  lang: string
): Promise<WeatherResponse> {
  const url = buildWeatherUrl({ q: city, units: "metric", lang });
  const response = await axios.get<WeatherResponse>(url);
  return response.data;
}
