import React from "react";
import { useTranslation } from "react-i18next";
import type { LangKey } from "../utils/aemetAi";

type Props = {
  lang: LangKey;              // "ca" | "es" | "eu" | "gl"
  risk: string;               // ex: "heat_moderate", "cold_mild", "cap", ...
  uvi: number | null;
  windRisk: string;           // ex: "none" | "breezy" | "moderate" | ...
  city?: string | null;       // opcional, per fer el share més útil
};

export default function SafetyActions({
  lang,
  risk,
  uvi,
  windRisk,
  city,
}: Props) {
  const { t } = useTranslation();

  // 🆘 Confirmació 112 (multiidioma)
  function confirmCall112(l: LangKey) {
    const msg =
      {
        ca: "Estàs segur que vols cridar a emergències?",
        es: "¿Seguro que quieres llamar a emergencias?",
        eu: "Larrialdietara deitu nahi duzula ziur zaude?",
        gl: "Tes certeza de que queres chamar ás emerxencias?",
      }[l] ?? t("confirm_emergency");

    if (window.confirm(msg)) window.location.href = "tel:112";
  }

  // 📤 Compartir (compacte, però coherent)
  const share = async () => {
    const lines: string[] = [];

    lines.push(`🛡️ ${t("official_advice_title")} – ThermoSafe`);
    if (city) lines.push(`📍 ${city}`);
    lines.push("");

    const riskLines: string[] = [];

    // 🔥 Calor
    if (risk.startsWith("heat_") && !risk.endsWith("_safe")) {
      const lvl = risk.replace("heat_", "");
      riskLines.push(`• ${t("heat_risk")}: ${t(`risk_levels.${lvl}`, lvl)}`);
    }

    // ❄️ Fred
    if (risk.startsWith("cold_") && !risk.endsWith("_safe")) {
      const lvl = risk.replace("cold_", "");
      riskLines.push(`• ${t("cold_risk")}: ${t(`risk_levels.${lvl}`, lvl)}`);
    }

    // ☀️ UV
    if (typeof uvi === "number" && uvi >= 3) {
      riskLines.push(`• ${t("uvi")}: ${uvi.toFixed(1)}`);
    }

    // 💨 Vent
    if (
      windRisk &&
      ["moderate", "strong", "very_strong", "extreme"].includes(windRisk)
    ) {
      riskLines.push(`• ${t("wind_risk")}: ${t(`windRisk.${windRisk}`, windRisk)}`);
    }

    if (riskLines.length > 0) {
      lines.push(`📍 ${t("current_risk")}:`);
      riskLines.forEach((l) => lines.push(l));
      lines.push("");
    }

    lines.push(`ℹ️ ${t("official_advice_footer")}`);
    lines.push("");
    lines.push("ThermoSafe · INSST · AEMET");
    lines.push("");
    lines.push("🍎 iOS: https://thermosafe.app");
    lines.push("🤖 Android: https://play.google.com/store/apps/details?id=app.thermosafe");

    const text = lines.join("\n");

    if (navigator.share) {
      await navigator.share({ title: t("official_advice_title"), text });
    } else {
      await navigator.clipboard.writeText(text);
      alert(t("copied_clipboard"));
    }
  };

  return (
    <div className="safety-actions">
      <button className="safety-share-btn" onClick={share}>
        📤 {t("share")}
      </button>

      <button
        className="safety-112-btn"
        onClick={() => confirmCall112(lang)}
        title="Emergències"
      >
        🚨 112
      </button>
    </div>
  );
}