import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";
import { getAemetAlertPhase, getAemetAlertTimelineState } from "../../src/utils/aemetAlertTimeline";
import { getAlertTimeCountdown } from "../../src/utils/getRemainingTime";
import { getPrimaryStatusBlock } from "../../src/utils/getPrimaryStatusBlock";
import { getTopAlertBannerState } from "../../src/components/TopAlertBanner";

const t = (key: string) => key;
const now = 1_000;
const alert = (start: number, end: number) => ({ start, end, event: "Moderate rain warning" });
const statusArgs = {
  primary: { kind: "none" as const, severity: 0 as const, labelKey: "" },
  heatRisk: null, coldRisk: null, windRisk: null, uvi: 0, day: true,
  primaryAdvice: null, contextualUVMessage: "", t,
};
function presentation(alerts: ReturnType<typeof alert>[], nowTs: number) {
  const timeline = getAemetAlertTimelineState(alerts, nowTs);
  const banner = getTopAlertBannerState({
    ...statusArgs, ...timeline, clouds: 0, irr: null, rainy: false, UV_HIGH: 6, UV_EXTREME: 11,
  });
  return { ...timeline, banner,
    status: getPrimaryStatusBlock({ ...statusArgs, alerts, nowTs }),
    countdowns: timeline.sortedAlerts.map(a => getAlertTimeCountdown(a.start, a.end, "ca", t, nowTs)),
  };
}

test("official alert phases, visibility, banner and countdown share start/end boundaries", () => {
  const cases = [
    { item: alert(now + 60, now + 3600), phase: "future", visible: true, banner: "aemet-soon" },
    { item: alert(now - 60, now + 60), phase: "active", visible: true, banner: "aemet-active" },
    { item: alert(now, now + 60), phase: "active", visible: true, banner: "aemet-active" },
    { item: alert(now - 60, now), phase: "ended", visible: false, banner: undefined },
    { item: alert(now - 60, now - 1), phase: "ended", visible: false, banner: undefined },
  ];
  for (const c of cases) {
    const ui = presentation([c.item], now);
    assert.equal(getAemetAlertPhase(c.item, now), c.phase);
    assert.equal(ui.sortedAlerts.length, c.visible ? 1 : 0);
    assert.equal(ui.banner?.key, c.banner);
    assert.ok(!ui.countdowns.includes("alert_time.ended"));
    if (!c.visible) {
      assert.equal(ui.aemetActive, false);
      assert.equal(ui.aemetSoon, false);
      assert.notEqual(ui.status.className, "status-card status-alert");
      assert.ok(!ui.status.title.includes("official_alert"));
    }
  }
  assert.equal(getAlertTimeCountdown(now - 60, now, "ca", t, now), "alert_time.ended");
});

test("stale cached alerts stay intact while only active or future alerts remain visible", () => {
  const ended = Object.freeze(alert(800, 999));
  const active = Object.freeze(alert(900, 1100));
  const future = Object.freeze(alert(1200, 1400));
  for (const remaining of [active, future]) {
    const cache = Object.freeze([ended, remaining]);
    const ui = presentation(cache as any, now);
    assert.deepEqual(ui.sortedAlerts, [remaining]);
    assert.equal(cache.length, 2);
    assert.equal(cache[0], ended);
  }
});

const ts = createRequire(import.meta.url)("typescript");
const compile = (source: string) => ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
}).outputText;

// Run the real hook with controlled React lifecycle, browser time and timers.
// Network APIs are deliberately unavailable; expiry must only update presentation.
function clockHarness(initialAlerts: ReturnType<typeof alert>[], initialNow = now) {
  let time = initialNow * 1000;
  let state: number | undefined;
  let dirty = false;
  let deps: unknown[] | undefined;
  let pendingEffect: (() => () => void) | undefined;
  let cleanup: (() => void) | undefined;
  let alerts = initialAlerts;
  let data: unknown = {};
  let timerId = 0;
  const timers = new Map<number, { at: number; callback: () => void }>();
  const listeners = new Set<() => void>();
  const document = {
    visibilityState: "visible",
    addEventListener: (_: string, fn: () => void) => listeners.add(fn),
    removeEventListener: (_: string, fn: () => void) => listeners.delete(fn),
  };
  const exported: any = {};
  vm.runInNewContext(compile(readFileSync("src/hooks/useAlertClock.ts", "utf8")), {
    exports: exported, Date: { now: () => time }, document,
    setTimeout: (callback: () => void, delay: number) => {
      timers.set(++timerId, { callback, at: time + delay }); return timerId;
    },
    clearTimeout: (id: number) => timers.delete(id),
    fetch: () => { throw new Error("Expiry must not fetch"); },
    require: (id: string) => {
      assert.equal(id, "react");
      return {
        useState: (init: () => number) => {
          if (state === undefined) state = init();
          return [state, (next: number) => { if (state !== next) { state = next; dirty = true; } }];
        },
        useEffect: (effect: () => () => void, next: unknown[]) => {
          if (!deps || next.some((value, index) => value !== deps![index])) {
            deps = next; pendingEffect = effect;
          }
        },
      };
    },
  });
  function render(): number {
    dirty = false;
    const value = exported.useAlertClock(alerts, data);
    if (pendingEffect) {
      cleanup?.();
      const effect = pendingEffect; pendingEffect = undefined;
      cleanup = effect();
    }
    return dirty ? render() : value;
  }
  render();
  return {
    timers, listeners,
    read: () => presentation(alerts, render()),
    advance: (next: number, runTimers = true) => {
      time = next * 1000;
      if (runTimers) for (const [id, timer] of [...timers]) {
        if (timer.at <= time) { timers.delete(id); timer.callback(); }
      }
      render();
    },
    resume: () => { for (const fn of listeners) fn(); render(); },
    replace: (nextAlerts: typeof alerts, nextData: unknown = {}) => { alerts = nextAlerts; data = nextData; render(); },
    unmount: () => cleanup?.(),
  };
}

test("one local timer transitions future to active to expired without a response or network", () => {
  const cached = [alert(now + 60, now + 120)];
  const h = clockHarness(cached);
  assert.equal(h.read().banner?.key, "aemet-soon");
  assert.equal(h.timers.size, 1);
  assert.equal([...h.timers.values()][0].at, (now + 60) * 1000);
  h.advance(now + 60);
  assert.equal(h.read().banner?.key, "aemet-active");
  assert.equal(h.read().status.className, "status-card status-alert");
  assert.equal(h.timers.size, 1);
  h.advance(now + 120);
  assert.deepEqual(h.read().sortedAlerts, []);
  assert.equal(h.read().banner, null);
  assert.equal(h.timers.size, 0);
  assert.equal(cached.length, 1);
  h.unmount();
  assert.equal(h.listeners.size, 0);
});

test("foreground resume expires alerts even when suspended timers did not run", () => {
  const h = clockHarness([alert(now - 60, now + 60)]);
  h.advance(now + 120, false);
  h.resume();
  assert.deepEqual(h.read().sortedAlerts, []);
  assert.equal(h.read().banner, null);
  assert.equal(h.timers.size, 0);
  h.unmount();
});

test("new weather data or alert arrays refresh the clock and replace the boundary timer", () => {
  const cached = [alert(now - 60, now + 60)];
  const h = clockHarness(cached);
  h.advance(now + 120, false);
  h.replace(cached); // same alerts, new weather response
  assert.deepEqual(h.read().sortedAlerts, []);
  const fresh = [alert(now + 180, now + 240)];
  h.replace(fresh);
  assert.equal(h.read().banner?.key, "aemet-soon");
  assert.equal(h.timers.size, 1);
  h.replace([]);
  assert.equal(h.timers.size, 0);
  h.unmount();
});

test("App primary status memo invalidates at expiry even with the same alerts and weather", () => {
  const app = readFileSync("src/App.tsx", "utf8");
  const source = app.slice(app.indexOf("const primaryStatusInput = useMemo("), app.indexOf("useEffect(() => {", app.indexOf("const primaryStatusInput = useMemo(")));
  const memo: Array<{ deps: unknown[]; value: any }> = [];
  let slot = 0;
  const context: any = {
    ...statusArgs, alerts: [alert(now - 60, now + 60)], alertNowTs: now,
    isLateDay: false, heatDayPhase: "day", contextualPrimaryUvAdvice: null, uvPending: false,
    getPrimaryStatusBlock,
    useMemo: (fn: () => any, deps: unknown[]) => {
      const index = slot++;
      if (!memo[index] || deps.some((value, i) => value !== memo[index].deps[i])) memo[index] = { deps, value: fn() };
      return memo[index].value;
    },
  };
  const render = () => { slot = 0; return vm.runInNewContext(compile(`(() => { ${source}; return primaryStatus; })()`), context); };
  assert.equal(render().className, "status-card status-alert");
  context.alertNowTs = now + 60;
  assert.notEqual(render().className, "status-card status-alert");
  assert.ok(!render().title.includes("official_alert"));
});
