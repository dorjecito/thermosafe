// ===============================================================
//  📘 Recommendations.tsx — Versió llarga, clara i supercomentada
// ===============================================================

import * as React from "react";
import { getHeatRisk } from "../utils/heatRisk";


// ---------------------------------------------------------------
// Tipus de llengua admesos
// ---------------------------------------------------------------
type Lang = "ca" | "es" | "eu" | "gl";


// ---------------------------------------------------------------
// Propietats rebudes pel component
// ---------------------------------------------------------------
interface Props {
  temp: number;  // temperatura efectiva
  lang: Lang;    // idioma
  isDay: boolean; // és de dia?
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
    cold_ext: "Risc extrem de fred: perill d’hipotèrmia. No surtis i mantén la calor corporal.",
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
    cold_ext: "Riesgo extremo por frío: peligro de hipotermia. No salgas.",
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
    cold_ext: "Hotz muturrekoa: hipotermiaren arriskua. Ez irten.",
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
    cold_ext: "Frío extremo: risco de hipotermia. Non saias.",
  },

} as const;



// ----------------------------------------------
// ✨ Sistema d'icones segons intensitat del risc
// ----------------------------------------------
const getIcon = (key: string): string => {
  // 🌙 NIT
  if (key.startsWith("night")) return "🌙";

  // ❄️ FRED
  if (key === "cold_low") return "❄️";
  if (key === "cold_mod") return "❄️❄️";
  if (key === "cold_high") return "❄️❄️❄️";
  if (key === "cold_ext") return "❄️❄️❄️❄️";

  // 🔥 CALOR
  if (key === "mild") return "🔥";
  if (key === "moderate") return "🔥🔥";
  if (key === "high") return "🔥🔥🔥";
  if (key === "ext") return "🔥🔥🔥🔥";

  // 🟢 SENSE RISC
  if (key === "safe") return "🟢";

  return "";
};



// ===============================================================
//  COMPONENT PRINCIPAL
// ===============================================================
export default function Recommendations({ temp, lang, isDay }: Props) {

  const t = TXT[lang]; // Textos de l’idioma actual


  // -------------------------------------------------------------
  // 1️⃣ PRIORITAT ABSOLUTA: RISC PER FRED
  // -------------------------------------------------------------
  let coldRisk: keyof typeof t | null = null;

  if (temp < -20) coldRisk = "cold_ext";
  else if (temp < -10) coldRisk = "cold_high";
  else if (temp < 0) coldRisk = "cold_mod";
  else if (temp < 5) coldRisk = "cold_low";

  if (coldRisk) {

    const icon = getIcon(coldRisk);

    return (
      <div className="recommendation-box">
        <p className={`recommendation-title ${coldRisk}`}>
          {icon}
          {t.title}
        </p>

        <p>{t[coldRisk]}</p>
      </div>
    );
  }



  // -------------------------------------------------------------
  // 2️⃣ RECOMANACIONS NOCTURNES (si NO fa fred)
  // -------------------------------------------------------------
  if (!isDay) {

    let nightKey: "nightCool" | "nightSafe" | "nightHeat";

    if (temp < 18) nightKey = "nightCool";
    else if (temp < 24) nightKey = "nightSafe";
    else nightKey = "nightHeat";

    const icon = getIcon(nightKey);

    return (
      <div className="recommendation-box">
        <p className={`recommendation-title ${nightKey}`}>
          {icon}
          {t.title}
        </p>

        <p>{t[nightKey]}</p>
      </div>
    );
  }



  // -------------------------------------------------------------
  // 3️⃣ RECOMANACIONS PER CALOR (només si NO hi ha fred ni és nit)
  // -------------------------------------------------------------
  const { level } = getHeatRisk(temp, "rest");

  const heatMap: Record<string, keyof typeof t> = {
    "Cap risc": "safe",
    Baix: "mild",
    Moderat: "moderate",
    Alt: "high",
    Extrem: "ext",
  };

  const heatKey = heatMap[level] ?? "safe";

  const icon = getIcon(heatKey);

  return (
    <div className="recommendation-box">
      <p className={`recommendation-title ${heatKey}`}>
        {icon}
        {t.title}
      </p>

      <p>{t[heatKey]}</p>
    </div>
  );
}