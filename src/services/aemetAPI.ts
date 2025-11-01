import axios from "axios";

const API_KEY = "ebd4ce67a42857776f4463c756e18b45";

// 📍 Rutes candidates (per si canvien)
const ENDPOINTS = [
  "https://opendata.aemet.es/opendata/api/avisos_cap/activ",
  "https://opendata.aemet.es/opendata/api/red/avisos_cap/",
];

// 🔹 Funció auxiliar per obtenir la URL de dades reals
async function fetchAemetData(url: string) {
  try {
    const res = await axios.get(`${url}?api_key=${API_KEY}`);
    if (res.data?.datos) {
      const datosRes = await axios.get(res.data.datos);
      return datosRes.data;
    }
    return [];
  } catch (err) {
    console.warn("⚠️ Endpoint AEMET no disponible:", url);
    return null;
  }
}

// 🌦️ Obté alertes meteorològiques actives
export async function getAemetAlerts(): Promise<any[]> {
  for (const endpoint of ENDPOINTS) {
    const data = await fetchAemetData(endpoint);
    if (data && data.length > 0) {
      console.log("✅ AEMET actiu:", endpoint);
      return data;
    }
  }
  console.warn("❌ Cap endpoint AEMET ha retornat dades.");
  return [];
}