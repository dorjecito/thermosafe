const { createHash } = require("node:crypto");

const MS_PER_DAY = 1000 * 60 * 60 * 24;

function toMillis(value) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (value && typeof value.toMillis === "function") return value.toMillis();
  if (value && typeof value.seconds === "number") return value.seconds * 1000;
  return 0;
}

function daysBetweenNow(ms, nowMs = Date.now()) {
  const age = nowMs - toMillis(ms);
  return age / MS_PER_DAY;
}

function getLastActivityMs(d) {
  return Math.max(
    toMillis(d.tokenLastSyncedAt),
    toMillis(d.updatedAt),
    toMillis(d.lastNotified),
    toMillis(d.lastUvAt),
    toMillis(d.lastHeatAt),
    toMillis(d.lastColdAt),
    toMillis(d.lastWindAt),
    toMillis(d.lastAemetAt),
    toMillis(d.createdAt)
  );
}

function isStaleActivity(lastActivityMs, inactivityDays, nowMs = Date.now()) {
  return lastActivityMs <= 0 || daysBetweenNow(lastActivityMs, nowMs) > inactivityDays;
}

function getCleanupDocLabel(docId) {
  return createHash("sha256").update(String(docId || "")).digest("hex").slice(0, 12);
}

function getCleanupValidationErrorCategory(error) {
  const code = String(error?.errorInfo?.code || error?.code || "");
  const message = String(error?.message || "");
  const value = `${code} ${message}`;

  if (value.includes("registration-token-not-registered")) {
    return "invalid-token";
  }
  if (value.includes("invalid-argument")) {
    return "invalid-token";
  }

  return "validation-error";
}

async function processCleanupSubDoc({
  doc,
  validateToken,
  inactivityDays,
  nowMs = Date.now(),
  logger = console,
}) {
  const d = doc.data() || {};
  const token = d.token;
  const docLabel = getCleanupDocLabel(doc.id);

  if (!token) {
    logger.log("[cleanup] delete", { docLabel, category: "missing-token" });
    await doc.ref.delete();
    return {
      classification: "missing-token",
      deleted: true,
      stale: true,
      error: false,
    };
  }

  const lastActivity = getLastActivityMs(d);
  const stale = isStaleActivity(lastActivity, inactivityDays, nowMs);

  const validation = await validateToken(token);

  if (validation.status === "invalid") {
    logger.log("[cleanup] delete", {
      docLabel,
      category: "invalid-token",
    });
    await doc.ref.delete();
    return {
      classification: "invalid",
      deleted: true,
      stale,
      error: false,
    };
  }

  if (validation.status === "error") {
    logger.warn("[cleanup] keep after non-definitive dry-run error", {
      docLabel,
      category: "validation-error",
    });
    return {
      classification: stale ? "valid-stale" : "valid-recent",
      deleted: false,
      stale,
      error: true,
    };
  }

  if (stale) {
    logger.log("[cleanup] keep", {
      docLabel,
      category: "valid-stale",
    });
    return {
      classification: "valid-stale",
      deleted: false,
      stale: true,
      error: false,
    };
  }

  return {
    classification: "valid-recent",
    deleted: false,
    stale: false,
    error: false,
  };
}

module.exports = {
  daysBetweenNow,
  getCleanupDocLabel,
  getCleanupValidationErrorCategory,
  getLastActivityMs,
  isStaleActivity,
  processCleanupSubDoc,
  toMillis,
};
