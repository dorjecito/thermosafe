// src/services/openWeatherUVI.ts
export async function getUVFromOW(lat: number, lon: number): Promise<number | null> {
  try {
    const API_KEY = "ebd4ce67a42857776f4463c756e18b45";

    const url = `https://api.openweathermap.org/data/3.0/onecall?lat=${lat}&lon=${lon}&appid=${API_KEY}&units=metric`;

    console.log("[DEBUG] Fetch UVI OW:", url);

    const response = await fetch(url);
    const data = await response.json();

    console.log("[DEBUG] OneCall 3.0 response:", data);

    // Camp correcte segons documentació 3.0
    const uvi =
      data?.current?.uvi ??
      data?.current?.uv ??
      null;

    return typeof uvi === "number" ? uvi : null;

  } catch (err) {
    console.error("[DEBUG] Error obtenint UVI OW:", err);
    return null;
  }
}