import React from "react";

interface CurrentConditionsProps {
  title: string;
  humidityLabel: string;
  humidity: number | null;
  windDirectionLabel: string;
  windDeg: number | null;
  windText: string;
  cloudinessLabel: string;
  clouds: number | null;
  fallbackClouds: number | null | undefined;
}

function CurrentConditions({
  title,
  humidityLabel,
  humidity,
  windDirectionLabel,
  windDeg,
  windText,
  cloudinessLabel,
  clouds,
  fallbackClouds,
}: CurrentConditionsProps) {
  const cloudinessText =
    typeof clouds === "number"
      ? `${clouds}%`
      : `${fallbackClouds ?? "—"}${typeof fallbackClouds === "number" ? "%" : ""}`;

  return (
    <div className="block-conditions block-conditions-compact">
      <h3 className="conditions-compact-title">{title}</h3>

      <div className="conditions-inline">
        <span className="condition-item">
          <strong>{humidityLabel}:</strong>{" "}
          {humidity !== null ? `${humidity}%` : "—"}
        </span>
        <span className="condition-item">
          <strong>{windDirectionLabel}:</strong>{" "}
          {windDeg !== null ? `${windText} (${windDeg.toFixed(0)}°)` : "—"}
        </span>
        <span className="condition-item">
          <strong>{cloudinessLabel}:</strong> {cloudinessText}
        </span>
      </div>
    </div>
  );
}

export default React.memo(CurrentConditions);
