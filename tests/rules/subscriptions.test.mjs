import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { before, after, test } from "node:test";
import { initializeApp, deleteApp } from "firebase/app";
import { connectFirestoreEmulator, getFirestore, doc, setDoc, updateDoc, getDoc,
  deleteField, serverTimestamp, terminate, setLogLevel } from "firebase/firestore";
import { initializeApp as initializeAdmin, deleteApp as deleteAdmin } from "firebase-admin/app";
import { getFirestore as getAdminFirestore } from "firebase-admin/firestore";

// Refuse to run against a remote host or real project, even with credentials present.
const host = process.env.FIRESTORE_EMULATOR_HOST;
assert.match(host ?? "", /^127\.0\.0\.1:\d+$/, "Start a local Firestore emulator and set FIRESTORE_EMULATOR_HOST=127.0.0.1:PORT");
const projectId = "demo-thermosafe-rules";
const client = initializeApp({ projectId, apiKey: "emulator-only" }, "rules-client");
const db = getFirestore(client);
connectFirestoreEmulator(db, "127.0.0.1", Number(host.split(":")[1]));
setLogLevel("silent");
const admin = initializeAdmin({ projectId }, "rules-admin");
const adminDb = getAdminFirestore(admin);
let sequence = 0;

const reset = {
  lastNotified: null, lastNotifiedDay: null, lastDailyResetDay: null,
  lastHeatLevel: 0, lastHeatAt: 0, lastColdLevel: 0, lastColdAt: 0,
  lastWindLevel: 0, lastWindAt: 0, lastUvLevel: 0, lastUvAt: 0,
  lastAemetLevel: 0, lastAemetAt: 0,
};
const adminFields = {
  lastAemetEpisodeKey: "episode", lastAemetNotifiedLevel: 3,
  lastAemetEventKey: "event", lastAemetEvent: { ca: "Calor" },
  lastAemetSender: "AEMET", lastAemetResetDay: "2026-09-20",
  uvLevelsByZone: { "39.5,2.9": 3 }, lastUvResetDay: "2026-09-20",
  jobType: "construction", futureAdminField: { value: "read-only" },
};
function fresh() {
  const token = `rules-test-${++sequence}-` + "x".repeat(60);
  const data = { token, lat: 39.5, lon: 2.9, lang: "ca", threshold: "moderate",
    place: "Origin", createdAt: 100, updatedAt: 100, ...reset };
  return { token, ref: doc(db, "subs", token), data };
}
async function seeded(extra = {}) {
  const record = fresh();
  record.data = { ...record.data, ...Object.fromEntries(Object.keys(reset).map(key => [key,
    key.endsWith("Day") ? "2026-09-20" : 3])), ...adminFields, ...extra };
  await adminDb.doc(`subs/${record.token}`).set(record.data);
  return record;
}
async function denied(operation) {
  await assert.rejects(operation, error => error.code === "permission-denied");
}

before(async () => {
  // Load the repository's real rules; never substitute a mock rules evaluator.
  const response = await fetch(`http://${host}/emulator/v1/projects/${projectId}:securityRules`, {
    method: "PUT", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ rules: { files: [{ name: "firestore.rules",
      content: readFileSync(new URL("../../firestore.rules", import.meta.url), "utf8") }] } }),
  });
  assert.equal(response.ok, true, await response.text());
});
after(async () => {
  await terminate(db);
  await deleteApp(client);
  await adminDb.terminate();
  await deleteAdmin(admin);
});

test("Admin fields survive a legitimate location update", async () => {
  const { ref } = await seeded();
  await updateDoc(ref, { lat: 39.51, lon: 2.91, updatedAt: 200, tokenLastSyncedAt: serverTimestamp() });
  const result = (await getDoc(ref)).data();
  assert.equal(result.lat, 39.51);
  for (const [key, value] of Object.entries(adminFields)) assert.deepEqual(result[key], value);
});
test("15 km geographic reset preserves every protected Admin field", async () => {
  const { ref } = await seeded();
  await updateDoc(ref, { lat: 41, lon: 2.9, updatedAt: 200, ...reset });
  const result = (await getDoc(ref)).data();
  for (const [key, value] of Object.entries(reset)) assert.equal(result[key], value);
  for (const [key, value] of Object.entries(adminFields)) assert.deepEqual(result[key], value);
});
test("language, preferences and heartbeat updates are allowed without altering risk state", async () => {
  const { ref, token, data } = await seeded();
  await updateDoc(ref, { lang: "en", threshold: "high", place: "New label" });
  await updateDoc(ref, { token, updatedAt: 200, tokenLastSyncedAt: serverTimestamp() });
  const result = (await getDoc(ref)).data();
  assert.equal(result.lang, "en");
  for (const key of Object.keys(reset)) assert.equal(result[key], data[key]);
});
test("long Admin metadata does not block unrelated client writes", async () => {
  const { ref } = await seeded({ lastAemetEventKey: "e".repeat(600), lastAemetSender: "s".repeat(400) });
  await updateDoc(ref, { lang: "es" });
});

for (const key of Object.keys(adminFields)) {
  test(`client cannot modify, delete or add protected field ${key}`, async () => {
    const { ref } = await seeded();
    await denied(updateDoc(ref, { [key]: "tampered" }));
    await denied(updateDoc(ref, { [key]: deleteField() }));
    const freshRecord = fresh();
    await setDoc(freshRecord.ref, freshRecord.data);
    await denied(updateDoc(freshRecord.ref, { [key]: adminFields[key] }));
  });
}
test("nested UV changes are denied", async () => {
  const { ref } = await seeded();
  await denied(updateDoc(ref, { "uvLevelsByZone.injected": 9 }));
  await denied(updateDoc(ref, { uvLevelsByZone: {} }));
});
test("token and creation time are immutable", async () => {
  const { ref } = await seeded();
  await denied(updateDoc(ref, { token: "other".repeat(15) }));
  await denied(updateDoc(ref, { createdAt: 999 }));
});
test("clients cannot forge notification levels, timestamps or daily markers", async () => {
  const { ref } = await seeded();
  for (const key of Object.keys(reset)) {
    await denied(updateDoc(ref, { ...reset, [key]: key.endsWith("Day") ? "2099-01-01" : 999 }));
  }
  await denied(updateDoc(ref, { lastHeatLevel: 0 }));
  await denied(updateDoc(ref, { lastUvAt: deleteField() }));
});
test("invalid client field values are still denied", async () => {
  const { ref } = await seeded();
  for (const payload of [{ lat: 91 }, { lon: -181 }, { lat: "39" }, { lang: "xx" },
    { threshold: "unknown" }, { tokenLastSyncedAt: 123 }, { updatedAt: "today" }]) {
    await denied(updateDoc(ref, payload));
  }
});
test("legitimate signup and recovery create payloads are allowed", async () => {
  const { ref, data } = fresh();
  await setDoc(ref, { ...data, tokenLastSyncedAt: serverTimestamp() }, { merge: true });
  assert.equal((await getDoc(ref)).exists(), true);
});
test("minimal compatible signup without reset metadata remains allowed", async () => {
  const { ref, token } = fresh();
  await setDoc(ref, { token, lat: 39.5, lon: 2.9 });
});
for (const key of Object.keys(adminFields)) {
  test(`signup cannot inject ${key}`, async () => {
    const { ref, data } = fresh();
    await denied(setDoc(ref, { ...data, [key]: adminFields[key] }));
  });
}
test("signup cannot forge notification state", async () => {
  const { ref, data } = fresh();
  await denied(setDoc(ref, { ...data, lastHeatLevel: 3 }));
});
test("updateDoc on an absent subscription cannot create it", async () => {
  const { ref, data } = fresh();
  await assert.rejects(updateDoc(ref, data));
  assert.equal((await getDoc(ref)).exists(), false);
});
