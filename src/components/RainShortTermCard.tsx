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
    <section className="rain-short-term-card" aria-label={t("rain_short_term_title")}>
      <strong className="rain-short-term-title">🌧️ {t("rain_short_term_title")}</strong>
      <p className="rain-short-term-text">
        {summary.rainingNow ? t("rain_now") : t("rain_expected")}
        {summary.currentMm != null && summary.rainingNow ? ` · ${summary.currentMm.toFixed(1)} mm/h` : ""}
        {summary.forecastMm != null ? ` · ${summary.forecastMm.toFixed(1)} mm` : ""}
      </p>
      <p className="rain-short-term-detail">
        {endText ? t("rain_ends_at", { time: endText }) : t("rain_next_hours")}
      </p>
    </section>
  );
}
