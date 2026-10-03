import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import CurrentWeatherSummary from "../../src/components/CurrentWeatherSummary";
import { evaluateRiskScore } from "../../src/utils/riskScoreEngine";

const base = {
  risk: "cap", quickTempToneClass: "", temp: 20, hi: 20,
  feelsLikeLabel: "Sensació", windKmh: 20, uvi: 0,
  windLabel: "Vent", gustLabel: "Ratxes",
};
function textContent(node: any): string {
  if (node == null || typeof node === "boolean") return "";
  if (Array.isArray(node)) return node.map(textContent).join("");
  if (typeof node === "object") return textContent(node.props.children);
  return String(node);
}
const render = (gustMs?: unknown, labels = {}) => textContent(
  CurrentWeatherSummary.type({ ...base, ...labels, gustMs }),
);

test("current wind retains sustained speed and formats gust m/s as km/h with one decimal", () => {
  assert.match(render(), /Vent 20\.0 km\/h/);
  assert.match(render(10), /Ratxes 36\.0 km\/h/);
  assert.match(render(10), /Vent 20\.0 km\/h/);
});

test("absent, null and invalid gusts produce no extra element; zero remains a real value", () => {
  const absent = render();
  assert.doesNotMatch(absent, /Ratxes/);
  for (const gust of [null, "10", NaN, Infinity, -Infinity, -1, {}, true, Number.MAX_VALUE]) {
    assert.equal(render(gust), absent);
  }
  assert.match(render(0), /Ratxes 0\.0 km\/h/);
  // A subsequent response without gust cannot retain the previous value.
  assert.match(render(15), /Ratxes 54\.0 km\/h/);
  assert.equal(render(undefined), absent);
});

test("gust labels are available in all five languages", () => {
  for (const [lang, label] of Object.entries({ca: "Ratxes", es: "Rachas", eu: "Haize-boladak", gl: "Refachos", en: "Gusts"})) {
    const locale = JSON.parse(readFileSync(`src/i18n/locales/${lang}.json`, "utf8"));
    assert.equal(locale.current_wind_gusts, label);
    assert.ok(locale.current_wind);
    assert.ok(render(10, { windLabel: locale.current_wind, gustLabel: locale.current_wind_gusts }).includes(`${label} 36.0 km/h`));
  }
});

test("20 km/h sustained wind stays breezy at severity 1 with a 60 km/h display gust", () => {
  const input = { heatIndex: 20, coldEffectiveTemp: 20, windKmh: 20, uvi: 0 };
  const before = evaluateRiskScore(input);
  assert.match(render(60 / 3.6), /Ratxes 60\.0 km\/h/);
  assert.deepEqual(evaluateRiskScore(input), before);
  const wind = before.factors.find(f => f.factor === "wind");
  assert.equal(wind?.level, "breezy");
  assert.equal(wind?.severity, 1);
  // Guard the actual App wiring: gust is passed only to the presentation component.
  const app = readFileSync("src/App.tsx", "utf8");
  assert.match(app, /<CurrentWeatherSummary\b[^]*?gustMs=\{data\?\.wind\?\.gust\}/);
  assert.equal((app.match(/\b(?:gust|gustMs|gustKmh)\b/g) || []).length, 2);
});
