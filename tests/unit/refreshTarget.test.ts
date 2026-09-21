import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import vm from "node:vm";
import { createRefreshGate, getRefreshCoords, getRefreshTarget } from "../../src/utils/dataRefresh";

// Execute the actual App handlers with service spies, including responses whose
// coordinates differ from the selected point and reverse-geocoded display names.
export function harness(options: { pushEnabled?: boolean } = {}) {
  const source = readFileSync(new URL("../../src/App.tsx", import.meta.url), "utf8");
  const handlers = [
    source.slice(source.indexOf("const fetchWeather = async ("), source.indexOf("  useEffect(() => {\n    dataRef.current = data;")),
    source.slice(source.indexOf("const handleSuggestionSelect = async ("), source.indexOf("refreshCurrentDataRef.current = refreshCurrentData;")),
  ].join("\n");
  const calls: unknown[][] = [];
  const response = {
    name: "Ibiza", coord: { lat: 38.9088, lon: 1.433 },
    main: { temp: 24, feels_like: 24, humidity: 60 },
    wind: { speed: 2 }, weather: [{ main: "Clouds" }],
  };
  const context: Record<string, any> = {
    console: { debug() {}, log() {}, error() {}, warn() {} },
    lang: "ca", dataSource: "search", city: "", realCity: "", lat: null, lon: null,
    refreshTargetRef: { current: null }, refreshGateRef: { current: createRefreshGate() },
    lastSuccessfulDataRefreshRef: { current: null },
    startRequest: () => 1, isStaleRequest: () => false,
    getRefreshTarget, getRefreshCoords,
    getWeatherByCoords: async (...args: unknown[]) => { calls.push(["coords", ...args]); return response; },
    getWeatherByCity: async (...args: unknown[]) => { calls.push(["city", ...args]); return response; },
    getLocationNameFromCoords: async () => "Ibiza, Balearic Islands, ES",
    isDayAtLocation: () => true, getColdRisk: () => "cap",
    WINDCHILL_TEMP_MAX: 10, WINDCHILL_WIND_MIN: 4.8, COLD_THRESHOLD: 10,
    resolveSkyDescription: () => "Clouds", t: (key: string) => key,
    getUVFromOpenUV: async () => 0, loadUvMaxToday: async () => {},
    loadAlertsIfNeeded: async () => {}, localStorage: { getItem: () => options.pushEnabled ? "test-token" : null },
    updateRiskAlertLocationLazy: async (location: unknown) => { calls.push(["push-location", location]); },
    collapseSearchPanel() {}, locate: async () => { throw new Error("Unexpected GPS lookup"); },
  };
  for (const name of handlers.match(/\bset[A-Z]\w*/g) ?? []) context[name] = () => {};
  for (const key of ["city", "realCity", "lat", "lon", "dataSource"]) {
    context[`set${key[0].toUpperCase()}${key.slice(1)}`] = (value: unknown) => { context[key] = value; };
  }
  const ts = createRequire(import.meta.url)("typescript");
  const js = ts.transpileModule(
    handlers.replaceAll("import.meta.env.DEV", "false") +
      "\nglobalThis.handlers = { fetchWeather, handleSuggestionSelect, refreshCurrentData };",
    { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } },
  ).outputText;
  vm.runInNewContext(js, context);
  return { calls, context, ...context.handlers };
}

const eivissa = { name: "Eivissa", state: "Balearic Islands", country: "ES", lat: 38.9743901, lon: 1.4197463 };

test("suggestion and manual refresh use exactly the selected coordinates, never city", async () => {
  const h = harness();
  await h.handleSuggestionSelect(eivissa);
  assert.equal(await h.refreshCurrentData(true), true);
  assert.equal(h.calls.length, 2);
  for (const call of h.calls) {
    assert.deepEqual(call.slice(0, 5), ["coords", eivissa.lat, eivissa.lon, "ca", undefined]);
    assert.equal((call[5] as any).forceRefresh, true);
  }
});

test("text search refresh repeats the original city query despite a different display name", async () => {
  const h = harness();
  await h.fetchWeather("Eivissa", false, true);
  assert.equal(await h.refreshCurrentData(true), true);
  assert.equal(h.calls.length, 2);
  for (const call of h.calls) {
    assert.deepEqual(call.slice(0, 4), ["city", "Eivissa", "ca", undefined]);
    assert.equal((call[4] as any).forceRefresh, true);
  }
});

test("selecting Eivissa replaces the previous Llucmajor refresh target", async () => {
  for (const previousMethod of ["city", "coords"]) {
    const h = harness();
    if (previousMethod === "city") await h.fetchWeather("Llucmajor");
    else await h.handleSuggestionSelect({ name: "Llucmajor", lat: 39.49, lon: 2.89 });
    await h.handleSuggestionSelect(eivissa);
    await h.refreshCurrentData(true);
    assert.equal(h.calls.length, 3);
    assert.deepEqual(h.calls[2].slice(0, 3), ["coords", eivissa.lat, eivissa.lon]);
  }
});

test("repeated refreshes never drift to response coordinates or display city", async () => {
  const h = harness();
  await h.handleSuggestionSelect(eivissa);
  for (const manual of [true, true, false, true]) await h.refreshCurrentData(manual);
  assert.equal(h.calls.length, 5);
  for (const call of h.calls) assert.deepEqual(call.slice(0, 3), ["coords", eivissa.lat, eivissa.lon]);
  assert.equal(h.context.lat, eivissa.lat);
  assert.equal(h.context.lon, eivissa.lon);
});
