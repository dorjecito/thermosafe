import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import React from "react";
import { createRequire } from "node:module";
const { renderToStaticMarkup } = createRequire(import.meta.url)("react-dom/server");
import { createInstance } from "i18next";
import SkyConditionCard from "../../src/components/SkyConditionCard";
import RainShortTermCard from "../../src/components/RainShortTermCard";
import { resolveSkyDescription } from "../../src/utils/resolveSkyDescription";
import { buildRainShortTermSummary } from "../../src/utils/rainShortTerm";
import { getHourlyForecastByCoords } from "../../src/services/weatherService";
import { harness } from "./refreshTarget.test";

const languages = ["ca", "es", "eu", "gl", "en"];
const resources = Object.fromEntries(languages.map(lang => [lang, {
  translation: JSON.parse(readFileSync(new URL(`../../src/i18n/locales/${lang}.json`, import.meta.url), "utf8")),
}]));
const source = readFileSync(new URL("../../src/App.tsx", import.meta.url), "utf8");
const skyMemo = source.slice(source.indexOf("const skyLabel = useMemo("),
  source.indexOf("\n\nuseEffect", source.indexOf("const skyLabel = useMemo(")));
const nowSec = 1_800_000_000;
const hourly = [
  { dt: nowSec + 600, rain: { "1h": 12 } },
  { dt: nowSec + 3600, rain: { "1h": 1.3 } },
];

test("one current-weather load: sky and icon alt translate immediately in five languages; rain is unchanged", async () => {
  const i18n = createInstance();
  await i18n.init({ resources, lng: "ca", fallbackLng: false, interpolation: { escapeValue: false } });
  const h = harness();
  const weather = Object.freeze({
    main: { temp: 18, feels_like: 18, humidity: 90 },
    coord: { lat: 39.49, lon: 2.89 },
    weather: [{ id: 502, main: "Rain", description: "pluja intensa", icon: "10d" }],
    rain: { "1h": 15 }, wind: { speed: 2 },
  });
  let loads = 0;
  let gps = 0;
  h.context.getWeatherByCity = async () => { loads++; return weather; };
  h.context.setData = (data: unknown) => { h.context.data = data; };
  h.context.locate = async () => { gps++; };
  assert.equal(await h.fetchWeather("Llucmajor", false, true), true);
  assert.equal(h.context.data, weather);
  const snapshot = JSON.stringify(weather);
  let dependencies: unknown[] | undefined;
  let label: string;
  // Run App's actual memo with React-equivalent dependency comparison. The same
  // t function is retained, so language changes must invalidate the memo itself.
  const context = {
    data: h.context.data, currentLang: "ca", t: i18n.t.bind(i18n), resolveSkyDescription,
    useMemo: (calculate: () => string, next: unknown[]) => {
      if (!dependencies || next.some((value, i) => !Object.is(value, dependencies![i]))) {
        label = calculate(); dependencies = [...next];
      }
      return label;
    },
  };
  const expected = ["Pluja intensa", "Lluvia intensa", "Euri bizia", "Chuvia intensa", "Heavy rain"];
  for (const [index, lang] of languages.entries()) {
    await i18n.changeLanguage(lang);
    context.currentLang = lang;
    const skyLabel = vm.runInNewContext(`(() => { ${skyMemo} return skyLabel; })()`, context);
    assert.equal(skyLabel, expected[index]);
    const markup = renderToStaticMarkup(React.createElement(SkyConditionCard, {
      title: i18n.t("sky_state"), sky: skyLabel, label: skyLabel, icon: "10d",
    }));
    assert.ok(markup.includes(`alt="${expected[index]}"`));
    assert.ok(markup.includes(`class="sky-label">${expected[index]}</span>`));
    const summary = buildRainShortTermSummary({ rainingNow: true, currentMm: 15, hourly, nowSec });
    assert.equal(summary.forecastMm, 13.3);
    assert.equal(summary.currentMm, 15);
    const rain = renderToStaticMarkup(React.createElement(RainShortTermCard, { summary, t: i18n.t.bind(i18n) }));
    assert.ok(rain.includes("13.3"));
    assert.equal(loads, 1);
    assert.equal(gps, 0);
    assert.equal(JSON.stringify(weather), snapshot);
  }
});

test("other catalogued sky conditions use exact neutral codes in all five languages", async () => {
  const cases: Record<number, string> = {
    201: "thunderstorm_with_rain", 211: "thunderstorm", 301: "drizzle",
    500: "light_rain", 501: "moderate_rain", 502: "heavy_intensity_rain", 521: "shower_rain",
    600: "light_snow", 601: "snow", 701: "mist", 711: "smoke", 721: "haze",
    741: "fog", 751: "sand", 761: "dust", 762: "ash", 771: "squall", 781: "tornado",
    800: "clear_sky", 801: "few_clouds", 802: "scattered_clouds", 803: "broken_clouds", 804: "overcast_clouds",
  };
  const i18n = createInstance();
  await i18n.init({ resources, lng: "ca", fallbackLng: false });
  for (const lang of languages) {
    await i18n.changeLanguage(lang);
    for (const [code, key] of Object.entries(cases)) {
      const expected = resources[lang].translation.weather_desc[key];
      assert.equal(typeof expected, "string", `${lang}: missing ${key}`);
      assert.equal(resolveSkyDescription("old API language", i18n.t.bind(i18n), Number(code)), expected);
    }
  }
});

test("sky fallback preserves uncatalogued phenomena without changing their severity", () => {
  const t = (key: string) => `translated:${key}`;
  assert.equal(resolveSkyDescription("heavy intensity rain", t), "translated:weather_desc.heavy_intensity_rain");
  assert.equal(resolveSkyDescription("ennuvolat", t), "translated:weather_desc.ennuvolat");
  assert.equal(resolveSkyDescription("freezing rain", t, 511), "freezing rain");
  assert.equal(resolveSkyDescription("extreme rain", t, 504), "extreme rain");
  assert.equal(resolveSkyDescription("", t), "");
});

test("rain audit: the same forecast can change 13.3 to 1.3 when the first sample leaves the time window", () => {
  const input = { rainingNow: true, currentMm: 15, hourly };
  assert.equal(buildRainShortTermSummary({ ...input, nowSec }).forecastMm, 13.3);
  assert.equal(buildRainShortTermSummary({ ...input, nowSec: nowSec + 601 }).forecastMm, 1.3);
});

test("rain audit: existing hourly service caches per language and can return different forecasts", async () => {
  const previousWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  const previousFetch = globalThis.fetch;
  const storage = new Map<string, string>();
  const requests: string[] = [];
  Object.defineProperty(globalThis, "window", { configurable: true, value: {
    localStorage: { getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value) },
  } });
  globalThis.fetch = (async (url: string) => {
    const lang = new URL(url, "https://test.invalid").searchParams.get("lang")!;
    requests.push(lang);
    return { ok: true, json: async () => ({ hourly: lang === "ca" ? hourly : hourly.slice(1) }) } as Response;
  }) as typeof fetch;
  try {
    const ca = await getHourlyForecastByCoords(39.49, 2.89, "ca", "local-test-key");
    const gl = await getHourlyForecastByCoords(39.49, 2.89, "gl", "local-test-key");
    const cachedCa = await getHourlyForecastByCoords(39.49, 2.89, "ca", "local-test-key");
    const mm = (forecast: typeof ca) => buildRainShortTermSummary({
      rainingNow: true, currentMm: 15, hourly: forecast?.hourly, nowSec,
    }).forecastMm;
    assert.deepEqual(requests, ["ca", "gl"]);
    assert.equal(mm(ca), 13.3);
    assert.equal(mm(gl), 1.3);
    assert.equal(mm(cachedCa), 13.3);
  } finally {
    globalThis.fetch = previousFetch;
    if (previousWindow) Object.defineProperty(globalThis, "window", previousWindow);
    else Reflect.deleteProperty(globalThis, "window");
  }
});
