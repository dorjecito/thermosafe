import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import vm from "node:vm";
import * as tokenSyncMetadata from "../../src/utils/tokenSyncMetadata";

const OLD = "old-token-".repeat(8);
const NEW = "new-token-".repeat(8);
const R = {
  lastNotified: null, lastNotifiedDay: null, lastDailyResetDay: null,
  lastHeatLevel: 0, lastHeatAt: 0, lastColdLevel: 0, lastColdAt: 0,
  lastWindLevel: 0, lastWindAt: 0, lastUvLevel: 0, lastUvAt: 0,
  lastAemetLevel: 0, lastAemetAt: 0,
};
const initial = {
  token: OLD, lat: 0, lon: 0, lang: "ca", place: "Origin", threshold: "high",
  ...Object.fromEntries(Object.keys(R).map(key => [key, 3])),
  uvLevelsByZone: { "0.0,0.0": 3 }, lastUvResetDay: "2026-09-20",
  lastAemetEpisodeKey: "episode", lastAemetNotifiedLevel: 3,
  lastAemetEventKey: "event", lastAemetResetDay: "2026-09-20",
};
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value));
const latitudeAtKm = (km: number) => km / 6371 * 180 / Math.PI;

// Load the actual subscription module with in-memory Firebase/browser adapters.
// No cron, endpoint, real messaging call or Firestore connection is executed.
function harness(options: {
  absent?: boolean; noLocalToken?: boolean; nextToken?: string;
  deleteError?: boolean; getTokenError?: boolean; race?: boolean;
  denyMetadata?: boolean; storage?: Map<string, string>;
} = {}) {
  const docs = new Map<string, any>(options.absent ? [] : [[OLD, clone(initial)]]);
  const storage = options.storage ?? new Map(options.noLocalToken ? [] : [["fcmToken", OLD]]);
  const writes: Array<{ kind: string; token: string; payload: any }> = [];
  const calls: string[] = [];
  const source = readFileSync(new URL("../../src/push/subscribe.ts", import.meta.url), "utf8");
  const ts = createRequire(import.meta.url)("typescript");
  const code = ts.transpileModule(source.replaceAll("import.meta.env.DEV", "false"), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText;
  let raced = false;
  const firestore = {
    doc: (_db: unknown, _collection: string, token: string) => token,
    serverTimestamp: () => "server-timestamp",
    getDoc: async (token: string) => {
      const snapshot = docs.has(token) ? clone(docs.get(token)) : undefined;
      return { exists: () => snapshot !== undefined, data: () => snapshot };
    },
    updateDoc: async (token: string, payload: any) => {
      writes.push({ kind: "update", token, payload: clone(payload) });
      if (options.race && !raced) { docs.delete(token); raced = true; }
      if (!docs.has(token)) throw Object.assign(new Error("Missing subscription"), { code: "not-found" });
      if (options.denyMetadata && "tokenLastSyncedAt" in payload) {
        throw Object.assign(new Error("Denied metadata"), { code: "permission-denied" });
      }
      docs.set(token, { ...docs.get(token), ...clone(payload) });
    },
    setDoc: async (token: string, payload: any) => {
      writes.push({ kind: "set", token, payload: clone(payload) });
      docs.set(token, { ...docs.get(token), ...clone(payload) });
    },
    deleteDoc: async (token: string) => { docs.delete(token); },
  };
  const messaging = {
    deleteToken: async () => {
      calls.push("deleteToken");
      assert.equal(storage.has("fcmToken"), false, "clear active token before deleting SDK token");
      if (options.deleteError) throw new Error("deleteToken failed");
      return true;
    },
    getToken: async () => {
      calls.push("getToken");
      if (options.getTokenError) throw new Error("getToken failed");
      return options.nextToken ?? NEW;
    },
  };
  const exported: any = {};
  const context = {
    exports: exported,
    require: (id: string) => {
      if (id === "firebase/firestore") return firestore;
      if (id === "firebase/messaging") return messaging;
      if (id === "../firebase") return { db: {}, messagingPromise: Promise.resolve({}) };
      if (id === "../utils/tokenSyncMetadata") return tokenSyncMetadata;
      if (id === "../utils/firebaseMessagingSw") return { waitForServiceWorkerRegistrationActive: async () => {} };
      throw new Error(`Unexpected import: ${id}`);
    },
    console: { log() {}, warn() {}, error() {} },
    localStorage: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
      removeItem: (key: string) => storage.delete(key),
    },
    navigator: {
      language: "ca",
      serviceWorker: { register: async () => ({ scope: "fcm" }) },
      geolocation: { getCurrentPosition: (success: Function) => success({ coords: { latitude: 0, longitude: 0 } }) },
    },
    window: { Notification: {} }, Notification: { requestPermission: async () => "granted" },
  };
  vm.runInNewContext(code, context);
  return { docs, storage, writes, calls, api: exported };
}

for (const km of [0, 0.05, 0.099]) {
  test(`subscription location ${km} km: heartbeat only, no reset`, async () => {
    const h = harness();
    assert.equal(await h.api.updateRiskAlertLocation({ lat: latitudeAtKm(km), lon: 0, lang: "ca", place: "Origin" }), true);
    assert.deepEqual(h.writes.map(w => w.kind), ["update"]);
    assert.deepEqual(Object.keys(h.writes[0].payload).sort(), ["token", "tokenLastSyncedAt", "updatedAt"]);
    assert.deepEqual(h.docs.get(OLD), { ...initial, ...h.writes[0].payload });
  });
}

for (const km of [0.1, 1, 14.999, 15, 20]) {
  test(`subscription location ${km} km preserves the exact geographic reset payload`, async () => {
    const h = harness();
    const location = { lat: latitudeAtKm(km), lon: 0, lang: "ca", place: "Destination" };
    assert.equal(await h.api.updateRiskAlertLocation(location), true);
    const write = h.writes[0];
    assert.equal(write.kind, "update");
    const expected = { token: OLD, ...location, updatedAt: write.payload.updatedAt,
      tokenLastSyncedAt: "server-timestamp", ...(km >= 15 ? R : {}) };
    assert.deepEqual(write.payload, expected);
    assert.deepEqual(h.docs.get(OLD), { ...initial, ...expected });
    assert.equal(h.calls.length, 0);
  });
}

test("missing subscription rotates the token and creates only the new subscription", async () => {
  const h = harness({ absent: true });
  assert.equal(await h.api.updateRiskAlertLocation({ lat: 1, lon: 2, lang: "ca", place: "New" }), true);
  assert.deepEqual(h.calls, ["deleteToken", "getToken"]);
  assert.deepEqual(h.writes.map(w => [w.kind, w.token]), [["set", NEW]]);
  assert.equal(h.docs.has(OLD), false);
  assert.equal(h.storage.get("fcmToken"), NEW);
  for (const [key, value] of Object.entries(R)) assert.equal(h.docs.get(NEW)[key], value);
});

test("cached old token is never recreated, including retries after a reload and signup", async () => {
  const h = harness({ absent: true, nextToken: OLD });
  assert.equal(await h.api.updateRiskAlertLocation({ lat: 0, lon: 0 }), false);
  assert.equal(h.storage.has("fcmToken"), false);
  assert.equal(h.writes.length, 0);
  const reloaded = harness({ absent: true, nextToken: OLD, storage: h.storage });
  assert.equal(await reloaded.api.updateRiskAlertLocation({ lat: 0, lon: 0 }), false);
  await assert.rejects(reloaded.api.enableRiskAlerts(), /renovar el token/);
  assert.equal(reloaded.writes.length, 0);
});

for (const error of ["deleteError", "getTokenError"] as const) {
  test(`${error}: recovery failure never restores the old subscription`, async () => {
    const h = harness({ absent: true, [error]: true });
    assert.equal(await h.api.updateRiskAlertLocation({ lat: 0, lon: 0 }), false);
    assert.equal(h.writes.length, 0);
    assert.equal(h.storage.has("fcmToken"), false);
    assert.equal(h.docs.has(OLD), false);
    if (error === "deleteError") assert.deepEqual(h.calls, ["deleteToken"]);
  });
}

for (const km of [0, 1, 20]) {
  test(`deletion between read and update at ${km} km cannot recreate the old token`, async () => {
    const h = harness({ race: true });
    assert.equal(await h.api.updateRiskAlertLocation({ lat: latitudeAtKm(km), lon: 0, lang: "ca", place: "Origin" }), true);
    assert.equal(h.docs.has(OLD), false);
    assert.deepEqual(h.writes.map(w => [w.kind, w.token]), [["update", OLD], ["set", NEW]]);
  });
}

test("concurrent recovery calls share one token rotation", async () => {
  const h = harness({ absent: true });
  const results = await Promise.all([1, 2].map(() => h.api.updateRiskAlertLocation({ lat: 0, lon: 0 })));
  assert.deepEqual(results, [true, true]);
  assert.deepEqual(h.calls, ["deleteToken", "getToken"]);
  assert.equal(h.writes.length, 1);
});

test("optional timestamp fallback stays update-only and preserves the exact reset", async () => {
  const h = harness({ denyMetadata: true });
  assert.equal(await h.api.updateRiskAlertLocation({ lat: 1, lon: 0 }), true);
  assert.deepEqual(h.writes.map(w => w.kind), ["update", "update"]);
  for (const [key, value] of Object.entries(R)) assert.equal(h.docs.get(OLD)[key], value);
  assert.equal(h.docs.get(OLD).tokenLastSyncedAt, undefined);
});

test("language update preserves all risk state and cannot recreate a deleted document", async () => {
  const h = harness();
  assert.equal(await h.api.updateRiskAlertLanguage("en"), true);
  assert.deepEqual(h.docs.get(OLD), { ...initial, ...h.writes[0].payload });
  assert.deepEqual(Object.keys(h.writes[0].payload).sort(), ["lang", "tokenLastSyncedAt", "updatedAt"]);
  const raced = harness({ race: true });
  assert.equal(await raced.api.updateRiskAlertLanguage("en"), false);
  assert.equal(raced.docs.has(OLD), false);
  assert.equal(raced.writes.some(w => w.kind === "set"), false);
});

test("legitimate signup still creates a new document with the original initial reset", async () => {
  const h = harness({ absent: true, noLocalToken: true });
  assert.equal(await h.api.enableRiskAlerts({ threshold: "high", lang: "ca" }), NEW);
  assert.deepEqual(h.writes.map(w => [w.kind, w.token]), [["set", NEW]]);
  for (const [key, value] of Object.entries(R)) assert.equal(h.docs.get(NEW)[key], value);
  assert.equal(h.docs.get(NEW).threshold, "high");
});

test("existing signup uses update and preserves risk state at the same location", async () => {
  const h = harness({ nextToken: OLD });
  assert.equal(await h.api.enableRiskAlerts({ threshold: "high", lang: "ca" }), OLD);
  assert.deepEqual(h.writes.map(w => w.kind), ["update"]);
  assert.deepEqual(h.docs.get(OLD), { ...initial, ...h.writes[0].payload });
  for (const key of Object.keys(R)) assert.equal(h.docs.get(OLD)[key], initial[key]);
});
