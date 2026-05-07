import "./CompactHeader.css";

type Props = {
  visible: boolean;
  city?: string | null;
  temp?: number | null;
};

export default function CompactHeader({
  visible,
  city,
  temp,
}: Props) {
  if (!visible) return null;

  return (
    <div className="compact-header">
      <span>☀️ ThermoSafe</span>

      <div className="compact-header-right">
        {city && <span>📍 {city}</span>}

        {typeof temp === "number" && (
          <span>{Math.round(temp)}°C</span>
        )}
      </div>
    </div>
  );
}
