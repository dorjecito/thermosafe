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
      style={{
        position: "fixed",
        top: 0,
        width: "100%",
        background: "#ffcc00",
        color: "#000",
        padding: "0.8rem",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        zIndex: 9999,
        fontWeight: 600,
        boxShadow: "0 2px 6px rgba(0,0,0,0.25)",
      }}
    >
      <span>{t("update.available")}</span>

      <button
        onClick={onReload}
        style={{
          background: "#000",
          color: "white",
          padding: "0.4rem 0.9rem",
          borderRadius: "6px",
          border: "none",
          cursor: "pointer",
          fontWeight: 700,
        }}
      >
        {t("update.reload")}
      </button>
    </div>
  );
}