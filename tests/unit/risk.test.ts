import assert from "node:assert/strict";
import test from "node:test";

import { getBaseHeatRisk, getHeatRisk } from "../../src/utils/heatRisk";
import { calcHI } from "../../src/utils/calcHI";
import { getColdRisk } from "../../src/utils/getColdRisk";
import { getWindRisk } from "../../src/utils/windRisk";
import {
  getUvAdvice,
  getUvLevel,
  getUvLevelIndex,
  getUvText,
} from "../../src/utils/uv";
import { isDayAtLocation, isLateDayAtLocation } from "../../src/utils/isDayAtLocation";
import { getPrimaryStatusBlock } from "../../src/utils/getPrimaryStatusBlock";

test("heat risk follows INSST-style threshold boundaries", () => {
  assert.equal(getBaseHeatRisk(26.9).class, "safe");
  assert.equal(getBaseHeatRisk(27).class, "mild");
  assert.equal(getBaseHeatRisk(32).class, "moderate");
  assert.equal(getBaseHeatRisk(41).class, "high");
  assert.equal(getBaseHeatRisk(54).class, "ext");
});

test("activity can raise heat risk but cannot turn safe weather into high heat risk", () => {
  assert.equal(getHeatRisk(19.8, "rest").class, "safe");
  assert.equal(getHeatRisk(25, "intense").class, "mild");
  assert.equal(getHeatRisk(30, "moderate").class, "high");
  assert.equal(getHeatRisk(45, "rest").class, "high");
});

test("heat index calculation is stable for representative warm and humid conditions", () => {
  assert.equal(calcHI(30, 70), 35);
});

test("cold risk follows effective-temperature thresholds", () => {
  assert.equal(getColdRisk(null, 20), "cap");
  assert.equal(getColdRisk(1, 20), "cap");
  assert.equal(getColdRisk(0, 20), "lleu");
  assert.equal(getColdRisk(-5, 20), "moderat");
  assert.equal(getColdRisk(-15, 20), "alt");
  assert.equal(getColdRisk(-25, 20), "molt alt");
  assert.equal(getColdRisk(-40, 20), "extrem");
});

test("wind risk follows km/h threshold boundaries", () => {
  assert.equal(getWindRisk(14.9), "none");
  assert.equal(getWindRisk(15), "breezy");
  assert.equal(getWindRisk(25), "moderate");
  assert.equal(getWindRisk(45), "strong");
  assert.equal(getWindRisk(65), "very_strong");
});

test("UV level, text and advice are classified consistently", () => {
  assert.equal(getUvLevel(null), "low");
  assert.equal(getUvLevel(2.4), "low");
  assert.equal(getUvLevel(2.5), "moderate");
  assert.equal(getUvLevel(3), "moderate");
  assert.equal(getUvLevel(6), "high");
  assert.equal(getUvLevel(8), "very-high");
  assert.equal(getUvLevel(11), "extreme");

  assert.equal(getUvLevelIndex(4.9), 1);
  assert.equal(getUvLevelIndex(5.2), 1);
  assert.equal(getUvLevelIndex(6.1), 2);
  assert.equal(getUvLevelIndex(10.6), 4);
  assert.equal(getUvLevelIndex(16.4), 4);

  assert.equal(getUvText(8, "ca"), "Molt alt (8–10)");
  assert.equal(getUvText(11, "es"), "Extremo (11+)");
  assert.match(getUvAdvice(6, "ca"), /Protecció extra/);
});

test("primary UV status title is translated and follows rounded bands", () => {
  const translations: Record<string, string> = {
    "primaryStatus.uv.high": "High UV radiation",
    "primaryStatus.uv.veryHigh": "Very high UV radiation",
  };
  const t = (key: string) => translations[key] || key;

  const makeStatus = (uvi: number) =>
    getPrimaryStatusBlock({
      alerts: [],
      primary: { kind: "uv", severity: 2, labelKey: "uv_high" },
      heatRisk: null,
      coldRisk: "cap",
      windRisk: "none",
      uvi,
      day: true,
      primaryAdvice: null,
      contextualUVMessage: "",
      t,
    });

  assert.equal(makeStatus(7.3).title, "High UV radiation");
  assert.equal(makeStatus(7.6).title, "Very high UV radiation");
});

test("day/night detection uses local sunrise and sunset boundaries", () => {
  const tz = 2 * 60 * 60;
  const sunrise = 1_800;
  const sunset = 45_000;

  assert.equal(isDayAtLocation(10_000, tz, sunrise, sunset), true);
  assert.equal(isDayAtLocation(sunrise - 1, tz, sunrise, sunset), false);
  assert.equal(isDayAtLocation(sunset, tz, sunrise, sunset), false);
  assert.equal(isDayAtLocation(10_000, tz), true);
});

test("late-day detection follows the local sunset window", () => {
  const tz = 2 * 60 * 60;
  const sunrise = 1_800;
  const sunset = 45_000;

  assert.equal(isLateDayAtLocation(sunset - 60 * 60, tz, sunrise, sunset), true);
  assert.equal(isLateDayAtLocation(sunset - 2 * 60 * 60, tz, sunrise, sunset), false);
  assert.equal(isLateDayAtLocation(sunset, tz, sunrise, sunset), false);
});

test("mild heat near sunset avoids moderate-risk and shade wording", () => {
  const result = getPrimaryStatusBlock({
    alerts: [],
    primary: { kind: "heat", severity: 1, labelKey: "heat_mild" },
    heatRisk: { isHigh: false, isExtreme: false },
    coldRisk: "cap",
    windRisk: "none",
    uvi: 0.2,
    day: true,
    isLateDay: true,
    primaryAdvice: null,
    contextualUVMessage: "",
    t: (key) => key,
  });

  assert.equal(result.title, "Temperatura encara elevada");
  assert.doesNotMatch(result.title, /moderat/i);
  assert.doesNotMatch(result.text, /ombra/i);
});

test("night heat status avoids daytime shade advice", () => {
  const translations: Record<string, string> = {
    "officialAdviceDynamic.heat.moderate": "Evita esforços intensos i busca ombra regularment.",
    "officialAdviceDynamic.heat.moderate_night":
      "La temperatura es manté elevada durant la nit. Hidrata't i evita esforços innecessaris.",
  };

  const result = getPrimaryStatusBlock({
    alerts: [],
    primary: { kind: "heat", severity: 2, labelKey: "heat_moderate" },
    heatRisk: { isHigh: false, isExtreme: false },
    coldRisk: "cap",
    windRisk: "none",
    uvi: 0,
    day: false,
    primaryAdvice: null,
    contextualUVMessage: "",
    t: (key) => translations[key] || key,
  });

  assert.equal(result.title, "Temperatura nocturna elevada");
  assert.match(result.text, /nit/i);
  assert.doesNotMatch(result.text, /ombra/i);
});
