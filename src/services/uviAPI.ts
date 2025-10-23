export async function getUVI(lat: number, lon: number): Promise<number | null> {
  try {
    // 💻 Mode local (durant desenvolupament)
    if (import.meta.env.DEV) {
      console.log("🧪 Mode local: simulant UVI 4.5");
      return 4.5;
    }

    // 🌍 En producció: crida al backend de Vercel (no directament a OpenUV)
    const response = await fetch(`/api/openuv?lat=${lat}&lon=${lon}`);

    console.log("📡 Resposta backend /api/openuv:", response.status);

    if (!response.ok) {
      const text = await response.text();
      console.error("❌ Error resposta /api/openuv:", text);
      throw new Error(`Error backend: ${response.status}`);
    }

    const data = await response.json();
    console.log("🌞 Dades UVI rebudes:", data);

    // 🔁 Retorna el valor UV si existeix
    return data?.result?.uv ?? null;

  } catch (error) {
    console.error("💥 Error obtenint UVI:", error);
    return null;
  }
}