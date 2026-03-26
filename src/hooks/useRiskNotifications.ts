import { useState } from "react";
import { getColdRisk } from "../utils/getColdRisk";
import { getWindRisk } from "../utils/windRisk";

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
    if (!enableColdAlerts) return;
    if (dataSource !== "gps") return;

    const coldRiskValue = getColdRisk(temp, windKmh);

    const now = Date.now();
    const lastColdAlert = Number(localStorage.getItem("lastColdAlert")) || 0;

    if (now - lastColdAlert < COLD_ALERT_MIN_INTERVAL_MIN * 60 * 1000) return;

    if (coldRiskValue !== "cap") {
      const title = `❄️ ${t("notify.coldTitle")} · ${place}`;
      const msg = t("notify.coldBody", {
        risk: t(`coldRisk.${coldRiskValue}`),
        temp: temp.toFixed(1),
      });

      showBrowserNotification(title, msg, `cold-${safePlace}`);
      localStorage.setItem("lastColdAlert", now.toString());
    }
  }

  async function maybeNotifyWind(kmh: number) {
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
      localStorage.setItem("lastWindRisk", risk);
    }
  }

  async function maybeNotifyUV(uvi: number | null) {
    if (!pushEnabled || uvi == null) return;
    if (!enableUvAlerts) return;
    if (dataSource !== "gps") return;

    const title = `${t("notify.uvTitle")} · ${place}`;

    if (uvi >= 8) {
      showBrowserNotification(
        title,
        t("notify.uvVeryHigh"),
        `uv-${safePlace}`
      );
    } else if (uvi >= 6) {
      showBrowserNotification(
        title,
        t("notify.uvHigh"),
        `uv-${safePlace}`
      );
    } else if (uvi >= 3) {
      showBrowserNotification(
        title,
        t("notify.uvModerate"),
        `uv-${safePlace}`
      );
    }
  }

  async function maybeNotifyHeat(hi: number | null) {
    if (!pushEnabled || hi == null) return;
    if (dataSource !== "gps") return;

    if (hi >= 54) {
      showBrowserNotification(
        `🔥 ${t("notify.heatTitle")} · ${place}`,
        t("notify.heatBody", { risk: t("heatRisk.extreme"), hi: hi.toFixed(1) }),
        `heat-${safePlace}`
      );
    } else if (hi >= 41) {
      showBrowserNotification(
        `🌋 ${t("notify.heatTitle")} · ${place}`,
        t("notify.heatBody", { risk: t("heatRisk.high"), hi: hi.toFixed(1) }),
        `heat-${safePlace}`
      );
    } else if (hi >= 32) {
      showBrowserNotification(
        `☀️ ${t("notify.heatTitle")} · ${place}`,
        t("notify.heatBody", { risk: t("heatRisk.moderate"), hi: hi.toFixed(1) }),
        `heat-${safePlace}`
      );
    }
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