import React from "react";
import type { TFunction } from "i18next";
import type { RainShortTermSummary } from "../utils/rainShortTerm";

type Props = {
  summary: RainShortTermSummary;
  timezoneOffset?: number;
  t: TFunction;
};

export default function RainShortTermCard({ summary, timezoneOffset = 0, t }: Props) {
  if (!summary.visible) return null;

  const endText = summary.endAt
    ? new Date((summary.endAt + timezoneOffset) * 1000).toLocaleTimeString(undefined, {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "UTC",
      })
    : null;

  return (
    <section className="rain-short-term-card" aria-label={t(summary.rainingNow ? "rain_current_title" : "rain_forecast_title")}>
      <strong className="rain-short-term-title">
        🌧️ {t(summary.rainingNow ? "rain_current_title" : "rain_forecast_title")}
      </strong>
      <p className="rain-short-term-text">
        {summary.forecastMm != null
          ? t("rain_amount_next_hours", { amount: summary.forecastMm.toFixed(1) })
          : null}
      </p>
      {(summary.intensity || endText) && (
        <p className="rain-short-term-detail">
          {summary.intensity ? t(`rain_intensity_${summary.intensity}`) : null}
          {endText ? ` ${t("rain_ends_at", { time: endText })}` : null}
        </p>
      )}
    </section>
  );
}
