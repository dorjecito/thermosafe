import { useState } from "react";

const EU_COUNTRIES = new Set([
  "ES", "PT", "FR", "IT", "DE", "AT", "BE", "NL", "LU", "IE",
  "DK", "SE", "FI", "PL", "CZ", "SK", "HU", "RO", "BG", "HR",
  "SI", "EE", "LV", "LT", "GR", "CY", "MT"
]);

type SuggestionItem = {
  name: string;
  state?: string;
  country: string;
  lat: number;
  lon: number;
};

type Params = {
  apiKey: string;
};

export function useCitySuggestions({ apiKey }: Params) {
  const [suggestions, setSuggestions] = useState<SuggestionItem[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestLoading, setSuggestLoading] = useState(false);
  const [showSearchHelp, setShowSearchHelp] = useState(false);

  const fetchCitySuggestions = async (query: string) => {
    if (query.trim().length < 4) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    try {
      setSuggestLoading(true);

      const res = await fetch(
        `https://api.openweathermap.org/geo/1.0/direct?q=${query}&limit=10&appid=${apiKey}`
      );

      const data = await res.json();
      console.log("[SUGGESTIONS]", data);

      const unique = (data || []).filter(
        (item: any, index: number, arr: any[]) =>
          index ===
          arr.findIndex(
            (x: any) =>
              x.name === item.name &&
              x.state === item.state &&
              x.country === item.country
          )
      );

      const ordered = [...unique].sort((a, b) => {
        const aIsES = a.country === "ES";
        const bIsES = b.country === "ES";
        if (aIsES && !bIsES) return -1;
        if (!aIsES && bIsES) return 1;

        const aIsEU = EU_COUNTRIES.has(a.country);
        const bIsEU = EU_COUNTRIES.has(b.country);
        if (aIsEU && !bIsEU) return -1;
        if (!aIsEU && bIsEU) return 1;

        return 0;
      });

      setSuggestions(ordered.slice(0, 5));
      setShowSuggestions(ordered.length > 0);
    } catch (e) {
      console.error("Error suggestions:", e);
    } finally {
      setSuggestLoading(false);
    }
  };

  return {
    suggestions,
    setSuggestions,
    showSuggestions,
    setShowSuggestions,
    suggestLoading,
    showSearchHelp,
    setShowSearchHelp,
    fetchCitySuggestions,
  };
}