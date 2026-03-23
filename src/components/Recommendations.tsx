// ===============================================================
// 📘 Recommendations.tsx — Versió robusta (CA/ES/EU/GL/EN)
// ✅ Fallback segur per evitar TXT undefined
// ✅ Títol coherent: “segons les condicions actuals”
// ✅ Missatge extra si hi ha alerta AEMET activa
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
  forceSafe?: boolean;       // reservat per compatibilitat futura
  aemetActive?: boolean;     // hi ha avís oficial actiu ara?
}

// ---------------------------------------------------------------
// 🗣️ Textos multilingües (calor, fred i nit)
// ---------------------------------------------------------------
const TXT: TxtDict = {
  ca: {
    title: "Recomanacions segons les condicions actuals:",

    aemetActive:
      "⚠️ Hi ha un avís meteorològic oficial actiu. Dona prioritat a les indicacions de l’organisme emissor i evita les zones de risc.",

    safe:
      "Condicions tèrmiques favorables. Mantén una hidratació adequada i segueix les mesures preventives habituals.",

    mild:
      "Precaució per calor. Pot aparèixer fatiga tèrmica. Beu aigua amb freqüència i fes pauses en zones ombrejades.",

    moderate:
      "Risc moderat d’estrès tèrmic. Programa pauses freqüents, redueix la càrrega física i mantén una hidratació constant.",

    high:
      "Risc alt per calor. Limita l’exposició prolongada i evita esforços físics intensos, especialment a les hores centrals del dia.",

    ext:
      "Risc extrem per calor. Atura l’activitat immediatament i aplica mesures actives de refredament corporal.",

    nightCool:
      "Ambient nocturn fresc. Utilitza roba adequada i evita una exposició prolongada si la sensació tèrmica és baixa.",

    nightSafe:
      "Condicions nocturnes estables. Mantén una ventilació adequada i una situació de confort tèrmic.",

    nightHeat:
      "Temperatura nocturna elevada. Afavoreix la ventilació creuada i utilitza roba lleugera i transpirable.",

    cold_low:
      "Fred lleu. Vesteix per capes i protegeix especialment les extremitats.",

    cold_mod:
      "Fred moderat. Limita l’exposició a l’exterior i protegeix mans, peus i vies respiratòries.",

    cold_high:
      "Risc alt per fred. Evita exposicions prolongades a l’exterior i reforça la protecció tèrmica.",

    cold_ext:
      "Risc extrem per fred. Hi ha perill d’hipotèrmia. Roman en un espai interior i conserva la calor corporal.",

    loading: "Carregant recomanacions…",
  },

  es: {
    title: "Recomendaciones según las condiciones actuales:",

    aemetActive:
      "⚠️ Hay un aviso meteorológico oficial activo. Da prioridad a las indicaciones del organismo emisor y evita las zonas de riesgo.",

    safe:
      "Condiciones térmicas favorables. Mantén una hidratación adecuada y sigue las medidas preventivas habituales.",

    mild:
      "Precaución por calor. Puede aparecer fatiga térmica. Bebe agua con frecuencia y programa pausas en zonas sombreadas.",

    moderate:
      "Riesgo moderado de estrés térmico. Programa pausas frecuentes, reduce la carga física y mantén una hidratación constante.",

    high:
      "Riesgo alto por calor. Limita la exposición prolongada y evita esfuerzos físicos intensos, especialmente en las horas centrales del día.",

    ext:
      "Riesgo extremo por calor. Interrumpe la actividad de inmediato y aplica medidas activas de enfriamiento corporal.",

    nightCool:
      "Ambiente nocturno fresco. Utiliza ropa adecuada y evita exposiciones prolongadas si la sensación térmica es baja.",

    nightSafe:
      "Condiciones nocturnas estables. Mantén una ventilación adecuada y una situación de confort térmico.",

    nightHeat:
      "Temperatura nocturna elevada. Favorece la ventilación cruzada y utiliza ropa ligera y transpirable.",

    cold_low:
      "Frío leve. Usa ropa por capas y protege especialmente las extremidades.",

    cold_mod:
      "Frío moderado. Limita la exposición al exterior y protege manos, pies y vías respiratorias.",

    cold_high:
      "Riesgo alto por frío. Evita exposiciones prolongadas al aire libre y refuerza la protección térmica.",

    cold_ext:
      "Riesgo extremo por frío. Existe peligro de hipotermia. Permanece en interiores y conserva el calor corporal.",

    loading: "Cargando recomendaciones…",
  },

  eu: {
    title: "Gomendioak uneko baldintzen arabera:",

    aemetActive:
      "⚠️ Abisu meteorologiko ofizial bat aktibo dago. Lehenetsi erakunde igorlearen jarraibideak eta saihestu arrisku-eremuak.",

    safe:
      "Baldintza termiko onak. Mantendu hidratazio egokia eta ohiko prebentzio-neurriak.",

    mild:
      "Kontuz beroarekin. Nekea ager daiteke. Edan ura maiz eta egin atsedenaldiak itzalpean.",

    moderate:
      "Bero-estresaren arrisku ertaina. Egin atsedenaldi maizak, murriztu lan-karga fisikoa eta mantendu hidratazio jarraitua.",

    high:
      "Bero-arrisku handia. Mugatu esposizio luzea eta saihestu ahalegin fisiko handiak, bereziki eguneko erdiko orduetan.",

    ext:
      "Bero-arrisku muturrekoa. Gelditu jarduera berehala eta aplikatu gorputza hozteko neurri aktiboak.",

    nightCool:
      "Gaueko giro freskoa. Erabili arropa egokia eta saihestu esposizio luzea sentipen termikoa baxua bada.",

    nightSafe:
      "Gaueko baldintza egonkorrak. Mantendu aireztapen egokia eta erosotasun termikoa.",

    nightHeat:
      "Gaueko tenperatura altua. Bultzatu aireztapen gurutzatua eta erabili arropa arina eta transpiragarria.",

    cold_low:
      "Hotz arina. Erabili geruzaz janzteko sistema eta babestu bereziki muturrak.",

    cold_mod:
      "Hotz ertaina. Mugatu kanpoko esposizioa eta babestu eskuak, oinak eta arnasbideak.",

    cold_high:
      "Hotz-arrisku handia. Saihestu kanpoan denbora luzez egotea eta indartu babes termikoa.",

    cold_ext:
      "Hotz-arrisku muturrekoa. Hipotermia izateko arriskua dago. Egon barruan eta mantendu gorputz-berotasuna.",

    loading: "Gomendioak kargatzen…",
  },

  gl: {
    title: "Recomendacións segundo as condicións actuais:",

    aemetActive:
      "⚠️ Hai un aviso meteorolóxico oficial activo. Dá prioridade ás indicacións do organismo emisor e evita as zonas de risco.",

    safe:
      "Condicións térmicas favorables. Mantén unha hidratación adecuada e segue as medidas preventivas habituais.",

    mild:
      "Precaución por calor. Pode aparecer fatiga térmica. Bebe auga con frecuencia e fai pausas en zonas sombreadas.",

    moderate:
      "Risco moderado de estrés térmico. Programa pausas frecuentes, reduce a carga física e mantén unha hidratación constante.",

    high:
      "Risco alto por calor. Limita a exposición prolongada e evita esforzos físicos intensos, especialmente nas horas centrais do día.",

    ext:
      "Risco extremo por calor. Interrompe a actividade de inmediato e aplica medidas activas de arrefriamento corporal.",

    nightCool:
      "Ambiente nocturno fresco. Emprega roupa adecuada e evita exposicións prolongadas se a sensación térmica é baixa.",

    nightSafe:
      "Condicións nocturnas estables. Mantén unha ventilación adecuada e unha situación de confort térmico.",

    nightHeat:
      "Temperatura nocturna elevada. Favorece a ventilación cruzada e emprega roupa lixeira e transpirable.",

    cold_low:
      "Frío leve. Usa roupa por capas e protexe especialmente as extremidades.",

    cold_mod:
      "Frío moderado. Limita a exposición ao exterior e protexe mans, pés e vías respiratorias.",

    cold_high:
      "Alto risco por frío. Evita exposicións prolongadas ao aire libre e reforza a protección térmica.",

    cold_ext:
      "Risco extremo por frío. Hai perigo de hipotermia. Permanece en interiores e conserva a calor corporal.",

    loading: "Cargando recomendacións…",
  },

  en: {
    title: "Recommendations based on current conditions:",

    aemetActive:
      "⚠️ An official weather alert is active. Follow the issuing agency guidance and avoid risk areas.",

    safe:
      "Favourable thermal conditions. Maintain adequate hydration and follow standard preventive measures.",

    mild:
      "Heat caution. Heat fatigue may occur. Drink water regularly and take breaks in shaded areas.",

    moderate:
      "Moderate heat stress risk. Schedule frequent breaks, reduce physical strain and maintain constant hydration.",

    high:
      "High heat risk. Limit prolonged exposure and avoid intense physical effort, especially during the hottest hours of the day.",

    ext:
      "Extreme heat risk. Stop activity immediately and apply active body-cooling measures.",

    nightCool:
      "Cool nighttime conditions. Dress appropriately and avoid prolonged exposure if thermal sensation is low.",

    nightSafe:
      "Stable nighttime conditions. Maintain adequate ventilation and thermal comfort.",

    nightHeat:
      "Elevated nighttime temperatures. Ensure cross-ventilation and wear light, breathable clothing.",

    cold_low:
      "Mild cold. Use layered clothing and protect your extremities.",

    cold_mod:
      "Moderate cold. Limit outdoor exposure and protect hands, feet and airways.",

    cold_high:
      "High cold risk. Avoid prolonged time outdoors and reinforce thermal protection.",

    cold_ext:
      "Extreme cold risk. There is a risk of hypothermia. Stay indoors and preserve body heat.",

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

// ---------------------------------------------------------------
// ✅ Caixa de recomanació reutilitzable
// ---------------------------------------------------------------
function RecommendationBox({
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
export default function Recommendations({
  temp,
  lang,
  isDay,
  forceSafe,
  aemetActive,
}: Props) {
  const lng = normalizeLang(lang);

  // ✅ Blindatge: mai permetre TXT undefined
  const t = (TXT as Record<string, (typeof TXT)["ca"]>)[lng] ?? TXT.ca;

  const effectiveTemp = Number(temp);
  const extraAemet = aemetActive ? t.aemetActive : undefined;

  if (!Number.isFinite(effectiveTemp)) {
    return (
      <RecommendationBox
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
      <RecommendationBox
        className={`recommendation-box ${coldRisk}`}
        title={`${getIcon(coldRisk)} ${t.title}`}
        body={t[coldRisk]}
        extra={extraAemet}
      />
    );
  }

  /* =========================================================
     2️⃣ RECOMANACIONS NOCTURNES (només si no hi ha fred)
  ========================================================== */
  if (!isDay) {
    const nightKey: "nightCool" | "nightSafe" | "nightHeat" =
      effectiveTemp < 18 ? "nightCool" : effectiveTemp < 24 ? "nightSafe" : "nightHeat";

    return (
      <RecommendationBox
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
      <RecommendationBox
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
    return (
      <RecommendationBox
        className="recommendation-box safe"
        title={`${getIcon("safe")} ${t.title}`}
        body={t.safe}
        extra={extraAemet}
      />
    );
  }

  return (
    <RecommendationBox
      className={`recommendation-box ${heatKey}`}
      title={`${getIcon(heatKey)} ${t.title}`}
      body={t[heatKey]}
      extra={extraAemet}
    />
  );
}