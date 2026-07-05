import React from "react";

interface SkyConditionCardProps {
  title: string;
  sky: string;
  icon: string;
  label: string;
}

function SkyConditionCard({ title, sky, icon, label }: SkyConditionCardProps) {
  return (
    <div className="card sky-card sky-card-compact">
      <div className="sky-inline">
        <h3>{title}:</h3>
        {icon && (
          <img
            src={`https://openweathermap.org/img/wn/${icon}@2x.png`}
            alt={sky}
            className="sky-icon"
            width="28"
            height="28"
          />
        )}
        <span className="sky-label">{label}</span>
      </div>
    </div>
  );
}

export default React.memo(SkyConditionCard);
