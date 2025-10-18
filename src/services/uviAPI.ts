export async function getUVI(lat: number, lon: number): Promise<number | null> {
    try {
      // Si estem en desenvolupament, simulem el valor UVI per evitar errors locals
      if (import.meta.env.DEV) {
        console.log("🧪 Mode local: simulant UVI 4.5");
        return 4.5;
      }
  
      // Si és producció, fem la crida directa a OpenUV
      const response = await fetch(`https://api.openuv.io/api/v1/uv?lat=${lat}&lng=${lon}`, {
        headers: {
          "x-access-token": import.meta.env.VITE_OPENUV_KEY || "LA_TEVA_API_KEY"
        }
      });
  
      if (!response.ok) {
        throw new Error("Failed to fetch UVI");
      }
  
      const data = await response.json();
      console.log("🌞 UVI data:", data);
      return data.result?.uv ?? null;
  
    } catch (error) {
      console.error("❌ Error fetching UVI:", error);
      return null;
    }
  }