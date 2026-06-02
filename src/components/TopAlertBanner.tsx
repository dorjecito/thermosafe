// src/components/TopAlertBanner.tsx
import React, { useEffect, useMemo, useState } from "react";

type Props = {
  primary: any;
  heatRisk: any;
  uvi: number | null;
  day: boolean;
  weatherMain: string | null;
  clouds: number | null;
  irr: number | null;
  aemetActive?: boolean;
  aemetSoon?: boolean;
  t: (key: string) => string;
  UV_HIGH: number;
  UV_EXTREME: number;
};

export default function TopAlertBanner({
  primary,
  heatRisk,
  uvi,
  day,
  weatherMain,
  clouds,
  irr,
  aemetActive,
  aemetSoon,
  t,
  UV_HIGH,
  UV_EXTREME,
}: Props) {
  const [bannerAnimKey, setBannerAnimKey] = useState(0);
  const [prevBannerSeverity, setPrevBannerSeverity] = useState(0);

  const bannerState = useMemo(() => {
    if (aemetActive) {
      return {
        severity: 3,
        key: "aemet-active",
        content: "🚨 ALERTA AEMET ACTIVA",
        pulse: true,
        visualClass: "alert-banner-aemet-active",
      };
    }

    if (primary.kind === "heat" && heatRisk && heatRisk.isHigh) {
      return {
        severity: heatRisk.isExtreme ? 3 : 2,
        key: `heat-${heatRisk.isExtreme ? "extreme" : "high"}`,
        content: heatRisk.isExtreme ? t("alert_extreme") : t("alertRisk"),
        pulse: heatRisk.isExtreme,
      };
    }

    const hasUvi = typeof uvi === "number" && Number.isFinite(uvi);
    const normalizedUvi = hasUvi ? Math.max(0, uvi) : null;

    if (normalizedUvi !== null && normalizedUvi >= UV_EXTREME) {
      const key = "extremeUVIWarning";
      const raw = t(key);
      const safeText = raw === key ? t("highUVIWarning") : raw;

      return {
        severity: 3,
        key: `uv-extreme-${normalizedUvi.toFixed(1)}`,
        content: safeText,
        pulse: true,
      };
    }

    if (
      normalizedUvi !== null &&
      normalizedUvi >= UV_HIGH &&
      normalizedUvi < UV_EXTREME &&
      primary.kind === "uv" &&
      day &&
      !["Rain", "Drizzle", "Thunderstorm"].includes(weatherMain ?? "") &&
      (clouds ?? 0) < 85
    ) {
      return {
        severity: 2,
        key: `uv-high-${normalizedUvi.toFixed(1)}`,
        content: t("highUVIWarning"),
        pulse: false,
      };
    }

    if (primary.kind === "none" && irr !== null && irr >= 8) {
      return {
        severity: 1,
        key: `irr-${Math.round(irr)}`,
        content: (
          <>
            <p>{t("highIrradianceWarning")}</p>
            <p>{t("irradianceTips")}</p>
          </>
        ),
        pulse: false,
      };
    }

    return null;
  }, [aemetActive, primary, heatRisk, uvi, day, weatherMain, clouds, irr, t, UV_HIGH, UV_EXTREME]);

  useEffect(() => {
    const nextSeverity = bannerState?.severity ?? 0;

    if (nextSeverity > prevBannerSeverity) {
      setBannerAnimKey((k) => k + 1);
    }

    setPrevBannerSeverity(nextSeverity);
  }, [bannerState?.severity, prevBannerSeverity]);

  if (!bannerState) return null;

  return (
    <div
      key={`${bannerState.key}-${bannerAnimKey}`}
      className="top-alert-banner-wrap alert-banner-enter"
    >
      <div
        className={`alert-banner ${bannerState.visualClass ?? ""} ${bannerState.pulse ? "alert-banner-pulse" : ""}`}
      >
        {typeof bannerState.content === "string" ? (
          <p>{bannerState.content}</p>
        ) : (
          bannerState.content
        )}
      </div>
    </div>
  );
}
