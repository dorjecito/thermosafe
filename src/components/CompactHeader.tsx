import "./CompactHeader.css";
import type * as React from "react";

type Props = {
  visible: boolean;
  city?: string | null;
  temp?: number | null;
  titleLongPressHandlers?: React.HTMLAttributes<HTMLSpanElement>;
};

export default function CompactHeader({
  visible,
  city,
  temp,
  titleLongPressHandlers,
}: Props) {
  if (!visible) return null;

  return (
    <div className="compact-header">
      <span {...titleLongPressHandlers}>☀️ ThermoSafe</span>

      <div className="compact-header-right">
        {city && <span>📍 {city}</span>}

        {typeof temp === "number" && (
          <span>{Math.round(temp)}°C</span>
        )}
      </div>
    </div>
  );
}
