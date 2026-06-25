import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
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
  normalizeUviForDisplay,
} from "../../src/utils/uv";
import {
  getHeatDayPhase,
  isDayAtLocation,
  isLateDayAtLocation,
} from "../../src/utils/isDayAtLocation";
import { getPrimaryStatusBlock } from "../../src/utils/getPrimaryStatusBlock";
import { pickPrimaryRisk } from "../../src/utils/PickPrimaryRisk";
import { getWorkWindow, getWorkWindowText } from "../../src/utils/workWindow";

test("heat risk follows INSST-style threshold boundaries", () => {
  assert.equal(getBaseHeatRisk(26.9).class, "safe");
  assert.equal(getBaseHeatRisk(27).class, "mild");
  assert.equal(getBaseHeatRisk(32).class, "moderate");
  assert.equal(getBaseHeatRisk(41).class, "high");
  assert.equal(getBaseHeatRisk(54).class, "ext");
});

test("activity can raise heat risk but cannot turn safe weather into high heat risk", () => {
  assert.equal(getHeatRisk(19.8, "rest").class, "safe");
  assert.equal(getHeatRisk(19.8, "intense").class, "safe");
  assert.equal(getHeatRisk(25, "intense").class, "mild");
  assert.equal(getHeatRisk(27, "intense").class, "mild");
  assert.equal(getHeatRisk(30, "moderate").class, "moderate");
  assert.equal(getHeatRisk(31.9, "intense").class, "moderate");
  assert.equal(getHeatRisk(35, "intense").class, "ext");
  assert.equal(getHeatRisk(45, "rest").class, "high");
});

test("intense activity below the official heat threshold raises preventive UI risk", () => {
  const heatRisk = getHeatRisk(26.4, "intense");
  const primary = pickPrimaryRisk({
    hi: 26.4,
    effForCold: 26.4,
    windRisk: "none",
    uvi: 1.4,
    heatRiskClass: heatRisk.class,
  });

  assert.equal(heatRisk.class, "mild");
  assert.equal(primary.kind, "heat");
  assert.equal(primary.severity, 1);

  const status = getPrimaryStatusBlock({
    alerts: [],
    primary,
    heatRisk,
    coldRisk: "cap",
    windRisk: "none",
    uvi: 1.4,
    day: true,
    primaryAdvice: null,
    contextualUVMessage: "",
    t: (key) => key,
  });

  assert.equal(status.title, "Precaució lleu per calor");
  assert.notEqual(status.title, "Condicions segures");
});

test("outdoor activity conditions react to physical effort below 27 degrees", () => {
  const heatRisk = getHeatRisk(26.4, "intense");

  assert.equal(
    getWorkWindow({
      heatRisk,
      heatIndex: 26.4,
      activity: "intense",
    }),
    "caution"
  );
});

test("outdoor activity conditions do not hide high heat risk behind caution", () => {
  assert.equal(
    getWorkWindow({
      heatRisk: { class: "high", isHigh: true, isExtreme: false },
      heatIndex: 30,
      activity: "moderate",
    }),
    "limited"
  );
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

test("mild cold status is not presented as moderate", () => {
  const result = getPrimaryStatusBlock({
    alerts: [],
    primary: { kind: "cold", severity: 1, labelKey: "cold_mild" },
    heatRisk: null,
    coldRisk: "lleu",
    windRisk: "none",
    uvi: 0,
    day: true,
    primaryAdvice: null,
    contextualUVMessage: "",
    t: (key) => key,
  });

  assert.equal(result.title, "Precaució lleu per fred");
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
  assert.equal(getUvLevel(2.5), "low");
  assert.equal(getUvLevel(2.9), "low");
  assert.equal(getUvLevel(3), "moderate");
  assert.equal(getUvLevel(3.1), "moderate");
  assert.equal(getUvLevel(6), "high");
  assert.equal(getUvLevel(8), "very-high");
  assert.equal(getUvLevel(11), "extreme");

  assert.equal(getUvLevelIndex(4.9), 1);
  assert.equal(getUvLevelIndex(5.2), 1);
  assert.equal(getUvLevelIndex(6.1), 2);
  assert.equal(getUvLevelIndex(10.6), 3);
  assert.equal(getUvLevelIndex(11), 4);
  assert.equal(getUvLevelIndex(16.4), 4);

  assert.equal(getUvText(8, "ca"), "Molt alt (8–10.9)");
  assert.equal(getUvText(11, "es"), "Extremo (11+)");
  assert.match(getUvAdvice(6, "ca"), /Protecció extra/);
});

test("UV classification follows the visible one-decimal value", () => {
  assert.equal(normalizeUviForDisplay(2.94), 2.9);
  assert.equal(getUvLevel(2.94), "low");
  assert.equal(getUvText(2.94, "ca"), "Baix (0–2.9)");

  assert.equal(normalizeUviForDisplay(2.95), 3);
  assert.equal(getUvLevel(2.95), "moderate");
  assert.equal(getUvText(2.95, "ca"), "Moderat (3–5.9)");

  assert.equal(getUvLevel(3), "moderate");
  assert.equal(getUvText(3, "ca"), "Moderat (3–5.9)");

  assert.equal(normalizeUviForDisplay(7.95), 8);
  assert.equal(getUvLevel(7.95), "very-high");
  assert.equal(getUvText(7.95, "ca"), "Molt alt (8–10.9)");
});

test("primary UV status title is translated and follows displayed bands", () => {
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

  assert.equal(makeStatus(7.9).title, "High UV radiation");
  assert.equal(makeStatus(8).title, "Very high UV radiation");
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

test("heat day phase distinguishes day, evening after sunset and night", () => {
  const tz = 2 * 60 * 60;
  const sunrise = 1_800;
  const sunset = 45_000;

  assert.equal(getHeatDayPhase(sunset - 3 * 60 * 60, tz, sunrise, sunset), "day");
  assert.equal(getHeatDayPhase(sunset - 60 * 60, tz, sunrise, sunset), "late_day");
  assert.equal(getHeatDayPhase(sunset + 60 * 60, tz, sunrise, sunset), "evening");
  assert.equal(getHeatDayPhase(sunset + 3 * 60 * 60, tz, sunrise, sunset), "night");
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

test("heat after sunset uses accumulated-heat evening wording", () => {
  const translations: Record<string, string> = {
    "primaryStatus.heat.mildLateDay": "Temperatura encara elevada",
    "primaryStatus.heat.mildEveningText":
      "Tot i que el sol ja s'ha post, la calor acumulada encara pot provocar cansament. Hidrata't i evita esforços intensos si notes fatiga.",
  };

  const result = getPrimaryStatusBlock({
    alerts: [],
    primary: { kind: "heat", severity: 1, labelKey: "heat_mild" },
    heatRisk: { isHigh: false, isExtreme: false },
    coldRisk: "cap",
    windRisk: "none",
    uvi: 0,
    day: false,
    heatDayPhase: "evening",
    primaryAdvice: null,
    contextualUVMessage: "",
    t: (key) => translations[key] || key,
  });

  assert.equal(result.title, "Temperatura encara elevada");
  assert.match(result.text, /sol ja s'ha post/i);
  assert.doesNotMatch(result.text, /sol ja baixa/i);
});

test("night heat status avoids daytime shade advice", () => {
  const translations: Record<string, string> = {
    "officialAdviceDynamic.heat.moderate": "Evita esforços intensos i busca ombra regularment.",
    "primaryStatus.heat.hotNight": "Nit calorosa",
    "primaryStatus.heat.hotNightText":
      "La temperatura continua elevada malgrat que és de nit. Hidrata't i evita esforços físics intensos fins que refresqui.",
  };

  const result = getPrimaryStatusBlock({
    alerts: [],
    primary: { kind: "heat", severity: 2, labelKey: "heat_moderate" },
    heatRisk: { isHigh: false, isExtreme: false },
    coldRisk: "cap",
    windRisk: "none",
    uvi: 0,
    day: false,
    heatDayPhase: "night",
    primaryAdvice: null,
    contextualUVMessage: "",
    t: (key) => translations[key] || key,
  });

  assert.equal(result.title, "Nit calorosa");
  assert.match(result.text, /nit/i);
  assert.doesNotMatch(result.text, /ombra/i);
  assert.doesNotMatch(result.text, /sol/i);
});

test("tropical night is not presented as safe primary status", () => {
  const result = getPrimaryStatusBlock({
    alerts: [],
    primary: { kind: "none", severity: 0, labelKey: "none" },
    heatRisk: { isHigh: false, isExtreme: false },
    coldRisk: "cap",
    windRisk: "none",
    uvi: 0,
    day: false,
    heatDayPhase: "night",
    nocturnalHeat: true,
    primaryAdvice: null,
    contextualUVMessage: "",
    t: (key) => seasonalTranslations[key] || key,
  });

  assert.equal(result.title, "Nit calorosa");
  assert.notEqual(result.title, "Condicions segures");
  assert.match(result.text, /nit/i);
  assert.match(result.text, /temperatura|elevada/i);
});

test("tropical night outdoor activity keeps a mild caution nuance", () => {
  const level = getWorkWindow({
    heatRisk: { class: "safe", isHigh: false, isExtreme: false },
    heatIndex: 25.5,
    coldRisk: "cap",
    windRisk: "none",
    uvi: 0,
    nocturnalHeat: true,
  });
  const text = getWorkWindowText(level, "ca", false, true);

  assert.equal(level, "caution");
  assert.match(text, /activitats suaus/i);
  assert.doesNotMatch(text, /Situació adequada/i);
});

test("dark theme keeps recommendation variants readable", () => {
  const css = readFileSync(`${process.cwd()}/src/index.css`, "utf8");
  const darkModeBlock = css.slice(css.indexOf("@media (prefers-color-scheme: dark)"));

  for (const variant of ["nightCool", "nightSafe", "nightHeat", "tropicalNight", "cold_low"]) {
    assert.ok(darkModeBlock.includes(`.recommendation-box.${variant}`));
  }

  assert.match(darkModeBlock, /color:\s*#e0f2fe\s*!important/);
  assert.match(darkModeBlock, /color:\s*#ffedd5\s*!important/);
});

const seasonalTranslations: Record<string, string> = {
  "safe_conditions": "Condicions segures",
  "safe_conditions_text_day": "No es requereixen mesures especials en aquest moment.",
  "primaryStatus.heat.mild": "Precaució lleu per calor",
  "primaryStatus.heat.mildLateDay": "Temperatura encara elevada",
  "primaryStatus.heat.hotNight": "Nit calorosa",
  "primaryStatus.heat.moderate": "Risc moderat per calor",
  "primaryStatus.heat.moderateLateDay": "Calor encara elevada",
  "primaryStatus.heat.high": "Risc alt per calor",
  "primaryStatus.heat.extreme": "Risc extrem per calor",
  "primaryStatus.heat.mildText":
    "La sensació tèrmica és moderadament elevada. Hidrata't i adapta l'activitat si mantens esforç físic.",
  "primaryStatus.heat.mildLateDayText":
    "Tot i que el sol ja baixa, la sensació tèrmica encara pot provocar cansament. Hidrata't i evita esforços innecessaris.",
  "primaryStatus.heat.mildEveningText":
    "Tot i que el sol ja s'ha post, la calor acumulada encara pot provocar cansament. Hidrata't i evita esforços intensos si notes fatiga.",
  "primaryStatus.heat.hotNightText":
    "La temperatura continua elevada malgrat que és de nit. Hidrata't i evita esforços físics intensos fins que refresqui.",
  "primaryStatus.heat.moderateLateDayText":
    "Tot i ser capvespre, la sensació tèrmica continua elevada. Redueix esforços intensos, hidrata't i fes pauses en llocs frescos.",
  "officialAdviceDynamic.heat.moderate":
    "Evita esforços intensos i fes pauses en llocs frescos.",
  "officialAdviceDynamic.heat.high":
    "Limita l'activitat exterior, hidrata't sovint i cerca ombra.",
  "officialAdviceDynamic.heat.extreme":
    "Evita completament l'exposició i interromp l'activitat física.",
  "primaryStatus.cold.mild": "Precaució lleu per fred",
  "primaryStatus.cold.moderate": "Risc moderat per fred",
  "primaryStatus.cold.high": "Risc alt per fred",
  "primaryStatus.cold.extreme": "Risc extrem per fred",
  "officialAdviceDynamic.cold.mild": "Abriga't lleugerament si passes temps a l'exterior.",
  "officialAdviceDynamic.cold.moderate": "Abriga't per capes i evita exposicions prolongades.",
  "officialAdviceDynamic.cold.high": "Protegeix extremitats i limita el temps d'exposició exterior.",
  "officialAdviceDynamic.cold.extreme": "Evita l'exterior. Hi ha risc greu de pèrdua ràpida de calor corporal.",
  "primaryStatus.wind.moderate": "Risc moderat per vent",
  "primaryStatus.wind.high": "Risc alt per vent",
  "primaryStatus.wind.veryHigh": "Risc molt alt per vent",
  "officialAdviceDynamic.wind.strong": "Assegura objectes i evita zones exposades.",
  "officialAdviceDynamic.wind.very_strong": "Evita zones exposades i roman en espais segurs.",
  "primaryStatus.uv.moderate": "Radiació UV moderada",
  "primaryStatus.uv.high": "Radiació UV alta",
  "primaryStatus.uv.veryHigh": "Radiació UV molt alta",
  "primaryStatus.uv.extreme": "Radiació UV extrema",
  "highUVIWarning": "Índex UV molt alt. Protecció solar imprescindible.",
};

function localTimeToSeconds(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 * 60 + minutes * 60;
}

function assertNoDuplicateSentences(text: string) {
  const sentences = text
    .split(".")
    .map((part) => part.trim())
    .filter(Boolean);
  assert.equal(new Set(sentences).size, sentences.length);
}

type SeasonalScenario = {
  name: string;
  date: string;
  time: string;
  sunrise: string;
  sunset: string;
  hi: number;
  effForCold: number;
  windKmh: number;
  uvi: number;
  expectedPhase: ReturnType<typeof getHeatDayPhase>;
  expectedPrimary: "heat" | "cold" | "wind" | "uv" | "none";
  weatherMain?: string;
  irradiance?: number;
};

const seasonalScenarios: SeasonalScenario[] = [
  { name: "estiu 08:00 suau", date: "21 juny", time: "08:00", sunrise: "06:20", sunset: "21:20", hi: 26, effForCold: 26, windKmh: 8, uvi: 2, expectedPhase: "day", expectedPrimary: "none" },
  { name: "estiu 14:00 UV dominant", date: "21 juny", time: "14:00", sunrise: "06:20", sunset: "21:20", hi: 35, effForCold: 35, windKmh: 10, uvi: 9, expectedPhase: "day", expectedPrimary: "uv" },
  { name: "estiu 19:00 encara de dia amb calor lleu", date: "21 juny", time: "19:00", sunrise: "06:20", sunset: "21:20", hi: 31, effForCold: 31, windKmh: 10, uvi: 4, expectedPhase: "day", expectedPrimary: "heat" },
  { name: "estiu 21:30 post-posta calor acumulada", date: "21 juny", time: "21:30", sunrise: "06:20", sunset: "21:20", hi: 30, effForCold: 30, windKmh: 6, uvi: 0, expectedPhase: "evening", expectedPrimary: "heat" },
  { name: "estiu 23:30 nit calorosa", date: "21 juny", time: "23:30", sunrise: "06:20", sunset: "21:20", hi: 29, effForCold: 29, windKmh: 5, uvi: 0, expectedPhase: "night", expectedPrimary: "heat" },
  { name: "hivern 08:00 abans de sortir el sol", date: "21 desembre", time: "08:00", sunrise: "08:05", sunset: "17:30", hi: 4, effForCold: 4, windKmh: 8, uvi: 0, expectedPhase: "night", expectedPrimary: "none" },
  { name: "hivern 12:00 fred lleu", date: "21 desembre", time: "12:00", sunrise: "08:05", sunset: "17:30", hi: 5, effForCold: -1, windKmh: 15, uvi: 1, expectedPhase: "day", expectedPrimary: "cold" },
  { name: "hivern 16:30 final de dia sense risc", date: "21 desembre", time: "16:30", sunrise: "08:05", sunset: "17:30", hi: 7, effForCold: 7, windKmh: 10, uvi: 0, expectedPhase: "late_day", expectedPrimary: "none" },
  { name: "hivern 20:00 fred moderat", date: "21 desembre", time: "20:00", sunrise: "08:05", sunset: "17:30", hi: 3, effForCold: -6, windKmh: 15, uvi: 0, expectedPhase: "night", expectedPrimary: "cold" },
  { name: "primavera 09:00 estable", date: "21 març", time: "09:00", sunrise: "06:55", sunset: "19:05", hi: 18, effForCold: 18, windKmh: 10, uvi: 2, expectedPhase: "day", expectedPrimary: "none" },
  { name: "primavera 15:00 UV alt", date: "21 març", time: "15:00", sunrise: "06:55", sunset: "19:05", hi: 21, effForCold: 21, windKmh: 8, uvi: 6, expectedPhase: "day", expectedPrimary: "uv" },
  { name: "primavera 19:00 final de dia sense risc", date: "21 març", time: "19:00", sunrise: "06:55", sunset: "19:05", hi: 24, effForCold: 24, windKmh: 9, uvi: 0, expectedPhase: "late_day", expectedPrimary: "none" },
  { name: "tardor 09:00 estable", date: "21 setembre", time: "09:00", sunrise: "07:35", sunset: "19:50", hi: 18, effForCold: 18, windKmh: 10, uvi: 2, expectedPhase: "day", expectedPrimary: "none" },
  { name: "tardor 15:00 UV moderat", date: "21 setembre", time: "15:00", sunrise: "07:35", sunset: "19:50", hi: 26, effForCold: 26, windKmh: 10, uvi: 4, expectedPhase: "day", expectedPrimary: "uv" },
  { name: "tardor 20:00 post-posta calor lleu", date: "21 setembre", time: "20:00", sunrise: "07:35", sunset: "19:50", hi: 27, effForCold: 27, windKmh: 6, uvi: 0, expectedPhase: "evening", expectedPrimary: "heat" },
  { name: "nit tropical", date: "21 juny", time: "23:30", sunrise: "06:20", sunset: "21:20", hi: 28, effForCold: 28, windKmh: 4, uvi: 0, expectedPhase: "night", expectedPrimary: "heat" },
  { name: "nit torrida", date: "21 juny", time: "23:30", sunrise: "06:20", sunset: "21:20", hi: 34, effForCold: 34, windKmh: 4, uvi: 0, expectedPhase: "night", expectedPrimary: "heat" },
  { name: "onada de calor", date: "21 juny", time: "14:00", sunrise: "06:20", sunset: "21:20", hi: 43, effForCold: 43, windKmh: 12, uvi: 7, expectedPhase: "day", expectedPrimary: "heat" },
  { name: "vent molt fort", date: "21 març", time: "15:00", sunrise: "06:55", sunset: "19:05", hi: 18, effForCold: 18, windKmh: 70, uvi: 2, expectedPhase: "day", expectedPrimary: "wind" },
  { name: "UV molt alt", date: "21 juny", time: "14:00", sunrise: "06:20", sunset: "21:20", hi: 24, effForCold: 24, windKmh: 5, uvi: 9, expectedPhase: "day", expectedPrimary: "uv" },
  { name: "irradiancia molt alta sense altre risc", date: "21 juny", time: "14:00", sunrise: "06:20", sunset: "21:20", hi: 22, effForCold: 22, windKmh: 5, uvi: 2, irradiance: 9, expectedPhase: "day", expectedPrimary: "none" },
  { name: "dia molt ennuvolat amb UV baix", date: "21 setembre", time: "15:00", sunrise: "07:35", sunset: "19:50", hi: 19, effForCold: 19, windKmh: 8, uvi: 1, weatherMain: "Clouds", expectedPhase: "day", expectedPrimary: "none" },
  { name: "hivern amb molt de vent", date: "21 desembre", time: "12:00", sunrise: "08:05", sunset: "17:30", hi: 2, effForCold: -16, windKmh: 50, uvi: 1, expectedPhase: "day", expectedPrimary: "cold" },
  { name: "calor intensa amb cel completament cobert", date: "21 juny", time: "14:00", sunrise: "06:20", sunset: "21:20", hi: 42, effForCold: 42, windKmh: 8, uvi: 1, weatherMain: "Clouds", expectedPhase: "day", expectedPrimary: "heat" },
];

test("seasonal validation matrix keeps risk, day phase and messages coherent", async (t) => {
  for (const scenario of seasonalScenarios) {
    await t.test(`${scenario.date} ${scenario.time} - ${scenario.name}`, () => {
      const now = localTimeToSeconds(scenario.time);
      const sunrise = localTimeToSeconds(scenario.sunrise);
      const sunset = localTimeToSeconds(scenario.sunset);
      const phase = getHeatDayPhase(now, 0, sunrise, sunset);
      const isDay = isDayAtLocation(now, 0, sunrise, sunset);
      const uviForRisk = isDay ? scenario.uvi : 0;
      const heatRisk = getHeatRisk(scenario.hi, "rest");
      const coldRisk = getColdRisk(scenario.effForCold, scenario.windKmh);
      const windRisk = getWindRisk(scenario.windKmh);
      const primary = pickPrimaryRisk({
        hi: scenario.hi,
        effForCold: scenario.effForCold,
        windRisk,
        uvi: uviForRisk,
        heatRiskClass: heatRisk.class,
      });
      const status = getPrimaryStatusBlock({
        alerts: [],
        primary,
        heatRisk,
        coldRisk,
        windRisk,
        uvi: uviForRisk,
        day: isDay,
        heatDayPhase: phase,
        primaryAdvice: null,
        contextualUVMessage: "",
        t: (key) => seasonalTranslations[key] || key,
      });
      const workWindow = getWorkWindow({
        heatRisk,
        heatIndex: scenario.hi,
        coldRisk,
        windRisk,
        uvi: uviForRisk,
        weatherMain: scenario.weatherMain ?? "Clear",
      });

      assert.equal(phase, scenario.expectedPhase);
      assert.equal(primary.kind, scenario.expectedPrimary);
      assert.notEqual(status.title, status.text);
      assertNoDuplicateSentences(status.text);

      if (phase === "night") {
        assert.notEqual(primary.kind, "uv");
        assert.doesNotMatch(status.title, /UV|Radiació|Índex/i);
        assert.doesNotMatch(
          status.text,
          /sol ja baixa|sol directe|protecció solar|hores centrals|ombra|sun|shade|eguzki|sombra/i
        );
      }

      if (phase === "evening" && primary.kind === "heat") {
        assert.match(status.text, /sol ja s'ha post|calor acumulada/i);
        assert.doesNotMatch(status.text, /sol ja baixa/i);
      }

      if (primary.kind !== "heat") {
        assert.notEqual(status.title, "Nit calorosa");
      }

      if (scenario.hi < 27) {
        assert.notEqual(status.title, "Nit calorosa");
      }

      if (scenario.effForCold > 0) {
        assert.notEqual(primary.kind, "cold");
      }

      if (primary.kind === "heat" && scenario.hi >= 41) {
        assert.ok(workWindow === "limited" || workWindow === "avoid");
      }

      if (scenario.irradiance && scenario.irradiance >= 8) {
        assert.equal(primary.kind, "none");
      }
    });
  }
});
