import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import vm from "node:vm";
import { harness as refreshHarness } from "./refreshTarget.test";

const app = readFileSync(new URL("../../src/App.tsx", import.meta.url), "utf8");
const switcher = readFileSync(new URL("../../src/components/LanguageSwitcher.tsx", import.meta.url), "utf8");
const effect = app.slice(app.indexOf("useEffect(() => {", app.indexOf("/* 🌍 Auto-refresh")),
  app.indexOf("// 💨 Actualitza el risc de vent"));
const setLang = switcher.slice(switcher.indexOf("  const setLang ="), switcher.indexOf("  React.useEffect"));
const ts = createRequire(import.meta.url)("typescript");
const compile = (source: string) => ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
}).outputText;
const flush = () => new Promise<void>(resolve => setImmediate(resolve));

// Execute the actual initialization effect and selector handler, with dependency
// comparison/cleanup equivalent to useEffect. GPS/services and time are simulated;
// the existing refresh harness executes the actual city/refresh handlers.
function harness(permission = "granted") {
  const h = refreshHarness({ pushEnabled: true });
  const intervals = new Map<number, { callback: () => void; ms: number }>();
  let nextId = 0;
  let dependencies: unknown[] | undefined;
  let cleanup: (() => void) | undefined;
  let initializations = 0;
  let gpsCalls = 0;
  const languageWrites: string[] = [];
  const dayCalls: unknown[][] = [];
  const context = h.context;
  Object.assign(context, {
    navigator: { geolocation: {}, permissions: { query: async () => { initializations++; return { state: permission }; } } },
    locate: async () => { gpsCalls++; return true; },
    refreshCurrentDataRef: { current: h.refreshCurrentData },
    dataRef: { current: { timezone: 3600, sys: { sunrise: 10, sunset: 20 } } },
    isDayAtLocation: (...args: unknown[]) => { dayCalls.push(args); return true; },
    setInterval: (callback: () => void, ms: number) => { intervals.set(++nextId, { callback, ms }); return nextId; },
    clearInterval: (id: number) => intervals.delete(id),
    useEffect: (callback: () => (() => void), next: unknown[]) => {
      if (!dependencies || next.length !== dependencies.length || next.some((value, index) => !Object.is(value, dependencies![index]))) {
        cleanup?.();
        dependencies = [...next];
        cleanup = callback();
      }
    },
    document: { documentElement: { lang: "ca" } },
    i18n: { changeLanguage: (lang: string) => { context.lang = lang; } },
    safeSetStoredLang: () => {},
    updateRiskAlertLanguageLazy: async (lang: string) => { languageWrites.push(lang); },
  });
  const render = () => vm.runInNewContext(compile(`(() => { const lang = globalThis.lang; ${effect} })()`), context);
  vm.runInNewContext(compile(`(() => { ${setLang} globalThis.changeLanguage = setLang; })()`), context);
  return { ...h, intervals, languageWrites, dayCalls, render,
    get initializations() { return initializations; }, get gpsCalls() { return gpsCalls; },
    changeLanguage: async (lang: string) => { context.changeLanguage(lang); render(); await flush(); },
    tick: async (ms: number) => { for (const timer of intervals.values()) if (timer.ms === ms) timer.callback(); await flush(); },
    unmount: () => cleanup?.(),
  };
}

test("initial mount requests location; language changes do not repeat initialization or GPS", async () => {
  const h = harness();
  h.render(); await flush();
  assert.equal(h.initializations, 1);
  assert.equal(h.gpsCalls, 1);
  for (const lang of ["en", "es", "ca"]) await h.changeLanguage(lang);
  assert.equal(h.initializations, 1);
  assert.equal(h.gpsCalls, 1);
  assert.deepEqual(h.languageWrites, ["en", "es", "ca"]);
  assert.equal(h.calls.filter(call => call[0] === "push-location").length, 0);
});

test("manual city, coordinates and notification location survive a language change", async () => {
  const h = harness();
  h.render(); await flush();
  await h.handleSuggestionSelect({ name: "Eivissa", lat: 38.97439, lon: 1.41974 });
  const selected = { city: h.context.city, lat: h.context.lat, lon: h.context.lon,
    target: h.context.refreshTargetRef.current, source: h.context.dataSource };
  const writesBefore = h.calls.filter(call => call[0] === "push-location").length;
  assert.equal(writesBefore, 1);
  await h.changeLanguage("en");
  assert.deepEqual({ city: h.context.city, lat: h.context.lat, lon: h.context.lon,
    target: h.context.refreshTargetRef.current, source: h.context.dataSource }, selected);
  assert.equal(h.calls.filter(call => call[0] === "push-location").length, writesBefore);
  assert.deepEqual(h.languageWrites, ["en"]);
  assert.equal(h.gpsCalls, 1);
});

test("language changes keep the same intervals; automatic refresh uses the latest callback", async () => {
  const h = harness();
  h.render(); await flush();
  const originalIds = [...h.intervals.keys()];
  assert.deepEqual([...h.intervals.values()].map(timer => timer.ms), [30 * 60000, 10 * 60000]);
  await h.changeLanguage("en");
  await h.changeLanguage("es");
  assert.deepEqual([...h.intervals.keys()], originalIds);
  let refreshed = 0;
  h.context.refreshCurrentDataRef.current = async () => { refreshed++; };
  await h.tick(30 * 60000);
  assert.equal(refreshed, 1);
  h.context.dataRef.current = { timezone: 7200, sys: { sunrise: 30, sunset: 40 } };
  await h.tick(10 * 60000);
  assert.deepEqual(h.dayCalls.at(-1)?.slice(1), [7200, 30, 40]);
  h.unmount();
  assert.equal(h.intervals.size, 0);
});

test("manual and scheduled refresh keep the selected city and use the new language", async () => {
  const h = harness();
  h.render(); await flush();
  await h.handleSuggestionSelect({ name: "Eivissa", lat: 38.97439, lon: 1.41974 });
  await h.changeLanguage("en");
  h.calls.length = 0;
  assert.equal(await h.refreshCurrentData(true), true);
  await h.tick(30 * 60000);
  const queries = h.calls.filter(call => call[0] === "coords");
  assert.equal(queries.length, 2);
  for (const query of queries) assert.deepEqual(query.slice(1, 4), [38.97439, 1.41974, "en"]);
  assert.equal(h.calls.filter(call => call[0] === "push-location").length, 2);
  assert.equal(h.gpsCalls, 1);
});

test("real city selection and GPS refresh remain reachable after changing language", async () => {
  const h = harness();
  h.render(); await flush();
  await h.changeLanguage("en");
  await h.fetchWeather("Eivissa", false, true);
  await h.handleSuggestionSelect({ name: "Llucmajor", lat: 39.49, lon: 2.89 });
  const syncs = h.calls.filter(call => call[0] === "push-location");
  assert.equal(syncs.length, 2);
  assert.equal((syncs[1][1] as any).lat, 39.49);
  assert.equal((syncs[1][1] as any).lang, "en");
  h.context.dataSource = "gps";
  h.context.refreshTargetRef.current = { source: "gps" };
  assert.equal(await h.refreshCurrentData(true), true);
  assert.equal(h.gpsCalls, 2);
});

test("denied initial GPS permission does not prevent scheduling refreshes", async () => {
  const h = harness("denied");
  h.render(); await flush();
  assert.equal(h.initializations, 1);
  assert.equal(h.gpsCalls, 0);
  assert.equal(h.intervals.size, 2);
  await h.changeLanguage("en");
  assert.equal(h.initializations, 1);
});
