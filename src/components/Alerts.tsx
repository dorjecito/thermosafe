import React from "react";
import { useTranslation } from "react-i18next";
import type { HeatRisk } from "../utils/heatRisk";

interface Props {
  hi: number | null;          // index de calor
  irr: number | null;         // irradiància solar W/m2
  uvi: number | null;         // índex UV
  heatRisk: HeatRisk | null;  // resultat combinat (inclou activitat)
  loading: boolean;
}

export default function Alerts({ hi, irr, uvi, heatRisk, loading }: Props) {
  const { t } = useTranslation();

  return (
    <div style={{ marginTop: "1rem" }}>
      
      {/* 🔥 ALERTA PER CALOR */}
      {hi !== null && hi >= 18 && heatRisk?.isHigh && (
        <div className="alert-banner">
          {heatRisk.isExtreme ? t("alert_extreme") : t("alertRisk")}
        </div>
      )}

      {/* ☀️ ALERTA PER IRRADIÀNCIA */}
      {irr !== null && irr >= 8 && (
        <div className="alert-banner">
          <p>{t("highIrradianceWarning")}</p>
          <p>{t("irradianceTips")}</p>
        </div>
      )}

      {/* 🔆 ALERTA PER UVI */}
      {uvi !== null && uvi >= 8 && (
        <div className="alert-banner">
          <p>{t("highUVIWarning")}</p>
        </div>
      )}

      {/* ⏳ LOADING */}
      {loading && (
        <p
          style={{
            color: "#1e90ff",
            fontStyle: "italic",
            textAlign: "center",
            marginBottom: "1rem",
          }}
        >
          {t("loading")}
        </p>
      )}
    </div>
  );
}