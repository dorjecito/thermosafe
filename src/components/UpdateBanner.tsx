// src/components/UpdateBanner.tsx
import React from "react";
import { useTranslation } from "react-i18next";

interface Props {
  onReload: () => void;
}

export default function UpdateBanner({ onReload }: Props) {
  const { t } = useTranslation();

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: "fixed",
        right: "1rem",
        bottom: "1rem",
        maxWidth: "min(92vw, 360px)",
        background: "var(--card-bg)",
        color: "var(--card-text)",
        padding: "0.85rem 0.95rem",
        display: "flex",
        gap: "0.75rem",
        justifyContent: "space-between",
        alignItems: "center",
        borderRadius: "14px",
        border: "1px solid rgba(59,130,246,0.28)",
        zIndex: 9999,
        boxShadow: "0 8px 24px rgba(0,0,0,0.16)",
      }}
    >
      <div>
        <div style={{ fontWeight: 700 }}>{t("update.available")}</div>
        <div style={{ fontSize: "0.9rem", opacity: 0.82, marginTop: 2 }}>
          {t("update.description")}
        </div>
      </div>

      <button
        onClick={onReload}
        type="button"
        style={{
          background: "#1d4ed8",
          color: "white",
          padding: "0.4rem 0.9rem",
          borderRadius: "9px",
          border: "none",
          cursor: "pointer",
          fontWeight: 700,
          whiteSpace: "nowrap",
        }}
      >
        {t("update.reload")}
      </button>
    </div>
  );
}
