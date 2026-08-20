export type AemetAlertPhase = "active" | "future" | "ended" | "unknown";

export type AemetAlertLike = {
  start?: unknown;
  end?: unknown;
  event?: unknown;
  description?: unknown;
  severity?: unknown;
  level?: unknown;
};

export type AemetAlertTimelineState<T extends AemetAlertLike> = {
  aemetActive: boolean;
  aemetSoon: boolean;
  activeAlert?: T;
  sortedAlerts: T[];
};

function normalizeText(value: unknown): string {
  if (typeof value === "string") return value;
  if (value && typeof value === "object") {
    return Object.values(value)
      .filter((item) => typeof item === "string")
      .join(" ");
  }
  return "";
}

export function getAemetAlertPhase(
  alert: AemetAlertLike,
  nowTs: number
): AemetAlertPhase {
  const start = alert.start;
  const end = alert.end;

  if (typeof start !== "number" || typeof end !== "number") {
    return "unknown";
  }

  if (nowTs >= start && nowTs <= end) return "active";
  if (start > nowTs) return "future";
  return "ended";
}

export function getAemetAlertSeverity(alert: AemetAlertLike): number {
  const explicitSeverity =
    typeof alert.severity === "number"
      ? alert.severity
      : typeof alert.level === "number"
        ? alert.level
        : null;

  if (explicitSeverity !== null && Number.isFinite(explicitSeverity)) {
    return explicitSeverity;
  }

  const text = `${normalizeText(alert.event)} ${normalizeText(alert.description)} ${normalizeText(alert.level)} ${normalizeText(alert.severity)}`
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  if (/(extreme|extrem|rojo|vermell|red|molt important)/.test(text)) return 4;
  if (/(severe|important|high|alto|alt|naranja|taronja|orange)/.test(text)) return 3;
  if (/(moderate|moderat|moderado|yellow|amarillo|groc|jaune)/.test(text)) return 2;
  return 1;
}

function phaseRank(phase: AemetAlertPhase): number {
  if (phase === "active") return 0;
  if (phase === "future") return 1;
  if (phase === "unknown") return 2;
  return 3;
}

export function compareAemetAlerts(
  a: AemetAlertLike,
  b: AemetAlertLike,
  nowTs: number
): number {
  const phaseA = getAemetAlertPhase(a, nowTs);
  const phaseB = getAemetAlertPhase(b, nowTs);
  const phaseDiff = phaseRank(phaseA) - phaseRank(phaseB);

  if (phaseDiff !== 0) return phaseDiff;

  const startA = typeof a.start === "number" ? a.start : Number.POSITIVE_INFINITY;
  const startB = typeof b.start === "number" ? b.start : Number.POSITIVE_INFINITY;
  const endA = typeof a.end === "number" ? a.end : Number.POSITIVE_INFINITY;
  const endB = typeof b.end === "number" ? b.end : Number.POSITIVE_INFINITY;
  const severityDiff = getAemetAlertSeverity(b) - getAemetAlertSeverity(a);

  if (phaseA === "active") {
    return severityDiff || startA - startB || endA - endB;
  }

  if (phaseA === "future") {
    return startA - startB || severityDiff || endA - endB;
  }

  return startA - startB || endA - endB || severityDiff;
}

export function sortAemetAlerts<T extends AemetAlertLike>(
  alerts: T[],
  nowTs: number
): T[] {
  return alerts
    .map((alert, index) => ({ alert, index }))
    .sort(
      (a, b) =>
        compareAemetAlerts(a.alert, b.alert, nowTs) || a.index - b.index
    )
    .map(({ alert }) => alert);
}

export function getAemetAlertTimelineState<T extends AemetAlertLike>(
  alerts: T[] | null | undefined,
  nowTs: number
): AemetAlertTimelineState<T> {
  if (!Array.isArray(alerts)) {
    return {
      aemetActive: false,
      aemetSoon: false,
      activeAlert: undefined,
      sortedAlerts: [],
    };
  }

  const sortedAlerts = sortAemetAlerts(alerts, nowTs);
  const activeAlerts = sortedAlerts.filter(
    (alert) => getAemetAlertPhase(alert, nowTs) === "active"
  );
  const futureAlerts = sortedAlerts.filter(
    (alert) => getAemetAlertPhase(alert, nowTs) === "future"
  );

  return {
    aemetActive: activeAlerts.length > 0,
    aemetSoon: futureAlerts.length > 0,
    activeAlert: activeAlerts[0],
    sortedAlerts,
  };
}
