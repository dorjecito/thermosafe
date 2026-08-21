function normalizeAemetAlertText(value) {
  if (typeof value === "string") return value;
  if (value && typeof value === "object") {
    return Object.values(value)
      .filter((item) => typeof item === "string")
      .join(" ");
  }
  return "";
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
  };
}

module.exports = {
  getAemetAlertSeverity,
  getAemetLevelFromAlerts,
  isAemetHeatRelatedAlert,
};
