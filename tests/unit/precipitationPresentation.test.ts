import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { createRequire } from "node:module";
// Load the Node renderer at runtime: the test runner bundles this file as ESM.
const { renderToStaticMarkup } = createRequire(import.meta.url)("react-dom/server") as typeof import("react-dom/server");
import { createInstance } from "i18next";
import RainShortTermCard from "../../src/components/RainShortTermCard";
import { buildRainShortTermSummary, getUsableForecastHourly } from "../../src/utils/rainShortTerm";
import type { HourlyForecastItem } from "../../src/services/weatherService";
import ca from "../../src/i18n/locales/ca.json";
import es from "../../src/i18n/locales/es.json";
import en from "../../src/i18n/locales/en.json";
import eu from "../../src/i18n/locales/eu.json";
import gl from "../../src/i18n/locales/gl.json";

const nowSec = 1000;
const hour = (data: Partial<HourlyForecastItem>, dt = 4600): HourlyForecastItem => ({ dt, ...data });
const summarize = (hourly: HourlyForecastItem[], rainingNow = false) =>
  buildRainShortTermSummary({ nowSec, hourly, rainingNow });
const rain = hour({ pop: 0.8, rain: { "1h": 0.5 }, weather: [{ id: 501, main: "Rain" }] });
const snow = hour({ pop: 0.49, snow: { "1h": 1.2 }, weather: [{ id: 601, main: "Snow" }] });

for (const [name, data, expected] of [
  ["rain", rain, "rain"],
  ["snow", snow, "snow"],
  ["unknown below zero", hour({ pop: 0.49, temp: -13 }), "precipitation"],
  ["simultaneous rain and snow", hour({ ...rain, snow: { "1h": 1 } }), "precipitation"],
  ["freezing rain 511", hour({ ...rain, weather: [{ id: 511, main: "Rain" }] }), "precipitation"],
  ["rain below zero", hour({ ...rain, temp: -8 }), "rain"],
  ["snow above zero", hour({ ...snow, temp: 3 }), "snow"],
  ["contradictory amount and code", hour({ ...rain, weather: [{ id: 601, main: "Snow" }] }), "precipitation"],
  ["contradictory main and code", hour({ pop: 0.8, weather: [{ id: 501, main: "Snow" }] }), "precipitation"],
  ["contradictory dry code and amount", hour({ ...rain, weather: [{ id: 800, main: "Clear" }] }), "precipitation"],
  ["snow amount only", hour({ pop: 0.8, snow: { "1h": 1 } }), "snow"],
  ["rain main only", hour({ pop: 0.8, weather: [{ main: "Rain" }] }), "rain"],
  ["storm without explicit rain", hour({ pop: 0.8, weather: [{ main: "Thunderstorm" }] }), "precipitation"],
  ["storm with explicit rain code", hour({ pop: 0.8, weather: [{ id: 201, main: "Thunderstorm" }] }), "rain"],
  ...[611, 612, 613, 615, 616].map(id => [String(id), hour({ pop: 0.8, weather: [{ id, main: "Snow" }] }), "precipitation"]),
] as [string, HourlyForecastItem, string][]) {
  test(`precipitation presentation: ${name}`, () => {
    const original = JSON.stringify(data);
    assert.equal(summarize([data]).forecastKind, expected);
    assert.equal(JSON.stringify(data), original, "classification must not mutate API data");
  });
}

test("precipitation presentation aggregates different and unknown phenomena in the selected window", () => {
  for (const second of [snow, hour({ pop: 0.4 }), hour({ ...snow, pop: 0.2 })]) {
    assert.equal(summarize([rain, { ...second, dt: 8200 }]).forecastKind, "precipitation");
  }
  assert.equal(summarize([rain, hour({ pop: 0, weather: [{ id: 804, main: "Clouds" }] }, 8200)]).forecastKind, "rain");
  assert.equal(summarize([rain, { ...snow, dt: 11801 }, { ...snow, dt: 999 }]).forecastKind, "rain");
  assert.equal(summarize([rain, { ...snow, dt: 11800 }]).forecastKind, "precipitation");
  assert.equal(summarize([1000, 4600, 8200, 11800].map(dt => ({ ...rain, dt })).concat(snow)).forecastKind, "rain", "only the original first four samples participate");
});

test("precipitation presentation preserves every legacy summary field at probability and accumulation boundaries", () => {
  for (const pop of [0.39, 0.4, 39, 40]) {
    for (const amount of [0, 0.2, 0.49, 0.5]) {
      for (const weather of [undefined, [{ id: 601, main: "Snow" }], [{ id: 511, main: "Rain" }]]) {
        const { forecastKind: _kind, ...legacy } = summarize([
          hour({ pop, rain: { "1h": amount }, snow: { "1h": 2 }, weather }),
          hour({ pop: 0 }, 8200),
        ]);
        const relevant = amount > 0 || pop === 0.4 || pop === 40;
        assert.deepEqual(legacy, {
          visible: relevant && (amount === 0 || amount >= 0.5),
          rainingNow: false, currentMm: null,
          forecastMm: amount > 0 ? amount : null,
          peakRainMmH: relevant ? amount : null,
          endAt: relevant ? 8200 : null,
          intensity: amount >= 0.5 ? "weak" : amount >= 0.1 ? "very_weak" : null,
          futureFallback: false,
        });
      }
    }
  }
  for (const pop of [0.39, 0.4]) {
    const { forecastKind: _kind, ...legacy } = summarize([hour({ pop })]);
    assert.deepEqual(legacy, { visible: pop === 0.4, rainingNow: false, currentMm: null,
      forecastMm: null, peakRainMmH: pop === 0.4 ? 0 : null, endAt: null,
      intensity: null, futureFallback: pop === 0.4 });
  }
});

test("precipitation presentation preserves current rain, stale forecast and location guards", () => {
  const coords = { lat: 74, lon: -95 };
  for (const [stale, forecastCoords] of [[true, coords], [false, { lat: 0, lon: 0 }]] as const) {
    const hourly = getUsableForecastHourly({ hourly: [snow], stale }, forecastCoords, coords.lat, coords.lon);
    assert.equal(hourly, null);
    assert.equal(summarize(hourly ?? []).visible, false);
    const current = buildRainShortTermSummary({ nowSec, hourly, rainingNow: true, currentMm: 0.2 });
    assert.equal(current.visible, true);
    assert.equal(current.currentMm, 0.2);
    assert.equal(current.rainingNow, true);
    assert.equal(current.endAt, null);
  }
});

for (const [lang, locale, titles] of [
  ["ca", ca, ["Previsió de pluja", "Previsió de neu", "Previsió de precipitacions"]],
  ["es", es, ["Previsión de lluvia", "Previsión de nieve", "Previsión de precipitaciones"]],
  ["en", en, ["Rain forecast", "Snow forecast", "Precipitation forecast"]],
  ["eu", eu, ["Euriaren iragarpena", "Elurraren iragarpena", "Prezipitazioen iragarpena"]],
  ["gl", gl, ["Previsión de chuvia", "Previsión de neve", "Previsión de precipitacións"]],
] as const) {
  test(`precipitation presentation renders coherent titles, accessibility and messages in ${lang}`, async () => {
    const i18n = createInstance();
    await i18n.init({ lng: lang, fallbackLng: false, resources: { [lang]: { translation: locale } }, interpolation: { escapeValue: false } });
    const fixtures = [hour({ pop: 0.49, weather: [{ main: "Rain" }] }), snow, hour({ pop: 0.49 })];
    for (const [index, item] of fixtures.entries()) {
      const summary = summarize([item]);
      const prefix = summary.forecastKind;
      const html = renderToStaticMarkup(React.createElement(RainShortTermCard, { summary, t: i18n.t }));
      assert.ok(html.includes(`aria-label="${titles[index]}"`));
      assert.ok(html.includes(`<span aria-hidden="true">${["🌧️", "❄️", "☁️"][index]}</span> ${titles[index]}`));
      assert.ok(html.includes(i18n.t(`${prefix}_possible_next_hours`)));
      assert.doesNotMatch(html, /\{\{|_forecast_title|_possible_next_hours/);
      for (const suffix of ["forecast_title", "possible_next_hours"]) {
        assert.ok(Object.hasOwn(locale, `${prefix}_${suffix}`), `${lang}: ${prefix}_${suffix}`);
      }
      const timed = summarize([item, hour({ pop: 0 }, 8200)]);
      const timedHtml = renderToStaticMarkup(React.createElement(RainShortTermCard, { summary: timed, t: i18n.t }));
      const time = new Date(8200 * 1000).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", timeZone: "UTC" });
      assert.equal(timed.endAt, 8200);
      if (prefix === "rain") {
        assert.ok(timedHtml.includes(i18n.t("rain_expected_before", { time })));
        assert.ok(!timedHtml.includes(i18n.t("rain_possible_next_hours")));
      } else {
        assert.ok(timedHtml.includes(i18n.t(`${prefix}_possible_next_hours`)));
        assert.ok(!timedHtml.includes(time));
      }
    }
    // Quantities, intensities and times remain in the summary, but are not
    // attributed to the whole phenomenon when only rain was measured.
    const dry = hour({ pop: 0 }, 11800);
    for (const [name, items] of [
      ["snow", [snow]],
      ["simultaneous", [hour({ ...rain, snow: { "1h": 10 } })]],
      ["different intervals", [rain, { ...snow, dt: 8200 }]],
      ["unknown amount", [hour({ pop: 0.8, precipitation: 2 })]],
      ["unknown probability", [hour({ pop: 0.8 })]],
      ["511", [hour({ ...rain, weather: [{ id: 511, main: "Rain" }] })]],
    ] as [string, HourlyForecastItem[]][]) {
      const summary = summarize([...items, dry]);
      const before = JSON.stringify(summary);
      const html = renderToStaticMarkup(React.createElement(RainShortTermCard, { summary, t: i18n.t }));
      assert.equal(JSON.stringify(summary), before, `${name}: render must preserve metrics`);
      assert.equal(summary.endAt, 11800);
      assert.ok(html.includes(i18n.t(`${summary.forecastKind}_possible_next_hours`)), name);
      assert.doesNotMatch(html, /mm|\d{1,2}:\d{2}|\{\{|_intensity_|_amount_|_expected_/, name);
      for (const intensity of ["very_weak", "weak", "moderate", "intense"]) {
        assert.ok(!html.includes(i18n.t(`rain_intensity_${intensity}`)), name);
      }
    }
    for (const [amount, intensity] of [[0.5, "weak"], [2, "moderate"], [10, "intense"]] as const) {
      const summary = summarize([hour({ ...rain, rain: { "1h": amount } }), dry]);
      const html = renderToStaticMarkup(React.createElement(RainShortTermCard, { summary, t: i18n.t }));
      assert.ok(html.includes(i18n.t(`rain_intensity_${intensity}`)));
      assert.ok(html.includes(i18n.t("rain_amount_next_hours", { amount: amount.toFixed(1) })));
      const time = new Date(11800 * 1000).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", timeZone: "UTC" });
      assert.ok(html.includes(i18n.t("rain_expected_before", { time })));
      const currentHtml = renderToStaticMarkup(React.createElement(RainShortTermCard, { summary: { ...summary, rainingNow: true }, t: i18n.t }));
      assert.ok(currentHtml.includes(i18n.t("rain_ends_at", { time })));
    }
    const current = buildRainShortTermSummary({ nowSec, rainingNow: true, currentMm: 0.2, hourly: [snow, dry] });
    const currentHtml = renderToStaticMarkup(React.createElement(RainShortTermCard, { summary: current, t: i18n.t }));
    assert.equal(current.endAt, 11800);
    assert.ok(currentHtml.includes(i18n.t("rain_current_title")));
    assert.ok(currentHtml.includes(i18n.t("rain_now_amount", { amount: "0.2" })));
    assert.ok(currentHtml.includes(i18n.t("snow_possible_next_hours")));
    assert.doesNotMatch(currentHtml, /\d{1,2}:\d{2}/);
    const currentOnlyHtml = renderToStaticMarkup(React.createElement(RainShortTermCard, { summary: summarize([], true), t: i18n.t }));
    assert.ok(currentOnlyHtml.includes(i18n.t("rain_current_no_amount")));
    assert.ok(!currentOnlyHtml.includes(i18n.t("precipitation_possible_next_hours")));
    assert.equal(renderToStaticMarkup(React.createElement(RainShortTermCard, { summary: summarize([]), t: i18n.t })), "");
  });
}
