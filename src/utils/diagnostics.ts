export type DiagnosticStatus = "ok" | "review" | "error" | "unknown" | "info";

export type NotificationPermissionState =
  | "granted"
  | "denied"
  | "default"
  | "unsupported"
  | "unknown";

export type DiagnosticsAlertSetting = {
  key: string;
  enabled: boolean | null;
};

export type DiagnosticsTokenInfo = {
  available: boolean;
  length: number | null;
};

export type DiagnosticsServiceWorkerInfo = {
  supported: boolean;
  registered: boolean | null;
  controllerActive: boolean | null;
  state: "active" | "waiting" | "installing" | "unknown";
  origin?: string | null;
};

export type DiagnosticsLocationInfo = {
  place?: string | null;
  zone?: string | null;
  lat?: number | null;
  lon?: number | null;
  lang?: string | null;
  lastWeatherUpdate?: string | null;
  lastLocationUpdate?: string | null;
  lastTokenSync?: string | number | null;
};

export type DiagnosticsSnapshot = {
  version: string;
  language: string;
  platform: string;
  browser: string;
  displayMode: string;
  isLocalhost: boolean;
  localTime: string;
  online: boolean | null;
  notificationSupported: boolean;
  notificationPermission: NotificationPermissionState;
  notificationsEnabled: boolean;
  pushEnabled: boolean;
  alertSettings: DiagnosticsAlertSetting[];
  firebaseMessagingSupported: boolean | null;
  token: DiagnosticsTokenInfo;
  serviceWorker: DiagnosticsServiceWorkerInfo;
  location: DiagnosticsLocationInfo;
};

export type DiagnosticsCheck = {
  key: string;
  status: DiagnosticStatus;
  detailKey?: string;
};

export type DiagnosticsCopyLabels = {
  title: string;
  version: string;
  platform: string;
  browser: string;
  language: string;
  displayMode: string;
  localTime: string;
  online: string;
  notificationPermission: string;
  notificationsEnabled: string;
  pushEnabled: string;
  firebaseMessaging: string;
  fcmToken: string;
  tokenLength: string;
  serviceWorker: string;
  serviceWorkerOrigin: string;
  location: string;
  zone: string;
  lastWeatherUpdate: string;
  lastLocationUpdate: string;
  lastTokenSync: string;
  notRegisteredLocally: string;
  relativeMinute: string;
  relativeMinutes: string;
  relativeHour: string;
  relativeHours: string;
  relativeDay: string;
  relativeDays: string;
  overallStatus: string;
  yes: string;
  no: string;
  unavailable: string;
  ok: string;
  review: string;
  error: string;
  unknown: string;
  info: string;
};

export type TokenSyncStatus =
  | { kind: "not_available" }
  | { kind: "not_registered" }
  | { kind: "relative"; unit: "minute" | "hour" | "day"; value: number }
  | { kind: "absolute"; value: string };

export type DiagnosticsInput = {
  version: string;
  language: string;
  notificationsEnabled: boolean;
  pushEnabled: boolean;
  alertSettings: DiagnosticsAlertSetting[];
  location: DiagnosticsLocationInfo;
};

export type DiagnosticsEnvironment = {
  userAgent?: string;
  platform?: string;
  maxTouchPoints?: number;
  standalone?: boolean;
  displayModeStandalone?: boolean;
  displayModeFullscreen?: boolean;
  displayModeMinimalUi?: boolean;
  locationOrigin?: string;
  hostname?: string;
  online?: boolean;
  notificationPermission?: NotificationPermissionState;
  notificationSupported?: boolean;
  serviceWorkerSupported?: boolean;
  pushManagerSupported?: boolean;
  token?: string | null;
  lastTokenSync?: string | number | null;
  now?: Date;
};

function formatBrowser(name: string, version: string | null): string {
  return version ? `${name} ${version}` : name;
}

function firstVersion(ua: string, pattern: RegExp): string | null {
  const match = ua.match(pattern);
  return match?.[1] || null;
}

export function detectPlatform(env: DiagnosticsEnvironment): string {
  const ua = `${env.userAgent || ""} ${env.platform || ""}`.toLowerCase();
  if (ua.includes("android")) return "Android";
  if (
    ua.includes("iphone") ||
    ua.includes("ipad") ||
    ua.includes("ipod") ||
    ((env.platform || "").toLowerCase().includes("mac") && (env.maxTouchPoints || 0) > 1)
  ) {
    return "iOS";
  }
  if (ua.includes("windows")) return "Windows";
  if (ua.includes("mac")) return "macOS";
  if (ua.includes("linux")) return "Linux";
  return "Unknown";
}

export function detectBrowser(env: DiagnosticsEnvironment): string {
  const rawUa = env.userAgent || "";
  const ua = rawUa.toLowerCase();
  if (ua.includes("edg/")) return formatBrowser("Edge", firstVersion(rawUa, /Edg\/(\d+)/));
  if (ua.includes("firefox/")) {
    return formatBrowser("Firefox", firstVersion(rawUa, /Firefox\/(\d+)/));
  }
  if (ua.includes("chrome/") && !ua.includes("edg/")) {
    return formatBrowser("Chrome", firstVersion(rawUa, /Chrome\/(\d+)/));
  }
  if (ua.includes("safari/") && !ua.includes("chrome/")) {
    return formatBrowser("Safari", firstVersion(rawUa, /Version\/(\d+)/));
  }
  return "Unknown";
}

export function detectDisplayMode(env: DiagnosticsEnvironment): string {
  if (env.displayModeFullscreen) return "Fullscreen";
  if (env.displayModeMinimalUi) return "Minimal-ui";
  if (env.standalone || env.displayModeStandalone) return "Standalone";
  return "Browser";
}

function isLocalhostEnvironment(env: DiagnosticsEnvironment): boolean {
  const host = env.hostname || "";
  if (host === "localhost" || host === "127.0.0.1" || host === "::1") return true;
  return Boolean(env.locationOrigin?.match(/^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/));
}

function parseStoredDate(value: string | number): Date | null {
  const raw = typeof value === "number" ? value : value.trim();
  if (raw === "") return null;
  const numericValue = typeof raw === "number" ? raw : /^\d+$/.test(raw) ? Number(raw) : NaN;
  const date = Number.isFinite(numericValue) ? new Date(numericValue) : new Date(raw);
  return Number.isFinite(date.getTime()) ? date : null;
}

export function formatAbsoluteDateTime(value: string | number, locale = "ca"): string {
  const date = parseStoredDate(value);
  if (!date) return String(value);
  return new Intl.DateTimeFormat(locale, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })
    .format(date)
    .replace(",", "");
}

export function getTokenSyncStatus(
  tokenAvailable: boolean,
  lastTokenSync: string | number | null | undefined,
  now: Date = new Date()
): TokenSyncStatus {
  if (!tokenAvailable) return { kind: "not_available" };
  if (lastTokenSync == null || lastTokenSync === "") return { kind: "not_registered" };

  const date = parseStoredDate(lastTokenSync);
  if (!date) return { kind: "absolute", value: String(lastTokenSync) };

  const diffMs = now.getTime() - date.getTime();
  if (!Number.isFinite(diffMs) || diffMs < 0) {
    return { kind: "absolute", value: formatAbsoluteDateTime(lastTokenSync) };
  }

  const minutes = Math.max(1, Math.floor(diffMs / 60000));
  if (minutes < 60) return { kind: "relative", unit: "minute", value: minutes };

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return { kind: "relative", unit: "hour", value: hours };

  return { kind: "relative", unit: "day", value: Math.floor(hours / 24) };
}

function withCount(template: string, count: number): string {
  return template.replace("{{count}}", String(count));
}

export function formatTokenSyncStatus(
  status: TokenSyncStatus,
  labels: Pick<
    DiagnosticsCopyLabels,
    | "unavailable"
    | "notRegisteredLocally"
    | "relativeMinute"
    | "relativeMinutes"
    | "relativeHour"
    | "relativeHours"
    | "relativeDay"
    | "relativeDays"
  >
): string {
  if (status.kind === "not_available") return labels.unavailable;
  if (status.kind === "not_registered") return labels.notRegisteredLocally;
  if (status.kind === "absolute") return status.value;

  if (status.unit === "minute") {
    return withCount(status.value === 1 ? labels.relativeMinute : labels.relativeMinutes, status.value);
  }
  if (status.unit === "hour") {
    return withCount(status.value === 1 ? labels.relativeHour : labels.relativeHours, status.value);
  }
  return withCount(status.value === 1 ? labels.relativeDay : labels.relativeDays, status.value);
}

export function createDiagnosticsSnapshot(
  input: DiagnosticsInput,
  env: DiagnosticsEnvironment
): DiagnosticsSnapshot {
  const notificationSupported = env.notificationSupported ?? false;
  const token = env.token || null;

  return {
    version: input.version,
    language: input.language,
    platform: detectPlatform(env),
    browser: detectBrowser(env),
    displayMode: detectDisplayMode(env),
    isLocalhost: isLocalhostEnvironment(env),
    localTime: (env.now || new Date()).toLocaleString(),
    online: typeof env.online === "boolean" ? env.online : null,
    notificationSupported,
    notificationPermission: notificationSupported
      ? env.notificationPermission || "unknown"
      : "unsupported",
    notificationsEnabled: input.notificationsEnabled,
    pushEnabled: input.pushEnabled,
    alertSettings: input.alertSettings,
    firebaseMessagingSupported:
      notificationSupported && Boolean(env.serviceWorkerSupported) && Boolean(env.pushManagerSupported),
    token: {
      available: Boolean(token),
      length: token ? token.length : null,
    },
    serviceWorker: {
      supported: Boolean(env.serviceWorkerSupported),
      registered: null,
      controllerActive: null,
      state: "unknown",
      origin: env.locationOrigin || null,
    },
    location: {
      ...input.location,
      lastTokenSync: input.location.lastTokenSync ?? env.lastTokenSync ?? null,
    },
  };
}

export async function getServiceWorkerDiagnostics(
  origin?: string | null
): Promise<DiagnosticsServiceWorkerInfo> {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) {
    return {
      supported: false,
      registered: null,
      controllerActive: null,
      state: "unknown",
      origin: origin || null,
    };
  }

  try {
    const registrations =
      typeof navigator.serviceWorker.getRegistrations === "function"
        ? await navigator.serviceWorker.getRegistrations()
        : [];
    const registration = registrations[0] || null;
    const state =
      registration?.active?.state === "activated"
        ? "active"
        : registration?.waiting?.state
        ? "waiting"
        : registration?.installing?.state
        ? "installing"
        : "unknown";

    return {
      supported: true,
      registered: registrations.length > 0,
      controllerActive: Boolean(navigator.serviceWorker.controller),
      state,
      origin: origin || (typeof window !== "undefined" ? window.location.origin : null),
    };
  } catch {
    return {
      supported: true,
      registered: null,
      controllerActive: Boolean(navigator.serviceWorker.controller),
      state: "unknown",
      origin: origin || (typeof window !== "undefined" ? window.location.origin : null),
    };
  }
}

export function mergeServiceWorkerDiagnostics(
  snapshot: DiagnosticsSnapshot,
  serviceWorker: DiagnosticsServiceWorkerInfo
): DiagnosticsSnapshot {
  return {
    ...snapshot,
    serviceWorker,
  };
}

export function getDiagnosticsChecks(snapshot: DiagnosticsSnapshot): DiagnosticsCheck[] {
  const tokenRequired = snapshot.pushEnabled || snapshot.notificationsEnabled;
  const pwaInstalled =
    snapshot.displayMode === "Standalone" ||
    snapshot.displayMode === "Fullscreen" ||
    snapshot.displayMode === "Minimal-ui";

  return [
    {
      key: "connection",
      status: snapshot.online === false ? "error" : snapshot.online === true ? "ok" : "unknown",
    },
    {
      key: "notificationApi",
      status: snapshot.notificationSupported ? "ok" : "error",
    },
    {
      key: "notificationPermission",
      status:
        snapshot.notificationPermission === "granted"
          ? "ok"
          : snapshot.notificationPermission === "denied"
          ? "error"
          : snapshot.notificationPermission === "default"
          ? "review"
          : "unknown",
    },
    {
      key: "thermosafeConfig",
      status: "ok",
    },
    {
      key: "push",
      status:
        !snapshot.pushEnabled
          ? "review"
          : snapshot.notificationPermission === "granted" && snapshot.token.available
          ? "ok"
          : "review",
    },
    {
      key: "firebaseMessaging",
      status:
        snapshot.firebaseMessagingSupported === true
          ? "ok"
          : snapshot.firebaseMessagingSupported === false
          ? "review"
          : "unknown",
    },
    {
      key: "fcmToken",
      status: snapshot.token.available ? "ok" : tokenRequired ? "review" : "unknown",
    },
    {
      key: "serviceWorker",
      status: !snapshot.serviceWorker.supported
        ? "error"
        : snapshot.serviceWorker.registered || snapshot.serviceWorker.controllerActive
        ? "ok"
        : snapshot.serviceWorker.registered === false
        ? "review"
        : "unknown",
    },
    {
      key: "pwa",
      status: pwaInstalled ? "ok" : "info",
      detailKey: snapshot.isLocalhost
        ? "localhostMode"
        : pwaInstalled
        ? "pwaInstalled"
        : "runningInBrowser",
    },
    {
      key: "location",
      status:
        snapshot.location.place ||
        (typeof snapshot.location.lat === "number" && typeof snapshot.location.lon === "number")
          ? "ok"
          : "unknown",
    },
  ];
}

export function getOverallDiagnosticsStatus(checks: DiagnosticsCheck[]): DiagnosticStatus {
  if (checks.some((check) => check.status === "error")) return "error";
  if (checks.some((check) => check.status === "review")) return "review";
  if (
    checks.every(
      (check) => check.status === "ok" || check.status === "unknown" || check.status === "info"
    )
  ) {
    return "ok";
  }
  return "unknown";
}

export function getDiagnosticsMessages(snapshot: DiagnosticsSnapshot): string[] {
  const messages: string[] = [];

  if (snapshot.online === false) messages.push("offline");
  if (snapshot.notificationPermission === "denied") messages.push("permissionDenied");
  if ((snapshot.pushEnabled || snapshot.notificationsEnabled) && !snapshot.token.available) {
    messages.push("missingToken");
  }
  if (
    snapshot.serviceWorker.supported &&
    snapshot.serviceWorker.registered === false &&
    !snapshot.serviceWorker.controllerActive
  ) {
    messages.push("missingServiceWorker");
  }
  if (messages.length === 0) messages.push("localOk", "backendHint");

  return messages;
}

export function roundedCoordinate(value: number | null | undefined): string | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return value.toFixed(2);
}

export function buildDiagnosticsCopyText(
  snapshot: DiagnosticsSnapshot,
  labels: DiagnosticsCopyLabels
): string {
  const checks = getDiagnosticsChecks(snapshot);
  const overall = getOverallDiagnosticsStatus(checks);
  const value = (enabled: boolean | null) =>
    enabled == null ? labels.unavailable : enabled ? labels.yes : labels.no;
  const statusText = labels[overall];
  const tokenText = snapshot.token.available ? labels.yes : labels.no;
  const tokenSyncText = formatTokenSyncStatus(
    getTokenSyncStatus(snapshot.token.available, snapshot.location.lastTokenSync),
    labels
  );
  const serviceWorkerText =
    snapshot.serviceWorker.state !== "unknown"
      ? snapshot.serviceWorker.state
      : snapshot.serviceWorker.controllerActive || snapshot.serviceWorker.registered
      ? labels.yes
      : labels.no;

  const lines = [
    labels.title,
    "",
    `${labels.version}: ${snapshot.version}`,
    `${labels.platform}: ${snapshot.platform}`,
    `${labels.browser}: ${snapshot.browser}`,
    `${labels.language}: ${snapshot.language}`,
    `${labels.displayMode}: ${snapshot.displayMode}`,
    `${labels.localTime}: ${snapshot.localTime}`,
    `${labels.online}: ${value(snapshot.online)}`,
    `${labels.notificationPermission}: ${snapshot.notificationPermission}`,
    `${labels.notificationsEnabled}: ${value(snapshot.notificationsEnabled)}`,
    `${labels.pushEnabled}: ${value(snapshot.pushEnabled)}`,
  ];

  snapshot.alertSettings.forEach((setting) => {
    lines.push(`${setting.key}: ${value(setting.enabled)}`);
  });

  lines.push(
    `${labels.firebaseMessaging}: ${value(snapshot.firebaseMessagingSupported)}`,
    `${labels.fcmToken}: ${tokenText}`,
    `${labels.tokenLength}: ${snapshot.token.length ?? labels.unavailable}`,
    `${labels.serviceWorker}: ${serviceWorkerText}`
  );
  if (snapshot.serviceWorker.origin) {
    lines.push(`${labels.serviceWorkerOrigin}: ${snapshot.serviceWorker.origin}`);
  }

  if (snapshot.location.place) lines.push(`${labels.location}: ${snapshot.location.place}`);
  if (snapshot.location.zone) lines.push(`${labels.zone}: ${snapshot.location.zone}`);
  if (snapshot.location.lastWeatherUpdate) {
    lines.push(`${labels.lastWeatherUpdate}: ${snapshot.location.lastWeatherUpdate}`);
  }
  if (snapshot.location.lastLocationUpdate) {
    lines.push(`${labels.lastLocationUpdate}: ${snapshot.location.lastLocationUpdate}`);
  }
  lines.push(`${labels.lastTokenSync}: ${tokenSyncText}`);

  lines.push(`${labels.overallStatus}: ${statusText}`);

  return lines.join("\n");
}

export type LongPressController = {
  start: () => void;
  cancel: () => void;
  dispose: () => void;
  isPending: () => boolean;
};

export function createLongPressController(
  onLongPress: () => void,
  options: {
    delayMs?: number;
    setTimeoutFn?: (callback: () => void, delayMs: number) => unknown;
    clearTimeoutFn?: (id: unknown) => void;
  } = {}
): LongPressController {
  const delayMs = options.delayMs ?? 1800;
  const setTimer = options.setTimeoutFn ?? ((callback, delay) => window.setTimeout(callback, delay));
  const clearTimer = options.clearTimeoutFn ?? ((id) => window.clearTimeout(id as number));
  let timer: unknown = null;

  const cancel = () => {
    if (timer == null) return;
    clearTimer(timer);
    timer = null;
  };

  return {
    start: () => {
      cancel();
      timer = setTimer(() => {
        timer = null;
        onLongPress();
      }, delayMs);
    },
    cancel,
    dispose: cancel,
    isPending: () => timer != null,
  };
}
