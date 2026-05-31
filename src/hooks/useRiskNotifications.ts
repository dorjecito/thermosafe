import { useState } from "react";
import { getColdRisk } from "../utils/getColdRisk";
import { getWindRisk } from "../utils/windRisk";
import { getUvLevelIndex } from "../utils/uv";

type Params = {
  t: any;
  city: string | null;
  realCity: string | null;
  pushEnabled: boolean;
  enableColdAlerts: boolean;
  enableWindAlerts: boolean;
  enableUvAlerts: boolean;
  dataSource: "gps" | "search" | null;
};

const COLD_ALERT_MIN_INTERVAL_MIN = 60;
const WIND_ALERT_MIN_INTERVAL_MIN = 60;
const HEAT_ALERT_MIN_INTERVAL_MIN = 60;

function getLocalDayKey(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function showBrowserNotification(title: string, body: string, tag?: string) {
  if (!("Notification" in window)) return;
  if (!("serviceWorker" in navigator)) return;

  const show = async () => {
    const registration = await navigator.serviceWorker.ready;

    registration.showNotification(title, {
      body,
      icon: "/icons/icon-192.png",
      tag: tag || "thermosafe-alert",
    });
  };

  if (Notification.permission === "granted") {
    show();
  } else if (Notification.permission !== "denied") {
    Notification.requestPermission().then((perm) => {
      if (perm === "granted") show();
    });
  }
}

export function useRiskNotifications({
  t,
  city,
  realCity,
  pushEnabled,
  enableColdAlerts,
  enableWindAlerts,
  enableUvAlerts,
  dataSource,
}: Params) {
  const [msgHeat, setMsgHeat] = useState<string | null>(null);

  const place = realCity || city || t("location");
  const safePlace = place.toLowerCase().replace(/\s+/g, "-");

  async function maybeNotifyCold(temp: number, windKmh: number) {
    if (!pushEnabled) return;
    if (!enableColdAlerts) return;
    if (dataSource !== "gps") return;

    const coldRiskValue = getColdRisk(temp, windKmh);
    const storagePrefix = `cold-${safePlace}`;
    const previousRisk = localStorage.getItem(`${storagePrefix}-risk`) || "cap";
    const rank: Record<string, number> = {
      cap: 0,
      lleu: 1,
      moderat: 2,
      alt: 3,
      "molt alt": 4,
      extrem: 5,
    };

    const now = Date.now();
    const lastColdAlert = Number(localStorage.getItem(`${storagePrefix}-at`)) || 0;
    const crossedUp = rank[coldRiskValue] > rank[previousRisk];

    if (
      coldRiskValue !== "cap" &&
      crossedUp &&
      now - lastColdAlert >= COLD_ALERT_MIN_INTERVAL_MIN * 60 * 1000
    ) {
      const title = `❄️ ${t("notify.coldTitle")} · ${place}`;
      const msg = t("notify.coldBody", {
        risk: t(`coldRisk.${coldRiskValue}`),
        temp: temp.toFixed(1),
      });

      showBrowserNotification(title, msg, `cold-${safePlace}`);
      localStorage.setItem(`${storagePrefix}-at`, now.toString());
    }
    localStorage.setItem(`${storagePrefix}-risk`, coldRiskValue);
  }

  async function maybeNotifyWind(kmh: number) {
    if (!pushEnabled) return;
    if (!enableWindAlerts) return;
    if (dataSource !== "gps") return;

    const risk = getWindRisk(kmh);

    const prev = (localStorage.getItem("lastWindRisk") as any) || "none";
    const lastAt = Number(localStorage.getItem("lastWindAlertAt") || "0");

    const cooldownOk =
      (Date.now() - lastAt) / 60000 >= WIND_ALERT_MIN_INTERVAL_MIN;

    const rank: Record<string, number> = {
      none: 0,
      breezy: 1,
      moderate: 2,
      strong: 3,
      very_strong: 4,
    };

    const crossedUp = rank[risk] > rank[prev] && rank[risk] >= rank["moderate"];

    if (crossedUp && cooldownOk) {
      const title = `💨 ${t("notify.windTitle")} · ${place}`;

      const msg = t("notify.windBody", {
        risk: t("windRisk." + risk),
        speed: kmh.toFixed(1),
      });

      showBrowserNotification(title, msg, `wind-${safePlace}`);

      localStorage.setItem("lastWindAlertAt", Date.now().toString());
    }
    localStorage.setItem("lastWindRisk", risk);
  }

  async function maybeNotifyUV(uvi: number | null) {
    if (!pushEnabled || uvi == null) return;
    if (!enableUvAlerts) return;
    if (dataSource !== "gps") return;

    const currentUvLevel = getUvLevelIndex(uvi);
    if (currentUvLevel === 0) return;

    const storagePrefix = `uv-${safePlace}`;
    const storedDay = localStorage.getItem(`${storagePrefix}-day`);
    const today = getLocalDayKey();
    const lastUvLevel =
      storedDay === today
        ? Number(localStorage.getItem(`${storagePrefix}-level`) || "0")
        : 0;

    if (currentUvLevel <= lastUvLevel) return;

    const title = `${t("notify.uvTitle")} · ${place}`;
    const bodyKey =
      currentUvLevel === 4
        ? "notify.uvExtreme"
        : currentUvLevel === 3
        ? "notify.uvVeryHigh"
        : currentUvLevel === 2
        ? "notify.uvHigh"
        : "notify.uvModerate";

    showBrowserNotification(title, t(bodyKey), storagePrefix);
    localStorage.setItem(`${storagePrefix}-day`, today);
    localStorage.setItem(`${storagePrefix}-level`, String(currentUvLevel));
  }

  async function maybeNotifyHeat(hi: number | null) {
    if (!pushEnabled || hi == null) return;
    if (dataSource !== "gps") return;

    const storagePrefix = `heat-${safePlace}`;
    const currentLevel = hi >= 54 ? 3 : hi >= 41 ? 2 : hi >= 32 ? 1 : 0;
    const previousLevel = Number(localStorage.getItem(`${storagePrefix}-level`) || "0");
    const lastAt = Number(localStorage.getItem(`${storagePrefix}-at`) || "0");
    const cooldownOk =
      Date.now() - lastAt >= HEAT_ALERT_MIN_INTERVAL_MIN * 60 * 1000;

    if (currentLevel > previousLevel && cooldownOk && hi >= 54) {
      showBrowserNotification(
        `🔥 ${t("notify.heatTitle")} · ${place}`,
        t("notify.heatBody", { risk: t("heatRisk.extreme"), hi: hi.toFixed(1) }),
        `heat-${safePlace}`
      );
    } else if (currentLevel > previousLevel && cooldownOk && hi >= 41) {
      showBrowserNotification(
        `🌋 ${t("notify.heatTitle")} · ${place}`,
        t("notify.heatBody", { risk: t("heatRisk.high"), hi: hi.toFixed(1) }),
        `heat-${safePlace}`
      );
    } else if (currentLevel > previousLevel && cooldownOk && hi >= 32) {
      showBrowserNotification(
        `☀️ ${t("notify.heatTitle")} · ${place}`,
        t("notify.heatBody", { risk: t("heatRisk.moderate"), hi: hi.toFixed(1) }),
        `heat-${safePlace}`
      );
    }
    if (currentLevel > previousLevel && cooldownOk) {
      localStorage.setItem(`${storagePrefix}-at`, Date.now().toString());
    }
    localStorage.setItem(`${storagePrefix}-level`, String(currentLevel));
  }

  return {
    maybeNotifyCold,
    maybeNotifyWind,
    maybeNotifyUV,
    maybeNotifyHeat,
    msgHeat,
    setMsgHeat,
  };
}
