import React from "react";
import { useTranslation } from "react-i18next";
import type { LangKey as AemetLangKey } from "../utils/aemetAi";

type LangKey = AemetLangKey | "en";

type Props = {
  lang: LangKey;              // "ca" | "es" | "eu" | "gl" | "en"
  risk: string;               // ex: "heat_moderate", "cold_mild", "cap", ...
  uvi: number | null;
  windRisk: string;           // ex: "none" | "breezy" | "moderate" | ...
  city?: string | null;       // opcional, per fer el share més útil
};

function normalizeLang(lng: string): LangKey {
  const s = (lng || "ca").slice(0, 2).toLowerCase();
  if (s === "ca" || s === "es" || s === "eu" || s === "gl" || s === "en") return s;
  return "ca";
}

export default function SafetyActions({
  lang,
  risk,
  uvi,
  windRisk,
  city,
}: Props) {
  const { t } = useTranslation();

  const l = normalizeLang(lang);

  // 🆘 Confirmació 112 (multiidioma)
  function confirmCall112(lng: LangKey) {
    const msg =
      ({
        ca: "Estàs segur que vols cridar a emergències?",
        es: "¿Seguro que quieres llamar a emergencias?",
        eu: "Larrialdietara deitu nahi duzula ziur zaude?",
        gl: "Tes certeza de que queres chamar ás emerxencias?",
        en: "Are you sure you want to call emergency services?",
      } as const)[lng] ?? t("confirm_emergency");

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
      riskLines.forEach((x) => lines.push(x));
      lines.push("");
    }

    lines.push(`ℹ️ ${t("official_advice_footer")}`);
    lines.push("");
    lines.push("ThermoSafe · INSST · AEMET");
    lines.push("");
    lines.push("🍎 iOS: https://thermosafe.app");
    lines.push("🤖 Android: https://play.google.com/store/apps/details?id=app.vercel.thermosafe.twa");

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
        onClick={() => confirmCall112(l)}
        title="Emergències"
      >
        🚨 112
      </button>
    </div>
  );
}