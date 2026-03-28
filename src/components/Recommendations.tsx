// ===============================================================
// 📘 Recommendations.tsx — Versió robusta (CA/ES/EU/GL/EN)
// ✅ Fallback segur per evitar TXT undefined
// ✅ Títol coherent: “segons les condicions actuals”
// ✅ Prioritza millor: fred > calor forta > UV > nit > segur
// ✅ Compatible amb les props actuals que envies des d’App.tsx
// ✅ Sense redundància amb el banner d’avís oficial
// ===============================================================

import * as React from "react";
import { getHeatRisk } from "../utils/heatRisk";

type Lang = "ca" | "es" | "eu" | "gl" | "en";

type TextKeys =
  | "title"
  | "safe"
  | "safeUvModerate"
  | "safeWind"
  | "safeCloudy"
  | "mild"
  | "moderate"
  | "high"
  | "ext"
  | "uvModerate"
  | "uvHigh"
  | "uvVeryHigh"
  | "uvExtreme"
  | "nightCool"
  | "nightSafe"
  | "nightHeat"
  | "cold_low"
  | "cold_mod"
  | "cold_high"
  | "cold_ext"
  | "rain"
  | "storm"
  | "humid"
  | "windModerate"
  | "windStrong"
  | "loading";

type TextPack = Record<TextKeys, string>;
type TxtDict = Record<Lang, TextPack>;

interface Props {
  temp: number; // temperatura efectiva o principal
  lang: Lang | string; // pot venir com "ca-ES", "en-GB"...
  isDay: boolean;
  humidity?: number;
  forceSafe?: boolean;
  aemetActive?: boolean;
  aemetSoon?: boolean;
  alertType?: string;
  uvi?: number | null;
  weatherMain?: string;
  weatherDescription?: string;
  cloudiness?: number | null;
  windKmh?: number | null;
  currentHour?: number;
}

// ---------------------------------------------------------------
// 🗣️ Textos multilingües
// ---------------------------------------------------------------
const TXT: TxtDict = {
  ca: {
    title: "Recomanacions segons les condicions actuals:",
    safe:
      "Condicions tèrmiques favorables. Mantén una hidratació adequada i segueix les mesures preventives habituals.",
    safeUvModerate:
      "Radiació UV moderada. Es recomana protecció solar si l’exposició és prolongada.",
    safeWind:
      "Vent present però dins marges assumibles. Mantén precaució bàsica amb objectes lleugers i eines.",
    safeCloudy:
      "Condicions generals favorables. Tot i els núvols, mantén vigilància bàsica si estàs molta estona a l’exterior.",
    mild:
      "Precaució per calor. Pot aparèixer fatiga tèrmica. Beu aigua amb freqüència i fes pauses en zones ombrejades.",
    moderate:
      "Risc moderat d’estrès tèrmic. Programa pauses freqüents, redueix la càrrega física i mantén una hidratació constant.",
    high:
      "Risc alt per calor. Limita l’exposició prolongada i evita esforços físics intensos, especialment a les hores centrals del dia.",
    ext:
      "Risc extrem per calor. Atura l’activitat immediatament i aplica mesures actives de refredament corporal.",
    uvModerate:
      "Radiació UV moderada. Utilitza protecció solar si l’exposició és prolongada i evita confiar-te durant les hores centrals.",
    uvHigh:
      "Radiació UV alta. Utilitza protecció solar, gorra i ulleres, i redueix l’exposició directa al sol.",
    uvVeryHigh:
      "Radiació UV molt alta. Evita el sol en hores centrals i reforça totes les mesures de protecció solar.",
    uvExtreme:
      "Radiació UV extrema. Evita l’exposició directa al sol i prioritza ombra, roba protectora i protecció ocular.",
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
    rain:
      "Pluja o superfícies humides possibles. Augmenta la precaució per relliscades, pèrdua d’adherència i menor confort.",
    storm:
      "Situació potencialment adversa per precipitació o tempesta. Limita l’activitat exterior si no és imprescindible.",
    humid:
      "Humitat elevada. Pot augmentar la sensació de xafogor o empitjorar el confort tèrmic.",
    windModerate:
      "Vent moderat. Vigila eines, materials lleugers i maniobres en zones exposades.",
    windStrong:
      "Vent destacable. Revalora tasques exposades i extrema la precaució amb objectes, eines i estabilitat.",
    loading: "Carregant recomanacions…",
  },

  es: {
    title: "Recomendaciones según las condiciones actuales:",
    safe:
      "Condiciones térmicas favorables. Mantén una hidratación adecuada y sigue las medidas preventivas habituales.",
    safeUvModerate:
      "Radiación UV moderada. Se recomienda protección solar si la exposición es prolongada.",
    safeWind:
      "Viento presente pero dentro de márgenes asumibles. Mantén una precaución básica con objetos ligeros y herramientas.",
    safeCloudy:
      "Condiciones generales favorables. Aunque haya nubes, mantén vigilancia básica si pasas mucho tiempo al aire libre.",
    mild:
      "Precaución por calor. Puede aparecer fatiga térmica. Bebe agua con frecuencia y programa pausas en zonas sombreadas.",
    moderate:
      "Riesgo moderado de estrés térmico. Programa pausas frecuentes, reduce la carga física y mantén una hidratación constante.",
    high:
      "Riesgo alto por calor. Limita la exposición prolongada y evita esfuerzos físicos intensos, especialmente en las horas centrales del día.",
    ext:
      "Riesgo extremo por calor. Interrumpe la actividad de inmediato y aplica medidas activas de enfriamiento corporal.",
    uvModerate:
      "Radiación UV moderada. Utiliza protección solar si la exposición es prolongada y evita confiarte en las horas centrales.",
    uvHigh:
      "Radiación UV alta. Usa protección solar, gorra y gafas, y reduce la exposición directa al sol.",
    uvVeryHigh:
      "Radiación UV muy alta. Evita el sol en horas centrales y refuerza todas las medidas de protección solar.",
    uvExtreme:
      "Radiación UV extrema. Evita la exposición directa al sol y prioriza sombra, ropa protectora y protección ocular.",
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
    rain:
      "Lluvia o superficies húmedas posibles. Aumenta la precaución por resbalones, pérdida de adherencia y menor confort.",
    storm:
      "Situación potencialmente adversa por precipitación o tormenta. Limita la actividad exterior si no es imprescindible.",
    humid:
      "Humedad elevada. Puede aumentar la sensación de bochorno o empeorar el confort térmico.",
    windModerate:
      "Viento moderado. Vigila herramientas, materiales ligeros y maniobras en zonas expuestas.",
    windStrong:
      "Viento destacable. Reevalúa tareas expuestas y extrema la precaución con objetos, herramientas y estabilidad.",
    loading: "Cargando recomendaciones…",
  },

  eu: {
    title: "Gomendioak uneko baldintzen arabera:",
    safe:
      "Baldintza termiko onak. Mantendu hidratazio egokia eta ohiko prebentzio-neurriak.",
    safeUvModerate:
      "UV erradiazio moderatua. Eguzki-babesa gomendatzen da esposizio luzea bada.",
    safeWind:
      "Haizea badago, baina onargarri diren mugetan. Mantendu oinarrizko arreta objektu arin eta tresnekin.",
    safeCloudy:
      "Baldintza orokorrak onak dira. Hodeiak egon arren, mantendu oinarrizko arreta kanpoan denbora asko ematen baduzu.",
    mild:
      "Kontuz beroarekin. Nekea ager daiteke. Edan ura maiz eta egin atsedenaldiak itzalpean.",
    moderate:
      "Bero-estresaren arrisku ertaina. Egin atsedenaldi maizak, murriztu lan-karga fisikoa eta mantendu hidratazio jarraitua.",
    high:
      "Bero-arrisku handia. Mugatu esposizio luzea eta saihestu ahalegin fisiko handiak, bereziki eguneko erdiko orduetan.",
    ext:
      "Bero-arrisku muturrekoa. Gelditu jarduera berehala eta aplikatu gorputza hozteko neurri aktiboak.",
    uvModerate:
      "UV erradiazio moderatua. Erabili eguzki-babesa esposizioa luzea bada eta ez fidatu eguerdiko orduetan.",
    uvHigh:
      "UV erradiazio handia. Erabili eguzki-babesa, txapela eta betaurrekoak, eta murriztu eguzki zuzeneko esposizioa.",
    uvVeryHigh:
      "UV erradiazio oso handia. Saihestu eguzkia erdiko orduetan eta indartu eguzki-babes neurri guztiak.",
    uvExtreme:
      "UV erradiazio muturrekoa. Saihestu eguzki zuzena eta lehenetsi itzala, arropa babeslea eta begi-babesa.",
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
    rain:
      "Euria edo gainazal bustiak egon daitezke. Handitu arreta labainketengatik, atxikidura galtzeagatik eta erosotasun txikiagoagatik.",
    storm:
      "Prezipitazio edo ekaitz egoera kaltegarria izan daiteke. Mugatu kanpoko jarduera beharrezkoa ez bada.",
    humid:
      "Hezetasun handia. Sargoria handitu edo erosotasun termikoa okertu dezake.",
    windModerate:
      "Haize moderatua. Zaindu tresnak, material arinak eta eremu irekietan egindako maniobrak.",
    windStrong:
      "Haize nabarmena. Berrikusi agerian dauden lanak eta arreta handitu objektu, tresna eta egonkortasunarekin.",
    loading: "Gomendioak kargatzen…",
  },

  gl: {
    title: "Recomendacións segundo as condicións actuais:",
    safe:
      "Condicións térmicas favorables. Mantén unha hidratación adecuada e segue as medidas preventivas habituais.",
    safeUvModerate:
      "Radiación UV moderada. Recoméndase protección solar se a exposición é prolongada.",
    safeWind:
      "Hai vento, pero dentro de marxes asumibles. Mantén precaución básica con obxectos lixeiros e ferramentas.",
    safeCloudy:
      "Condicións xerais favorables. Aínda con nubes, mantén unha vixilancia básica se pasas moito tempo ao aire libre.",
    mild:
      "Precaución por calor. Pode aparecer fatiga térmica. Bebe auga con frecuencia e fai pausas en zonas sombreadas.",
    moderate:
      "Risco moderado de estrés térmico. Programa pausas frecuentes, reduce a carga física e mantén unha hidratación constante.",
    high:
      "Risco alto por calor. Limita a exposición prolongada e evita esforzos físicos intensos, especialmente nas horas centrais do día.",
    ext:
      "Risco extremo por calor. Interrompe a actividade de inmediato e aplica medidas activas de arrefriamento corporal.",
    uvModerate:
      "Radiación UV moderada. Emprega protección solar se a exposición é prolongada e evita confiarte nas horas centrais.",
    uvHigh:
      "Radiación UV alta. Emprega protección solar, gorra e lentes, e reduce a exposición directa ao sol.",
    uvVeryHigh:
      "Radiación UV moi alta. Evita o sol nas horas centrais e reforza todas as medidas de protección solar.",
    uvExtreme:
      "Radiación UV extrema. Evita a exposición directa ao sol e prioriza sombra, roupa protectora e protección ocular.",
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
    rain:
      "Chuvia ou superficies húmidas posibles. Aumenta a precaución por esvaróns, perda de adherencia e menor confort.",
    storm:
      "Situación potencialmente adversa por precipitación ou treboada. Limita a actividade exterior se non é imprescindible.",
    humid:
      "Humidade elevada. Pode aumentar a sensación de abafamento ou empeorar o confort térmico.",
    windModerate:
      "Vento moderado. Vixía ferramentas, materiais lixeiros e manobras en zonas expostas.",
    windStrong:
      "Vento destacable. Reavalia tarefas expostas e extrema a precaución con obxectos, ferramentas e estabilidade.",
    loading: "Cargando recomendacións…",
  },

  en: {
    title: "Recommendations based on current conditions:",
    safe:
      "Favourable thermal conditions. Maintain adequate hydration and follow standard preventive measures.",
    safeUvModerate:
      "Moderate UV radiation. Sun protection is recommended if exposure is prolonged.",
    safeWind:
      "Wind is present but within acceptable margins. Keep basic caution with light objects and tools.",
    safeCloudy:
      "Generally favourable conditions. Even with clouds, maintain basic awareness if you remain outdoors for long periods.",
    mild:
      "Heat caution. Heat fatigue may occur. Drink water regularly and take breaks in shaded areas.",
    moderate:
      "Moderate heat stress risk. Schedule frequent breaks, reduce physical strain and maintain constant hydration.",
    high:
      "High heat risk. Limit prolonged exposure and avoid intense physical effort, especially during the hottest hours of the day.",
    ext:
      "Extreme heat risk. Stop activity immediately and apply active body-cooling measures.",
    uvModerate:
      "Moderate UV radiation. Use sun protection if exposure is prolonged and avoid underestimating midday sun.",
    uvHigh:
      "High UV radiation. Use sunscreen, hat and eyewear, and reduce direct sun exposure.",
    uvVeryHigh:
      "Very high UV radiation. Avoid midday sun and reinforce all sun-protection measures.",
    uvExtreme:
      "Extreme UV radiation. Avoid direct sun exposure and prioritise shade, protective clothing and eye protection.",
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
    rain:
      "Rain or wet surfaces are possible. Increase caution due to slipping risk, loss of traction and lower comfort.",
    storm:
      "Potentially adverse weather due to precipitation or storm activity. Limit outdoor activity if not essential.",
    humid:
      "High humidity. It may increase mugginess or worsen thermal comfort.",
    windModerate:
      "Moderate wind. Watch tools, light materials and manoeuvres in exposed areas.",
    windStrong:
      "Noticeable wind. Reassess exposed tasks and increase caution with objects, tools and stability.",
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
  if (key === "uvModerate") return "☀️";
  if (key === "uvHigh") return "☀️☀️";
  if (key === "uvVeryHigh") return "☀️☀️☀️";
  if (key === "uvExtreme") return "☀️☀️☀️☀️";
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
// Helpers
// ---------------------------------------------------------------
type HeatKey = "safe" | "mild" | "moderate" | "high" | "ext";
type ColdKey = "cold_low" | "cold_mod" | "cold_high" | "cold_ext";
type UvKey = "uvModerate" | "uvHigh" | "uvVeryHigh" | "uvExtreme";
type NightKey = "nightCool" | "nightSafe" | "nightHeat";

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

const getColdKey = (effectiveTemp: number): ColdKey | null => {
  if (effectiveTemp < -20) return "cold_ext";
  if (effectiveTemp < -10) return "cold_high";
  if (effectiveTemp < 5) return "cold_mod";
  if (effectiveTemp < 10) return "cold_low";
  return null;
};

const getUvKey = (uvi: number | null | undefined): UvKey | null => {
  if (typeof uvi !== "number" || !Number.isFinite(uvi)) return null;
  const uv = Math.max(0, uvi);
  if (uv >= 11) return "uvExtreme";
  if (uv >= 8) return "uvVeryHigh";
  if (uv >= 6) return "uvHigh";
  if (uv >= 3) return "uvModerate";
  return null;
};

const getNightKey = (effectiveTemp: number): NightKey => {
  if (effectiveTemp < 18) return "nightCool";
  if (effectiveTemp < 24) return "nightSafe";
  return "nightHeat";
};

const isRainyWeather = (weatherMain?: string): boolean =>
  weatherMain === "Rain" ||
  weatherMain === "Drizzle" ||
  weatherMain === "Thunderstorm";

const isStormWeather = (weatherMain?: string): boolean =>
  weatherMain === "Thunderstorm";

const joinExtras = (...parts: Array<string | undefined | null | false>): string | undefined => {
  const clean = parts
    .filter(Boolean)
    .map((x) => String(x).trim())
    .filter((x) => x.length > 0);
  return clean.length ? clean.join(" ") : undefined;
};

const joinLines = (...parts: Array<string | undefined | null | false>): string => {
  const clean = parts
    .filter(Boolean)
    .map((x) => String(x).trim())
    .filter((x) => x.length > 0);

  return clean.join("\n\n");
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
      <p style={{ whiteSpace: "pre-line" }}>{body}</p>
      {extra ? (
        <p style={{ marginTop: "0.6rem", opacity: 0.95, whiteSpace: "pre-line" }}>
          {extra}
        </p>
      ) : null}
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
  humidity,
  forceSafe,
  aemetActive,
  aemetSoon,
  alertType,
  uvi,
  weatherMain,
  weatherDescription,
  cloudiness,
  windKmh,
  currentHour,
}: Props) {
  const lng = normalizeLang(lang);

  // ✅ Blindatge: mai permetre TXT undefined
  const t = (TXT as Record<string, (typeof TXT)["ca"]>)[lng] ?? TXT.ca;

  const effectiveTemp = Number(temp);
  const uvKey = getUvKey(uvi);
  const coldKey = getColdKey(effectiveTemp);
  const rainy = isRainyWeather(weatherMain);
  const stormy = isStormWeather(weatherMain);
  const humid = typeof humidity === "number" && humidity >= 70 && effectiveTemp >= 24;
  const windyModerate = typeof windKmh === "number" && windKmh >= 25 && windKmh < 45;
  const windyStrong = typeof windKmh === "number" && windKmh >= 45;
  const veryCloudy = typeof cloudiness === "number" && cloudiness >= 85;

  if (!Number.isFinite(effectiveTemp)) {
    return (
      <RecommendationBox
        className="recommendation-box safe"
        title={`${getIcon("safe")} ${t.title}`}
        body={t.loading}
      />
    );
  }

  if (forceSafe) {
    return (
      <RecommendationBox
        className="recommendation-box safe"
        title={`${getIcon("safe")} ${t.title}`}
        body={t.safe}
      />
    );
  }

  /* =========================================================
     1️⃣ PRIORITAT ABSOLUTA — RISC PER FRED
  ========================================================== */
  if (coldKey) {
    return (
      <RecommendationBox
        className={`recommendation-box ${coldKey}`}
        title={`${getIcon(coldKey)} ${t.title}`}
        body={t[coldKey]}
        extra={joinExtras(
          windyModerate && t.windModerate,
          windyStrong && t.windStrong,
          stormy && t.storm,
          rainy && !stormy && t.rain
        )}
      />
    );
  }

  /* =========================================================
     2️⃣ CALOR IMPORTANT — abans que UV moderat
  ========================================================== */
  if (effectiveTemp >= 30) {
    const heatKey: HeatKey = effectiveTemp < 33 ? "moderate" : effectiveTemp < 41 ? "high" : "ext";

    return (
      <RecommendationBox
        className={`recommendation-box ${heatKey}`}
        title={`${getIcon(heatKey)} ${t.title}`}
        body={t[heatKey]}
        extra={joinExtras(
          humid && t.humid,
          uvKey === "uvHigh" && t.uvHigh,
          uvKey === "uvVeryHigh" && t.uvVeryHigh,
          uvKey === "uvExtreme" && t.uvExtreme,
          windyModerate && t.windModerate,
          windyStrong && t.windStrong
        )}
      />
    );
  }

  /* =========================================================
     3️⃣ UV — només si realment és rellevant de dia
  ========================================================== */
  if (isDay && uvKey) {
    return (
      <RecommendationBox
        className={`recommendation-box ${uvKey}`}
        title={`${getIcon(uvKey)} ${t.title}`}
        body={t[uvKey]}
        extra={joinExtras(
          humid && t.humid,
          windyModerate && t.windModerate,
          windyStrong && t.windStrong,
          rainy && !stormy && t.rain,
          stormy && t.storm
        )}
      />
    );
  }

  /* =========================================================
     4️⃣ RECOMANACIONS NOCTURNES
  ========================================================== */
  if (!isDay) {
    const nightKey = getNightKey(effectiveTemp);

    return (
      <RecommendationBox
        className={`recommendation-box ${nightKey}`}
        title={`${getIcon(nightKey)} ${t.title}`}
        body={t[nightKey]}
        extra={joinExtras(
          humid && t.humid,
          windyModerate && t.windModerate,
          windyStrong && t.windStrong,
          rainy && !stormy && t.rain,
          stormy && t.storm
        )}
      />
    );
  }

  /* =========================================================
     5️⃣ RISC PER CALOR (via getHeatRisk) — només en franges suaus
  ========================================================== */
  const riskObj: any = getHeatRisk(effectiveTemp, "rest");
  const heatKey = mapHeatLevelToKey(riskObj?.level);

  if (heatKey !== "safe") {
    return (
      <RecommendationBox
        className={`recommendation-box ${heatKey}`}
        title={`${getIcon(heatKey)} ${t.title}`}
        body={t[heatKey]}
        extra={joinExtras(
          humid && t.humid,
          windyModerate && t.windModerate,
          windyStrong && t.windStrong
        )}
      />
    );
  }

  /* =========================================================
     6️⃣ CASOS SEGURS / CONTEXTUALS
  ========================================================== */
  if (isDay && uvKey === "uvModerate") {
    return (
      <RecommendationBox
        className="recommendation-box safe"
        title={`${getIcon("safe")} ${t.title}`}
        body={joinLines(
          t.safeUvModerate,
          humid && t.humid,
          windyModerate && t.windModerate
        )}
      />
    );
  }

  if (windyModerate) {
    return (
      <RecommendationBox
        className="recommendation-box safe"
        title={`${getIcon("safe")} ${t.title}`}
        body={joinLines(
          t.safeWind,
          humid && t.humid
        )}
      />
    );
  }

  if (rainy || stormy) {
    return (
      <RecommendationBox
        className="recommendation-box safe"
        title={`${getIcon("safe")} ${t.title}`}
        body={joinLines(
          t.safe,
          stormy ? t.storm : t.rain
        )}
      />
    );
  }

  if (veryCloudy) {
    return (
      <RecommendationBox
        className="recommendation-box safe"
        title={`${getIcon("safe")} ${t.title}`}
        body={joinLines(
          t.safeCloudy,
          humid && t.humid
        )}
      />
    );
  }

  /* =========================================================
     7️⃣ CAS SEGUR FINAL
  ========================================================== */
  return (
    <RecommendationBox
      className="recommendation-box safe"
      title={`${getIcon("safe")} ${t.title}`}
      body={joinLines(
        t.safe,
        humid && t.humid
      )}
    />
  );
}