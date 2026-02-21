// ===============================================================
//  📘 Recommendations.tsx — Versió robusta (CA/ES/EU/GL/EN)
//  ✅ Fallback segur per evitar t undefined
//  ✅ Títol coherent: “segons condicions actuals” a tots els idiomes
//  ✅ Missatge extra si hi ha alerta AEMET activa (aemetActive)
// ===============================================================

import * as React from "react";
import { getHeatRisk } from "../utils/heatRisk";

type Lang = "ca" | "es" | "eu" | "gl" | "en";

type TextKeys =
  | "title"
  | "aemetActive"
  | "safe"
  | "mild"
  | "moderate"
  | "high"
  | "ext"
  | "nightCool"
  | "nightSafe"
  | "nightHeat"
  | "cold_low"
  | "cold_mod"
  | "cold_high"
  | "cold_ext"
  | "loading";

type TextPack = Record<TextKeys, string>;
type TxtDict = Record<Lang, TextPack>;

interface Props {
  temp: number;              // temperatura efectiva rebuda
  lang: Lang | string;       // permet 'en-GB', 'ca-ES', etc.
  isDay: boolean;
  forceSafe?: boolean;       // força mostrar recomanacions “segures”
  aemetActive?: boolean;     // ✅ hi ha avís oficial actiu ara?
}

// ---------------------------------------------------------------
// 🗣️ Textos multillengua (calor, fred, nit)
// ---------------------------------------------------------------
const TXT: TxtDict = {
  ca: {
  title: "Recomanacions segons condicions actuals:",

  aemetActive:
    "⚠️ Hi ha un avís oficial actiu (AEMET). Prioritza les indicacions oficials i evita zones de risc.",

  safe:
    "Condicions tèrmiques dins paràmetres segurs. Mantén hidratació habitual i vigilància preventiva bàsica.",

  mild:
    "Precaució per calor. Pot aparèixer fatiga tèrmica. Incrementa la ingesta d’aigua i programa pauses en zones ombrejades.",

  moderate:
    "Precaució extrema per estrès tèrmic. Programa pauses freqüents, redueix la càrrega física i mantén hidratació constant.",

  high:
    "Perill per calor. Limita l’exposició prolongada i evita treballs físics intensos.",

  ext:
    "Perill extrem per calor. Interromp immediatament l’activitat i aplica mesures actives de refredament corporal.",

  nightCool:
    "Condicions nocturnes fresques. Utilitza roba adequada i mantén ventilació controlada.",

  nightSafe:
    "Condicions nocturnes estables. Mantén ventilació adequada de l’espai.",

  nightHeat:
    "Temperatures nocturnes elevades. Assegura ventilació creuada i utilitza roba lleugera.",

  cold_low:
    "Fred lleu. Utilitza sistema de capes i protegeix extremitats.",

  cold_mod:
    "Fred moderat. Limita l’exposició exterior i protegeix mans, peus i vies respiratòries.",

  cold_high:
    "Alt risc per fred. Evita permanències prolongades a l’exterior.",

  cold_ext:
    "Risc extrem per fred. Possible hipotèrmia. Roman en interiors i conserva la calor corporal.",

  loading: "Carregant recomanacions…",
},

  es: {
  title: "Recomendaciones según las condiciones actuales:",

  aemetActive:
    "⚠️ Existe un aviso oficial activo (AEMET). Prioriza las indicaciones oficiales y evita zonas de riesgo.",

  safe:
    "Condiciones térmicas dentro de parámetros seguros. Mantén hidratación habitual y vigilancia preventiva básica.",

  mild:
    "Precaución por calor. Puede aparecer fatiga térmica. Incrementa la ingesta de agua y programa pausas en zonas sombreadas.",

  moderate:
    "Precaución extrema por estrés térmico. Programa pausas frecuentes, reduce la carga física y mantén hidratación constante.",

  high:
    "Peligro por calor. Limita la exposición prolongada, incrementa las pausas y evita trabajos físicos intensos.",

  ext:
    "Peligro extremo por calor. Interrumpe la actividad inmediatamente y aplica medidas activas de enfriamiento corporal.",

  nightCool:
    "Condiciones nocturnas frescas. Utiliza ropa adecuada y mantén ventilación controlada.",

  nightSafe:
    "Condiciones nocturnas estables. Mantén ventilación adecuada del espacio.",

  nightHeat:
    "Temperaturas nocturnas elevadas. Garantiza ventilación cruzada y utiliza ropa ligera.",

  cold_low:
    "Frío leve. Utiliza sistema de capas y protege extremidades.",

  cold_mod:
    "Frío moderado. Limita la exposición exterior y protege adecuadamente manos, pies y vías respiratorias.",

  cold_high:
    "Alto riesgo por frío. Evita permanencias prolongadas en exteriores.",

  cold_ext:
    "Riesgo extremo por frío. Posible hipotermia. Permanece en interiores y conserva el calor corporal.",

  loading: "Cargando recomendaciones…",
},

  eu: {
  title: "Gomendioak uneko baldintzen arabera:",

  aemetActive:
    "⚠️ AEMETen abisu ofiziala aktibo dago. Jarraitu jarraibide ofizialak eta saihestu arrisku-eremuak.",

  safe:
    "Tenperatura baldintza seguruak. Mantendu hidratazio arrunta eta prebentziozko zaintza.",

  mild:
    "Beroagatiko kontuz. Nekea ager daiteke. Ura gehiago edan eta atsedenaldiak programatu itzaletan.",

  moderate:
    "Bero-estresagatik kontu handia. Atsedenaldi maizak egin, lan-karga murriztu eta hidratazio konstantea mantendu.",

  high:
    "Bero-arrisku handia. Mugatu esposizio luzea eta saihestu ahalegin fisiko handia.",

  ext:
    "Bero-arrisku muturrekoa. Gelditu jarduera berehala eta aplikatu gorputz-hozte neurriak.",

  nightCool:
    "Gau freskoa. Erabili arropa egokia eta mantendu aireztapen kontrolatua.",

  nightSafe:
    "Gau baldintza egonkorrak. Mantendu aireztapen egokia.",

  nightHeat:
    "Gaueko tenperatura altuak. Aireztapen gurutzatua bermatu eta arropa arina erabili.",

  cold_low:
    "Hotz arina. Geruzak erabili eta muturrak babestu.",

  cold_mod:
    "Hotz ertaina. Mugatu kanpoko esposizioa eta babestu eskuak, oinak eta arnasketa-bideak.",

  cold_high:
    "Hotz arrisku handia. Saihestu kanpoan denbora luzea ematea.",

  cold_ext:
    "Hotz arrisku muturrekoa. Hipotermia arriskua. Egon barruan eta mantendu gorputz-berotasuna.",

  loading: "Gomendioak kargatzen…",
},

  gl: {
  title: "Recomendacións segundo as condicións actuais:",

  aemetActive:
    "⚠️ Hai un aviso oficial activo (AEMET). Prioriza as indicacións oficiais e evita zonas de risco.",

  safe:
    "Condicións térmicas dentro de parámetros seguros. Mantén hidratación habitual e vixilancia preventiva básica.",

  mild:
    "Precaución por calor. Pode aparecer fatiga térmica. Incrementa a inxesta de auga e programa pausas en zonas sombreadas.",

  moderate:
    "Precaución extrema por estrés térmico. Programa pausas frecuentes, reduce a carga física e mantén hidratación constante.",

  high:
    "Perigo por calor. Limita a exposición prolongada e evita traballos físicos intensos.",

  ext:
    "Perigo extremo por calor. Interrompe a actividade inmediatamente e aplica medidas activas de arrefriamento corporal.",

  nightCool:
    "Noite fresca. Emprega roupa adecuada e mantén ventilación controlada.",

  nightSafe:
    "Condicións nocturnas estables. Mantén ventilación adecuada do espazo.",

  nightHeat:
    "Temperaturas nocturnas elevadas. Garante ventilación cruzada e emprega roupa lixeira.",

  cold_low:
    "Frío leve. Emprega sistema de capas e protexe extremidades.",

  cold_mod:
    "Frío moderado. Limita a exposición exterior e protexe mans, pés e vías respiratorias.",

  cold_high:
    "Alto risco por frío. Evita permanencias prolongadas no exterior.",

  cold_ext:
    "Risco extremo por frío. Posible hipotermia. Permanece en interiores e conserva a calor corporal.",

  loading: "Cargando recomendacións…",
},

  en: {
  title: "Recommendations based on current conditions:",

  aemetActive:
    "⚠️ An official alert is active (AEMET). Follow official instructions and avoid risk areas.",

  safe:
    "Thermal conditions within safe parameters. Maintain normal hydration and basic preventive vigilance.",

  mild:
    "Heat caution. Heat fatigue may occur. Increase water intake and schedule breaks in shaded areas.",

  moderate:
    "Extreme caution due to heat stress. Schedule frequent breaks, reduce physical workload and maintain constant hydration.",

  high:
    "Heat danger. Limit prolonged exposure and avoid intense physical activity.",

  ext:
    "Extreme heat danger. Stop activity immediately and apply active body cooling measures.",

  nightCool:
    "Cool night conditions. Dress appropriately and maintain controlled ventilation.",

  nightSafe:
    "Stable night conditions. Maintain adequate space ventilation.",

  nightHeat:
    "Elevated nighttime temperatures. Ensure cross-ventilation and wear light clothing.",

  cold_low:
    "Mild cold. Use layered clothing and protect extremities.",

  cold_mod:
    "Moderate cold. Limit outdoor exposure and protect hands, feet and airways.",

  cold_high:
    "High cold risk. Avoid prolonged outdoor stays.",

  cold_ext:
    "Extreme cold risk. Possible hypothermia. Stay indoors and preserve body heat.",

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
  const raw = String(lang || "ca").trim().toLowerCase();

  // agafa subtags tipus "eu-ES", "eu_ES", etc.
  const primary = raw.split(/[-_]/)[0].slice(0, 2) as Lang;

  return (["ca", "es", "eu", "gl", "en"] as const).includes(primary) ? primary : "ca";
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
      {extra ? <p style={{ marginTop: "0.6rem", opacity: 0.95 }}>{extra}</p> : null}
    </div>
  );
}

/* =============================================================
   COMPONENT PRINCIPAL
============================================================= */
export default function Recommendations({ temp, lang, isDay, forceSafe, aemetActive }: Props) {
  const lng = normalizeLang(lang);

  // ✅ Blindatge: MAI permetre t undefined
  // (Important per evitar l'error "Cannot read properties of undefined (reading 'title')")
  const t = (TXT as Record<string, (typeof TXT)["ca"]>)[lng] ?? TXT.ca;

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