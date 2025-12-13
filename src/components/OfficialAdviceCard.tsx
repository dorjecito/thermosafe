import React, { useState } from "react";
import { useTranslation } from "react-i18next";

interface Props {
  risk: string;       // heat_mild, cold_extreme, etc.
  irr: number | null;
  uvi: number | null;
  windRisk: string;   // breezy, moderate, strong...
  lang: string;
}

export default function OfficialAdviceCard({
  risk,
  irr,
  uvi,
  windRisk,
  lang,
}: Props) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  /* ───────────────────────────────────────────────
     🆘 CONFIRMACIÓ 112
  ──────────────────────────────────────────────── */
  function confirmCall112(lang: string) {
    const msg =
      {
        ca: "Estàs segur que vols cridar a emergències?",
        es: "¿Seguro que quieres llamar a emergencias?",
        eu: "Larrialdietara deitu nahi duzula ziur zaude?",
        gl: "Tes certeza de que queres chamar ás emerxencias?",
      }[lang] ?? t("confirm_emergency");

    if (window.confirm(msg)) {
      window.location.href = "tel:112";
    }
  }

  /* ───────────────────────────────────────────────
     🎨 COLORS SEGONS RISC GLOBAL
  ──────────────────────────────────────────────── */
  const riskClass =
    risk.includes("extreme")
      ? "official-advanced-extreme"
      : risk.includes("high")
      ? "official-advanced-high"
      : risk.includes("moderate")
      ? "official-advanced-moderate"
      : "official-advanced-low";

  /* ───────────────────────────────────────────────
     ⚡ RECOMANACIONS DINÀMIQUES (curtes)
  ──────────────────────────────────────────────── */
  const dynamicAdvice: string[] = [];

  if (risk.startsWith("heat_")) {
    const lvl = risk.replace("heat_", "");
    const key = `officialAdviceDynamic.heat.${lvl}`;
    const txt = t(key);
    if (txt !== key) dynamicAdvice.push(txt);
  }

  if (risk.startsWith("cold_")) {
    const lvl = risk.replace("cold_", "");
    const key = `officialAdviceDynamic.cold.${lvl}`;
    const txt = t(key);
    if (txt !== key) dynamicAdvice.push(txt);
  }

  if (windRisk && windRisk !== "none") {
    const key = `officialAdviceDynamic.wind.${windRisk}`;
    const txt = t(key);
    if (txt !== key) dynamicAdvice.push(txt);
  }

  if (typeof uvi === "number" && uvi >= 3) {
    const lvl =
      uvi < 6 ? "moderate" : uvi < 8 ? "high" : uvi < 11 ? "very_high" : "extreme";
    const key = `officialAdviceDynamic.uv.${lvl}`;
    const txt = t(key);
    if (txt !== key) dynamicAdvice.push(txt);
  }

  /* ───────────────────────────────────────────────
     📘 RECOMANACIONS OFICIALS (INSST / AEMET)
  ──────────────────────────────────────────────── */
  const officialAdvice = (() => {
    if (risk.startsWith("heat_")) {
      return [
        t("official_advice.hydration"),
        t("official_advice.rest"),
        t("official_advice.sunAvoid"),
        t("official_advice.followAlerts"),
        t("official_advice.symptoms"),
      ];
    }

    if (risk.startsWith("cold_")) {
      return [
        t("official_advice.coldClothes"),
        t("official_advice.limitExposure"),
        t("official_advice.protectExtremities"),
        t("official_advice.avoidWind"),
        t("official_advice.followAlerts"),
        t("official_advice.symptomsCold"),
      ];
    }

    if (windRisk && windRisk !== "none") {
      return [
        t("official_advice.secureObjects"),
        t("official_advice.avoidTrees"),
        t("official_advice.avoidUnstableStructures"),
        t("official_advice.followAlerts"),
      ];
    }

    if (typeof uvi === "number" && uvi >= 8) {
      return [
        t("official_advice.useSPF"),
        t("official_advice.useShade"),
        t("official_advice.sunAvoid"),
        t("official_advice.followAlerts"),
      ];
    }

    return [t("official_advice.followAlerts")];
  })();

  /* ───────────────────────────────────────────────
     📤 COMPARTIR — text traduït + decimals
  ──────────────────────────────────────────────── */
  const share = () => {
    const text = `
🛡️ ${t("official_advice_title")} – ThermoSafe

📍 ${t("current_risk")}:
• ${t("heat_risk")}: ${t(`risk_levels.${risk.replace("heat_", "")}`, risk)}
${uvi !== null ? `• ${t("uvi")}: ${uvi.toFixed(1)}` : ""}
${windRisk && windRisk !== "none" ? `• ${t("wind_risk")}: ${t(`windRisk.${windRisk}`, windRisk)}` : ""}

📋 ${t("recommendations_title")}
${dynamicAdvice.map(a => `• ${a}`).join("\n")}

ℹ️ ${t("official_advice_footer")}

ThermoSafe · INSST · AEMET

🍎 iOS: https://apps.apple.com/app/thermosafe
🤖 Android: https://play.google.com/store/apps/details?id=app.thermosafe
`.trim();

    if (navigator.share) {
      navigator.share({
        title: t("official_advice_title"),
        text,
      });
    } else {
      navigator.clipboard.writeText(text);
      alert(t("copied_clipboard"));
    }
  };

  /* ───────────────────────────────────────────────
     🧱 RENDER
  ──────────────────────────────────────────────── */
  return (
    <div className={`official-advanced-card ${riskClass}`}>
      <h3>🛡️ {t("official_advice_title")}</h3>

      <button className="official-share-btn" onClick={share}>
        📤 {t("share")}
      </button>

      <button className="emergency-btn" onClick={() => confirmCall112(lang)}>
        🚨 112
      </button>

      <button className="official-expand-btn" onClick={() => setOpen(!open)}>
        {open ? `▲ ${t("hide_advice")}` : `▼ ${t("show_advice")}`}
      </button>

      {open && (
        <>
          {dynamicAdvice.length > 0 && (
            <ul className="dynamic-list">
              {dynamicAdvice.map((a, i) => (
                <li key={i}>{a}</li>
              ))}
            </ul>
          )}

          <ul className="general-list">
            {officialAdvice.map((a, i) => (
              <li key={i}>{a}</li>
            ))}
          </ul>
        </>
      )}

      <p className="official-advice-footer">
        {t("official_advice_footer")}
      </p>
    </div>
  );
}