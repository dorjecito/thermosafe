const API_USAGE_RETENTION_DAYS = 90;
const API_USAGE_CLEANUP_LIMIT = 500;

function getUtcUsageDateKey(now = new Date()) {
  return now.toISOString().slice(0, 10);
}

function getOpenWeatherUsageFieldForFunction(fnName) {
  if (fnName === "getWeather") return "currentWeather";
  if (fnName === "getWeatherAlerts") return "oneCall";
  if (fnName === "getUVfromOpenWeather") return "oneCall";
  return null;
}

function buildOpenWeatherUsagePayload(field, hasError, FieldValue, now = new Date()) {
  const date = getUtcUsageDateKey(now);

  return {
    id: `openweather_${date}`,
    data: {
      provider: "openweather",
      date,
      oneCall: FieldValue.increment(field === "oneCall" ? 1 : 0),
      currentWeather: FieldValue.increment(field === "currentWeather" ? 1 : 0),
      geoDirect: FieldValue.increment(field === "geoDirect" ? 1 : 0),
      geoReverse: FieldValue.increment(field === "geoReverse" ? 1 : 0),
      errors: FieldValue.increment(hasError ? 1 : 0),
      lastCallAt: FieldValue.serverTimestamp(),
    },
  };
}

async function trackOpenWeatherApiUsage(db, admin, field, hasError, logger = console) {
  try {
    const { id, data } = buildOpenWeatherUsagePayload(
      field,
      hasError,
      admin.firestore.FieldValue
    );
    await db.collection("apiUsage").doc(id).set(data, { merge: true });
  } catch (error) {
    logger.warn("[apiUsage] No s'ha pogut registrar consum OpenWeather:", error);
  }
}

async function fetchTrackedOpenWeather(fetchFn, db, admin, url, field, logger = console) {
  let usageTracked = false;

  try {
    const response = await fetchFn(url);
    await trackOpenWeatherApiUsage(db, admin, field, !response.ok, logger);
    usageTracked = true;
    return response;
  } catch (error) {
    if (!usageTracked) {
      await trackOpenWeatherApiUsage(db, admin, field, true, logger);
    }
    throw error;
  }
}

function parseUsageDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }

  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) return null;
  if (parsed.toISOString().slice(0, 10) !== value) return null;

  return value;
}

function getRecognizedUsageDocInfo(id, data = {}) {
  const match = /^(openuv|openweather)_(\d{4}-\d{2}-\d{2})$/.exec(id);
  if (!match) return null;

  const provider = match[1];
  const idDate = parseUsageDate(match[2]);
  if (!idDate) return null;

  const fieldDate = parseUsageDate(data.date);
  const date = fieldDate || idDate;

  return { provider, date };
}

function getApiUsageCutoffDate(now = new Date()) {
  const cutoff = new Date(now);
  cutoff.setUTCHours(0, 0, 0, 0);
  cutoff.setUTCDate(cutoff.getUTCDate() - API_USAGE_RETENTION_DAYS);
  return getUtcUsageDateKey(cutoff);
}

function shouldDeleteApiUsageDoc(id, data = {}, now = new Date()) {
  const info = getRecognizedUsageDocInfo(id, data);
  if (!info) return false;

  return info.date < getApiUsageCutoffDate(now);
}

async function cleanupOldApiUsageCounters(db, now = new Date(), logger = console) {
  let snap;

  try {
    snap = await db.collection("apiUsage").limit(API_USAGE_CLEANUP_LIMIT).get();
  } catch (error) {
    logger.warn("[apiUsage] No s'ha pogut llistar comptadors antics:", error);
    return { scanned: 0, deleted: 0, errors: 1 };
  }

  let deleted = 0;
  let errors = 0;

  for (const doc of snap.docs) {
    const data = typeof doc.data === "function" ? doc.data() : {};
    if (!shouldDeleteApiUsageDoc(doc.id, data, now)) continue;

    try {
      await doc.ref.delete();
      deleted += 1;
    } catch (error) {
      errors += 1;
      logger.warn("[apiUsage] No s'ha pogut eliminar comptador antic:", {
        id: doc.id,
        error: error?.message || error,
      });
    }
  }

  logger.log("[apiUsage] cleanup", {
    scanned: snap.size,
    deleted,
    errors,
    olderThanDays: API_USAGE_RETENTION_DAYS,
    cutoffDateUtc: getApiUsageCutoffDate(now),
  });

  return { scanned: snap.size, deleted, errors };
}

module.exports = {
  API_USAGE_CLEANUP_LIMIT,
  API_USAGE_RETENTION_DAYS,
  buildOpenWeatherUsagePayload,
  cleanupOldApiUsageCounters,
  fetchTrackedOpenWeather,
  getApiUsageCutoffDate,
  getOpenWeatherUsageFieldForFunction,
  getRecognizedUsageDocInfo,
  getUtcUsageDateKey,
  shouldDeleteApiUsageDoc,
  trackOpenWeatherApiUsage,
};
