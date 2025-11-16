// 📌 Obté l’índex UV des d’OpenWeather One Call 3.0
export async function getUVI(lat: number, lon: number): Promise<number | null> {
  try {
    const apiKey = import.meta.env.VITE_OPENWEATHER_API_KEY;
    if (!apiKey) {
      console.error("❌ Falta VITE_OPENWEATHER_API_KEY al .env");
      return null;
    }

    const url =
      `https://api.openweathermap.org/data/3.0/onecall?lat=${lat}&lon=${lon}` +
      `&exclude=minutely,hourly,daily,alerts&appid=${apiKey}`;

    console.log("🌤️ Cridant OpenWeather UVI…", url);

    const response = await fetch(url);
    if (!response.ok) {
      console.error("❌ Error OpenWeather:", await response.text());
      return null;
    }

    const data = await response.json();
    console.log("🌞 Dades UVI rebudes:", data);

    return data.current?.uvi ?? null;

  } catch (err) {
    console.error("❌ Error obtenint UVI:", err);
    return null;
  }
}