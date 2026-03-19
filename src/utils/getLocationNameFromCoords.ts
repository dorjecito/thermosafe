// src/utils/getLocationNameFromCoords.ts

type GeoReverseItem = {
  name?: string;
  state?: string;
  country?: string;
  local_names?: Record<string, string>;
};

type NominatimAddress = {
  suburb?: string;
  neighbourhood?: string;
  quarter?: string;
  hamlet?: string;
  village?: string;
  town?: string;
  city?: string;
  municipality?: string;
  county?: string;
  state?: string;
  country?: string;
};

type NominatimResponse = {
  name?: string;
  display_name?: string;
  address?: NominatimAddress;
};

function pickLocalName(item: GeoReverseItem, lang?: string) {
  const l = (lang || "").toLowerCase();
  const ln = item.local_names;

  const byLang =
    (l && ln?.[l]) ||
    (l.startsWith("ca") && ln?.ca) ||
    (l.startsWith("es") && ln?.es) ||
    (l.startsWith("eu") && ln?.eu) ||
    (l.startsWith("gl") && ln?.gl) ||
    (l.startsWith("en") && ln?.en);

  return (byLang || item.name || "").trim();
}

function pickBestLocalName(address?: NominatimAddress): string {
  if (!address) return "";

  const local =
    address.suburb ||
    address.neighbourhood ||
    address.quarter ||
    address.hamlet ||
    address.village ||
    address.town ||
    address.city ||
    "";

  const municipality =
    address.municipality ||
    address.city ||
    address.town ||
    "";

  if (local && municipality && local !== municipality) {
    return `${local}, ${municipality}`;
  }

  return (
    local ||
    municipality ||
    address.county ||
    address.state ||
    address.country ||
    ""
  );
}

async function getFromNominatim(
  lat: number,
  lon: number,
  lang?: string
): Promise<string> {
  try {
    const language = (lang || "ca").split("-")[0].toLowerCase();

    const url =
      `https://nominatim.openstreetmap.org/reverse` +
      `?lat=${encodeURIComponent(lat)}` +
      `&lon=${encodeURIComponent(lon)}` +
      `&format=jsonv2` +
      `&addressdetails=1` +
      `&accept-language=${encodeURIComponent(language)}`;

    const res = await fetch(url, {
      headers: {
        Accept: "application/json",
      },
    });

    if (!res.ok) {
      console.warn("[Nominatim Reverse] HTTP", res.status, res.statusText);
      return "";
    }

    const data = (await res.json()) as NominatimResponse;

    return (
      pickBestLocalName(data.address) ||
      (data.name || data.display_name || "").trim()
    );
  } catch (error) {
    console.warn("[Nominatim Reverse] Error:", error);
    return "";
  }
}

async function getFromOpenWeather(
  lat: number,
  lon: number,
  lang?: string
): Promise<string> {
  try {
    const API_KEY =
      (import.meta as any).env?.VITE_OPENWEATHER_KEY ||
      (import.meta as any).env?.VITE_OWM_KEY ||
      (import.meta as any).env?.VITE_OPENWEATHER_API_KEY;

    if (!API_KEY) return "";

    const url =
      `https://api.openweathermap.org/geo/1.0/reverse` +
      `?lat=${encodeURIComponent(lat)}` +
      `&lon=${encodeURIComponent(lon)}` +
      `&limit=1` +
      `&appid=${API_KEY}`;

    const res = await fetch(url);

    if (!res.ok) {
      console.warn("[OpenWeather Reverse] HTTP", res.status, res.statusText);
      return "";
    }

    const data = (await res.json()) as GeoReverseItem[];
    const first = data?.[0];
    if (!first) return "";

    return pickLocalName(first, lang);
  } catch (error) {
    console.warn("[OpenWeather Reverse] Error:", error);
    return "";
  }
}

export async function getLocationNameFromCoords(
  lat: number,
  lon: number,
  lang?: string
): Promise<string> {
  try {
    // 1) Intent més fi: barri / suburbi / urbanització / nucli
    const nominatimName = await getFromNominatim(lat, lon, lang);
    if (nominatimName) return nominatimName;

    // 2) Fallback estable: municipi / ciutat
    const openWeatherName = await getFromOpenWeather(lat, lon, lang);
    if (openWeatherName) return openWeatherName;

    return "";
  } catch (error) {
    console.error("Error obtenint el nom de la ubicació:", error);
    return "";
  }
}