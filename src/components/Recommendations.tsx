// ===============================================================
//  📘 Recommendations.tsx — Versió corregida i robusta (amb anglès)
//  + ✅ Missatge extra si hi ha alerta AEMET activa (aemetActive)
// ===============================================================

import * as React from "react";
import { getHeatRisk } from "../utils/heatRisk";

type Lang = "ca" | "es" | "eu" | "gl" | "en";

interface Props {
  temp: number;              // temperatura efectiva rebuda
  lang: Lang | string;       // permet 'en-GB', 'ca-ES', etc.
  isDay: boolean;
  forceSafe?: boolean;       // força mostrar recomanacions “segures”
  aemetActive?: boolean;     // ✅ hi ha avís oficial actiu ara?
}

// ---------------------------------------------------------------
// 🗣️ Textos multillengua (calor, fred, nit)
// ---------------------------------------------------------------
const TXT = {
  ca: {
    title: "Recomanacions:",

    // ✅ AEMET
    aemetActive:
      "⚠️ Hi ha un avís oficial actiu (AEMET). Segueix les indicacions i evita zones exposades.",

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

    // Fallback
    loading: "Carregant recomanacions…",
  },

  es: {
    title: "Recomendaciones:",

    aemetActive:
      "⚠️ Hay un aviso oficial activo (AEMET). Sigue las indicaciones y evita zonas expuestas.",

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

    loading: "Cargando recomendaciones…",
  },

  eu: {
    title: "Gomendioak:",

    aemetActive:
      "⚠️ AEMETen abisu ofizial aktiboa dago. Jarraitu jarraibideak eta saihestu eremu esposatuak.",

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

    loading: "Gomendioak kargatzen…",
  },

  gl: {
    title: "Recomendacións:",

    aemetActive:
      "⚠️ Hai un aviso oficial activo (AEMET). Sigue as indicacións e evita zonas expostas.",

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

    loading: "Cargando recomendacións…",
  },

  en: {
    title: "Recommendations:",

    aemetActive:
      "⚠️ An official alert is active (AEMET). Follow instructions and avoid exposed areas.",

    safe: "Safe conditions. Maintain normal hydration.",
    mild: "Possible heat fatigue. Drink water often and rest in the shade.",
    moderate: "Moderate risk. Breaks every 20 min, light clothing, and hydrate.",
    high: "High risk. Avoid intense effort and increase breaks.",
    ext: "Extreme risk. Stop activity and cool down immediately.",

    nightCool: "Cool night: dress appropriately and keep the space ventilated.",
    nightSafe: "Safe conditions. Keep good ventilation.",
    nightHeat: "If it is hot at night, ventilate well and sleep in light clothing.",

    cold_low: "Mild cold: dress in layers and protect yourself a bit.",
    cold_mod: "Moderate cold: limit exposure and protect extremities.",
    cold_high: "High cold risk: avoid long periods outdoors.",
    cold_ext: "Extreme cold risk: danger of hypothermia. Stay inside and keep warm.",

    loading: "Loading recommendations…",
  },
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
  return "🟢";
};

const normalizeLang = (lang: Lang | string): Lang => {
  const code = String(lang || "ca").toLowerCase().slice(0, 2) as Lang;
  return (["ca", "es", "eu", "gl", "en"] as const).includes(code) ? code : "ca";
};

// ---------------------------------------------------------------
// Helper: normalitza el “level” de getHeatRisk a una clau interna
// ---------------------------------------------------------------
type HeatKey = "safe" | "mild" | "moderate" | "high" | "ext";

const mapHeatLevelToKey = (levelRaw: unknown): HeatKey => {
  const s = String(levelRaw ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");

  if (
    s === "cap risc" ||
    s === "sin riesgo" ||
    s === "no risk" ||
    s === "none" ||
    s === "baix" ||
    s === "bajo" ||
    s === "low" ||
    s === "safe"
  ) return "safe";

  if (s.includes("lleu") || s.includes("leve") || s.includes("mild")) return "mild";
  if (s.includes("moderat") || s.includes("moderado") || s.includes("moderate")) return "moderate";
  if (s.includes("alt") || s.includes("alto") || s.includes("high")) return "high";
  if (s.includes("extrem") || s.includes("extremo") || s.includes("extreme")) return "ext";

  return "safe";
};

// ✅ Render helper per afegir la línia AEMET sense duplicar codi
function Box({
  className,
  title,
  body,
  extra,
}: {
  className: string;
  title: string;
  body: string;
  extra?: string;
}) {
  return (
    <div className={className}>
      <p className="recommendation-title">{title}</p>
      <p>{body}</p>
      {extra ? (
        <p style={{ marginTop: "0.6rem", opacity: 0.95 }}>
          {extra}
        </p>
      ) : null}
    </div>
  );
}

/* =============================================================
   COMPONENT PRINCIPAL
============================================================= */
export default function Recommendations({ temp, lang, isDay, forceSafe, aemetActive }: Props) {
  const lng = normalizeLang(lang);
  const t = TXT[lng];

  const effectiveTemp = Number(temp);
  const extraAemet = aemetActive ? t.aemetActive : undefined;

  if (!Number.isFinite(effectiveTemp)) {
    return (
      <Box
        className="recommendation-box safe"
        title={`${getIcon("safe")} ${t.title}`}
        body={t.loading}
        extra={extraAemet}
      />
    );
  }

  /* =========================================================
     1️⃣ PRIORITAT ABSOLUTA — RISC PER FRED
  ========================================================== */
  let coldRisk: "cold_low" | "cold_mod" | "cold_high" | "cold_ext" | null = null;

  if (effectiveTemp < -20) coldRisk = "cold_ext";
  else if (effectiveTemp < -10) coldRisk = "cold_high";
  else if (effectiveTemp < 5) coldRisk = "cold_mod";
  else if (effectiveTemp < 10) coldRisk = "cold_low";

  if (coldRisk) {
    return (
      <Box
        className={`recommendation-box ${coldRisk}`}
        title={`${getIcon(coldRisk)} ${t.title}`}
        body={t[coldRisk]}
        extra={extraAemet}
      />
    );
  }

  /* =========================================================
     2️⃣ RECOMANACIONS NOCTURNES (només si NO hi ha fred)
  ========================================================== */
  if (!isDay) {
    const nightKey: "nightCool" | "nightSafe" | "nightHeat" =
      effectiveTemp < 18 ? "nightCool" : effectiveTemp < 24 ? "nightSafe" : "nightHeat";

    return (
      <Box
        className={`recommendation-box ${nightKey}`}
        title={`${getIcon(nightKey)} ${t.title}`}
        body={t[nightKey]}
        extra={extraAemet}
      />
    );
  }

  /* =========================================================
     3️⃣ EXTRA — si fa molta calor real (protecció extra)
  ========================================================== */
  if (effectiveTemp >= 30) {
    const heatKey: HeatKey = effectiveTemp < 33 ? "moderate" : "high";

    return (
      <Box
        className={`recommendation-box ${heatKey}`}
        title={`${getIcon(heatKey)} ${t.title}`}
        body={t[heatKey]}
        extra={extraAemet}
      />
    );
  }

  /* =========================================================
     4️⃣ RISC PER CALOR (getHeatRisk)
  ========================================================== */
  const riskObj: any = getHeatRisk(effectiveTemp, "rest");
  const heatKey = mapHeatLevelToKey(riskObj?.level);

  if (heatKey === "safe") {
    if (forceSafe === false) {
      return (
        <Box
          className="recommendation-box safe"
          title={`${getIcon("safe")} ${t.title}`}
          body={t.safe}
          extra={extraAemet}
        />
      );
    }

    return (
      <Box
        className="recommendation-box safe"
        title={`${getIcon("safe")} ${t.title}`}
        body={t.safe}
        extra={extraAemet}
      />
    );
  }

  return (
    <Box
      className={`recommendation-box ${heatKey}`}
      title={`${getIcon(heatKey)} ${t.title}`}
      body={t[heatKey]}
      extra={extraAemet}
    />
  );
}