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
  denyMetadata?: boolean; updateError?: boolean; updateFailureAt?: number;
  updateGate?: (attempt: number) => Promise<void>; storage?: Map<string, string>;
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
  let updateAttempts = 0;
  const firestore = {
    doc: (_db: unknown, _collection: string, token: string) => token,
    serverTimestamp: () => "server-timestamp",
    getDoc: async (token: string) => {
      const snapshot = docs.has(token) ? clone(docs.get(token)) : undefined;
      return { exists: () => snapshot !== undefined, data: () => snapshot };
    },
    updateDoc: async (token: string, payload: any) => {
      updateAttempts += 1;
      writes.push({ kind: "update", token, payload: clone(payload) });
      await options.updateGate?.(updateAttempts);
      if (options.race && !raced) { docs.delete(token); raced = true; }
      if (!docs.has(token)) throw Object.assign(new Error("Missing subscription"), { code: "not-found" });
      if (options.updateError || options.updateFailureAt === updateAttempts) {
        throw Object.assign(new Error("Remote update failed"), { code: "permission-denied" });
      }
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
      if (id === "../utils/windActivityProfile") return {
        parseWindActivityProfile: (value: unknown) => ["generic", "jardineria", "poda", "altura", "obra", "neteja", "trekking", "oci"].includes(String(value)) ? value : "generic",
        readWindActivityProfile: () => storage.get("thermosafe_wind_activity_profile") && ["generic", "jardineria", "poda", "altura", "obra", "neteja", "trekking", "oci"].includes(storage.get("thermosafe_wind_activity_profile")!) ? storage.get("thermosafe_wind_activity_profile") : "generic",
      };
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
    window: { Notification: {} }, Notification: { requestPermission: async () => { calls.push("requestPermission"); return "granted"; } },
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

test("jobType update reuses the saved token and writes only jobType", async () => {
  const h = harness();
  const before = clone(h.docs.get(OLD));
  assert.equal(await h.api.updateSubscriptionJobType("poda"), true);
  assert.deepEqual(h.calls, []);
  assert.deepEqual(h.writes, [{ kind: "update", token: OLD, payload: { jobType: "poda" } }]);
  assert.deepEqual(h.docs.get(OLD), { ...before, jobType: "poda" });
  assert.equal(h.storage.get("fcmToken"), OLD);
});

test("jobType update returns false without a saved token or when the document is missing", async () => {
  const noToken = harness({ noLocalToken: true });
  assert.equal(await noToken.api.updateSubscriptionJobType("altura"), false);
  assert.equal(noToken.writes.length, 0);
  const missing = harness({ absent: true });
  assert.equal(await missing.api.updateSubscriptionJobType("altura"), false);
  assert.equal(missing.writes.length, 0);
  assert.deepEqual(missing.calls, []);
  const failed = harness({ updateError: true });
  assert.equal(await failed.api.updateSubscriptionJobType("altura"), false);
  assert.deepEqual(failed.writes[0].payload, { jobType: "altura" });
});

test("jobType update normalizes invalid profiles to generic and avoids redundant writes", async () => {
  const h = harness();
  assert.equal(await h.api.updateSubscriptionJobType("not-a-profile"), true);
  assert.deepEqual(h.writes[0].payload, { jobType: "generic" });
  h.writes.length = 0;
  assert.equal(await h.api.updateSubscriptionJobType("generic"), true);
  assert.equal(h.writes.length, 0);
});

test("new subscriptions and recovered tokens include the locally selected profile", async () => {
  const storage = new Map([["thermosafe_wind_activity_profile", "trekking"]]);
  const signup = harness({ absent: true, noLocalToken: true, storage });
  assert.equal(await signup.api.enableRiskAlerts({ threshold: "high", lang: "ca" }), NEW);
  assert.equal(signup.docs.get(NEW).jobType, "trekking");

  const recoveryStorage = new Map([
    ["fcmToken", OLD],
    ["thermosafe_wind_activity_profile", "poda"],
  ]);
  const recovery = harness({ absent: true, storage: recoveryStorage });
  assert.equal(await recovery.api.updateRiskAlertLocation({ lat: 0, lon: 0 }), true);
  assert.equal(recovery.docs.get(NEW).jobType, "poda");

  for (const storedProfile of [undefined, "corrupt"]) {
    const fallbackStorage = new Map<string, string>();
    if (storedProfile !== undefined) fallbackStorage.set("thermosafe_wind_activity_profile", storedProfile);
    const fallback = harness({ absent: true, noLocalToken: true, storage: fallbackStorage });
    assert.equal(await fallback.api.enableRiskAlerts({ threshold: "high", lang: "ca" }), NEW);
    assert.equal(fallback.docs.get(NEW).jobType, "generic");
  }
});

test("profile selection persists locally before optional remote synchronization", () => {
  const appSource = readFileSync(new URL("../../src/App.tsx", import.meta.url), "utf8");
  const handler = appSource.match(/const handleWindActivityProfileChange = \(value: string\) => \{([\s\S]*?)\n\};/);
  assert.ok(handler);
  assert.ok(handler[1].indexOf("writeWindActivityProfile(profile)") < handler[1].indexOf("updateSubscriptionJobTypeLazy(profile)"));
  assert.match(handler[1], /pushEnabled && \(pushToken \|\| localStorage\.getItem\("fcmToken"\)\)/);
  assert.match(handler[1], /catch\(\(error\) =>/);
  assert.doesNotMatch(handler[1], /writeWindActivityProfile\([^)]*generic[^)]*\)/);
});

test("startup synchronizes the saved profile once without requesting permission or token", () => {
  const appSource = readFileSync(new URL("../../src/App.tsx", import.meta.url), "utf8");
  const sync = appSource.match(/useEffect\(\(\) => \{\n  const tok = localStorage\.getItem\("fcmToken"\);([\s\S]*?)\n\}, \[\]\);/);
  assert.ok(sync);
  assert.match(sync[1], /updateSubscriptionJobTypeLazy\(readWindActivityProfile\(\)\)/);
  assert.doesNotMatch(sync[1], /getToken|requestPermission|enableRiskAlerts/);
});

test("rapid profile changes are serialized and the last selection wins", async () => {
  let releaseFirst!: () => void;
  let markFirstStarted!: () => void;
  const firstStarted = new Promise<void>((resolve) => { markFirstStarted = resolve; });
  const firstGate = new Promise<void>((resolve) => { releaseFirst = resolve; });
  const h = harness({ updateGate: async (attempt) => {
    if (attempt === 1) { markFirstStarted(); await firstGate; }
  } });

  const general = h.api.updateSubscriptionJobType("generic");
  await firstStarted;
  h.storage.set("thermosafe_wind_activity_profile", "poda");
  const pruning = h.api.updateSubscriptionJobType("poda");
  h.storage.set("thermosafe_wind_activity_profile", "trekking");
  const trekking = h.api.updateSubscriptionJobType("trekking");
  assert.equal(h.writes.length, 1, "later writes wait for the active write");

  releaseFirst();
  assert.deepEqual(await Promise.all([general, pruning, trekking]), [true, true, true]);
  assert.deepEqual(h.writes.map((write) => write.payload.jobType), ["generic", "poda", "trekking"]);
  assert.equal(h.docs.get(OLD).jobType, "trekking");
});

test("initial generic synchronization cannot overwrite a later user selection", async () => {
  let releaseInitial!: () => void;
  let markInitialStarted!: () => void;
  const initialStarted = new Promise<void>((resolve) => { markInitialStarted = resolve; });
  const initialGate = new Promise<void>((resolve) => { releaseInitial = resolve; });
  const h = harness({ updateGate: async (attempt) => {
    if (attempt === 1) { markInitialStarted(); await initialGate; }
  } });

  const initialSync = h.api.updateSubscriptionJobType("generic");
  await initialStarted;
  h.storage.set("thermosafe_wind_activity_profile", "poda");
  const userChange = h.api.updateSubscriptionJobType("poda");
  releaseInitial();
  assert.deepEqual(await Promise.all([initialSync, userChange]), [true, true]);
  assert.equal(h.docs.get(OLD).jobType, "poda");
});

test("failed latest profile write keeps local choice and can be retried", async () => {
  const storage = new Map([
    ["fcmToken", OLD],
    ["thermosafe_wind_activity_profile", "trekking"],
  ]);
  const h = harness({ storage, updateFailureAt: 2 });
  const older = h.api.updateSubscriptionJobType("poda");
  const latest = h.api.updateSubscriptionJobType("trekking");
  assert.deepEqual(await Promise.all([older, latest]), [true, false]);
  assert.equal(storage.get("thermosafe_wind_activity_profile"), "trekking");
  assert.equal(h.docs.get(OLD).jobType, "poda");

  assert.equal(await h.api.updateSubscriptionJobType(storage.get("thermosafe_wind_activity_profile")), true);
  assert.equal(h.docs.get(OLD).jobType, "trekking");
  assert.equal(h.writes.at(-1)?.payload.jobType, "trekking");
});

test("profile changes while push is disabled do not call the remote updater", () => {
  const appSource = readFileSync(new URL("../../src/App.tsx", import.meta.url), "utf8");
  const handler = appSource.match(/const handleWindActivityProfileChange = \(value: string\) => \{([\s\S]*?)\n\};/);
  assert.ok(handler);
  assert.match(handler[1], /if \(pushEnabled && \(pushToken \|\| localStorage\.getItem\("fcmToken"\)\)\) \{[\s\S]*updateSubscriptionJobTypeLazy\(profile\)/);
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
