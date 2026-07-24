// src/utils/getLocationNameFromCoords.ts
import { startupEnd, startupStart } from "./startupAudit";

type GeoReverseItem = {
  name?: string;
  state?: string;
  country?: string;
  local_names?: Record<string, string>;
};

type NominatimAddress = {
  house_number?: string;
  road?: string;
  pedestrian?: string;
  residential?: string;
  suburb?: string;
  neighbourhood?: string;
  quarter?: string;
  city_district?: string;
  borough?: string;
  hamlet?: string;
  village?: string;
  town?: string;
  city?: string;
  municipality?: string;
  county?: string;
  state_district?: string;
  state?: string;
  postcode?: string;
  country?: string;
  country_code?: string;
};

type NominatimResponse = {
  name?: string;
  display_name?: string;
  type?: string;
  category?: string;
  addresstype?: string;
  address?: NominatimAddress;
};

const NOMINATIM_CANDIDATE_FIELDS = [
  "suburb",
  "neighbourhood",
  "quarter",
  "hamlet",
  "village",
  "town",
  "city",
  "county",
  "state",
  "country",
] as const;

export type LocationCandidateField = {
  field: (typeof NOMINATIM_CANDIDATE_FIELDS)[number];
  value: string | null;
};

export type LocationSelectionAudit = {
  candidateFields: LocationCandidateField[];
  selectedField: LocationCandidateField["field"] | "municipality" | null;
  selectedValue: string | null;
  municipality: string;
  finalLabel: string;
};

function locationAuditAddress(address?: NominatimAddress) {
  return {
    house_number: address?.house_number || "",
    road: address?.road || "",
    pedestrian: address?.pedestrian || "",
    residential: address?.residential || "",
    suburb: address?.suburb || "",
    neighbourhood: address?.neighbourhood || "",
    quarter: address?.quarter || "",
    city_district: address?.city_district || "",
    borough: address?.borough || "",
    hamlet: address?.hamlet || "",
    village: address?.village || "",
    town: address?.town || "",
    city: address?.city || "",
    municipality: address?.municipality || "",
    county: address?.county || "",
    state_district: address?.state_district || "",
    state: address?.state || "",
    postcode: address?.postcode || "",
    country: address?.country || "",
    country_code: address?.country_code || "",
  };
}

function logLocationAudit(
  payload: {
    lat: number;
    lon: number;
    provider: "Nominatim" | "OpenWeather fallback";
    fields: Record<string, unknown>;
    finalName: string;
    source: string;
    selection?: LocationSelectionAudit;
    fallbackReason?: string;
  }
) {
  if (!import.meta.env.DEV) return;

  console.log("[Location Audit]", {
    gps: {
      latitude: payload.lat,
      longitude: payload.lon,
    },
    reverseGeocoder: {
      provider: payload.provider,
      ...payload.fields,
    },
    selection: payload.selection || {
      candidateFields: [],
      selectedField: null,
      selectedValue: payload.finalName || null,
      municipality: "",
      finalLabel: payload.finalName,
      source: payload.source,
      fallbackReason: payload.fallbackReason || "",
    },
  });
}

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

export function getNominatimSelectionAudit(
  address?: NominatimAddress
): LocationSelectionAudit {
  const candidateFields = NOMINATIM_CANDIDATE_FIELDS.map((field) => ({
    field,
    value: address?.[field]?.trim() || null,
  }));
  const localCandidate =
    candidateFields
      .filter((candidate) =>
        ["suburb", "neighbourhood", "quarter", "hamlet", "village", "town", "city"].includes(
          candidate.field
        )
      )
      .find((candidate) => candidate.value) || null;
  const municipality =
    address?.municipality?.trim() ||
    address?.city?.trim() ||
    address?.town?.trim() ||
    "";
  const fallbackCandidate =
    candidateFields
      .filter((candidate) => ["county", "state", "country"].includes(candidate.field))
      .find((candidate) => candidate.value) || null;
  const selectedCandidate =
    localCandidate ||
    (municipality ? { field: "municipality" as const, value: municipality } : null) ||
    fallbackCandidate;
  const selectedValue = selectedCandidate?.value || null;
  const finalLabel =
    localCandidate?.value && municipality && localCandidate.value !== municipality
      ? `${localCandidate.value}, ${municipality}`
      : localCandidate?.value ||
        municipality ||
        fallbackCandidate?.value ||
        "";

  return {
    candidateFields,
    selectedField: selectedCandidate?.field || null,
    selectedValue,
    municipality,
    finalLabel,
  };
}

function pickBestLocalName(address?: NominatimAddress): string {
  return getNominatimSelectionAudit(address).finalLabel;
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
      startupEnd("nominatim-reverse", { status: "http-error", httpStatus: res.status });
      console.warn("[Nominatim Reverse] HTTP", res.status, res.statusText);
      return "";
    }

    const data = (await res.json()) as NominatimResponse;

    const selection = getNominatimSelectionAudit(data.address);
    const bestLocalName = selection.finalLabel;
    const fallbackName = (data.name || data.display_name || "").trim();
    const finalName = bestLocalName || fallbackName;

    logLocationAudit({
      lat,
      lon,
      provider: "Nominatim",
      fields: {
        displayName: data.display_name || "",
        name: data.name || "",
        type: data.type || "",
        category: data.category || "",
        addresstype: data.addresstype || "",
        address: locationAuditAddress(data.address),
      },
      finalName,
      source: bestLocalName ? "address_priority" : "name_or_display_name",
      selection,
    });

    startupEnd("nominatim-reverse", {
      status: finalName ? "ok" : "empty",
      selectedField: selection.selectedField,
      hasLocalField: Boolean(selection.selectedValue),
    });
    return finalName;
  } catch (error) {
    startupEnd("nominatim-reverse", { status: "error" });
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
    startupStart("openweather-reverse-fallback", { cache: "not-instrumented" });
    const directKey = import.meta.env.DEV
      ? import.meta.env.VITE_OPENWEATHER_API_KEY ||
        import.meta.env.VITE_OPENWEATHER_KEY ||
        import.meta.env.VITE_OWM_KEY
      : "";

    const url = new URL(
      directKey
        ? "https://api.openweathermap.org/geo/1.0/reverse"
        : "/api/openweather",
      directKey ? undefined : window.location.origin
    );

    if (!directKey) url.searchParams.set("route", "geo-reverse");
    url.searchParams.set("lat", String(lat));
    url.searchParams.set("lon", String(lon));
    url.searchParams.set("limit", "1");
    if (directKey) url.searchParams.set("appid", directKey);

    const res = await fetch(
      directKey ? url.toString() : `${url.pathname}${url.search}`
    );

    if (!res.ok) {
      startupEnd("openweather-reverse-fallback", {
        status: "http-error",
        httpStatus: res.status,
      });
      console.warn("[OpenWeather Reverse] HTTP", res.status, res.statusText);
      return "";
    }

    const data = (await res.json()) as GeoReverseItem[];
    const first = data?.[0];
    if (!first) {
      startupEnd("openweather-reverse-fallback", { status: "empty" });
      return "";
    }

    const finalName = pickLocalName(first, lang);

    logLocationAudit({
      lat,
      lon,
      provider: "OpenWeather fallback",
      fields: {
        name: first.name || "",
        state: first.state || "",
        country: first.country || "",
        local_names: first.local_names
          ? Object.keys(first.local_names).sort()
          : [],
      },
      finalName,
      source: "openweather_reverse",
      fallbackReason: "Nominatim returned no usable label or failed",
    });

    startupEnd("openweather-reverse-fallback", {
      status: finalName ? "ok" : "empty",
      hasName: Boolean(finalName),
    });
    return finalName;
  } catch (error) {
    startupEnd("openweather-reverse-fallback", { status: "error" });
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
    startupStart("nominatim-reverse");
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
