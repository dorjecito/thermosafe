import React from "react";

interface CurrentWeatherSummaryProps {
  risk: string;
  quickTempToneClass: string;
  temp: number | null;
  feelsLikeLabel: string;
  hi: number | null;
  windKmh: number | null;
  uvi: number | null;
}

function CurrentWeatherSummary({
  risk,
  quickTempToneClass,
  temp,
  feelsLikeLabel,
  hi,
  windKmh,
  uvi,
}: CurrentWeatherSummaryProps) {
  return (
    <div className={`quick-summary-card quick-summary-${risk}`}>
      <div className={`quick-temp ${quickTempToneClass}`}>
        {temp !== null ? `${temp.toFixed(1)}°C` : "—"}
      </div>

      <div className="quick-meta quick-meta-inline">
        <span>{hi !== null ? `${feelsLikeLabel}: ${hi.toFixed(1)}°C` : "—"}</span>
        <span>💨 {windKmh !== null ? `${windKmh.toFixed(1)} km/h` : "—"}</span>
        <span>☀️ {uvi !== null ? uvi.toFixed(1) : "—"}</span>
      </div>
    </div>
  );
}

export default React.memo(CurrentWeatherSummary);
