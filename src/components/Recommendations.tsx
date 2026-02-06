// ===============================================================
//  📘 Recommendations.tsx — Versió corregida i robusta (amb anglès)
// ===============================================================

import * as React from "react";
import { getHeatRisk } from "../utils/heatRisk";

type Lang = "ca" | "es" | "eu" | "gl" | "en";

interface Props {
  temp: number;   // temperatura efectiva rebuda
  lang: Lang | string; // permet 'en-GB', 'ca-ES', etc.
  isDay: boolean;
  forceSafe?: boolean;
}

// ---------------------------------------------------------------
// 🗣️ Textos multillengua (calor, fred, nit)
// ---------------------------------------------------------------
const TXT = {
  // ---------------------- Català ----------------------
  ca: {
    title: "Recomanacions:",

    // Calor
    safe: "Condicions segures. Mantén la hidratació habitual.",
    mild: "Possible fatiga per calor. Beu aigua sovint i descansa a l’ombra.",
    moderate: "Risc moderat. Pauses cada 20 min, roba lleugera i hidrata’t.",
    high: "Risc alt. Evita l’esforç intens i incrementa les pauses.",
    ext: "Risc extrem. Atura l’activitat i refresca’t immediatament.",

    // Nit
    nightCool: "Nit fresca: abriga’t adequadament i mantén l’espai ventilat.",
    nightSafe: "Condicions segures. Mantén una bona ventilació.",
    nightHeat: "Si fa calor a la nit, ventila bé l’espai i dorm amb roba lleugera.",

    // Fred
    cold_low: "Fred lleu: vesteix amb capes i protegeix-te una mica.",
    cold_mod: "Fred moderat: limita l’exposició i protegeix extremitats.",
    cold_high: "Risc alt de fred: evita exposicions llargues a l’exterior.",
    cold_ext: "Risc extrem de fred: perill d’hipotèrmia. No surtis i mantén la calor corporal."
  },

  // ---------------------- Espanyol ----------------------
  es: {
    title: "Recomendaciones:",

    safe: "Condiciones seguras. Mantén la hidratación habitual.",
    mild: "Posible fatiga por calor. Bebe agua y descansa a la sombra.",
    moderate: "Riesgo moderado. Pausas cada 20 min, ropa ligera e hidrátate.",
    high: "Riesgo alto. Evita el esfuerzo intenso y aumenta las pausas.",
    ext: "Riesgo extremo. Detén la actividad y refréscate.",

    nightCool: "Noche fresca: abrígate y ventila la habitación adecuadamente.",
    nightSafe: "Condiciones seguras. Mantén buena ventilación.",
    nightHeat: "Si hace calor por la noche, ventila bien y usa ropa ligera.",

    cold_low: "Frío leve: usa capas y protégete ligeramente.",
    cold_mod: "Frío moderado: limita la exposición y protege extremidades.",
    cold_high: "Riesgo alto por frío: evita exposiciones prolongadas.",
    cold_ext: "Riesgo extremo por frío: peligro de hipotermia. No salgas."
  },

  // ---------------------- Euskera ----------------------
  eu: {
    title: "Gomendioak:",

    safe: "Egoera segurua. Edan ura eta mantendu hidratazioa.",
    mild: "Bero-nekea gerta daiteke. Atseden hartu eta edan maiz.",
    moderate: "Arrisku moderatua. Geldialdiak eta hidratazio ona.",
    high: "Arrisku handia. Saihestu ahalegin handia.",
    ext: "Arrisku larria. Utzi jarduera eta freskatu.",

    nightCool: "Gau freskoa: estali zaitez eta aireztatu gela.",
    nightSafe: "Egoera segurua. Mantendu aireztapen ona.",
    nightHeat: "Gauean beroa bada, aireztatu eta erabili arropa arina.",

    cold_low: "Hotz arina: geruzak erabili eta babestu pixka bat.",
    cold_mod: "Hotz moderatua: mugatu kanpoan egotea eta babestu gorputz-adarrak.",
    cold_high: "Hotz handia: saihestu esposizio luzeak.",
    cold_ext: "Hotz muturrekoa: hipotermiaren arriskua. Ez irten."
  },

  // ---------------------- Gallec ----------------------
  gl: {
    title: "Recomendacións:",

    safe: "Condicións seguras. Mantén a hidratación habitual.",
    mild: "Posible fatiga por calor. Bebe auga e descansa á sombra.",
    moderate: "Risco moderado. Pausas e hidratación frecuente.",
    high: "Risco alto. Evita esforzos intensos.",
    ext: "Risco extremo. Detén a actividade e arrefréscate.",

    nightCool: "Noite fresca: abrígate e ventila ben o espazo.",
    nightSafe: "Condicións seguras. Mantén boa ventilación.",
    nightHeat: "Se fai calor pola noite, ventila e usa roupa lixeira.",

    cold_low: "Frío lixeiro: usa capas e protéxete algo.",
    cold_mod: "Frío moderado: limita exposición e protexe extremidades.",
    cold_high: "Risco alto por frío: evita estar fóra moito tempo.",
    cold_ext: "Frío extremo: risco de hipotermia. Non saias."
  },

  // ---------------------- English ----------------------
  en: {
    title: "Recommendations:",

    // Heat
    safe: "Safe conditions. Maintain normal hydration.",
    mild: "Possible heat fatigue. Drink water often and rest in the shade.",
    moderate: "Moderate risk. Breaks every 20 min, light clothing, and hydrate.",
    high: "High risk. Avoid intense effort and increase breaks.",
    ext: "Extreme risk. Stop activity and cool down immediately.",

    // Night
    nightCool: "Cool night: dress appropriately and keep the space ventilated.",
    nightSafe: "Safe conditions. Keep good ventilation.",
    nightHeat: "If it is hot at night, ventilate well and sleep in light clothing.",

    // Cold
    cold_low: "Mild cold: dress in layers and protect yourself a bit.",
    cold_mod: "Moderate cold: limit exposure and protect extremities.",
    cold_high: "High cold risk: avoid long periods outdoors.",
    cold_ext: "Extreme cold risk: danger of hypothermia. Stay inside and keep warm."
  }
} as const;

// ----------------------------------------------
// ✨ Sistema d'icones segons intensitat del risc
// ----------------------------------------------
const getIcon = (key: string): string => {
  if (key.startsWith("night")) return "🌙";
  if (key === "cold_low") return "❄️";
  if (key === "cold_mod") return "❄️❄️";
  if (key === "cold_high") return "❄️❄️❄️";
  if (key === "cold_ext") return "❄️❄️❄️❄️";
  if (key === "mild") return "🔥";
  if (key === "moderate") return "🔥🔥";
  if (key === "high") return "🔥🔥🔥";
  if (key === "ext") return "🔥🔥🔥🔥";
  if (key === "safe") return "🟢";
  return "";
};

const normalizeLang = (lang: Lang | string): Lang => {
  const code = (lang || "ca").toString().toLowerCase().slice(0, 2) as Lang;
  return (["ca", "es", "eu", "gl", "en"] as const).includes(code) ? code : "ca";
};

/* =============================================================
   COMPONENT PRINCIPAL
============================================================= */
export default function Recommendations({ temp, lang, isDay }: Props) {
  const lng = normalizeLang(lang);
  const t = TXT[lng];

  /* 🔒 NORMALITZACIÓ ABSOLUTA */
  const effectiveTemp = Number(temp);

  /* =========================================================
     1️⃣ PRIORITAT ABSOLUTA — RISC PER FRED
  ========================================================== */
  let coldRisk: keyof typeof t | null = null;

  if (effectiveTemp < -20) coldRisk = "cold_ext";
  else if (effectiveTemp < -10) coldRisk = "cold_high";
  else if (effectiveTemp < 5) coldRisk = "cold_mod";
  else if (effectiveTemp < 10) coldRisk = "cold_low";

  if (coldRisk) {
    return (
      <div className="recommendation-box">
        <p className={`recommendation-title ${coldRisk}`}>
          {getIcon(coldRisk)} {t.title}
        </p>
        <p>{t[coldRisk]}</p>
      </div>
    );
  }

  /* =========================================================
     2️⃣ RECOMANACIONS NOCTURNES (només si NO hi ha fred)
  ========================================================== */
  if (!isDay) {
    let nightKey: "nightCool" | "nightSafe" | "nightHeat";

    if (effectiveTemp < 18) nightKey = "nightCool";
    else if (effectiveTemp < 24) nightKey = "nightSafe";
    else nightKey = "nightHeat";

    return (
      <div className="recommendation-box">
        <p className={`recommendation-title ${nightKey}`}>
          {getIcon(nightKey)} {t.title}
        </p>
        <p>{t[nightKey]}</p>
      </div>
    );
  }

  /* =========================================================
     (Extra) Força risc moderat/alt amb calor alta real
  ========================================================== */
  if (effectiveTemp >= 30) {
    const heatKey: keyof typeof t = effectiveTemp < 33 ? "moderate" : "high";

    return (
      <div className="recommendation-box">
        <p className={`recommendation-title ${heatKey}`}>
          {getIcon(heatKey)} {t.title}
        </p>
        <p>{t[heatKey]}</p>
      </div>
    );
  }

  /* =========================================================
     3️⃣ ZONA NEUTRA (10–18 °C, sense fred ni calor)
  ========================================================== */
  if (effectiveTemp >= 10 && effectiveTemp < 18) {
    return null;
  }

  /* =========================================================
     4️⃣ RECOMANACIONS PER CALOR
  ========================================================== */
  const { level } = getHeatRisk(effectiveTemp, "rest");

  if (level === "Cap risc" || level === "Baix") {
    return null;
  }

  const heatMap: Record<string, keyof typeof t> = {
    Moderat: "moderate",
    Alt: "high",
    Extrem: "ext"
  };

  const heatKey = heatMap[level];

  return (
    <div className="recommendation-box">
      <p className={`recommendation-title ${heatKey}`}>
        {getIcon(heatKey)} {t.title}
      </p>
      <p>{t[heatKey]}</p>
    </div>
  );
}