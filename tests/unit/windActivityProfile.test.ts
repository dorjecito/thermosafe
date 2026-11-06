import assert from "node:assert/strict";
import test from "node:test";
import { getHeatRisk } from "../../src/utils/heatRisk";
import { getWindRisk } from "../../src/utils/windRisk";
import {
  getWindActivityRisk,
  parseWindActivityProfile,
  readWindActivityProfile,
  WIND_ACTIVITY_PROFILE_STORAGE_KEY,
  WIND_ACTIVITY_PROFILES,
  WIND_ACTIVITY_THRESHOLDS,
  writeWindActivityProfile,
  type WindActivityStorage,
} from "../../src/utils/windActivityProfile";

function makeStorage(initial?: [string, string]): WindActivityStorage & {
  values: Map<string, string>;
} {
  const values = new Map(initial ? [initial] : []);
  return {
    values,
    getItem(key) {
      return values.get(key) ?? null;
    },
    setItem(key, value) {
      values.set(key, value);
    },
  };
}

test("wind activity profile defaults to generic and validates stored values", () => {
  assert.equal(readWindActivityProfile(makeStorage()), "generic");
  assert.equal(readWindActivityProfile(makeStorage([WIND_ACTIVITY_PROFILE_STORAGE_KEY, "unknown"])), "generic");
  assert.equal(readWindActivityProfile(makeStorage([WIND_ACTIVITY_PROFILE_STORAGE_KEY, "poda"])), "poda");
  assert.equal(parseWindActivityProfile(null), "generic");
});

test("wind activity profile selection persists locally", () => {
  const storage = makeStorage();
  assert.equal(writeWindActivityProfile("trekking", storage), true);
  assert.equal(storage.values.get(WIND_ACTIVITY_PROFILE_STORAGE_KEY), "trekking");
  assert.equal(readWindActivityProfile(storage), "trekking");
});

test("every displayed wind activity profile is recognized", () => {
  assert.deepEqual(WIND_ACTIVITY_PROFILES.map(parseWindActivityProfile), [
    "generic", "jardineria", "poda", "altura", "obra", "neteja", "trekking", "oci",
  ]);
});

test("activity wind limits mirror the current backend profiles", () => {
  assert.deepEqual(WIND_ACTIVITY_THRESHOLDS, {
    generic: { moderate: 30, high: 45, veryHigh: 65 },
    jardineria: { moderate: 30, high: 45, veryHigh: 65 },
    poda: { moderate: 25, high: 40, veryHigh: 60 },
    altura: { moderate: 20, high: 35, veryHigh: 55 },
    obra: { moderate: 28, high: 45, veryHigh: 65 },
    neteja: { moderate: 30, high: 50, veryHigh: 70 },
    trekking: { moderate: 35, high: 50, veryHigh: 70 },
    oci: { moderate: 35, high: 50, veryHigh: 70 },
  });
  assert.equal(getWindActivityRisk(30, "generic"), "caution");
  assert.equal(getWindActivityRisk(45, "generic"), "elevated");
  assert.equal(getWindActivityRisk(65, "generic"), "avoid");
  for (const profile of WIND_ACTIVITY_PROFILES) {
    const limits = WIND_ACTIVITY_THRESHOLDS[profile];
    assert.equal(getWindActivityRisk(limits.moderate, profile), "caution", `${profile} moderate boundary`);
    assert.equal(getWindActivityRisk(limits.high, profile), "elevated", `${profile} high boundary`);
    assert.equal(getWindActivityRisk(limits.veryHigh, profile), "avoid", `${profile} very-high boundary`);
  }
});

test("activity profile gives a separate wind context without changing weather severity", () => {
  assert.equal(getWindRisk(38), "moderate");
  assert.equal(getWindActivityRisk(38, "altura"), "elevated");
  assert.equal(getWindActivityRisk(38, "generic"), "caution");
  assert.equal(getWindActivityRisk(38, "trekking"), "caution");
  assert.equal(getWindRisk(38), "moderate");
});

test("low wind yields no activity warning, and heat activity calculation remains independent", () => {
  for (const profile of WIND_ACTIVITY_PROFILES) {
    assert.equal(getWindActivityRisk(14, profile), null);
    assert.equal(
      getWindActivityRisk(WIND_ACTIVITY_THRESHOLDS[profile].moderate - 0.1, profile),
      null,
      `${profile} should not display an activity note below its preventive threshold`
    );
    assert.equal(
      getHeatRisk(33, "moderate").class,
      "ext",
      `automatic heat intensity remains unchanged for ${profile}`
    );
  }
  assert.equal(getWindActivityRisk(null, "altura"), null);
});
