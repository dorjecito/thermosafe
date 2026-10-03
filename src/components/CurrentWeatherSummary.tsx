import React from "react";

interface CurrentWeatherSummaryProps {
  risk: string;
  quickTempToneClass: string;
  temp: number | null;
  feelsLikeLabel: string;
  hi: number | null;
  windKmh: number | null;
  windLabel: string;
  gustLabel: string;
  gustMs?: unknown;
  uvi: number | null;
}

function CurrentWeatherSummary({
  risk,
  quickTempToneClass,
  temp,
  feelsLikeLabel,
  hi,
  windKmh,
  windLabel,
  gustLabel,
  gustMs,
  uvi,
}: CurrentWeatherSummaryProps) {
  // Presentation only: never substitute gusts for sustained wind.
  const gustKmh = typeof gustMs === "number" && Number.isFinite(gustMs) && gustMs >= 0
    && Number.isFinite(gustMs * 3.6) ? gustMs * 3.6 : null;
  return (
    <div className={`quick-summary-card quick-summary-${risk}`}>
      <div className={`quick-temp ${quickTempToneClass}`}>
        {temp !== null ? `${temp.toFixed(1)}°C` : "—"}
      </div>

      <div className="quick-meta quick-meta-inline">
        <span>{hi !== null ? `${feelsLikeLabel}: ${hi.toFixed(1)}°C` : "—"}</span>
        <span>💨 {windLabel} {windKmh !== null ? `${windKmh.toFixed(1)} km/h` : "—"}</span>
        {gustKmh !== null && <span>{gustLabel} {gustKmh.toFixed(1)} km/h</span>}
        <span>☀️ {uvi !== null ? uvi.toFixed(1) : "—"}</span>
      </div>
    </div>
  );
}

export default React.memo(CurrentWeatherSummary);
