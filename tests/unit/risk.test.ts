import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { getBaseHeatRisk, getHeatRisk } from "../../src/utils/heatRisk";
import { calcHI } from "../../src/utils/calcHI";
import { getColdRisk, type ColdRisk } from "../../src/utils/getColdRisk";
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
import { detectAemetHazard } from "../../src/utils/aemetAi";
import { pickPrimaryRisk } from "../../src/utils/PickPrimaryRisk";
import { getWorkWindow, getWorkWindowText } from "../../src/utils/workWindow";
import { buildRiskTrend } from "../../src/utils/riskTrend";
import {
  evaluateRiskScore,
  type RiskEngineInput,
} from "../../src/utils/riskScoreEngine";
import {
  factorItems,
  getRecommendationColdKey,
  getRecommendationFactorState,
  getRecommendationHumid,
  getRecommendationRainy,
  getRecommendationSlipperySurface,
  getRecommendationStormy,
  getRecommendationSuppressUv,
  getRecommendationVeryCloudy,
  mapColdRiskToRecommendationKey,
  sortItemsByRiskFactors,
  type RecommendationItem,
} from "../../src/components/Recommendations";
import {
  primaryRiskFromEngine,
  type PrimaryRiskFromEngineResult,
} from "../../src/utils/primaryRiskFromEngine";
import {
  getWeatherContext,
  CONTEXT_VERY_CLOUDY_THRESHOLD,
  UV_BLOCKING_CLOUDINESS_THRESHOLD,
} from "../../src/utils/weatherContext";
import { formatOzoneMeasurement } from "../../src/components/UVDetailPanel";
import {
  buildDiagnosticsCopyText,
  createDiagnosticsSnapshot,
  createLongPressController,
  detectBrowser,
  detectDisplayMode,
  formatTokenSyncStatus,
  getDiagnosticsChecks,
  getDiagnosticsMessages,
  getOverallDiagnosticsStatus,
  getTokenSyncStatus,
  type DiagnosticsCopyLabels,
} from "../../src/utils/diagnostics";
import {
  CHUNK_RELOAD_STORAGE_KEY,
  getChunkLoadRecoveryDecision,
  isChunkLoadError,
} from "../../src/utils/chunkLoadRecovery";
import {
  buildTokenLastSyncedPayload,
  isFirestorePermissionDenied,
  omitTokenLastSyncedAt,
  saveTokenLastSyncedLocally,
  TOKEN_LAST_SYNCED_LOCAL_KEY,
  writeWithOptionalTokenSyncFallback,
} from "../../src/utils/tokenSyncMetadata";
import {
  buildVersionUrl,
  fetchPublishedVersion,
  isNewVersionAvailable,
  VERSION_CHECK_INTERVAL_MS,
} from "../../src/utils/versionCheck";
import {
  prepareServiceWorkerForVersionReload,
  reloadThermoSafeVersion,
  unregisterAppShellServiceWorkers,
} from "../../src/utils/serviceWorkerUpdate";

function selectPrimaryForUi(
  enginePrimary: PrimaryRiskFromEngineResult
): PrimaryRiskFromEngineResult {
  return enginePrimary;
}

function compareRiskEngineWithPrimaryPicker(input: RiskEngineInput) {
  const heatRisk =
    typeof input.heatIndex === "number"
      ? getHeatRisk(input.heatIndex, input.activity || "rest")
      : null;
  const windRisk =
    typeof input.windKmh === "number" ? getWindRisk(input.windKmh) : "none";

  const engine = evaluateRiskScore(input);
  const current = pickPrimaryRisk({
    hi: input.heatIndex ?? null,
    effForCold: input.coldEffectiveTemp ?? null,
    windRisk,
    uvi: input.uvi ?? null,
    heatRiskClass: heatRisk?.class,
  });

  return {
    engine,
    current,
    engineKind: engine.primary?.factor ?? "none",
  };
}

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

test("workWindow accepts RiskScoreEngine input passively without changing decisions", () => {
  const input = {
    heatRisk: getHeatRisk(31, "rest"),
    heatIndex: 31,
    coldRisk: "cap" as const,
    windRisk: "moderate" as const,
    uvi: 6.2,
  };
  const engineRisk = evaluateRiskScore({
    heatIndex: input.heatIndex,
    coldEffectiveTemp: input.heatIndex,
    windKmh: 26,
    uvi: input.uvi,
  });

  assert.equal(getWorkWindow(input), "caution");
  assert.equal(getWorkWindow({ ...input, engineRisk }), getWorkWindow(input));
});

test("workWindow uses RiskScoreEngine UV factor when available and keeps legacy fallback", () => {
  const fallbackInput = {
    heatRisk: getHeatRisk(24, "rest"),
    heatIndex: 24,
    coldRisk: "cap" as const,
    windRisk: "none" as const,
    uvi: 8.2,
  };
  const engineRisk = evaluateRiskScore({
    heatIndex: fallbackInput.heatIndex,
    coldEffectiveTemp: fallbackInput.heatIndex,
    windKmh: 0,
    uvi: 0,
  });

  assert.equal(getWorkWindow(fallbackInput), "limited");
  assert.equal(getWorkWindow({ ...fallbackInput, engineRisk }), "optimal");
});

test("workWindow uses RiskScoreEngine wind factor when available and keeps legacy fallback", () => {
  const fallbackInput = {
    heatRisk: getHeatRisk(24, "rest"),
    heatIndex: 24,
    coldRisk: "cap" as const,
    windRisk: "moderate" as const,
    uvi: 0,
  };
  const engineRisk = evaluateRiskScore({
    heatIndex: fallbackInput.heatIndex,
    coldEffectiveTemp: fallbackInput.heatIndex,
    windKmh: 0,
    uvi: fallbackInput.uvi,
  });

  assert.equal(getWorkWindow(fallbackInput), "caution");
  assert.equal(getWorkWindow({ ...fallbackInput, engineRisk }), "optimal");
});

test("workWindow uses RiskScoreEngine cold factor when available and keeps legacy fallback", () => {
  const fallbackInput = {
    heatRisk: getHeatRisk(4, "rest"),
    heatIndex: 4,
    coldRisk: "moderat" as const,
    windRisk: "none" as const,
    uvi: 0,
  };
  const engineRisk = evaluateRiskScore({
    heatIndex: fallbackInput.heatIndex,
    coldEffectiveTemp: 4,
    windKmh: 0,
    uvi: fallbackInput.uvi,
  });

  assert.equal(getWorkWindow(fallbackInput), "limited");
  assert.equal(getWorkWindow({ ...fallbackInput, engineRisk }), "optimal");
});

test("workWindow keeps cold and wind combined rules when both factors come from RiskScoreEngine", () => {
  const input = {
    heatRisk: getHeatRisk(-16, "rest"),
    heatIndex: -16,
    coldRisk: "cap" as const,
    windRisk: "none" as const,
    uvi: 0,
  };
  const engineRisk = evaluateRiskScore({
    heatIndex: input.heatIndex,
    coldEffectiveTemp: -16,
    windKmh: 28,
    uvi: input.uvi,
  });

  assert.equal(getWorkWindow(input), "optimal");
  assert.equal(getWorkWindow({ ...input, engineRisk }), "avoid");
});

test("workWindow uses RiskScoreEngine heat factor when available and keeps legacy fallback", () => {
  const fallbackInput = {
    heatRisk: { class: "safe", isHigh: false, isExtreme: false } as const,
    heatIndex: 26,
    coldRisk: "cap" as const,
    windRisk: "none" as const,
    uvi: 0,
    activity: "intense" as const,
  };
  const engineRisk = evaluateRiskScore({
    heatIndex: fallbackInput.heatIndex,
    activity: fallbackInput.activity,
    coldEffectiveTemp: fallbackInput.heatIndex,
    windKmh: 0,
    uvi: fallbackInput.uvi,
  });

  assert.equal(getWorkWindow(fallbackInput), "optimal");
  assert.equal(getWorkWindow({ ...fallbackInput, engineRisk }), "caution");
});

test("workWindow rainy source uses WeatherContext when available and legacy fallback otherwise", () => {
  const input = {
    heatRisk: getHeatRisk(24, "rest"),
    heatIndex: 24,
    coldRisk: "cap" as const,
    windRisk: "none" as const,
    uvi: 0,
    weatherMain: "Rain",
  };

  assert.equal(getWorkWindow(input), "caution");
  assert.equal(
    getWorkWindow({
      ...input,
      weatherMain: "Clear",
      weatherContext: getWeatherContext({ weatherMain: "Rain" }),
    }),
    "caution"
  );
  assert.equal(
    getWorkWindow({
      ...input,
      weatherContext: getWeatherContext({ weatherMain: "Clear" }),
    }),
    "optimal"
  );
});

test("workWindow keeps AEMET plus rainy behavior through WeatherContext", () => {
  const input = {
    heatRisk: getHeatRisk(24, "rest"),
    heatIndex: 24,
    coldRisk: "cap" as const,
    windRisk: "none" as const,
    uvi: 0,
    aemetActive: true,
    weatherMain: "Rain",
  };

  assert.equal(getWorkWindow(input), "limited");
  assert.equal(
    getWorkWindow({
      ...input,
      weatherMain: "Clear",
      weatherContext: getWeatherContext({ weatherMain: "Rain" }),
    }),
    "limited"
  );
  assert.equal(
    getWorkWindow({
      ...input,
      weatherContext: getWeatherContext({ weatherMain: "Clear" }),
    }),
    "caution"
  );
});

test("workWindow stormy source is wired without adding storm severity", () => {
  const input = {
    heatRisk: getHeatRisk(24, "rest"),
    heatIndex: 24,
    coldRisk: "cap" as const,
    windRisk: "none" as const,
    uvi: 0,
    weatherMain: "Thunderstorm",
  };

  assert.equal(getWorkWindow(input), "caution");
  assert.equal(
    getWorkWindow({
      ...input,
      weatherMain: "Clear",
      weatherContext: getWeatherContext({ weatherMain: "Thunderstorm" }),
    }),
    "caution"
  );
  assert.equal(
    getWorkWindow({
      ...input,
      weatherContext: getWeatherContext({ weatherMain: "Clear" }),
    }),
    "optimal"
  );
});

test("weather context centralizes observed rain and storm interpretation", () => {
  assert.deepEqual(
    {
      rain: getWeatherContext({ weatherMain: "Rain" }).rainy,
      drizzle: getWeatherContext({ weatherMain: "Drizzle" }).rainy,
      thunderstormRainy: getWeatherContext({ weatherMain: "Thunderstorm" }).rainy,
      thunderstormStormy: getWeatherContext({ weatherMain: "Thunderstorm" }).stormy,
      clearRainy: getWeatherContext({ weatherMain: "Clear" }).rainy,
    },
    {
      rain: true,
      drizzle: true,
      thunderstormRainy: true,
      thunderstormStormy: true,
      clearRainy: false,
    }
  );

  assert.equal(getWeatherContext({ weatherMain: "Rain" }).slipperySurface, true);
});

test("weather context interprets observed OpenWeather phenomena", () => {
  const snow = getWeatherContext({
    weatherMain: "Snow",
    weatherCode: 601,
    effectiveTemp: -2,
  });
  assert.equal(snow.snowy, true);
  assert.equal(snow.icySurface, true);
  assert.equal(snow.slipperySurface, false);

  assert.equal(getWeatherContext({ weatherCode: 741 }).foggy, true);
  assert.equal(getWeatherContext({ weatherCode: 906 }).hail, true);
  assert.equal(getWeatherContext({ weatherCode: 731 }).dusty, true);
  assert.equal(getWeatherContext({ weatherCode: 761 }).dusty, true);
  assert.equal(getWeatherContext({ weatherCode: 711 }).smoky, true);
});

test("weather context only infers ice with compatible precipitation and temperature", () => {
  assert.equal(
    getWeatherContext({
      weatherMain: "Rain",
      weatherCode: 500,
      effectiveTemp: -0.5,
    }).icySurface,
    true
  );
  assert.equal(
    getWeatherContext({
      weatherMain: "Rain",
      weatherCode: 500,
      effectiveTemp: 4,
    }).icySurface,
    false
  );
  assert.equal(
    getWeatherContext({
      weatherMain: "Clear",
      weatherCode: 800,
      effectiveTemp: -2,
    }).icySurface,
    false
  );
});

test("weather context detects humid warm conditions without treating cool humidity as risk context", () => {
  assert.equal(
    getWeatherContext({ humidity: 70, effectiveTemp: 24 }).humid,
    true
  );
  assert.equal(
    getWeatherContext({ humidity: 84, effectiveTemp: 22.5 }).humid,
    false
  );
  assert.equal(
    getWeatherContext({ humidity: 69.9, effectiveTemp: 28 }).humid,
    false
  );
});

test("weather context keeps cloudiness thresholds explicit for future migrations", () => {
  assert.equal(
    getWeatherContext({
      cloudiness: CONTEXT_VERY_CLOUDY_THRESHOLD,
    }).veryCloudy,
    true
  );
  assert.equal(
    getWeatherContext({
      cloudiness: UV_BLOCKING_CLOUDINESS_THRESHOLD - 1,
    }).uvBlockingCloudy,
    false
  );
  assert.equal(
    getWeatherContext({
      cloudiness: UV_BLOCKING_CLOUDINESS_THRESHOLD,
    }).uvBlockingCloudy,
    true
  );
  assert.equal(
    getWeatherContext({
      cloudiness: CONTEXT_VERY_CLOUDY_THRESHOLD,
    }).suppressUv,
    true
  );
});

test("recommendations rainy source uses WeatherContext when available and legacy fallback otherwise", () => {
  assert.equal(getRecommendationRainy(true), true);
  assert.equal(getRecommendationRainy(false), false);
  assert.equal(
    getRecommendationRainy(false, getWeatherContext({ weatherMain: "Rain" })),
    true
  );
  assert.equal(
    getRecommendationRainy(true, getWeatherContext({ weatherMain: "Clear" })),
    false
  );
});

test("recommendations stormy source uses WeatherContext when available and legacy fallback otherwise", () => {
  assert.equal(getRecommendationStormy(true), true);
  assert.equal(getRecommendationStormy(false), false);
  assert.equal(
    getRecommendationStormy(false, getWeatherContext({ weatherMain: "Thunderstorm" })),
    true
  );
  assert.equal(
    getRecommendationStormy(true, getWeatherContext({ weatherMain: "Clear" })),
    false
  );
});

test("recommendations humid source uses WeatherContext when available and legacy fallback otherwise", () => {
  assert.equal(getRecommendationHumid(true), true);
  assert.equal(getRecommendationHumid(false), false);
  assert.equal(
    getRecommendationHumid(
      false,
      getWeatherContext({ humidity: 70, effectiveTemp: 24 })
    ),
    true
  );
  assert.equal(
    getRecommendationHumid(
      true,
      getWeatherContext({ humidity: 84, effectiveTemp: 22.5 })
    ),
    false
  );
});

test("recommendations veryCloudy source uses WeatherContext when available and legacy fallback otherwise", () => {
  assert.equal(getRecommendationVeryCloudy(true), true);
  assert.equal(getRecommendationVeryCloudy(false), false);
  assert.equal(
    getRecommendationVeryCloudy(
      false,
      getWeatherContext({ cloudiness: CONTEXT_VERY_CLOUDY_THRESHOLD })
    ),
    true
  );
  assert.equal(
    getRecommendationVeryCloudy(
      true,
      getWeatherContext({ cloudiness: CONTEXT_VERY_CLOUDY_THRESHOLD - 1 })
    ),
    false
  );
});

test("recommendations suppressUv source uses WeatherContext when available and legacy fallback otherwise", () => {
  assert.equal(getRecommendationSuppressUv(true), true);
  assert.equal(getRecommendationSuppressUv(false), false);
  assert.equal(
    getRecommendationSuppressUv(
      false,
      getWeatherContext({ weatherMain: "Rain" })
    ),
    true
  );
  assert.equal(
    getRecommendationSuppressUv(
      true,
      getWeatherContext({ weatherMain: "Clear", cloudiness: 0 })
    ),
    false
  );
});

test("recommendations slipperySurface source uses WeatherContext when available and legacy fallback otherwise", () => {
  assert.equal(getRecommendationSlipperySurface(true), true);
  assert.equal(getRecommendationSlipperySurface(false), false);
  assert.equal(
    getRecommendationSlipperySurface(
      false,
      getWeatherContext({ weatherMain: "Rain" })
    ),
    true
  );
  assert.equal(
    getRecommendationSlipperySurface(
      true,
      getWeatherContext({ weatherMain: "Clear" })
    ),
    false
  );
});

test("workWindow keeps direct heat-index rules even when engine heat factor is lower", () => {
  const input = {
    heatRisk: { class: "safe", isHigh: false, isExtreme: false } as const,
    heatIndex: 41,
    coldRisk: "cap" as const,
    windRisk: "none" as const,
    uvi: 0,
  };
  const engineRisk = evaluateRiskScore({
    heatIndex: 24,
    coldEffectiveTemp: input.heatIndex,
    windKmh: 0,
    uvi: input.uvi,
  });

  assert.equal(getWorkWindow({ ...input, engineRisk }), "avoid");
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

test("recommendation cold key maps current cold risk labels without changing visible buckets", () => {
  const cases: Array<[ColdRisk, string | null]> = [
    ["cap", null],
    ["lleu", "cold_low"],
    ["moderat", "cold_mod"],
    ["alt", "cold_high"],
    ["molt alt", "cold_high"],
    ["extrem", "cold_ext"],
  ];

  for (const [coldRisk, expectedKey] of cases) {
    assert.equal(
      mapColdRiskToRecommendationKey(coldRisk),
      expectedKey,
      coldRisk
    );
  }
});

test("recommendation cold key uses coldRisk when available and falls back to effective temperature", () => {
  assert.equal(getRecommendationColdKey(undefined, -5), "cold_mod");
  assert.equal(getRecommendationColdKey(null, -15), "cold_high");
  assert.equal(getRecommendationColdKey("moderat", 8), "cold_mod");
  assert.equal(getRecommendationColdKey("cap", -5), null);
  assert.equal(getRecommendationColdKey("molt alt", -40), "cold_high");
  assert.equal(getRecommendationColdKey("extrem", 10), "cold_ext");
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

test("UV ozone detail text avoids redundant update wording and source in the summary", () => {
  assert.equal(
    formatOzoneMeasurement(326, "17:04", {
      ozoneMeasurement: "Mesura d’ozó",
    }),
    "Mesura d’ozó: 326 DU (17:04)"
  );

  const withoutTime = formatOzoneMeasurement(326, null, {
    ozoneMeasurement: "Mesura d’ozó",
  });
  assert.equal(withoutTime, "Mesura d’ozó: 326 DU");
  assert.doesNotMatch(withoutTime ?? "", /[·()]/);

  assert.equal(
    formatOzoneMeasurement(null, "17:04", {
      ozoneMeasurement: "Mesura d’ozó",
    }),
    null
  );

  const uvDetailPanelSource = readFileSync(
    new URL("../../src/components/UVDetailPanel.tsx", import.meta.url),
    "utf8"
  );
  assert.doesNotMatch(uvDetailPanelSource, /updated:\s*string|Actualitzat|Updated/);
  assert.doesNotMatch(uvDetailPanelSource, /font OpenUV|fuente OpenUV|OpenUV source/);
  assert.doesNotMatch(uvDetailPanelSource, /ozoneDataTime|Mesura de les|Measurement from/);
});

const diagnosticCopyLabels: DiagnosticsCopyLabels = {
  title: "ThermoSafe Diagnostics",
  version: "Version",
  platform: "Platform",
  browser: "Browser",
  language: "Language",
  displayMode: "Display Mode",
  localTime: "Local Time",
  online: "Online",
  notificationPermission: "Notification Permission",
  notificationsEnabled: "Notifications Enabled",
  pushEnabled: "Push Enabled",
  firebaseMessaging: "Firebase Messaging",
  fcmToken: "FCM Token",
  tokenLength: "Token Length",
  serviceWorker: "Service Worker",
  serviceWorkerOrigin: "Service Worker Origin",
  location: "Location",
  zone: "Zone",
  lastWeatherUpdate: "Last Weather Update",
  lastLocationUpdate: "Last Location Update",
  lastTokenSync: "Last Token Sync",
  notRegisteredLocally: "Not registered locally",
  relativeMinute: "{{count}} minute ago",
  relativeMinutes: "{{count}} minutes ago",
  relativeHour: "{{count}} hour ago",
  relativeHours: "{{count}} hours ago",
  relativeDay: "{{count}} day ago",
  relativeDays: "{{count}} days ago",
  overallStatus: "Overall Status",
  yes: "true",
  no: "false",
  unavailable: "Not available",
  ok: "OK",
  review: "Review",
  error: "Error",
  unknown: "Unknown",
  info: "Info",
};

function createOkDiagnosticsSnapshot(overrides: Parameters<typeof createDiagnosticsSnapshot>[1] = {}) {
  return createDiagnosticsSnapshot(
    {
      version: "1.0.10",
      language: "ca",
      notificationsEnabled: true,
      pushEnabled: true,
      alertSettings: [
        { key: "uv", enabled: true },
        { key: "wind", enabled: true },
        { key: "cold", enabled: true },
      ],
      location: {
        place: "Llucmajor",
        zone: "ES",
        lat: 39.512345,
        lon: 2.894567,
        lang: "ca",
        lastWeatherUpdate: "18:05",
      },
    },
    {
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/138.0.0.0 Safari/537.36",
      platform: "Win32",
      online: true,
      notificationSupported: true,
      notificationPermission: "granted",
      serviceWorkerSupported: true,
      pushManagerSupported: true,
      token: "token-with-safe-length-only",
      now: new Date("2026-07-19T18:05:00Z"),
      locationOrigin: "https://thermosafe.app",
      hostname: "thermosafe.app",
      ...overrides,
    }
  );
}

test("diagnostics long press opens only after delay and supports cancellation", () => {
  let opened = 0;
  let pending: (() => void) | null = null;

  const controller = createLongPressController(
    () => {
      opened += 1;
    },
    {
      delayMs: 1800,
      setTimeoutFn: (callback) => {
        pending = callback;
        return 1;
      },
      clearTimeoutFn: () => {
        pending = null;
      },
    }
  );

  controller.start();
  assert.equal(opened, 0);
  controller.cancel();
  pending?.();
  assert.equal(opened, 0);

  controller.start();
  pending?.();
  assert.equal(opened, 1);
  assert.equal(controller.isPending(), false);
});

test("diagnostics snapshot classifies permissions and overall status", () => {
  const snapshot = createDiagnosticsSnapshot(
    {
      version: "1.0.10",
      language: "ca",
      notificationsEnabled: true,
      pushEnabled: true,
      alertSettings: [
        { key: "uv", enabled: true },
        { key: "wind", enabled: false },
      ],
      location: {
        place: "Llucmajor",
        zone: "ES",
        lat: 39.512345,
        lon: 2.894567,
        lang: "ca",
        lastWeatherUpdate: "18:05",
      },
    },
    {
      userAgent:
        "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/126.0 Mobile Safari/537.36",
      platform: "Linux armv8l",
      online: true,
      notificationSupported: true,
      notificationPermission: "denied",
      serviceWorkerSupported: true,
      pushManagerSupported: true,
      token: null,
      now: new Date("2026-07-19T18:05:00Z"),
    }
  );

  const checks = getDiagnosticsChecks(snapshot);
  assert.equal(snapshot.platform, "Android");
  assert.equal(snapshot.browser, "Chrome 126");
  assert.equal(
    checks.find((check) => check.key === "notificationPermission")?.status,
    "error"
  );
  assert.equal(getOverallDiagnosticsStatus(checks), "error");
  assert.deepEqual(getDiagnosticsMessages(snapshot), [
    "permissionDenied",
    "missingToken",
  ]);
});

test("diagnostics does not treat normal browser mode as an issue", () => {
  const snapshot = createOkDiagnosticsSnapshot({
    displayModeStandalone: false,
    locationOrigin: "https://thermosafe.app",
    hostname: "thermosafe.app",
  });

  const checks = getDiagnosticsChecks(snapshot);
  const pwa = checks.find((check) => check.key === "pwa");

  assert.equal(snapshot.displayMode, "Browser");
  assert.equal(pwa?.status, "info");
  assert.equal(pwa?.detailKey, "runningInBrowser");
  assert.equal(getOverallDiagnosticsStatus(checks), "ok");
});

test("diagnostics does not treat localhost as an issue", () => {
  const snapshot = createOkDiagnosticsSnapshot({
    locationOrigin: "http://localhost:5173",
    hostname: "localhost",
  });

  const checks = getDiagnosticsChecks(snapshot);
  const pwa = checks.find((check) => check.key === "pwa");

  assert.equal(snapshot.isLocalhost, true);
  assert.equal(pwa?.status, "info");
  assert.equal(pwa?.detailKey, "localhostMode");
  assert.equal(getOverallDiagnosticsStatus(checks), "ok");
});

test("diagnostics marks installed PWA display modes as correct", () => {
  const standalone = createOkDiagnosticsSnapshot({ displayModeStandalone: true });
  const fullscreen = createOkDiagnosticsSnapshot({ displayModeFullscreen: true });
  const minimalUi = createOkDiagnosticsSnapshot({ displayModeMinimalUi: true });

  assert.equal(detectDisplayMode({ displayModeStandalone: true }), "Standalone");
  assert.equal(detectDisplayMode({ displayModeFullscreen: true }), "Fullscreen");
  assert.equal(detectDisplayMode({ displayModeMinimalUi: true }), "Minimal-ui");
  assert.equal(getDiagnosticsChecks(standalone).find((check) => check.key === "pwa")?.status, "ok");
  assert.equal(getDiagnosticsChecks(fullscreen).find((check) => check.key === "pwa")?.status, "ok");
  assert.equal(getDiagnosticsChecks(minimalUi).find((check) => check.key === "pwa")?.status, "ok");
});

test("diagnostics detects approximate browser versions", () => {
  assert.equal(
    detectBrowser({
      userAgent:
        "Mozilla/5.0 AppleWebKit/537.36 Chrome/138.0.0.0 Safari/537.36",
    }),
    "Chrome 138"
  );
  assert.equal(
    detectBrowser({
      userAgent:
        "Mozilla/5.0 Gecko/20100101 Firefox/141.0",
    }),
    "Firefox 141"
  );
  assert.equal(
    detectBrowser({
      userAgent:
        "Mozilla/5.0 Version/18.0 Mobile/15E148 Safari/604.1",
    }),
    "Safari 18"
  );
});

test("diagnostics overall ok explains local scope and backend checks", () => {
  const snapshot = createOkDiagnosticsSnapshot();
  const checks = getDiagnosticsChecks(snapshot);

  assert.equal(getOverallDiagnosticsStatus(checks), "ok");
  assert.deepEqual(getDiagnosticsMessages(snapshot), ["localOk", "backendHint"]);
});

test("diagnostics formats token sync time in minutes hours and days", () => {
  const now = new Date("2026-07-19T12:00:00Z");

  assert.equal(
    formatTokenSyncStatus(
      getTokenSyncStatus(true, "2026-07-19T11:48:00Z", now),
      diagnosticCopyLabels
    ),
    "12 minutes ago"
  );
  assert.equal(
    formatTokenSyncStatus(
      getTokenSyncStatus(true, "2026-07-19T09:00:00Z", now),
      diagnosticCopyLabels
    ),
    "3 hours ago"
  );
  assert.equal(
    formatTokenSyncStatus(
      getTokenSyncStatus(true, "2026-07-17T12:00:00Z", now),
      diagnosticCopyLabels
    ),
    "2 days ago"
  );
});

test("diagnostics formats token sync absolute date when relative time is not computable", () => {
  const now = new Date("2026-07-19T12:00:00Z");
  const status = getTokenSyncStatus(true, "2026-07-20T09:42:00", now);

  assert.equal(status.kind, "absolute");
  assert.match(formatTokenSyncStatus(status, diagnosticCopyLabels), /20\/07\/2026/);
  assert.match(formatTokenSyncStatus(status, diagnosticCopyLabels), /09:42/);
});

test("diagnostics distinguishes missing local token sync record from missing token", () => {
  assert.equal(
    formatTokenSyncStatus(getTokenSyncStatus(true, null), diagnosticCopyLabels),
    "Not registered locally"
  );
  assert.equal(
    formatTokenSyncStatus(getTokenSyncStatus(false, "2026-07-19T09:42:00Z"), diagnosticCopyLabels),
    "Not available"
  );
});

test("diagnostics uses a specific message when location was not updated this session", () => {
  const modalSource = readFileSync(
    new URL("../../src/components/NotificationDiagnosticsModal.tsx", import.meta.url),
    "utf8"
  );

  assert.match(modalSource, /lastLocationUpdate[\s\S]*locationNotUpdatedThisSession/);
});

test("diagnostics location update fallback is translated in all supported languages", () => {
  const locales = ["ca", "es", "en", "eu", "gl"];

  for (const locale of locales) {
    const messages = JSON.parse(
      readFileSync(
        new URL(`../../src/i18n/locales/${locale}.json`, import.meta.url),
        "utf8"
      )
    ) as { diagnostics?: { locationNotUpdatedThisSession?: string } };

    assert.equal(
      typeof messages.diagnostics?.locationNotUpdatedThisSession,
      "string",
      `${locale} should define diagnostics.locationNotUpdatedThisSession`
    );
    assert.ok(
      messages.diagnostics?.locationNotUpdatedThisSession?.length,
      `${locale} location fallback should not be empty`
    );
  }
});

test("location audit logging stays development-only and records geocoder fields", () => {
  const source = readFileSync(
    new URL("../../src/utils/getLocationNameFromCoords.ts", import.meta.url),
    "utf8"
  );

  assert.match(source, /if \(!import\.meta\.env\.DEV\) return;/);
  assert.match(source, /\[Location Audit\]/);
  assert.match(source, /suburb/);
  assert.match(source, /neighbourhood/);
  assert.match(source, /village/);
  assert.match(source, /municipality/);
  assert.match(source, /finalName/);
});

test("diagnostics treats invalid local token sync dates as not registered", () => {
  assert.equal(
    formatTokenSyncStatus(getTokenSyncStatus(true, "not-a-date"), diagnosticCopyLabels),
    "Not registered locally"
  );
});

test("token sync metadata stores the local timestamp only when called", () => {
  const values = new Map<string, string>();
  const storage = {
    setItem(key: string, value: string) {
      values.set(key, value);
    },
  };

  assert.equal(values.has(TOKEN_LAST_SYNCED_LOCAL_KEY), false);
  saveTokenLastSyncedLocally(
    storage,
    new Date("2026-07-20T09:42:00.000Z")
  );

  assert.equal(
    values.get(TOKEN_LAST_SYNCED_LOCAL_KEY),
    "2026-07-20T09:42:00.000Z"
  );
});

test("token sync metadata builds an additive tokenLastSyncedAt payload", () => {
  const sentinel = { kind: "serverTimestamp" };

  assert.deepEqual(buildTokenLastSyncedPayload(sentinel), {
    tokenLastSyncedAt: sentinel,
  });
});

test("token sync metadata can omit the additive timestamp field", () => {
  assert.deepEqual(
    omitTokenLastSyncedAt({
      token: "abc",
      updatedAt: 123,
      tokenLastSyncedAt: { kind: "serverTimestamp" },
    }),
    {
      token: "abc",
      updatedAt: 123,
    }
  );
});

test("token sync metadata detects Firestore permission-denied errors", () => {
  assert.equal(isFirestorePermissionDenied({ code: "permission-denied" }), true);
  assert.equal(
    isFirestorePermissionDenied(
      new Error("FirebaseError: Missing or insufficient permissions.")
    ),
    true
  );
  assert.equal(isFirestorePermissionDenied(new Error("network unavailable")), false);
});

test("token sync fallback keeps the subscription write when only timestamp metadata is denied", async () => {
  const writes: Array<Record<string, unknown>> = [];
  let localSyncSaved = false;

  const result = await writeWithOptionalTokenSyncFallback(
    {
      token: "abc",
      updatedAt: 123,
      tokenLastSyncedAt: { kind: "serverTimestamp" },
    },
    async (payload) => {
      writes.push(payload);
      if (writes.length === 1) {
        const error = new Error("Missing or insufficient permissions.");
        (error as Error & { code?: string }).code = "permission-denied";
        throw error;
      }
    },
    () => {
      localSyncSaved = true;
    }
  );

  assert.equal(result.tokenSyncWritten, false);
  assert.equal(localSyncSaved, false);
  assert.equal(writes.length, 2);
  assert.equal("tokenLastSyncedAt" in writes[0], true);
  assert.equal("tokenLastSyncedAt" in writes[1], false);
});

test("token sync fallback fails when the critical subscription write fails", async () => {
  await assert.rejects(
    () =>
      writeWithOptionalTokenSyncFallback(
        {
          token: "abc",
          updatedAt: 123,
        },
        async () => {
          throw new Error("Firestore unavailable");
        },
        () => {
          throw new Error("should not save local sync");
        }
      ),
    /Firestore unavailable/
  );
});

test("chunk load recovery detects dynamic import chunk failures", () => {
  assert.equal(
    isChunkLoadError(
      new TypeError(
        "Failed to fetch dynamically imported module: https://thermosafe.app/assets/subscribe-old.js"
      )
    ),
    true
  );
  assert.equal(
    isChunkLoadError(new Error("FirebaseError: Missing or insufficient permissions")),
    false
  );
});

test("chunk load recovery reloads once inside the guard window", () => {
  const values = new Map<string, string>();
  const storage = {
    getItem(key: string) {
      return values.get(key) ?? null;
    },
    setItem(key: string, value: string) {
      values.set(key, value);
    },
    removeItem(key: string) {
      values.delete(key);
    },
  };
  const error = new Error("ChunkLoadError: Loading chunk subscribe failed");

  assert.equal(getChunkLoadRecoveryDecision(error, storage, 1000), "reload");
  assert.equal(values.get(CHUNK_RELOAD_STORAGE_KEY), "1000");
  assert.equal(getChunkLoadRecoveryDecision(error, storage, 1200), "already_attempted");
  assert.equal(
    getChunkLoadRecoveryDecision(new Error("ordinary error"), storage, 1300),
    "not_chunk_error"
  );
});

test("version check detects a newer published build without polling aggressively", async () => {
  assert.equal(VERSION_CHECK_INTERVAL_MS, 30 * 60 * 1000);
  assert.equal(isNewVersionAvailable("build-a", { buildId: "build-a" }), false);
  assert.equal(isNewVersionAvailable("build-a", { buildId: "build-b" }), true);
  assert.equal(isNewVersionAvailable("", { buildId: "build-b" }), false);
  assert.equal(isNewVersionAvailable("build-a", null), false);

  assert.equal(buildVersionUrl(12345), "/version.json?t=12345");

  const calls: Array<{ input: RequestInfo | URL; init?: RequestInit }> = [];
  const version = await fetchPublishedVersion(
    async (input, init) => {
      calls.push({ input, init });
      return {
        ok: true,
        async json() {
          return { version: "1.0.10", buildId: "build-b" };
        },
      } as Response;
    },
    () => 12345
  );

  assert.deepEqual(version, { version: "1.0.10", buildId: "build-b" });
  assert.equal(calls[0]?.input, "/version.json?t=12345");
  assert.equal(calls[0]?.init?.cache, "no-store");
});

test("version update banner uses translated accessible copy", () => {
  const source = readFileSync(
    new URL("../../src/components/UpdateBanner.tsx", import.meta.url),
    "utf8"
  );

  assert.match(source, /role="status"/);
  assert.match(source, /aria-live="polite"/);
  assert.match(source, /update\.available/);
  assert.match(source, /update\.description/);
  assert.match(source, /update\.reload/);
});

test("version detection uses the Vite build id injected through import meta env", () => {
  const appSource = readFileSync(
    new URL("../../src/App.tsx", import.meta.url),
    "utf8"
  );
  const viteConfigSource = readFileSync(
    new URL("../../vite.config.ts", import.meta.url),
    "utf8"
  );

  assert.match(appSource, /import\.meta\.env\.VITE_THERMOSAFE_BUILD_ID/);
  assert.doesNotMatch(appSource, /__THERMOSAFE_BUILD_ID__/);
  assert.match(
    viteConfigSource,
    /"import\.meta\.env\.VITE_THERMOSAFE_BUILD_ID"/
  );
  assert.match(appSource, /const updateAvailable = isNewVersionAvailable/);
  assert.match(appSource, /setVersionUpdateAvailable\(updateAvailable\)/);
});

test("GPS and suggestion weather fetches guard null responses before reading timezone", () => {
  const appSource = readFileSync(
    new URL("../../src/App.tsx", import.meta.url),
    "utf8"
  );

  assert.match(appSource, /if \(!d\) \{\s*if \(!silent\) setErr\(t\("errorGPS"\)\);\s*return;\s*\}\s*setData\(d\);/);
  assert.match(appSource, /const data = await getWeatherByCoords\(s\.lat, s\.lon, lang\);\s*if \(!data\) \{\s*setErr\(t\("errorCity"\)\);\s*return;\s*\}/);
});

test("version reload prepares the service worker before reloading", async () => {
  let updateCalled = false;
  let reloaded = false;
  let listener: (() => void) | null = null;
  const waitingMessages: unknown[] = [];

  const serviceWorker = {
    controller: {},
    addEventListener(type: string, callback: () => void) {
      if (type === "controllerchange") listener = callback;
    },
    removeEventListener(type: string, callback: () => void) {
      if (type === "controllerchange" && listener === callback) listener = null;
    },
    async getRegistrations() {
      return [
        {
          async update() {
            updateCalled = true;
            queueMicrotask(() => listener?.());
          },
          waiting: {
            postMessage(message: unknown) {
              waitingMessages.push(message);
            },
          },
        },
      ];
    },
  };

  await reloadThermoSafeVersion({
    serviceWorker: serviceWorker as unknown as ServiceWorkerContainer,
    reload: () => {
      reloaded = true;
    },
    timeoutMs: 50,
  });

  assert.equal(updateCalled, true);
  assert.deepEqual(waitingMessages, [{ type: "SKIP_WAITING" }]);
  assert.equal(reloaded, true);
});

test("version reload still reloads when service worker update is unavailable", async () => {
  let reloaded = false;

  await reloadThermoSafeVersion({
    serviceWorker: null,
    reload: () => {
      reloaded = true;
    },
    timeoutMs: 1,
  });

  assert.equal(reloaded, true);
});

test("service worker preparation tolerates update failures", async () => {
  let listenerRemoved = false;
  const serviceWorker = {
    controller: {},
    addEventListener() {},
    removeEventListener() {
      listenerRemoved = true;
    },
    async getRegistrations() {
      return [
        {
          async update() {
            throw new Error("update failed");
          },
        },
      ];
    },
  };

  await prepareServiceWorkerForVersionReload(
    serviceWorker as unknown as ServiceWorkerContainer,
    1
  );

  assert.equal(listenerRemoved, true);
});

test("version reload unregisters only the app shell service worker", async () => {
  const unregistered: string[] = [];
  const serviceWorker = {
    controller: null,
    addEventListener() {},
    removeEventListener() {},
    async getRegistrations() {
      return [
        {
          active: { scriptURL: "http://localhost:4174/sw.js" },
          async update() {},
          async unregister() {
            unregistered.push("app");
            return true;
          },
        },
        {
          active: {
            scriptURL: "http://localhost:4174/firebase-messaging-sw.js",
          },
          async update() {},
          async unregister() {
            unregistered.push("firebase");
            return true;
          },
        },
      ];
    },
  };

  await unregisterAppShellServiceWorkers(
    serviceWorker as unknown as ServiceWorkerContainer
  );

  assert.deepEqual(unregistered, ["app"]);
});

test("diagnostics copy text does not expose sensitive token data", () => {
  const fullToken = "fcm_secret_token_value_that_must_never_be_copied_1234567890";
  const snapshot = createDiagnosticsSnapshot(
    {
      version: "1.0.10",
      language: "ca",
      notificationsEnabled: true,
      pushEnabled: true,
      alertSettings: [{ key: "uv", enabled: true }],
      location: {
        place: "Llucmajor",
        zone: "ES",
        lat: 39.512345,
        lon: 2.894567,
        lang: "ca",
        lastWeatherUpdate: "18:05",
      },
    },
    {
      userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Safari/605.1.15",
      platform: "iPhone",
      online: true,
      notificationSupported: true,
      notificationPermission: "granted",
      serviceWorkerSupported: true,
      pushManagerSupported: true,
      token: fullToken,
      now: new Date("2026-07-19T18:05:00Z"),
    }
  );

  const text = buildDiagnosticsCopyText(snapshot, diagnosticCopyLabels);

  assert.match(text, /FCM Token: true/);
  assert.match(text, new RegExp(`Token Length: ${fullToken.length}`));
  assert.doesNotMatch(text, new RegExp(fullToken));
  assert.doesNotMatch(text, /39\.512345|2\.894567/);
  assert.doesNotMatch(text, /AIza|api[_-]?key/i);
});

test("diagnostics copy text includes service worker origin without sensitive data", () => {
  const snapshot = {
    ...createOkDiagnosticsSnapshot({
      locationOrigin: "https://thermosafe.app",
    }),
    serviceWorker: {
      supported: true,
      registered: true,
      controllerActive: true,
      state: "active" as const,
      origin: "https://thermosafe.app",
    },
  };

  const text = buildDiagnosticsCopyText(snapshot, diagnosticCopyLabels);

  assert.match(text, /Service Worker Origin: https:\/\/thermosafe\.app/);
  assert.doesNotMatch(text, /fcm_secret|AIza|api[_-]?key/i);
});

test("risk score engine mirrors basic heat risk cases", () => {
  assert.deepEqual(
    evaluateRiskScore({ heatIndex: 26.9 }).factors.find((f) => f.factor === "heat"),
    {
      factor: "heat",
      active: false,
      severity: 0,
      level: "safe",
      value: 26.9,
      labelKey: "heat_safe",
      reasonKey: "riskScore.heat.safe",
    }
  );

  const moderate = evaluateRiskScore({ heatIndex: 35 });
  assert.equal(moderate.primary?.factor, "heat");
  assert.equal(moderate.primary?.severity, 2);
  assert.equal(moderate.primary?.level, "moderate");

  const high = evaluateRiskScore({ heatIndex: 45 });
  assert.equal(high.primary?.factor, "heat");
  assert.equal(high.primary?.severity, 3);
  assert.equal(high.primary?.level, "high");
});

test("risk score engine mirrors UV bands", () => {
  const moderate = evaluateRiskScore({ uvi: 3 });
  assert.equal(moderate.primary?.factor, "uv");
  assert.equal(moderate.primary?.severity, 1);

  const high = evaluateRiskScore({ uvi: 6 });
  assert.equal(high.primary?.factor, "uv");
  assert.equal(high.primary?.severity, 2);

  const veryHigh = evaluateRiskScore({ uvi: 8 });
  assert.equal(veryHigh.primary?.factor, "uv");
  assert.equal(veryHigh.primary?.severity, 3);
  assert.equal(veryHigh.primary?.labelKey, "uv_very_high");
});

test("risk score engine mirrors wind and cold factors", () => {
  const wind = evaluateRiskScore({ windKmh: 25 });
  assert.equal(wind.primary?.factor, "wind");
  assert.equal(wind.primary?.severity, 2);
  assert.equal(wind.primary?.level, "moderate");

  const cold = evaluateRiskScore({ coldEffectiveTemp: -5, windKmh: 20 });
  assert.equal(cold.primary?.factor, "cold");
  assert.equal(cold.primary?.severity, 2);
  assert.equal(cold.primary?.level, "moderat");
});

test("risk score engine classifies tropical and torrid night heat levels", () => {
  const cases = [
    { isNightAtLocation: false, nightReferenceTemperature: 28, expected: "none" },
    { isNightAtLocation: true, nightReferenceTemperature: 19.9, expected: "none" },
    { isNightAtLocation: true, nightReferenceTemperature: 20, expected: "tropical" },
    { isNightAtLocation: true, nightReferenceTemperature: 24.9, expected: "tropical" },
    { isNightAtLocation: true, nightReferenceTemperature: 25, expected: "torrid" },
    { isNightAtLocation: true, nightReferenceTemperature: 28, expected: "torrid" },
  ] as const;

  for (const scenario of cases) {
    const result = evaluateRiskScore({
      heatIndex: 22,
      coldEffectiveTemp: 22,
      uvi: 0,
      windKmh: 0,
      isNightAtLocation: scenario.isNightAtLocation,
      nightReferenceTemperature: scenario.nightReferenceTemperature,
    });

    assert.equal(result.nightHeatLevel, scenario.expected);
  }
});

test("night heat level is semantic and does not alter daytime heat severity", () => {
  const base = evaluateRiskScore({
    heatIndex: 35,
    coldEffectiveTemp: 35,
    uvi: 0,
    windKmh: 0,
  });
  const tropical = evaluateRiskScore({
    heatIndex: 35,
    coldEffectiveTemp: 35,
    uvi: 0,
    windKmh: 0,
    isNightAtLocation: true,
    nightReferenceTemperature: 24.9,
  });
  const torrid = evaluateRiskScore({
    heatIndex: 35,
    coldEffectiveTemp: 35,
    uvi: 0,
    windKmh: 0,
    isNightAtLocation: true,
    nightReferenceTemperature: 25,
  });

  assert.equal(base.primary?.factor, tropical.primary?.factor);
  assert.equal(base.primary?.severity, tropical.primary?.severity);
  assert.equal(base.primary?.factor, torrid.primary?.factor);
  assert.equal(base.primary?.severity, torrid.primary?.severity);
  assert.equal(tropical.nightHeatLevel, "tropical");
  assert.equal(torrid.nightHeatLevel, "torrid");
});

test("risk score engine exposes active factors in combined heat UV wind conditions", () => {
  const result = evaluateRiskScore({
    heatIndex: 35,
    uvi: 8.4,
    windKmh: 33,
    coldEffectiveTemp: 30,
  });

  assert.equal(result.maxSeverity, 3);
  assert.equal(result.primary?.factor, "uv");
  assert.deepEqual(
    result.activeFactors.map((factor) => [factor.factor, factor.severity]),
    [
      ["heat", 2],
      ["wind", 2],
      ["uv", 3],
    ]
  );
});

test("recommendation factor ordering keeps current order without risk factors", () => {
  const items: RecommendationItem[] = [
    { factor: "wind", icon: "🌬️", label: "Vent", text: "Vent moderat." },
    { factor: "heat", icon: "🌡️", label: "Calor", text: "Calor moderada." },
    { factor: "uv", icon: "☀️", label: "Radiació UV", text: "UV molt alt." },
  ];

  assert.deepEqual(
    sortItemsByRiskFactors(items).map((item) => item.factor),
    ["wind", "heat", "uv"]
  );
});

test("recommendation factor ordering follows RiskScoreEngine active factors", () => {
  const riskFactors = evaluateRiskScore({
    heatIndex: 35,
    uvi: 8,
    windKmh: 25,
    coldEffectiveTemp: 30,
  }).activeFactorsSorted;
  const items: RecommendationItem[] = [
    { factor: "wind", icon: "🌬️", label: "Vent", text: "Vent moderat." },
    { factor: "heat", icon: "🌡️", label: "Calor", text: "Calor moderada." },
    { factor: "uv", icon: "☀️", label: "Radiació UV", text: "UV molt alt." },
  ];

  assert.deepEqual(
    sortItemsByRiskFactors(items, riskFactors).map((item) => item.factor),
    ["uv", "heat", "wind"]
  );
});

test("recommendation factor ordering keeps unknown factors stable", () => {
  const riskFactors = evaluateRiskScore({
    heatIndex: 35,
    windKmh: 25,
    coldEffectiveTemp: 30,
  }).activeFactorsSorted;
  const items: RecommendationItem[] = [
    { factor: "humidity", icon: "💧", label: "Humitat", text: "Humitat alta." },
    { factor: "rain", icon: "🌧️", label: "Pluja", text: "Pluja possible." },
    { factor: "wind", icon: "🌬️", label: "Vent", text: "Vent moderat." },
    { factor: "heat", icon: "🌡️", label: "Calor", text: "Calor moderada." },
  ];

  assert.deepEqual(
    sortItemsByRiskFactors(items, riskFactors).map((item) => item.factor),
    ["heat", "wind", "humidity", "rain"]
  );
});

test("single recommendation factors keep their visible subtitle", () => {
  const cases: RecommendationItem[] = [
    {
      factor: "thermalComfort",
      icon: "🌡️",
      label: "Confort tèrmic",
      text: "El confort tèrmic és favorable.",
    },
    {
      factor: "heat",
      icon: "🌡️",
      label: "Calor",
      text: "Programa pauses freqüents.",
    },
    {
      factor: "uv",
      icon: "☀️",
      label: "Radiació UV",
      text: "Utilitza protecció solar.",
    },
    {
      factor: "cold",
      icon: "🥶",
      label: "Fred",
      text: "Protegeix mans, peus i vies respiratòries.",
    },
    {
      factor: "night",
      icon: "🌙",
      label: "Nit",
      text: "Condicions nocturnes agradables i estables.",
    },
    {
      factor: "night",
      icon: "🌙",
      label: "Nit tropical",
      text: "Ventila els espais abans d’anar a dormir.",
    },
    {
      factor: "night",
      icon: "🌙",
      label: "Nit tòrrida",
      text: "Refresca i ventila els espais.",
    },
  ];

  for (const item of cases) {
    const [rendered] = factorItems(undefined, item);

    assert.equal(rendered.icon, item.icon);
    assert.equal(rendered.label, item.label);
    assert.equal(rendered.text, item.text);
  }
});

test("multiple recommendation factors keep every visible subtitle", () => {
  const rendered = factorItems(
    undefined,
    {
      factor: "uv",
      icon: "☀️",
      label: "Radiació UV",
      text: "Utilitza protecció solar.",
    },
    {
      factor: "heat",
      icon: "🌡️",
      label: "Calor",
      text: "Programa pauses freqüents.",
    },
    {
      factor: "humidity",
      icon: "💧",
      label: "Humitat",
      text: "Adapta el ritme de l’activitat.",
    }
  );

  assert.deepEqual(
    rendered.map((item) => [item.icon, item.label]),
    [
      ["☀️", "Radiació UV"],
      ["🌡️", "Calor"],
      ["💧", "Humitat"],
    ]
  );
});

test("recommendation factor state uses RiskScoreEngine factors when available", () => {
  assert.deepEqual(getRecommendationFactorState(), {
    hasEngineFactors: false,
    heat: null,
    uv: null,
    wind: null,
  });

  const heatUvWind = evaluateRiskScore({
    heatIndex: 35,
    coldEffectiveTemp: 35,
    uvi: 8,
    windKmh: 33,
  }).activeFactorsSorted;

  assert.deepEqual(getRecommendationFactorState(heatUvWind), {
    hasEngineFactors: true,
    heat: true,
    uv: true,
    wind: true,
  });

  const noRisk = evaluateRiskScore({
    heatIndex: 22,
    coldEffectiveTemp: 22,
    uvi: 1,
    windKmh: 8,
  }).activeFactorsSorted;

  assert.deepEqual(getRecommendationFactorState(noRisk), {
    hasEngineFactors: true,
    heat: false,
    uv: false,
    wind: false,
  });
});

test("recommendation factor state covers heat uv wind combinations from RiskScoreEngine", () => {
  const cases: Array<{
    name: string;
    input: RiskEngineInput;
    expected: Pick<
      ReturnType<typeof getRecommendationFactorState>,
      "heat" | "uv" | "wind"
    >;
  }> = [
    {
      name: "heat",
      input: { heatIndex: 35, coldEffectiveTemp: 35, uvi: 1, windKmh: 8 },
      expected: { heat: true, uv: false, wind: false },
    },
    {
      name: "uv",
      input: { heatIndex: 24, coldEffectiveTemp: 24, uvi: 8, windKmh: 8 },
      expected: { heat: false, uv: true, wind: false },
    },
    {
      name: "wind",
      input: { heatIndex: 24, coldEffectiveTemp: 24, uvi: 1, windKmh: 33 },
      expected: { heat: false, uv: false, wind: true },
    },
    {
      name: "heat + wind",
      input: { heatIndex: 35, coldEffectiveTemp: 35, uvi: 1, windKmh: 33 },
      expected: { heat: true, uv: false, wind: true },
    },
    {
      name: "heat + uv",
      input: { heatIndex: 35, coldEffectiveTemp: 35, uvi: 8, windKmh: 8 },
      expected: { heat: true, uv: true, wind: false },
    },
    {
      name: "uv + wind",
      input: { heatIndex: 24, coldEffectiveTemp: 24, uvi: 8, windKmh: 33 },
      expected: { heat: false, uv: true, wind: true },
    },
    {
      name: "heat + uv + wind",
      input: { heatIndex: 35, coldEffectiveTemp: 35, uvi: 8, windKmh: 33 },
      expected: { heat: true, uv: true, wind: true },
    },
  ];

  for (const scenario of cases) {
    const state = getRecommendationFactorState(
      evaluateRiskScore(scenario.input).activeFactorsSorted
    );

    assert.equal(state.heat, scenario.expected.heat, scenario.name);
    assert.equal(state.uv, scenario.expected.uv, scenario.name);
    assert.equal(state.wind, scenario.expected.wind, scenario.name);
  }
});

test("risk score engine sorted active factors omit inactive risks", () => {
  const result = evaluateRiskScore({
    heatIndex: 24,
    coldEffectiveTemp: 24,
    windKmh: 8,
    uvi: 8,
  });

  assert.deepEqual(
    result.activeFactorsSorted.map((factor) => factor.factor),
    ["uv"]
  );
});

test("risk score engine sorted active factors prioritize severity before factor order", () => {
  const result = evaluateRiskScore({
    heatIndex: 35,
    uvi: 8.4,
    windKmh: 33,
    coldEffectiveTemp: 30,
  });

  assert.deepEqual(
    result.activeFactorsSorted.map((factor) => [factor.factor, factor.severity]),
    [
      ["uv", 3],
      ["heat", 2],
      ["wind", 2],
    ]
  );
  assert.equal(result.primary, result.activeFactorsSorted[0]);
});

test("risk score engine sorted active factors use stable tie order", () => {
  const result = evaluateRiskScore({
    heatIndex: 35,
    coldEffectiveTemp: -5,
    uvi: 6,
    windKmh: 25,
  });

  assert.deepEqual(
    result.activeFactorsSorted.map((factor) => factor.factor),
    ["heat", "cold", "uv", "wind"]
  );
  assert.equal(result.primary?.factor, "heat");
});

test("risk score engine primary candidate matches current primary risk picker", () => {
  const scenarios: Array<{
    name: string;
    input: RiskEngineInput;
    expectedEngineKind: "heat" | "cold" | "wind" | "uv" | "none";
    expectedCurrentKind?: "heat" | "cold" | "wind" | "uv" | "none";
    expectedSeverity: number;
  }> = [
    {
      name: "sense risc",
      input: { heatIndex: 24, coldEffectiveTemp: 24, windKmh: 8, uvi: 2 },
      expectedEngineKind: "none",
      expectedSeverity: 0,
    },
    {
      name: "calor moderada",
      input: { heatIndex: 35 },
      expectedEngineKind: "heat",
      expectedSeverity: 2,
    },
    {
      name: "calor alta",
      input: { heatIndex: 45 },
      expectedEngineKind: "heat",
      expectedSeverity: 3,
    },
    {
      name: "UV moderat",
      input: { uvi: 3 },
      expectedEngineKind: "uv",
      expectedSeverity: 1,
    },
    {
      name: "UV alt",
      input: { uvi: 6 },
      expectedEngineKind: "uv",
      expectedSeverity: 2,
    },
    {
      name: "UV molt alt",
      input: { uvi: 8 },
      expectedEngineKind: "uv",
      expectedSeverity: 3,
    },
    {
      name: "vent moderat",
      input: { windKmh: 25 },
      expectedEngineKind: "wind",
      expectedSeverity: 2,
    },
    {
      name: "fred moderat",
      input: { coldEffectiveTemp: -5, windKmh: 20 },
      expectedEngineKind: "cold",
      expectedSeverity: 2,
    },
    {
      name: "calor + UV amb empat de severitat",
      input: { heatIndex: 35, uvi: 6 },
      expectedEngineKind: "heat",
      expectedSeverity: 2,
    },
    {
      name: "UV + vent moderat amb empat de severitat",
      input: { uvi: 6, windKmh: 25 },
      expectedEngineKind: "uv",
      expectedSeverity: 2,
    },
    {
      name: "calor + UV + vent",
      input: { heatIndex: 35, uvi: 8.4, windKmh: 33, coldEffectiveTemp: 30 },
      expectedEngineKind: "uv",
      expectedSeverity: 3,
    },
  ];

  for (const scenario of scenarios) {
    const { engine, current, engineKind } = compareRiskEngineWithPrimaryPicker(
      scenario.input
    );

    assert.equal(engineKind, scenario.expectedEngineKind, scenario.name);
    assert.equal(
      current.kind,
      scenario.expectedCurrentKind || scenario.expectedEngineKind,
      scenario.name
    );
    assert.equal(engine.maxSeverity, scenario.expectedSeverity, scenario.name);
    assert.equal(current.severity, scenario.expectedSeverity, scenario.name);
  }
});

test("primaryRiskFromEngine keeps parity with pickPrimaryRisk contract", () => {
  const scenarios: Array<{
    name: string;
    input: RiskEngineInput;
  }> = [
    {
      name: "sense risc",
      input: { heatIndex: 24, coldEffectiveTemp: 24, windKmh: 8, uvi: 2 },
    },
    {
      name: "calor",
      input: { heatIndex: 35, coldEffectiveTemp: 35, windKmh: 8, uvi: 2 },
    },
    {
      name: "fred",
      input: { heatIndex: 4, coldEffectiveTemp: -5, windKmh: 15, uvi: 0 },
    },
    {
      name: "UV",
      input: { heatIndex: 24, coldEffectiveTemp: 24, windKmh: 8, uvi: 8 },
    },
    {
      name: "vent",
      input: { heatIndex: 22, coldEffectiveTemp: 22, windKmh: 25, uvi: 2 },
    },
    {
      name: "calor + UV",
      input: { heatIndex: 35, coldEffectiveTemp: 35, windKmh: 8, uvi: 6 },
    },
    {
      name: "UV + vent moderat",
      input: { heatIndex: 22, coldEffectiveTemp: 22, windKmh: 25, uvi: 6 },
    },
    {
      name: "UV + vent fort",
      input: { heatIndex: 22, coldEffectiveTemp: 22, windKmh: 45, uvi: 8 },
    },
    {
      name: "fred molt alt",
      input: { heatIndex: -25, coldEffectiveTemp: -25, windKmh: 10, uvi: 0 },
    },
    {
      name: "calor + UV + vent",
      input: { heatIndex: 45, coldEffectiveTemp: 45, windKmh: 33, uvi: 8.4 },
    },
  ];

  for (const scenario of scenarios) {
    const { current, engine } = compareRiskEngineWithPrimaryPicker(scenario.input);
    const bridged = primaryRiskFromEngine(engine);

    assert.deepEqual(bridged, current, scenario.name);
  }
});

test("primary selection uses engine result without legacy fallback", () => {
  const engine = evaluateRiskScore({
    heatIndex: 35,
    coldEffectiveTemp: 35,
    windKmh: 8,
    uvi: 2,
  });
  const enginePrimary = primaryRiskFromEngine(engine);
  const legacyPrimary = pickPrimaryRisk({
    hi: 35,
    effForCold: 35,
    windRisk: "none",
    uvi: 2,
    heatRiskClass: getHeatRisk(35, "rest").class,
  });
  const neutralPrimary: PrimaryRiskFromEngineResult = {
    kind: "none",
    severity: 0,
    labelKey: "none",
  };

  assert.deepEqual(selectPrimaryForUi(enginePrimary), enginePrimary);
  assert.deepEqual(enginePrimary, legacyPrimary);
  assert.deepEqual(selectPrimaryForUi(neutralPrimary), neutralPrimary);
  assert.deepEqual(Object.keys(enginePrimary).sort(), [
    "kind",
    "labelKey",
    "severity",
  ]);
});

test("risk score engine keeps parity for mild heat around 27 degrees with low UV", () => {
  const input: RiskEngineInput = {
    heatIndex: 27.34,
    coldEffectiveTemp: 26.85,
    windKmh: 8,
    uvi: 0.029,
    activity: "rest",
  };
  const { current, engine } = compareRiskEngineWithPrimaryPicker(input);
  const bridged = primaryRiskFromEngine(engine);

  assert.deepEqual(current, {
    kind: "heat",
    severity: 1,
    labelKey: "heat_mild",
  });
  assert.deepEqual(bridged, current);
});

test("risk score engine covers observed ThermoSafe multi-factor scenarios", () => {
  const scenarios: Array<{
    name: string;
    input: RiskEngineInput;
    expectedSorted: Array<["heat" | "cold" | "uv" | "wind", number]>;
    expectedPrimary: "heat" | "cold" | "uv" | "wind" | null;
    expectedMaxSeverity: number;
  }> = [
    {
      name: "UV molt alt + vent moderat",
      input: { uvi: 8.9, windKmh: 33, heatIndex: 24, coldEffectiveTemp: 24 },
      expectedSorted: [
        ["uv", 3],
        ["wind", 2],
      ],
      expectedPrimary: "uv",
      expectedMaxSeverity: 3,
    },
    {
      name: "calor lleu + UV alt",
      input: { heatIndex: 30.5, uvi: 7.2, windKmh: 10, coldEffectiveTemp: 30 },
      expectedSorted: [
        ["uv", 2],
        ["heat", 1],
      ],
      expectedPrimary: "uv",
      expectedMaxSeverity: 2,
    },
    {
      name: "calor moderada + UV alt",
      input: { heatIndex: 35, uvi: 7.2, windKmh: 10, coldEffectiveTemp: 35 },
      expectedSorted: [
        ["heat", 2],
        ["uv", 2],
      ],
      expectedPrimary: "heat",
      expectedMaxSeverity: 2,
    },
    {
      name: "vent moderat sense calor ni UV",
      input: { heatIndex: 22, coldEffectiveTemp: 22, windKmh: 33, uvi: 2 },
      expectedSorted: [["wind", 2]],
      expectedPrimary: "wind",
      expectedMaxSeverity: 2,
    },
    {
      name: "calor alta + UV molt alt + vent moderat",
      input: { heatIndex: 45, uvi: 9.7, windKmh: 33, coldEffectiveTemp: 45 },
      expectedSorted: [
        ["heat", 3],
        ["uv", 3],
        ["wind", 2],
      ],
      expectedPrimary: "heat",
      expectedMaxSeverity: 3,
    },
    {
      name: "fred moderat + vent",
      input: { coldEffectiveTemp: -5, windKmh: 25, heatIndex: -5, uvi: 0 },
      expectedSorted: [
        ["cold", 2],
        ["wind", 2],
      ],
      expectedPrimary: "cold",
      expectedMaxSeverity: 2,
    },
    {
      name: "sense risc amb vent baix, UV baix i temperatura confortable",
      input: { heatIndex: 22, coldEffectiveTemp: 22, windKmh: 8, uvi: 2 },
      expectedSorted: [],
      expectedPrimary: null,
      expectedMaxSeverity: 0,
    },
  ];

  for (const scenario of scenarios) {
    const result = evaluateRiskScore(scenario.input);

    assert.deepEqual(
      result.activeFactorsSorted.map((factor) => [factor.factor, factor.severity]),
      scenario.expectedSorted,
      scenario.name
    );
    assert.equal(result.primary?.factor ?? null, scenario.expectedPrimary, scenario.name);
    assert.equal(result.maxSeverity, scenario.expectedMaxSeverity, scenario.name);
  }
});

test("primary risk prioritizes UV over moderate wind when severity ties", () => {
  const { engine, current } = compareRiskEngineWithPrimaryPicker({
    uvi: 6,
    windKmh: 25,
    heatIndex: 22,
    coldEffectiveTemp: 22,
  });

  assert.deepEqual(
    engine.activeFactorsSorted.map((factor) => [factor.factor, factor.severity]),
    [
      ["uv", 2],
      ["wind", 2],
    ]
  );
  assert.equal(engine.primary?.factor, "uv");
  assert.equal(current.kind, "uv");
  assert.equal(engine.maxSeverity, current.severity);
});

test("UV remains primary over moderate wind, but strong wind keeps priority", () => {
  const uvHighWithModerateWind = compareRiskEngineWithPrimaryPicker({
    uvi: 6,
    windKmh: 25,
    heatIndex: 22,
    coldEffectiveTemp: 22,
  });
  assert.equal(uvHighWithModerateWind.engine.primary?.factor, "uv");
  assert.equal(uvHighWithModerateWind.current.kind, "uv");
  assert.equal(uvHighWithModerateWind.engine.maxSeverity, 2);
  assert.equal(uvHighWithModerateWind.current.severity, 2);

  const uvVeryHighWithModerateWind = compareRiskEngineWithPrimaryPicker({
    uvi: 8,
    windKmh: 25,
    heatIndex: 22,
    coldEffectiveTemp: 22,
  });
  assert.equal(uvVeryHighWithModerateWind.engine.primary?.factor, "uv");
  assert.equal(uvVeryHighWithModerateWind.current.kind, "uv");
  assert.equal(uvVeryHighWithModerateWind.engine.maxSeverity, 3);
  assert.equal(uvVeryHighWithModerateWind.current.severity, 3);

  const uvModerateWithStrongWind = compareRiskEngineWithPrimaryPicker({
    uvi: 4,
    windKmh: 45,
    heatIndex: 22,
    coldEffectiveTemp: 22,
  });
  assert.equal(uvModerateWithStrongWind.engine.primary?.factor, "wind");
  assert.equal(uvModerateWithStrongWind.current.kind, "wind");
  assert.equal(uvModerateWithStrongWind.engine.maxSeverity, 3);
  assert.equal(uvModerateWithStrongWind.current.severity, 3);
});

test("strong wind keeps priority over very high UV when severity ties", () => {
  const { engine, current } = compareRiskEngineWithPrimaryPicker({
    uvi: 8,
    windKmh: 45,
    heatIndex: 22,
    coldEffectiveTemp: 22,
  });

  assert.equal(engine.primary?.factor, "wind");
  assert.equal(current.kind, "wind");
  assert.equal(engine.maxSeverity, 3);
  assert.equal(current.severity, 3);
});

test("cold severity comparison keeps risk score engine aligned with current picker", () => {
  const scenarios: Array<{
    name: string;
    effectiveTemp: number;
    expectedColdRisk: "lleu" | "moderat" | "alt" | "molt alt" | "extrem";
    expectedCurrentSeverity: number;
    expectedEngineSeverity: number;
    expectedCurrentLabel: string;
    expectedEngineLabel: string;
  }> = [
    {
      name: "fred lleu",
      effectiveTemp: 0,
      expectedColdRisk: "lleu",
      expectedCurrentSeverity: 1,
      expectedEngineSeverity: 1,
      expectedCurrentLabel: "cold_mild",
      expectedEngineLabel: "cold_mild",
    },
    {
      name: "fred moderat",
      effectiveTemp: -5,
      expectedColdRisk: "moderat",
      expectedCurrentSeverity: 2,
      expectedEngineSeverity: 2,
      expectedCurrentLabel: "cold_moderate",
      expectedEngineLabel: "cold_moderate",
    },
    {
      name: "fred alt",
      effectiveTemp: -15,
      expectedColdRisk: "alt",
      expectedCurrentSeverity: 3,
      expectedEngineSeverity: 3,
      expectedCurrentLabel: "cold_high",
      expectedEngineLabel: "cold_high",
    },
    {
      name: "fred molt alt",
      effectiveTemp: -25,
      expectedColdRisk: "molt alt",
      expectedCurrentSeverity: 3,
      expectedEngineSeverity: 3,
      expectedCurrentLabel: "cold_very_high",
      expectedEngineLabel: "cold_very_high",
    },
    {
      name: "fred extrem",
      effectiveTemp: -40,
      expectedColdRisk: "extrem",
      expectedCurrentSeverity: 4,
      expectedEngineSeverity: 4,
      expectedCurrentLabel: "cold_extreme",
      expectedEngineLabel: "cold_extreme",
    },
  ];

  for (const scenario of scenarios) {
    const coldRisk = getColdRisk(scenario.effectiveTemp, 20);
    const current = pickPrimaryRisk({
      hi: null,
      effForCold: scenario.effectiveTemp,
      windRisk: "none",
      uvi: null,
    });
    const engine = evaluateRiskScore({
      coldEffectiveTemp: scenario.effectiveTemp,
      windKmh: 20,
    });

    assert.equal(coldRisk, scenario.expectedColdRisk, scenario.name);
    assert.equal(current.kind, "cold", scenario.name);
    assert.equal(engine.primary?.factor, "cold", scenario.name);
    assert.equal(current.severity, scenario.expectedCurrentSeverity, scenario.name);
    assert.equal(engine.maxSeverity, scenario.expectedEngineSeverity, scenario.name);
    assert.equal(current.labelKey, scenario.expectedCurrentLabel, scenario.name);
    assert.equal(engine.primary?.labelKey, scenario.expectedEngineLabel, scenario.name);
  }
});

test("very-high cold with wind keeps parity with the current picker", () => {
  const { engine, current } = compareRiskEngineWithPrimaryPicker({
    coldEffectiveTemp: -25,
    windKmh: 25,
    heatIndex: null,
    uvi: 0,
  });

  assert.equal(current.kind, "cold");
  assert.equal(current.severity, 3);
  assert.equal(current.labelKey, "cold_very_high");
  assert.equal(engine.primary?.factor, "cold");
  assert.equal(engine.maxSeverity, 3);
  assert.deepEqual(
    engine.activeFactorsSorted.map((factor) => [factor.factor, factor.severity]),
    [
      ["cold", 3],
      ["wind", 2],
    ]
  );
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

test("official alert hazard detection covers common AEMET phenomena", () => {
  assert.equal(detectAemetHazard("Moderate coastal event warning"), "coast");
  assert.equal(detectAemetHazard("Wind warning"), "wind");
  assert.equal(detectAemetHazard("Rain warning"), "rain");
  assert.equal(detectAemetHazard("Thunderstorm warning"), "storm");
  assert.equal(detectAemetHazard("High temperature warning"), "temp_max");
  assert.equal(detectAemetHazard("Unknown advisory"), "other");
});

test("official alert primary status keeps a generic title and describes the known phenomenon", () => {
  const originalNow = Date.now;
  Date.now = () => 1_000_000;

  try {
    const translations: Record<string, string> = {
      official_alert_soon: "Avís meteorològic oficial proper",
      follow_official_alerts_soon: "Hi ha un avís meteorològic previst.",
      official_alert_soon_prefix: "Pròxim avís oficial",
      "official_alert_soon_hazard.coast":
        "Es preveu un avís oficial per costa i onatge. Convé anticipar-se i revisar l’activitat prevista.",
      official_alert_soon_multiple: "Pròxims avisos oficials",
      official_alert_soon_multiple_text:
        "Hi ha diversos avisos meteorològics previstos. Revisa el detall abans de planificar l’activitat.",
    };
    const t = (key: string) => translations[key] || key;

    const makeStatus = (alerts: any[]) =>
      getPrimaryStatusBlock({
        alerts,
        primary: { kind: "none", severity: 0, labelKey: "none" },
        heatRisk: null,
        coldRisk: "cap",
        windRisk: "none",
        uvi: 0,
        day: true,
        primaryAdvice: null,
        contextualUVMessage: "",
        t,
      });

    const coastStatus = makeStatus([
      { event: "Moderate coastal event warning", start: 2_000, end: 3_000 },
    ]);
    assert.equal(coastStatus.title, "Pròxim avís oficial");
    assert.equal(
      coastStatus.text,
      "Es preveu un avís oficial per costa i onatge. Convé anticipar-se i revisar l’activitat prevista."
    );

    const multipleStatus = makeStatus([
      { event: "Wind warning", start: 2_000, end: 3_000 },
      { event: "Rain warning", start: 2_000, end: 3_000 },
    ]);
    assert.equal(multipleStatus.title, "Pròxims avisos oficials");
    assert.equal(
      multipleStatus.text,
      "Hi ha diversos avisos meteorològics previstos. Revisa el detall abans de planificar l’activitat."
    );
    assert.equal(
      makeStatus([{ event: "Unknown advisory", start: 2_000, end: 3_000 }]).title,
      "Avís meteorològic oficial proper"
    );
  } finally {
    Date.now = originalNow;
  }
});

const trendNow = new Date("2026-06-29T10:00:00Z");

function makeTrendForecast(
  hours: Array<{
    offsetHours: number;
    temp: number;
    feels_like?: number;
    windKmh?: number;
    uvi?: number;
  }>
) {
  const nowSeconds = Math.floor(trendNow.getTime() / 1000);
  return {
    hourly: hours.map(({ offsetHours, windKmh, ...rest }) => ({
      dt: nowSeconds + offsetHours * 60 * 60,
      wind_speed: typeof windKmh === "number" ? windKmh / 3.6 : undefined,
      ...rest,
    })),
  };
}

test("risk trend detects heat-index rise inside the same risk category", () => {
  const trend = buildRiskTrend(
    makeTrendForecast([
      { offsetHours: 1, temp: 29.8, feels_like: 29.8, windKmh: 5, uvi: 2 },
      { offsetHours: 2, temp: 31.2, feels_like: 31.2, windKmh: 5, uvi: 2 },
    ]),
    { temp: 28, heatIndex: 28, windKmh: 5, uvi: 2 },
    trendNow
  );

  assert.equal(trend?.direction, "worsening");
  assert.deepEqual(trend?.factors, ["heat"]);
});

test("risk trend detects UV rise inside the same risk category", () => {
  const trend = buildRiskTrend(
    makeTrendForecast([
      { offsetHours: 1, temp: 22, feels_like: 22, windKmh: 5, uvi: 3.8 },
      { offsetHours: 2, temp: 22, feels_like: 22, windKmh: 5, uvi: 4.8 },
    ]),
    { temp: 22, heatIndex: 22, windKmh: 5, uvi: 3.2 },
    trendNow
  );

  assert.equal(trend?.direction, "worsening");
  assert.deepEqual(trend?.factors, ["uv"]);
});

test("risk trend detects wind rise inside the same risk category", () => {
  const trend = buildRiskTrend(
    makeTrendForecast([
      { offsetHours: 1, temp: 20, feels_like: 20, windKmh: 20, uvi: 1 },
      { offsetHours: 2, temp: 20, feels_like: 20, windKmh: 24.6, uvi: 1 },
    ]),
    { temp: 20, heatIndex: 20, windKmh: 15.5, uvi: 1 },
    trendNow
  );

  assert.equal(trend?.direction, "worsening");
  assert.deepEqual(trend?.factors, ["wind"]);
});

test("risk trend detects real improvement when no factor worsens", () => {
  const trend = buildRiskTrend(
    makeTrendForecast([
      { offsetHours: 1, temp: 28.4, feels_like: 28.4, windKmh: 5, uvi: 1 },
      { offsetHours: 2, temp: 28.2, feels_like: 28.2, windKmh: 5, uvi: 1 },
    ]),
    { temp: 31.5, heatIndex: 31.5, windKmh: 5, uvi: 1 },
    trendNow
  );

  assert.equal(trend?.direction, "improving");
  assert.deepEqual(trend?.factors, ["heat"]);
});

test("risk trend remains stable for small ordinary variations", () => {
  const trend = buildRiskTrend(
    makeTrendForecast([
      { offsetHours: 1, temp: 28.8, feels_like: 28.8, windKmh: 12, uvi: 2.2 },
      { offsetHours: 2, temp: 29.4, feels_like: 29.4, windKmh: 13, uvi: 2.5 },
    ]),
    { temp: 28, heatIndex: 28, windKmh: 10, uvi: 2 },
    trendNow
  );

  assert.equal(trend?.direction, "stable");
  assert.deepEqual(trend?.factors, []);
});

test("risk trend identifies cold as the dominant worsening factor", () => {
  const trend = buildRiskTrend(
    makeTrendForecast([
      { offsetHours: 1, temp: -2, feels_like: -2, windKmh: 20, uvi: 0 },
      { offsetHours: 2, temp: -6, feels_like: -6, windKmh: 20, uvi: 0 },
    ]),
    { temp: 5, heatIndex: 5, windKmh: 5, uvi: 0 },
    trendNow
  );

  assert.equal(trend?.direction, "worsening_clearly");
  assert.deepEqual(trend?.factors, ["cold"]);
});

test("risk trend keeps at most two similarly weighted factors", () => {
  const trend = buildRiskTrend(
    makeTrendForecast([
      { offsetHours: 1, temp: 31, feels_like: 31, windKmh: 24, uvi: 2 },
      { offsetHours: 2, temp: 31, feels_like: 31, windKmh: 24, uvi: 2 },
    ]),
    { temp: 28, heatIndex: 28, windKmh: 15, uvi: 2 },
    trendNow
  );

  assert.equal(trend?.direction, "worsening");
  assert.deepEqual(trend?.factors, ["heat", "wind"]);
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
      "La temperatura encara es manté elevada després de la posta de sol. Tot i que el risc disminueix respecte al dia, la calor acumulada pot fer menys confortable l'activitat a l'exterior.",
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
  assert.match(result.text, /temperatura encara es manté elevada|calor acumulada/i);
  assert.doesNotMatch(result.text, /sol ja baixa/i);
});

test("night heat status avoids daytime shade advice", () => {
  const translations: Record<string, string> = {
    "officialAdviceDynamic.heat.moderate": "Evita esforços intensos i busca ombra regularment.",
    "primaryStatus.heat.tropicalNight": "Nit tropical",
    "primaryStatus.heat.tropicalNightText":
      "La temperatura continua elevada durant la nit, fet que pot dificultar el descans i la recuperació tèrmica.",
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
    nightHeatLevel: "tropical",
    primaryAdvice: null,
    contextualUVMessage: "",
    t: (key) => translations[key] || key,
  });

  assert.equal(result.title, "Nit tropical");
  assert.match(result.text, /nit/i);
  assert.doesNotMatch(result.text, /ombra/i);
  assert.doesNotMatch(result.text, /sol/i);
  assert.notEqual(result.title, "Nit calorosa");
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
    nightHeatLevel: "tropical",
    primaryAdvice: null,
    contextualUVMessage: "",
    t: (key) => seasonalTranslations[key] || key,
  });

  assert.equal(result.title, "Nit tropical");
  assert.notEqual(result.title, "Condicions segures");
  assert.notEqual(result.title, "Nit calorosa");
  assert.match(result.text, /nit/i);
  assert.match(result.text, /calor|nit|recuperació/i);
});

test("torrid night is distinct from tropical night in primary status", () => {
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
    nightHeatLevel: "torrid",
    primaryAdvice: null,
    contextualUVMessage: "",
    t: (key) => seasonalTranslations[key] || key,
  });

  assert.equal(result.title, "Nit tòrrida");
  assert.notEqual(result.title, "Nit tropical");
  assert.notEqual(result.title, "Nit calorosa");
  assert.match(result.text, /molt elevada|notablement/i);
});

test("night heat thresholds are not recalculated inside visual consumers", () => {
  const recommendationsSource = readFileSync(
    `${process.cwd()}/src/components/Recommendations.tsx`,
    "utf8"
  );

  assert.match(recommendationsSource, /nightHeatLevel/);
  assert.doesNotMatch(recommendationsSource, /effectiveTemp\s*>=\s*25/);
});

test("night recommendations are action-focused and do not repeat primary description", () => {
  const recommendationsSource = readFileSync(
    `${process.cwd()}/src/components/Recommendations.tsx`,
    "utf8"
  );

  assert.match(recommendationsSource, /Ventila els espais abans d.anar a dormir/);
  assert.match(recommendationsSource, /Refresca i ventila els espais/);
  assert.match(recommendationsSource, /factorTropicalNight:\s*"Nit tropical"/);
  assert.match(recommendationsSource, /factorTorridNight:\s*"Nit tòrrida"/);
  assert.match(recommendationsSource, /label:\s*nightLabel/);
  assert.match(recommendationsSource, /items=\{factorItems\(/);
  assert.doesNotMatch(recommendationsSource, /clean\.length\s*<=\s*1/);
  assert.doesNotMatch(
    recommendationsSource,
    /tropicalNight:\s*["']La temperatura continua elevada durant la nit/
  );
  assert.doesNotMatch(
    recommendationsSource,
    /torridNight:\s*["']La temperatura es manté molt elevada durant la nit/
  );
});

test("visible recommendation branches always provide factor subtitles", () => {
  const recommendationsSource = readFileSync(
    `${process.cwd()}/src/components/Recommendations.tsx`,
    "utf8"
  );
  const recommendationBoxes = recommendationsSource.match(
    /<RecommendationBox[\s\S]*?\/>/g
  );

  assert.ok(recommendationBoxes?.length);

  const uncategorizedBoxes = recommendationBoxes
    .filter((box) => !box.includes("body={t.loading}"))
    .filter((box) => !box.includes("items={"));

  assert.deepEqual(uncategorizedBoxes, []);
  assert.match(recommendationsSource, /thermalComfortItem\(t,\s*t\.safeCloudy\)/);
  assert.match(recommendationsSource, /thermalComfortItem\(t\)/);
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
  const text = getWorkWindowText(level, "ca", false, "tropical");

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
  "safe_conditions_text_day": "No s'observen riscos destacables en aquest moment.",
  "official_alert": "Avís meteorològic oficial actiu",
  "follow_official_alerts": "Segueix les indicacions oficials i extrema la precaució.",
  "official_alert_active_prefix": "Avís meteorològic oficial actiu",
  "official_alert_active_hazard.coastal": "Avís oficial per costa i onatge. Segueix les indicacions oficials.",
  "official_alert_active_hazard.storm": "Avís oficial per tempestes. Segueix les indicacions oficials.",
  "primaryStatus.heat.mild": "Precaució lleu per calor",
  "primaryStatus.heat.mildLateDay": "Temperatura encara elevada",
  "primaryStatus.heat.hotNight": "Nit calorosa",
  "primaryStatus.heat.tropicalNight": "Nit tropical",
  "primaryStatus.heat.torridNight": "Nit tòrrida",
  "primaryStatus.heat.moderate": "Risc moderat per calor",
  "primaryStatus.heat.moderateLateDay": "Calor encara elevada",
  "primaryStatus.heat.high": "Risc alt per calor",
  "primaryStatus.heat.extreme": "Risc extrem per calor",
  "primaryStatus.heat.mildText":
    "La sensació tèrmica és moderadament elevada. Hidrata't i adapta l'activitat si mantens esforç físic.",
  "primaryStatus.heat.mildLateDayText":
    "Tot i que el sol ja baixa, la sensació tèrmica encara pot provocar cansament. Hidrata't i evita esforços innecessaris.",
  "primaryStatus.heat.mildEveningText":
    "La temperatura encara es manté elevada després de la posta de sol. Tot i que el risc disminueix respecte al dia, la calor acumulada pot fer menys confortable l'activitat a l'exterior.",
  "primaryStatus.heat.hotNightText":
    "La calor acumulada durant la nit pot dificultar el descans i la recuperació tèrmica. Hidrata't i evita esforços físics intensos fins que refresqui.",
  "primaryStatus.heat.tropicalNightText":
    "La temperatura continua elevada durant la nit, fet que pot dificultar el descans i la recuperació tèrmica.",
  "primaryStatus.heat.torridNightText":
    "La temperatura es manté molt elevada durant la nit i pot dificultar notablement el descans i la recuperació tèrmica.",
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
      const engineRisk = evaluateRiskScore({
        heatIndex: scenario.hi,
        coldEffectiveTemp: scenario.effForCold,
        windKmh: scenario.windKmh,
        uvi: uviForRisk,
        isNightAtLocation: phase === "night",
        nightReferenceTemperature: scenario.hi,
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
        nightHeatLevel: engineRisk.nightHeatLevel,
        nocturnalHeat: engineRisk.nightHeatLevel !== "none",
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
        assert.match(status.text, /temperatura encara es manté elevada|calor acumulada/i);
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

type CityScenario = {
  name: string;
  heatIndex: number;
  coldEffectiveTemp: number;
  windKmh: number;
  uvi: number;
  day: boolean;
  heatDayPhase: ReturnType<typeof getHeatDayPhase>;
  weatherMain?: string;
  weatherCode?: number;
  humidity?: number;
  cloudiness?: number;
  aemetAlerts?: any[];
  aemetActive?: boolean;
  nocturnalHeat?: boolean;
  expectedPrimary: "heat" | "cold" | "wind" | "uv" | "none";
  expectedWorkWindow: ReturnType<typeof getWorkWindow>;
  expectedSignals: string[];
  forbiddenStatus?: RegExp[];
  expectedStatus?: RegExp;
};

function evaluateCityScenario(scenario: CityScenario) {
  const heatRisk = getHeatRisk(scenario.heatIndex, "rest");
  const coldRisk = getColdRisk(scenario.coldEffectiveTemp, scenario.windKmh);
  const windRisk = getWindRisk(scenario.windKmh);
  const weatherContext = getWeatherContext({
    weatherMain: scenario.weatherMain,
    weatherCode: scenario.weatherCode,
    humidity: scenario.humidity,
    effectiveTemp: scenario.coldEffectiveTemp,
    cloudiness: scenario.cloudiness,
  });
  const engineRisk = evaluateRiskScore({
    heatIndex: scenario.heatIndex,
    coldEffectiveTemp: scenario.coldEffectiveTemp,
    windKmh: scenario.windKmh,
    uvi: scenario.uvi,
    activity: "rest",
    isNightAtLocation: !scenario.day,
    nightReferenceTemperature: scenario.heatIndex,
  });
  const primary = primaryRiskFromEngine(engineRisk);
  const status = getPrimaryStatusBlock({
    alerts: scenario.aemetAlerts ?? [],
    primary,
    heatRisk,
    coldRisk,
    windRisk,
    uvi: scenario.uvi,
    day: scenario.day,
    heatDayPhase: scenario.heatDayPhase,
    nocturnalHeat: engineRisk.nightHeatLevel !== "none",
    nightHeatLevel: engineRisk.nightHeatLevel,
    primaryAdvice: null,
    contextualUVMessage: "",
    t: (key) => seasonalTranslations[key] || key,
  });
  const workWindow = getWorkWindow({
    heatRisk,
    heatIndex: scenario.heatIndex,
    coldRisk,
    windRisk,
    uvi: scenario.uvi,
    aemetActive: scenario.aemetActive ?? false,
    weatherMain: scenario.weatherMain,
    nocturnalHeat: engineRisk.nightHeatLevel !== "none",
    nightHeatLevel: engineRisk.nightHeatLevel,
    engineRisk,
    weatherContext,
  });
  const workText = getWorkWindowText(
    workWindow,
    "ca",
    scenario.aemetActive ?? false,
    engineRisk.nightHeatLevel
  );

  const recommendationSignals = new Set<string>();
  const factorState = getRecommendationFactorState(engineRisk.activeFactorsSorted);
  if (factorState.heat) recommendationSignals.add("calor");
  if (factorState.uv) recommendationSignals.add("uv");
  if (factorState.wind) recommendationSignals.add("vent");
  if (coldRisk !== "cap") recommendationSignals.add("fred");
  if (weatherContext.rainy || weatherContext.slipperySurface) recommendationSignals.add("pluja");
  if (weatherContext.snowy) recommendationSignals.add("neu");
  if (weatherContext.foggy) recommendationSignals.add("boira");
  if (weatherContext.hail) recommendationSignals.add("calamarsa");
  if (weatherContext.humid) recommendationSignals.add("humitat");
  if (scenario.aemetAlerts?.length) recommendationSignals.add("avís");

  return {
    primary,
    status,
    workWindow,
    workText,
    recommendationSignals,
    weatherContext,
    engineRisk,
  };
}

function makeActiveAemetAlert(event: string) {
  const now = Math.floor(Date.now() / 1000);
  return {
    event,
    description: event,
    start: now - 60,
    end: now + 3600,
  };
}

const cityScenarios: CityScenario[] = [
  {
    name: "Llucmajor - calor moderada i UV alt sense pluja",
    heatIndex: 34,
    coldEffectiveTemp: 34,
    windKmh: 12,
    uvi: 6.5,
    day: true,
    heatDayPhase: "day",
    expectedPrimary: "heat",
    expectedWorkWindow: "limited",
    expectedSignals: ["calor", "uv"],
    expectedStatus: /calor/i,
  },
  {
    name: "Sevilla - calor alta amb UV alt",
    heatIndex: 42,
    coldEffectiveTemp: 42,
    windKmh: 10,
    uvi: 7.2,
    day: true,
    heatDayPhase: "day",
    expectedPrimary: "heat",
    expectedWorkWindow: "avoid",
    expectedSignals: ["calor", "uv"],
    expectedStatus: /calor/i,
  },
  {
    name: "Dubai - nit tropical amb humitat i UV nocturn zero",
    heatIndex: 31,
    coldEffectiveTemp: 31,
    windKmh: 8,
    uvi: 0,
    day: false,
    heatDayPhase: "night",
    humidity: 76,
    nocturnalHeat: true,
    expectedPrimary: "heat",
    expectedWorkWindow: "caution",
    expectedSignals: ["calor", "humitat"],
    expectedStatus: /nit|calor/i,
    forbiddenStatus: [/UV/i],
  },
  {
    name: "Oulu - condicions segures amb UV baix",
    heatIndex: 9,
    coldEffectiveTemp: 9,
    windKmh: 8,
    uvi: 1,
    day: true,
    heatDayPhase: "day",
    expectedPrimary: "none",
    expectedWorkWindow: "optimal",
    expectedSignals: [],
    expectedStatus: /Condicions segures/i,
    forbiddenStatus: [/calor/i, /fred/i, /UV/i],
  },
  {
    name: "Bergen - condicions segures i cel ennuvolat sense alarmisme",
    heatIndex: 13,
    coldEffectiveTemp: 13,
    windKmh: 10,
    uvi: 1,
    day: true,
    heatDayPhase: "day",
    weatherMain: "Clouds",
    cloudiness: 70,
    expectedPrimary: "none",
    expectedWorkWindow: "optimal",
    expectedSignals: [],
    expectedStatus: /Condicions segures/i,
    forbiddenStatus: [/alerta/i],
  },
  {
    name: "Ushuaia - fred moderat amb neu contextual",
    heatIndex: 1,
    coldEffectiveTemp: -6,
    windKmh: 18,
    uvi: 1,
    day: true,
    heatDayPhase: "day",
    weatherMain: "Snow",
    weatherCode: 601,
    expectedPrimary: "cold",
    expectedWorkWindow: "limited",
    expectedSignals: ["fred", "neu"],
    expectedStatus: /fred/i,
    forbiddenStatus: [/Condicions segures/i],
  },
  {
    name: "Oymyakon - fred intens sense classificar-se com segur",
    heatIndex: -20,
    coldEffectiveTemp: -28,
    windKmh: 12,
    uvi: 0,
    day: true,
    heatDayPhase: "day",
    weatherMain: "Snow",
    weatherCode: 600,
    expectedPrimary: "cold",
    expectedWorkWindow: "limited",
    expectedSignals: ["fred", "neu"],
    expectedStatus: /fred/i,
    forbiddenStatus: [/Condicions segures/i],
  },
  {
    name: "Tampere - pluja i superfícies humides",
    heatIndex: 12,
    coldEffectiveTemp: 12,
    windKmh: 10,
    uvi: 1,
    day: true,
    heatDayPhase: "day",
    weatherMain: "Rain",
    weatherCode: 500,
    expectedPrimary: "none",
    expectedWorkWindow: "caution",
    expectedSignals: ["pluja"],
  },
  {
    name: "Londres - plugim i recomanació de relliscades",
    heatIndex: 15,
    coldEffectiveTemp: 15,
    windKmh: 11,
    uvi: 1,
    day: true,
    heatDayPhase: "day",
    weatherMain: "Drizzle",
    weatherCode: 300,
    expectedPrimary: "none",
    expectedWorkWindow: "caution",
    expectedSignals: ["pluja"],
  },
  {
    name: "Cadis - avís oficial amb risc local baix",
    heatIndex: 22,
    coldEffectiveTemp: 22,
    windKmh: 8,
    uvi: 1,
    day: true,
    heatDayPhase: "day",
    aemetAlerts: [makeActiveAemetAlert("Fenòmens costaners")],
    aemetActive: true,
    expectedPrimary: "none",
    expectedWorkWindow: "caution",
    expectedSignals: ["avís"],
    expectedStatus: /Avís|oficial|alerta/i,
    forbiddenStatus: [/Condicions segures/i],
  },
  {
    name: "Kíiv - avís oficial simulat no desapareix amb risc local baix",
    heatIndex: 18,
    coldEffectiveTemp: 18,
    windKmh: 9,
    uvi: 1,
    day: true,
    heatDayPhase: "day",
    aemetAlerts: [makeActiveAemetAlert("Tempestes")],
    aemetActive: true,
    expectedPrimary: "none",
    expectedWorkWindow: "caution",
    expectedSignals: ["avís"],
    expectedStatus: /Avís|oficial|alerta/i,
    forbiddenStatus: [/Condicions segures/i],
  },
];

test("city fixture matrix keeps primary risk, activity and recommendation signals coherent", async (t) => {
  for (const scenario of cityScenarios) {
    await t.test(scenario.name, () => {
      const result = evaluateCityScenario(scenario);
      const statusText = `${result.status.title} ${result.status.text}`;

      assert.equal(result.primary.kind, scenario.expectedPrimary);
      assert.equal(result.workWindow, scenario.expectedWorkWindow);

      for (const signal of scenario.expectedSignals) {
        assert.ok(
          result.recommendationSignals.has(signal),
          `${scenario.name} should include recommendation signal ${signal}`
        );
      }

      if (scenario.expectedStatus) {
        assert.match(statusText, scenario.expectedStatus);
      }

      for (const forbidden of scenario.forbiddenStatus ?? []) {
        assert.doesNotMatch(statusText, forbidden);
      }

      if (scenario.uvi === 0) {
        assert.equal(result.engineRisk.factors.find((factor) => factor.factor === "uv")?.active, false);
      }

      assertNoDuplicateSentences(`${statusText}. ${result.workText}`);
    });
  }
});

test("Tokyo fixture marks future trend times as local time when timezone differs", () => {
  const now = new Date("2026-07-09T00:00:00.000Z");
  const forecast = {
    hourly: [
      { dt: Math.floor(now.getTime() / 1000) + 60 * 60, temp: 29, feels_like: 30, wind_speed: 3, uvi: 4 },
      { dt: Math.floor(now.getTime() / 1000) + 2 * 60 * 60, temp: 30, feels_like: 31, wind_speed: 3, uvi: 6.5 },
      { dt: Math.floor(now.getTime() / 1000) + 3 * 60 * 60, temp: 31, feels_like: 32, wind_speed: 3, uvi: 7.5 },
    ],
  };

  const trend = buildRiskTrend(
    forecast,
    { temp: 28, heatIndex: 28, windKmh: 10, uvi: 2, activity: "rest" },
    now
  );
  const trendUsesDifferentTimezone = true;
  const shouldShowTrendLocalTime =
    Boolean(trend) &&
    trendUsesDifferentTimezone &&
    trend?.direction !== "stable" &&
    trend?.direction !== "improving";

  assert.ok(trend);
  assert.notEqual(trend.direction, "stable");
  assert.equal(shouldShowTrendLocalTime, true);
  assert.equal(seasonalTranslations["riskTrend.localTimeSuffix"] || "(hora local)", "(hora local)");
});
