import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import vm from "node:vm";
import React from "react";
import { harness as selectionHarness } from "./refreshTarget.test";

const ts = createRequire(import.meta.url)("typescript");
const compile = (source: string) => ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.React },
}).outputText;

type Suggestion = { name: string; state?: string; country: string; lat: number; lon: number };
const a: Suggestion = { name: "Llucmajor", state: "Balearic Islands", country: "ES", lat: 39.44, lon: 2.84 };
const b: Suggestion = { ...a, lat: 39.49, lon: 2.89 };

// Exercise the real hook with a controlled geocoder response and debounce clock.
async function suggest(response: Suggestion[]) {
  const source = readFileSync("src/hooks/useCitySuggestions.ts", "utf8")
    .replace(/^import .*;\n/, "")
    .replace("export function useCitySuggestions", "function useCitySuggestions");
  const state: any[] = [];
  let timer: (() => Promise<void>) | undefined;
  let requestedUrl = "";
  const context: Record<string, any> = {
    URL, console,
    useState(initial: unknown) {
      const index = state.push(initial) - 1;
      return [initial, (value: unknown) => { state[index] = value; }];
    },
    useRef: (current: unknown) => ({ current }), useEffect() {},
    window: { location: { origin: "https://thermosafe.app" }, clearTimeout() {},
      setTimeout(callback: () => Promise<void>) { timer = callback; return 1; } },
    fetch: async (url: string) => { requestedUrl = url; return { json: async () => response }; },
  };
  vm.runInNewContext(compile(source.replaceAll("import.meta.env", "({ DEV: false })") +
    "\nglobalThis.hook = useCitySuggestions();"), context);
  context.hook.fetchCitySuggestions("Llucmajor");
  assert.ok(timer);
  await timer();
  assert.equal(requestedUrl, "/api/openweather?route=geo-direct&q=Llucmajor&limit=10");
  return Array.from(state[0]) as Suggestion[];
}

// Render the actual App suggestion rows and invoke their actual click callbacks.
function renderRows(suggestions: Suggestion[], handleSuggestionSelect = (_s: Suggestion): any => {}) {
  const app = readFileSync("src/App.tsx", "utf8");
  const start = app.indexOf("{suggestions.map((s, i) => {");
  const end = app.indexOf("})}", start);
  assert.ok(start >= 0 && end > start);
  const context: Record<string, any> = { React, suggestions, handleSuggestionSelect };
  vm.runInNewContext(compile(`globalThis.rows = ${app.slice(start + 1, end + 2)};`), context);
  return Array.from(context.rows) as React.ReactElement<any>[];
}

const coordinateLine = (row: React.ReactElement<any>) =>
  React.Children.toArray(row.props.children).find(child => React.isValidElement(child)) as React.ReactElement<any> | undefined;
const lineText = (line: React.ReactElement<any>) => React.Children.toArray(line.props.children).join("");

test("city suggestions retain both Llucmajor points and remove only exact duplicates", async () => {
  assert.deepEqual(await suggest([a, b, { ...a }]), [a, b]);
  assert.deepEqual(await suggest([b, a]), [b, a]);
  // Exact comparison deliberately preserves even very close, non-identical points.
  const nearby = { ...a, lat: a.lat + 0.000001 };
  assert.deepEqual(await suggest([a, nearby]), [a, nearby]);
});

test("city suggestions keep distinct states and countries", async () => {
  const otherState = { ...a, state: "Other state" };
  const otherCountry = { ...a, country: "PT" };
  assert.deepEqual(await suggest([a, otherState, otherCountry]), [a, otherState, otherCountry]);
  assert.ok(renderRows([a, otherState, otherCountry]).every(row => !coordinateLine(row)));
});

test("city suggestions preserve ES EU rest priority, within-group order and five-result cap", async () => {
  const us = { ...a, country: "US" };
  const fr = { ...a, country: "FR" };
  const pt = { ...a, country: "PT" };
  const gb = { ...a, country: "GB" };
  assert.deepEqual(await suggest([us, fr, a, pt, gb]), [a, fr, pt, us, gb]);
  assert.deepEqual(await suggest([us, fr, a, pt, gb, b]), [a, b, fr, pt, us]);
});

test("city suggestion coordinates appear only for repeated visible labels", async () => {
  const unique = { ...a, name: "Palma" };
  const rows = renderRows(await suggest([a, b, unique]));
  assert.equal(lineText(coordinateLine(rows[0])!), "39.44, 2.84");
  assert.equal(lineText(coordinateLine(rows[1])!), "39.49, 2.89");
  assert.equal(coordinateLine(rows[2]), undefined);
  const single = renderRows(await suggest([a]))[0];
  assert.deepEqual(React.Children.toArray(single.props.children), ["Llucmajor, Balearic Islands, ES"]);
  const others = Array.from({ length: 4 }, (_, i) => ({ ...a, name: `City ${i}` }));
  const capped = await suggest([a, ...others, b]);
  assert.equal(capped.length, 5);
  assert.ok(renderRows(capped).every(row => !coordinateLine(row)));
});

test("clicking each Llucmajor uses full original coordinates, never presentation rounding", async () => {
  const first = { ...a, lat: 39.4412345, lon: 2.8412345 };
  const second = { ...b, lat: 39.4912345, lon: 2.8912345 };
  const original = [first, second];
  const h = selectionHarness();
  const rows = renderRows(await suggest(original), h.handleSuggestionSelect);
  for (const [index, point] of original.entries()) {
    assert.equal(lineText(coordinateLine(rows[index])!), index === 0 ? "39.44, 2.84" : "39.49, 2.89");
    await rows[index].props.onClick();
    assert.deepEqual(h.calls.at(-1)?.slice(0, 3), ["coords", point.lat, point.lon]);
    assert.equal(h.context.lat, point.lat);
    assert.equal(h.context.lon, point.lon);
    assert.equal(h.context.refreshTargetRef.current.lat, point.lat);
    assert.equal(h.context.refreshTargetRef.current.lon, point.lon);
  }
  assert.equal(first.lat, 39.4412345);
  assert.equal(second.lon, 2.8912345);
});
