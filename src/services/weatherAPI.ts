import axios from 'axios';

const API_KEY = 'ebd4ce67a42857776f4463c756e18b45';
const BASE_URL = 'https://api.openweathermap.org/data/2.5/weather';

interface WeatherResponse {
  main: {
    temp:       number;  // °C
    feels_like: number;  // °C  (la “sensació” que ja dona OW)
    humidity:   number;  // %
  };
  wind: {
    speed: number;       // m/s  (OpenWeather la retorna així)
  };
  name: string;          // nom del lloc
}


export async function getWeatherByCoords(lat: number, lon: number): Promise<WeatherResponse> {
  const url = `${BASE_URL}?lat=${lat}&lon=${lon}&appid=${API_KEY}&units=metric`;
  const response = await axios.get<WeatherResponse>(url);
  return response.data;
}

export async function getWeatherByCity(city: string): Promise<WeatherResponse> {
  const url = `${BASE_URL}?q=${encodeURIComponent(city)}&appid=${API_KEY}&units=metric`;
  const response = await axios.get<WeatherResponse>(url);
  return response.data;
}

