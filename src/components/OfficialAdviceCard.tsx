import React, { useState } from "react";
import { useTranslation } from "react-i18next";

interface Props {
  risk: string;      // heat_mild, cold_extreme, etc.
  irr: number | null;
  uvi: number | null;
  windRisk: string;  // breezy, moderate, strong...
  lang: string;
}

export default function OfficialAdviceCard({ risk, irr, uvi, windRisk, lang }: Props) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  /* ───────────────────────────────────────────────
      CONFIRMACIÓ 112
  ─────────────────────────────────────────────── */
  function confirmCall112(lang: string) {
    const msg = {
      ca: "Estàs segur que vols cridar a emergències?",
      es: "¿Seguro que quieres llamar a emergencias?",
      eu: "Larrialdietara deitu nahi duzula ziur zaude?",
      gl: "Tes certeza de que queres chamar ás emerxencias?"
    }[lang] || "Estàs segur?";

    if (window.confirm(msg)) {
      window.location.href = "tel:112";
    }
  }

  /* ───────────────────────────────────────────────
      COLORS SEGONS RISC GLOBAL
  ─────────────────────────────────────────────── */
  const riskClass =
    risk.includes("extreme") ? "official-advanced-extreme" :
    risk.includes("high")    ? "official-advanced-high" :
    risk.includes("moderate")? "official-advanced-moderate" :
                               "official-advanced-low";

  /* ───────────────────────────────────────────────
      RECOMANACIONS DINÀMIQUES
  ─────────────────────────────────────────────── */
  const dynamicAdvice: string[] = [];

  // 1) Calor
  if (risk.startsWith("heat_")) {
    const lvl = risk.replace("heat_", ""); 
    const key = `officialAdviceDynamic.heat.${lvl}`;
    const txt = t(key);
    if (txt !== key) dynamicAdvice.push(txt);
  }

  // 2) Fred
  if (risk.startsWith("cold_")) {
    const lvl = risk.replace("cold_", "");
    const key = `officialAdviceDynamic.cold.${lvl}`;
    const txt = t(key);
    if (txt !== key) dynamicAdvice.push(txt);
  }

  // 3) Vent
  if (windRisk && windRisk !== "none") {
    const key = `officialAdviceDynamic.wind.${windRisk}`;
    const txt = t(key);
    if (txt !== key) dynamicAdvice.push(txt);
  }

  // 4) UV
  if (uvi >= 3) {
    const lvl =
      uvi < 6  ? "moderate" :
      uvi < 8  ? "high" :
      uvi < 11 ? "very_high" :
                 "extreme";

    const key = `officialAdviceDynamic.uv.${lvl}`;
    const txt = t(key);
    if (txt !== key) dynamicAdvice.push(txt);
  }

  /* ───────────────────────────────────────────────
      RECOMANACIONS GENERALS INSST/AEMET
  ─────────────────────────────────────────────── */
  const generalAdvice = [
    t("official_advice.hydration"),
    t("official_advice.rest"),
    t("official_advice.sunAvoid"),
    t("official_advice.coldClothes"),
    t("official_advice.followAlerts"),
    t("official_advice.symptoms")
  ];

  /* ───────────────────────────────────────────────
      COMPARTIR
  ─────────────────────────────────────────────── */
  const share = () => {
    const text = [...dynamicAdvice, ...generalAdvice].join("\n");
    if (navigator.share) {
      navigator.share({
        title: t("official_advice_title"),
        text
      });
    } else {
      alert("Funció no compatible al teu dispositiu.");
    }
  };

  /* ───────────────────────────────────────────────
      RENDER
  ─────────────────────────────────────────────── */
  return (
    <div className={`official-advanced-card ${riskClass}`}>

      <h3>🛡️ {t("official_advice_title")}</h3>

      <button className="official-share-btn" onClick={share}>
        📤 {t("share")}
      </button>

      <button className="emergency-btn" onClick={() => confirmCall112(lang)}>
        🚨 112 📞
      </button>

      <button className="official-expand-btn" onClick={() => setOpen(!open)}>
        {open ? `▲ ${t("hide_advice")}` : `▼ ${t("show_advice")}`}
      </button>

      {open && (
        <>
          {/* PRIMER: DINÀMIQUES */}
          {dynamicAdvice.length > 0 && (
            <ul className="dynamic-list">
              {dynamicAdvice.map((a, i) => <li key={i}>{a}</li>)}
            </ul>
          )}

          {/* SEGON: GENERALS */}
          <ul className="general-list">
            {generalAdvice.map((a, i) => <li key={i}>{a}</li>)}
          </ul>
        </>
      )}

      <p className="official-advice-footer">
        {t("official_advice_footer")}
      </p>
    </div>
  );
}