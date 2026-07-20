import * as React from "react";
import { useTranslation } from "react-i18next";
import {
  buildDiagnosticsCopyText,
  createDiagnosticsSnapshot,
  formatTokenSyncStatus,
  getDiagnosticsChecks,
  getDiagnosticsMessages,
  getOverallDiagnosticsStatus,
  getServiceWorkerDiagnostics,
  getTokenSyncStatus,
  mergeServiceWorkerDiagnostics,
  roundedCoordinate,
  type DiagnosticStatus,
  type DiagnosticsAlertSetting,
  type DiagnosticsCopyLabels,
  type DiagnosticsLocationInfo,
  type DiagnosticsSnapshot,
} from "../utils/diagnostics";
import { TOKEN_LAST_SYNCED_LOCAL_KEY } from "../utils/tokenSyncMetadata";

type Props = {
  open: boolean;
  onClose: () => void;
  version: string;
  language: string;
  notificationsEnabled: boolean;
  pushEnabled: boolean;
  alertSettings: DiagnosticsAlertSetting[];
  location: DiagnosticsLocationInfo;
};

const modalOverlayStyle: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  zIndex: 10000,
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  padding: "1rem",
  background: "rgba(15, 23, 42, 0.58)",
};

const modalStyle: React.CSSProperties = {
  width: "min(720px, 100%)",
  maxHeight: "88vh",
  overflow: "auto",
  borderRadius: 18,
  border: "1px solid rgba(148, 163, 184, 0.35)",
  background: "var(--card-bg, #ffffff)",
  color: "var(--text-color, #111827)",
  boxShadow: "0 24px 70px rgba(15, 23, 42, 0.32)",
};

const headerStyle: React.CSSProperties = {
  position: "sticky",
  top: 0,
  zIndex: 1,
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "0.75rem",
  padding: "1rem 1rem 0.85rem",
  borderBottom: "1px solid rgba(148, 163, 184, 0.25)",
  background: "var(--card-bg, #ffffff)",
};

const contentStyle: React.CSSProperties = {
  padding: "0.95rem 1rem 1rem",
  display: "grid",
  gap: "0.85rem",
};

const sectionStyle: React.CSSProperties = {
  padding: "0.85rem",
  borderRadius: 14,
  border: "1px solid rgba(148, 163, 184, 0.26)",
  background: "rgba(148, 163, 184, 0.08)",
};

const gridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
  gap: "0.45rem 0.8rem",
};

const rowStyle: React.CSSProperties = {
  display: "grid",
  gap: 2,
};

const labelStyle: React.CSSProperties = {
  fontSize: "0.78rem",
  opacity: 0.72,
  fontWeight: 700,
};

const valueStyle: React.CSSProperties = {
  fontSize: "0.92rem",
  fontWeight: 650,
  overflowWrap: "anywhere",
};

const actionRowStyle: React.CSSProperties = {
  display: "flex",
  gap: "0.55rem",
  flexWrap: "wrap",
  justifyContent: "flex-end",
};

function getEnvironment() {
  const nav = typeof navigator !== "undefined" ? navigator : null;
  const win = typeof window !== "undefined" ? window : null;
  const readLocalStorage = (keys: string[]) => {
    try {
      for (const key of keys) {
        const value = win?.localStorage?.getItem(key);
        if (value) return value;
      }
    } catch {
      return null;
    }
    return null;
  };

  return {
    userAgent: nav?.userAgent,
    platform: nav?.platform,
    maxTouchPoints: nav?.maxTouchPoints,
    standalone: Boolean((nav as any)?.standalone),
    displayModeStandalone: Boolean(win?.matchMedia?.("(display-mode: standalone)")?.matches),
    displayModeFullscreen: Boolean(win?.matchMedia?.("(display-mode: fullscreen)")?.matches),
    displayModeMinimalUi: Boolean(win?.matchMedia?.("(display-mode: minimal-ui)")?.matches),
    locationOrigin: win?.location?.origin,
    hostname: win?.location?.hostname,
    online: nav?.onLine,
    notificationSupported: typeof Notification !== "undefined",
    notificationPermission:
      typeof Notification !== "undefined" ? Notification.permission : "unsupported",
    serviceWorkerSupported: Boolean(nav && "serviceWorker" in nav),
    pushManagerSupported: typeof PushManager !== "undefined",
    token: readLocalStorage(["fcmToken"]),
    lastTokenSync: readLocalStorage([
      TOKEN_LAST_SYNCED_LOCAL_KEY,
      "fcmTokenLastSyncAt",
      "lastFcmTokenSync",
      "lastTokenSync",
      "fcmTokenUpdatedAt",
    ]),
    now: new Date(),
  };
}

function statusIcon(status: DiagnosticStatus) {
  if (status === "ok") return "🟢";
  if (status === "info") return "ℹ️";
  if (status === "review") return "🟠";
  if (status === "error") return "🔴";
  return "⚪";
}

function Field({
  label,
  value,
}: {
  label: React.ReactNode;
  value: React.ReactNode;
}) {
  return (
    <div style={rowStyle}>
      <span style={labelStyle}>{label}</span>
      <span style={valueStyle}>{value}</span>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section style={sectionStyle}>
      <h3 style={{ margin: "0 0 0.65rem", fontSize: "1rem" }}>{title}</h3>
      {children}
    </section>
  );
}

export default function NotificationDiagnosticsModal({
  open,
  onClose,
  version,
  language,
  notificationsEnabled,
  pushEnabled,
  alertSettings,
  location,
}: Props) {
  const { t } = useTranslation();
  const closeButtonRef = React.useRef<HTMLButtonElement | null>(null);
  const [copied, setCopied] = React.useState(false);
  const [snapshot, setSnapshot] = React.useState<DiagnosticsSnapshot | null>(null);

  const tr = React.useCallback((key: string) => t(`diagnostics.${key}`), [t]);

  React.useEffect(() => {
    if (!open) return;
    const environment = getEnvironment();

    const baseSnapshot = createDiagnosticsSnapshot(
      {
        version,
        language,
        notificationsEnabled,
        pushEnabled,
        alertSettings,
        location,
      },
      environment
    );

    setSnapshot(baseSnapshot);
    setCopied(false);
    window.setTimeout(() => closeButtonRef.current?.focus(), 0);

    let alive = true;
    getServiceWorkerDiagnostics(environment.locationOrigin).then((serviceWorker) => {
      if (!alive) return;
      setSnapshot((current) =>
        current ? mergeServiceWorkerDiagnostics(current, serviceWorker) : current
      );
    });

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);

    return () => {
      alive = false;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [
    open,
    version,
    language,
    notificationsEnabled,
    pushEnabled,
    alertSettings,
    location,
    onClose,
  ]);

  if (!open || !snapshot) return null;

  const checks = getDiagnosticsChecks(snapshot);
  const overall = getOverallDiagnosticsStatus(checks);
  const messages = getDiagnosticsMessages(snapshot);
  const isAndroid = snapshot.platform === "Android";
  const isIos = snapshot.platform === "iOS";
  const boolText = (value: boolean | null) =>
    value == null ? tr("unknownValue") : value ? tr("yes") : tr("no");
  const supportedText = (value: boolean | null) =>
    value == null ? tr("unknownValue") : value ? tr("supported") : tr("notSupported");
  const roundedLat = roundedCoordinate(snapshot.location.lat);
  const roundedLon = roundedCoordinate(snapshot.location.lon);

  const copyLabels: DiagnosticsCopyLabels = {
    title: tr("copyTitle"),
    version: tr("version"),
    platform: tr("platform"),
    browser: tr("browser"),
    language: tr("language"),
    displayMode: tr("displayMode"),
    localTime: tr("localTime"),
    online: tr("online"),
    notificationPermission: tr("notificationPermission"),
    notificationsEnabled: tr("notificationsEnabled"),
    pushEnabled: tr("pushEnabled"),
    firebaseMessaging: tr("firebaseMessaging"),
    fcmToken: tr("fcmToken"),
    tokenLength: tr("tokenLength"),
    serviceWorker: tr("serviceWorker"),
    serviceWorkerOrigin: tr("origin"),
    location: tr("location"),
    zone: tr("zone"),
    lastWeatherUpdate: tr("lastWeatherUpdate"),
    lastLocationUpdate: tr("lastLocationUpdate"),
    lastTokenSync: tr("lastTokenSync"),
    overallStatus: tr("overallStatus"),
    yes: tr("yes"),
    no: tr("no"),
    unavailable: tr("unknownValue"),
    notRegisteredLocally: tr("notRegisteredLocally"),
    relativeMinute: tr("relativeMinute"),
    relativeMinutes: tr("relativeMinutes"),
    relativeHour: tr("relativeHour"),
    relativeHours: tr("relativeHours"),
    relativeDay: tr("relativeDay"),
    relativeDays: tr("relativeDays"),
    ok: tr("overallOkShort"),
    review: tr("overallReviewShort"),
    error: tr("overallErrorShort"),
    unknown: tr("unknownValue"),
    info: tr("info"),
  };
  const tokenSyncValue = formatTokenSyncStatus(
    getTokenSyncStatus(snapshot.token.available, snapshot.location.lastTokenSync),
    copyLabels
  );

  const copyDiagnostics = async () => {
    const text = buildDiagnosticsCopyText(snapshot, copyLabels);
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
    } else {
      const area = document.createElement("textarea");
      area.value = text;
      area.setAttribute("readonly", "true");
      area.style.position = "fixed";
      area.style.opacity = "0";
      document.body.appendChild(area);
      area.select();
      document.execCommand("copy");
      document.body.removeChild(area);
    }
    setCopied(true);
  };

  return (
    <div style={modalOverlayStyle} onPointerDown={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="thermosafe-diagnostics-title"
        style={modalStyle}
        onPointerDown={(event) => event.stopPropagation()}
      >
        <div style={headerStyle}>
          <h2 id="thermosafe-diagnostics-title" style={{ margin: 0, fontSize: "1.15rem" }}>
            {tr("title")}
          </h2>
          <button ref={closeButtonRef} type="button" onClick={onClose}>
            {tr("close")}
          </button>
        </div>

        <div style={contentStyle}>
          <Section title={tr("general")}>
            <div style={gridStyle}>
              <Field label={tr("version")} value={snapshot.version} />
              <Field label={tr("language")} value={snapshot.language} />
              <Field label={tr("platform")} value={snapshot.platform} />
              <Field label={tr("browser")} value={snapshot.browser} />
              <Field label={tr("displayMode")} value={snapshot.displayMode} />
              <Field label={tr("localTime")} value={snapshot.localTime} />
              <Field label={tr("online")} value={boolText(snapshot.online)} />
            </div>
          </Section>

          <Section title={tr("notifications")}>
            <div style={gridStyle}>
              <Field
                label={tr("notificationApi")}
                value={supportedText(snapshot.notificationSupported)}
              />
              <Field
                label={tr("notificationPermission")}
                value={tr(`permission.${snapshot.notificationPermission}`)}
              />
              <Field
                label={tr("notificationsEnabled")}
                value={boolText(snapshot.notificationsEnabled)}
              />
              <Field label={tr("pushEnabled")} value={boolText(snapshot.pushEnabled)} />
              {snapshot.alertSettings.map((setting) => (
                <Field
                  key={setting.key}
                  label={t(`diagnostics.alerts.${setting.key}`, setting.key)}
                  value={boolText(setting.enabled)}
                />
              ))}
            </div>
          </Section>

          <Section title={tr("firebaseMessaging")}>
            <div style={gridStyle}>
              <Field
                label={tr("firebaseMessaging")}
                value={supportedText(snapshot.firebaseMessagingSupported)}
              />
              <Field
                label={tr("fcmToken")}
                value={snapshot.token.available ? tr("available") : tr("notAvailable")}
              />
              <Field
                label={tr("tokenLength")}
                value={snapshot.token.length ?? tr("unknownValue")}
              />
            </div>
          </Section>

          <Section title={tr("serviceWorker")}>
            <div style={gridStyle}>
              <Field
                label={tr("support")}
                value={supportedText(snapshot.serviceWorker.supported)}
              />
              <Field
                label={tr("registered")}
                value={boolText(snapshot.serviceWorker.registered)}
              />
              <Field
                label={tr("controllerActive")}
                value={boolText(snapshot.serviceWorker.controllerActive)}
              />
              <Field
                label={tr("state")}
                value={t(`diagnostics.swState.${snapshot.serviceWorker.state}`)}
              />
              <Field
                label={tr("origin")}
                value={snapshot.serviceWorker.origin || tr("notAvailableThisSession")}
              />
            </div>
          </Section>

          <Section title={tr("locationSection")}>
            <div style={gridStyle}>
              <Field label={tr("location")} value={snapshot.location.place || tr("unknownValue")} />
              <Field label={tr("zone")} value={snapshot.location.zone || tr("unknownValue")} />
              <Field
                label={tr("coordinates")}
                value={
                  roundedLat && roundedLon ? `${roundedLat}, ${roundedLon}` : tr("unknownValue")
                }
              />
              <Field label={tr("language")} value={snapshot.location.lang || snapshot.language} />
              <Field
                label={tr("lastWeatherUpdate")}
                value={snapshot.location.lastWeatherUpdate || tr("notAvailableThisSession")}
              />
              <Field
                label={tr("lastLocationUpdate")}
                value={snapshot.location.lastLocationUpdate || tr("locationNotUpdatedThisSession")}
              />
              <Field
                label={tr("lastTokenSync")}
                value={tokenSyncValue}
              />
            </div>
          </Section>

          <Section title={tr("selfCheck")}>
            <div style={{ display: "grid", gap: "0.35rem" }}>
              {checks.map((check) => (
                <div key={check.key}>
                  {statusIcon(check.status)}{" "}
                  {t(`diagnostics.checks.${check.detailKey || check.key}`)} ·{" "}
                  {t(`diagnostics.status.${check.status}`)}
                </div>
              ))}
            </div>
          </Section>

          <Section title={tr("overallStatus")}>
            <p style={{ margin: "0 0 0.55rem" }}>
              {overall === "ok"
                ? tr("overallOk")
                : overall === "review"
                ? tr("overallReview")
                : overall === "error"
                ? tr("overallError")
                : tr("overallUnknown")}
            </p>
            <div style={{ display: "grid", gap: "0.35rem" }}>
              {messages.map((message) => (
                <div key={message}>• {t(`diagnostics.messages.${message}`)}</div>
              ))}
            </div>
          </Section>

          {(isAndroid || isIos) && (
            <Section title={isAndroid ? tr("androidChecks") : tr("iosChecks")}>
              <div style={{ display: "grid", gap: "0.3rem" }}>
                {(isAndroid
                  ? ["showNotifications", "soundVibration", "battery", "unusedPermissions", "noExtremeSaver"]
                  : ["notificationsAllowed", "focus", "scheduledSummary", "pwaInstalled"]
                ).map((key) => (
                  <label key={key}>
                    <input type="checkbox" disabled />{" "}
                    {t(`diagnostics.manual.${key}`)}
                  </label>
                ))}
              </div>
            </Section>
          )}

          <Section title={tr("supportInfo")}>
            <p style={{ margin: "0 0 0.65rem", opacity: 0.82 }}>
              {tr("supportSubtitle")}
            </p>
            <div style={gridStyle}>
              <Field label={tr("version")} value={snapshot.version} />
              <Field label={tr("platform")} value={snapshot.platform} />
              <Field label={tr("browser")} value={snapshot.browser} />
              <Field label={tr("language")} value={snapshot.language} />
              <Field label={tr("displayMode")} value={snapshot.displayMode} />
              <Field label={tr("localTime")} value={snapshot.localTime} />
              <Field
                label={tr("lastWeatherUpdate")}
                value={snapshot.location.lastWeatherUpdate || tr("notAvailableThisSession")}
              />
              <Field
                label={tr("lastLocationUpdate")}
                value={snapshot.location.lastLocationUpdate || tr("locationNotUpdatedThisSession")}
              />
              <Field
                label={tr("lastTokenSync")}
                value={tokenSyncValue}
              />
            </div>
          </Section>

          <div style={actionRowStyle}>
            {copied && <span role="status">{tr("copied")}</span>}
            <button type="button" onClick={copyDiagnostics}>
              {tr("copy")}
            </button>
            <button type="button" onClick={onClose}>
              {tr("close")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
