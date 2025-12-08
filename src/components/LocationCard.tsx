import React from "react";

interface Props {
  city: string;
  realCity: string;
  label: string;
}

export default function LocationCard({ city, realCity, label }: Props) {
  return (
    <div
      style={{
        padding: "1rem 1.2rem",
        borderRadius: "14px",
        border: "1px solid rgba(0,0,0,0.08)",
        background: "var(--card-bg)",
        boxShadow: "0 4px 10px rgba(0,0,0,0.08)",
        marginBottom: "1rem",
      }}
      className="location-card"
    >
      <h3
        style={{
          margin: 0,
          marginBottom: "0.4rem",
          fontSize: "1.15rem",
          fontWeight: 700,
          display: "flex",
          alignItems: "center",
          gap: "0.45rem",
          color: "var(--card-title)",
        }}
      >
         {label}
      </h3>

      <p
        style={{
          margin: 0,
          fontSize: "1.05rem",
          color: "var(--card-text)",
          fontWeight: 600,
        }}
      >
        {city}
        {realCity && realCity !== city && (
          <span style={{ opacity: 0.6, fontWeight: 500 }}>
            {" "}
            ({realCity})
          </span>
        )}
      </p>
    </div>
  );
}