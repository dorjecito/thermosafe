function normalizeAemetAlertText(value) {
  if (typeof value === "string") return value;
  if (value && typeof value === "object") {
    return Object.values(value)
      .filter((item) => typeof item === "string")
      .join(" ");
  }
  return "";
}

function normalizeAemetIdentityPart(value) {
  return normalizeAemetAlertText(value)
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function buildLegacyAemetEventKey(info) {
  return [
    info?.level ?? 0,
    info?.event ?? "",
    info?.sender ?? "",
    info?.timing ?? "",
    String(info?.description ?? "").slice(0, 120),
  ].join("|");
}

function buildAemetEpisodeKey(info, zoneKey = "") {
  const start = Number(info?.start);
  const end = Number(info?.end);

  if (!Number.isFinite(start) || !Number.isFinite(end)) return "";

  return [
    "ow-alert-v1",
    normalizeAemetIdentityPart(info?.sender),
    normalizeAemetIdentityPart(info?.event),
    String(start),
    String(end),
    normalizeAemetIdentityPart(zoneKey),
  ].join("|");
}

function getAemetAlertSeverity(alert) {
  const explicitSeverity =
    typeof alert?.severity === "number"
      ? alert.severity
      : typeof alert?.level === "number"
        ? alert.level
        : null;

  if (explicitSeverity !== null && Number.isFinite(explicitSeverity)) {
    return explicitSeverity;
  }

  const text = `${normalizeAemetAlertText(alert?.event)} ${normalizeAemetAlertText(
    alert?.description
  )} ${normalizeAemetAlertText(alert?.level)} ${normalizeAemetAlertText(alert?.severity)}`
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  if (/(extreme|extrem|rojo|vermell|red|molt important)/.test(text)) return 4;
  if (/(severe|important|high|alto|alt|naranja|taronja|orange)/.test(text)) return 3;
  if (/(moderate|moderat|moderado|yellow|amarillo|groc|jaune)/.test(text)) return 2;
  return 1;
}

function isAemetHeatRelatedAlert(...values) {
  const text = values
    .map(normalizeAemetAlertText)
    .join(" ")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  return /\b(heat|temperature|calor|temperatura|temperaturas maximas|temperatura maxima|maximum temperature|high temperature)\b/.test(
    text
  );
}

function getAemetLevelFromAlerts(alerts, nowTs = Math.floor(Date.now() / 1000)) {
  if (!Array.isArray(alerts) || alerts.length === 0) {
    return {
      level: 0,
      event: "",
      sender: "",
      description: "",
      timing: "",
    };
  }

  const relevantAlerts = alerts.filter(
    (alert) => typeof alert?.end !== "number" || alert.end >= nowTs
  );
  const activeAlerts = relevantAlerts
    .filter((alert) => typeof alert?.start !== "number" || alert.start <= nowTs)
    .sort((a, b) => {
      const severityDiff = getAemetAlertSeverity(b) - getAemetAlertSeverity(a);
      const startA = typeof a?.start === "number" ? a.start : Number.POSITIVE_INFINITY;
      const startB = typeof b?.start === "number" ? b.start : Number.POSITIVE_INFINITY;
      const endA = typeof a?.end === "number" ? a.end : Number.POSITIVE_INFINITY;
      const endB = typeof b?.end === "number" ? b.end : Number.POSITIVE_INFINITY;

      return severityDiff || startA - startB || endA - endB;
    });
  const upcomingAlerts = relevantAlerts
    .filter((alert) => typeof alert?.start === "number" && alert.start > nowTs)
    .sort((a, b) => {
      const startDiff = a.start - b.start;
      const severityDiff = getAemetAlertSeverity(b) - getAemetAlertSeverity(a);
      const endA = typeof a?.end === "number" ? a.end : Number.POSITIVE_INFINITY;
      const endB = typeof b?.end === "number" ? b.end : Number.POSITIVE_INFINITY;

      return startDiff || severityDiff || endA - endB;
    });
  const first = activeAlerts[0] || upcomingAlerts[0];

  if (!first) {
    return {
      level: 0,
      event: "",
      sender: "",
      description: "",
      timing: "",
    };
  }

  return {
    level: getAemetAlertSeverity(first),
    event: String(first.event || ""),
    sender: String(first.sender_name || ""),
    description: String(first.description || ""),
    timing: activeAlerts.length > 0 ? "active" : "soon",
    start: typeof first.start === "number" ? first.start : null,
    end: typeof first.end === "number" ? first.end : null,
  };
}

function isLegacyAemetEventKeyForEpisode(legacyKey, info, nowMs = Date.now()) {
  if (typeof legacyKey !== "string" || !legacyKey || legacyKey.startsWith("ow-alert-v1|")) {
    return false;
  }

  const parts = legacyKey.split("|");
  if (parts.length !== 5) return false;

  const [legacyLevel, legacyEvent, legacySender, legacyTiming, legacyDescription] = parts;
  const previousLevel = Number(legacyLevel);
  const currentLevel = Number(info?.level ?? 0);

  if (!Number.isFinite(previousLevel) || previousLevel < currentLevel) return false;
  if (legacyEvent !== String(info?.event ?? "")) return false;
  if (legacySender !== String(info?.sender ?? "")) return false;
  if (legacyDescription !== String(info?.description ?? "").slice(0, 120)) return false;
  if (legacyTiming && legacyTiming !== "soon" && legacyTiming !== "active") return false;

  const startMs = Number(info?.start) * 1000;
  const endMs = Number(info?.end) * 1000;

  if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) return false;
  if (!Number.isFinite(nowMs) || nowMs <= 0) return false;

  const currentTiming = String(info?.timing || "");

  if (currentTiming === "active") {
    return nowMs >= startMs - 24 * 60 * 60 * 1000 && nowMs <= endMs + 6 * 60 * 60 * 1000;
  }

  if (currentTiming === "soon") {
    return nowMs >= startMs - 2 * 60 * 60 * 1000 && nowMs <= startMs;
  }

  return false;
}

function getAemetNotificationDecision({ sub = {}, info, zoneKey = "", nowMs = Date.now() }) {
  const episodeKey = buildAemetEpisodeKey(info, zoneKey);
  const currentLevel = Number(info?.level ?? 0);
  const storedEpisodeKey = String(sub.lastAemetEpisodeKey || "");
  const storedEventKey = String(sub.lastAemetEventKey || "");
  const storedLevel = Number(sub.lastAemetNotifiedLevel ?? sub.lastAemetLevel ?? 0);
  const notifiedLevel = Number.isFinite(storedLevel) ? storedLevel : 0;
  const sameEpisode =
    Boolean(episodeKey) &&
    (storedEpisodeKey === episodeKey ||
      storedEventKey === episodeKey ||
      isLegacyAemetEventKeyForEpisode(storedEventKey, info, Number(sub.lastAemetAt ?? nowMs)));

  if (!episodeKey || currentLevel <= 0) {
    return {
      shouldNotify: false,
      episodeKey,
      notifiedLevel,
      nextNotifiedLevel: notifiedLevel,
      reason: "noRisk",
    };
  }

  if (sameEpisode && notifiedLevel >= currentLevel) {
    return {
      shouldNotify: false,
      episodeKey,
      notifiedLevel,
      nextNotifiedLevel: notifiedLevel,
      reason: "repeatedAlert",
    };
  }

  return {
    shouldNotify: true,
    episodeKey,
    notifiedLevel: sameEpisode ? notifiedLevel : 0,
    nextNotifiedLevel: sameEpisode ? Math.max(notifiedLevel, currentLevel) : currentLevel,
    reason: sameEpisode ? "escalatedAlert" : "newEpisode",
  };
}

function buildAemetNotifiedState({ info, episodeKey, notifiedLevel, nowMs, todayKey }) {
  const nextLevel = Math.max(Number(notifiedLevel ?? 0) || 0, Number(info?.level ?? 0) || 0);

  return {
    lastAemetAt: nowMs,
    lastAemetLevel: nextLevel,
    lastAemetNotifiedLevel: nextLevel,
    lastAemetEvent: info?.event || "",
    lastAemetSender: info?.sender || "",
    lastAemetEpisodeKey: episodeKey || "",
    lastAemetEventKey: episodeKey || "",
    lastAemetResetDay: todayKey,
  };
}

module.exports = {
  buildAemetEpisodeKey,
  buildAemetNotifiedState,
  buildLegacyAemetEventKey,
  getAemetAlertSeverity,
  getAemetLevelFromAlerts,
  getAemetNotificationDecision,
  isAemetHeatRelatedAlert,
  isLegacyAemetEventKeyForEpisode,
};
