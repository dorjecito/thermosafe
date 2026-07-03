// ===============================================================
// 📘 Recommendations.tsx — Versió robusta millorada (CA/ES/EU/GL/EN)
// ✅ Fallback segur per evitar TXT undefined
// ✅ Títol coherent: “segons les condicions actuals”
// ✅ Prioritza millor: fred > calor forta > vent fort > UV > nit > segur
// ✅ Recomanacions nocturnes més naturals i menys alarmistes
// ✅ Compatible amb les props actuals que envies des d’App.tsx
// ✅ Sense redundància amb el banner d’avís oficial
// ===============================================================

import * as React from "react";
import { getHeatRisk } from "../utils/heatRisk";
import { getColdRisk } from "../utils/getColdRisk";
import { getUvLevelIndex } from "../utils/uv";
import type { HeatDayPhase } from "../utils/isDayAtLocation";
import type { FactorRisk } from "../utils/riskScoreEngine";

type Lang = "ca" | "es" | "eu" | "gl" | "en";
type ActivityLevel = "rest" | "walk" | "moderate" | "intense";

type TextKeys =
  | "title"
  | "safe"
  | "safeUvModerate"
  | "safeWind"
  | "safeCloudy"
  | "factorHeat"
  | "factorCold"
  | "factorUv"
  | "factorWind"
  | "factorHumidity"
  | "factorRain"
  | "factorStorm"
  | "factorNight"
  | "mild"
  | "moderate"
  | "high"
  | "highLateDay"
  | "highEvening"
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
  | "loading"
  | "safeUvCloudy"
  | "tropicalNight";

type TextPack = Record<TextKeys, string>;
type TxtDict = Record<Lang, TextPack>;
type RecommendationFactor =
  | FactorRisk["factor"]
  | "humidity"
  | "rain"
  | "storm"
  | "night";
export type RecommendationItem = {
  icon: string;
  label: string;
  text: string;
  factor?: RecommendationFactor;
};

export type RecommendationFactorState = {
  hasEngineFactors: boolean;
  heat: boolean | null;
  uv: boolean | null;
  wind: boolean | null;
};

interface Props {
  temp: number;
  lang: Lang | string;
  isDay: boolean;
  activity?: ActivityLevel;
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
  heatDayPhase?: HeatDayPhase;
  riskFactors?: FactorRisk[];
}

// ---------------------------------------------------------------
// 🗣️ Textos multilingües
// ---------------------------------------------------------------
const TXT: TxtDict = {
  ca: {
    title: "Recomanacions preventives",
    safe:
      "Condicions tèrmiques favorables. Mantén una hidratació adequada i segueix les mesures preventives habituals.",
    safeUvModerate:
      "Radiació UV moderada. Es recomana protecció solar si l’exposició és prolongada.",
    safeWind:
      "Vent moderat. Assegura objectes, evita manipular materials lleugers exposats i augmenta la precaució amb eines o treballs a l’exterior.",
    safeCloudy:
      "Condicions generals favorables. Tot i els núvols, mantén vigilància bàsica si estàs molta estona a l’exterior.",
    factorHeat: "Calor",
    factorCold: "Fred",
    factorUv: "Radiació UV",
    factorWind: "Vent",
    factorHumidity: "Humitat",
    factorRain: "Pluja",
    factorStorm: "Tempestes",
    factorNight: "Nit",
    mild:
      "Precaució lleu per calor. Pot aparèixer fatiga tèrmica si mantens esforç físic. Beu aigua amb freqüència i fes pauses en llocs frescos.",
    moderate:
      "Risc moderat d’estrès tèrmic. Programa pauses freqüents, redueix la càrrega física i mantén una hidratació constant.",
    high:
      "Risc alt per calor. Limita l’exposició prolongada i evita esforços físics intensos, especialment a les hores centrals del dia.",
    highLateDay:
      "Risc alt per calor. Mantén una bona hidratació i evita esforços físics intensos fins que les condicions millorin.",
    highEvening:
      "Risc alt per calor. Mantén una bona hidratació i continua limitant els esforços físics mentre persisteixi la calor.",
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
      "Ambient nocturn fresc. Es recomana roba còmoda i una capa lleugera si passes temps a l’exterior.",
    nightSafe:
      "Condicions nocturnes agradables i estables. No calen mesures especials.",
    nightHeat:
      "Temperatura nocturna elevada. Afavoreix la ventilació creuada, hidrata’t i utilitza roba lleugera i transpirable.",
    cold_low:
      "Frescor o fred lleu. És recomanable vestir per capes lleugeres, sobretot si estàs quiet o fa vent.",
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
      "Vent fort. Revalora tasques exposades i assegura eines o materials lleugers.",
    safeUvCloudy:
      "Pot existir radiació UV significativa encara que hi hagi núvols o pluja. Si passes temps a l’exterior, mantén protecció solar bàsica i adapta l’activitat segons l’evolució del temps.",
    tropicalNight:
      "Nit tropical. La temperatura es manté elevada durant la nit i pot dificultar el descans i la recuperació tèrmica. Ventila els espais, hidrata’t i evita esforços físics innecessaris.",
    loading: "Carregant recomanacions…",
  },

  es: {
    title: "Recomendaciones preventivas",
    safe:
      "Condiciones térmicas favorables. Mantén una hidratación adecuada y sigue las medidas preventivas habituales.",
    safeUvModerate:
      "Radiación UV moderada. Se recomienda protección solar si la exposición es prolongada.",
    safeWind:
      "Viento moderado. Asegura objetos, evita manipular materiales ligeros expuestos y aumenta la precaución con herramientas o trabajos al aire libre.",
    safeCloudy:
      "Condiciones generales favorables. Aunque haya nubes, mantén vigilancia básica si pasas mucho tiempo al aire libre.",
    factorHeat: "Calor",
    factorCold: "Frío",
    factorUv: "Radiación UV",
    factorWind: "Viento",
    factorHumidity: "Humedad",
    factorRain: "Lluvia",
    factorStorm: "Tormentas",
    factorNight: "Noche",
    mild:
      "Precaución leve por calor. Puede aparecer fatiga térmica si mantienes esfuerzo físico. Bebe agua con frecuencia y programa pausas en lugares frescos.",
    moderate:
      "Riesgo moderado de estrés térmico. Programa pausas frecuentes, reduce la carga física y mantén una hidratación constante.",
    high:
      "Riesgo alto por calor. Limita la exposición prolongada y evita esfuerzos físicos intensos, especialmente en las horas centrales del día.",
    highLateDay:
      "Riesgo alto por calor. Mantén una buena hidratación y evita esfuerzos físicos intensos hasta que las condiciones mejoren.",
    highEvening:
      "Riesgo alto por calor. Mantén una buena hidratación y sigue limitando los esfuerzos físicos mientras persista el calor.",
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
      "Ambiente nocturno fresco. Se recomienda ropa cómoda y una capa ligera si pasas tiempo al aire libre.",
    nightSafe:
      "Condiciones nocturnas agradables y estables. No se requieren medidas especiales.",
    nightHeat:
      "Temperatura nocturna elevada. Favorece la ventilación cruzada, hidrátate y utiliza ropa ligera y transpirable.",
    cold_low:
      "Frescor o frío leve. Se recomienda vestir por capas ligeras, sobre todo si permaneces quieto o hace viento.",
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
      "Viento fuerte. Reevalúa tareas expuestas y asegura herramientas o materiales ligeros.",
    safeUvCloudy:
      "Puede existir radiación UV significativa aunque haya nubes o lluvia. Si pasas tiempo al aire libre, mantén protección solar básica y adapta la actividad según la evolución del tiempo.",
    tropicalNight:
      "Noche tropical. La temperatura se mantiene elevada durante la noche y puede dificultar el descanso y la recuperación térmica. Ventila los espacios, hidrátate y evita esfuerzos físicos innecesarios.",
    loading: "Cargando recomendaciones…",
  },

  eu: {
    title: "Prebentzio-gomendioak",
    safe:
      "Baldintza termiko onak. Mantendu hidratazio egokia eta ohiko prebentzio-neurriak.",
    safeUvModerate:
      "UV erradiazio moderatua. Eguzki-babesa gomendatzen da esposizio luzea bada.",
    safeWind:
      "Haize moderatua. Lotu objektuak, saihestu agerian dauden material arinak manipulatzea eta handitu arreta tresnekin edo kanpoko lanetan.",
    safeCloudy:
      "Baldintza orokorrak onak dira. Hodeiak egon arren, mantendu oinarrizko arreta kanpoan denbora asko ematen baduzu.",
    factorHeat: "Beroa",
    factorCold: "Hotza",
    factorUv: "UV erradiazioa",
    factorWind: "Haizea",
    factorHumidity: "Hezetasuna",
    factorRain: "Euria",
    factorStorm: "Ekaitzak",
    factorNight: "Gaua",
    mild:
      "Beroagatik arreta arina. Ahalegin fisikoa mantenduz gero nekea ager daiteke. Edan ura maiz eta egin atsedenaldiak leku freskoetan.",
    moderate:
      "Bero-estresaren arrisku ertaina. Egin atsedenaldi maizak, murriztu lan-karga fisikoa eta mantendu hidratazio jarraitua.",
    high:
      "Bero-arrisku handia. Mugatu esposizio luzea eta saihestu ahalegin fisiko handiak, bereziki eguneko erdiko orduetan.",
    highLateDay:
      "Bero-arrisku handia. Mantendu hidratazio egokia eta saihestu ahalegin fisiko handiak baldintzak hobetu arte.",
    highEvening:
      "Bero-arrisku handia. Mantendu hidratazio egokia eta jarraitu ahalegin fisikoak mugatzen beroak irauten duen bitartean.",
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
      "Gaueko giro freskoa. Erabili arropa erosoa eta geruza arin bat kanpoan denbora pasatuko baduzu.",
    nightSafe:
      "Gaueko baldintzak atseginak eta egonkorrak dira. Ez da neurri berezirik behar.",
    nightHeat:
      "Gaueko tenperatura altua. Bultzatu aireztapen gurutzatua, hidratatu eta erabili arropa arina eta transpiragarria.",
    cold_low:
      "Freskura edo hotz arina. Geruza arinez janztea gomendatzen da, batez ere geldirik bazaude edo haizea badabil.",
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
      "Haize handia. Berrikusi kanpoan egiteko lanak eta ziurtatu tresna edo material arinak.",
    safeUvCloudy:
      "Hodeiak edo euria egon arren, UV erradiazio esanguratsua egon daiteke. Kanpoan denbora ematen baduzu, mantendu oinarrizko eguzki-babesa eta egokitu jarduera eguraldiaren bilakaeraren arabera.",
    tropicalNight:
      "Gau tropikala. Tenperatura altua mantentzen da gauez eta atseden termikoa zaildu dezake. Aireztatu espazioak, hidratatu eta saihestu alferrikako ahalegin fisikoak.",
    loading: "Gomendioak kargatzen…",
  },

  gl: {
    title: "Recomendacións preventivas",
    safe:
      "Condicións térmicas favorables. Mantén unha hidratación adecuada e segue as medidas preventivas habituais.",
    safeUvModerate:
      "Radiación UV moderada. Recoméndase protección solar se a exposición é prolongada.",
    safeWind:
      "Vento moderado. Asegura obxectos, evita manipular materiais lixeiros expostos e aumenta a precaución con ferramentas ou traballos ao aire libre.",
    safeCloudy:
      "Condicións xerais favorables. Aínda con nubes, mantén unha vixilancia básica se pasas moito tempo ao aire libre.",
    factorHeat: "Calor",
    factorCold: "Frío",
    factorUv: "Radiación UV",
    factorWind: "Vento",
    factorHumidity: "Humidade",
    factorRain: "Chuvia",
    factorStorm: "Treboadas",
    factorNight: "Noite",
    mild:
      "Precaución leve por calor. Pode aparecer fatiga térmica se mantés esforzo físico. Bebe auga con frecuencia e fai pausas en lugares frescos.",
    moderate:
      "Risco moderado de estrés térmico. Programa pausas frecuentes, reduce a carga física e mantén unha hidratación constante.",
    high:
      "Risco alto por calor. Limita a exposición prolongada e evita esforzos físicos intensos, especialmente nas horas centrais do día.",
    highLateDay:
      "Risco alto por calor. Mantén unha boa hidratación e evita esforzos físicos intensos ata que as condicións melloren.",
    highEvening:
      "Risco alto por calor. Mantén unha boa hidratación e continúa limitando os esforzos físicos mentres persista a calor.",
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
      "Ambiente nocturno fresco. Recoméndase roupa cómoda e unha capa lixeira se pasas tempo ao aire libre.",
    nightSafe:
      "Condicións nocturnas agradables e estables. Non se requiren medidas especiais.",
    nightHeat:
      "Temperatura nocturna elevada. Favorece a ventilación cruzada, hidrátate e emprega roupa lixeira e transpirable.",
    cold_low:
      "Frescura ou frío leve. Recoméndase vestir por capas lixeiras, sobre todo se permaneces quieto ou hai vento.",
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
      "Vento forte. Reavalia tarefas expostas e asegura ferramentas ou materiais lixeiros.",
    safeUvCloudy:
      "Pode existir radiación UV significativa aínda que haxa nubes ou choiva. Se permaneces ao aire libre, mantén protección solar básica e adapta a actividade segundo a evolución do tempo.",
    tropicalNight:
      "Noite tropical. A temperatura mantense elevada durante a noite e pode dificultar o descanso e a recuperación térmica. Ventila os espazos, hidrátate e evita esforzos físicos innecesarios.",
    loading: "Cargando recomendacións…",
  },

  en: {
    title: "Preventive recommendations",
    safe:
      "Favourable thermal conditions. Maintain adequate hydration and follow standard preventive measures.",
    safeUvModerate:
      "Moderate UV radiation. Sun protection is recommended if exposure is prolonged.",
    safeWind:
      "Moderate wind. Secure objects, avoid handling exposed light materials and increase caution with tools or outdoor work.",
    safeCloudy:
      "Generally favourable conditions. Even with clouds, maintain basic awareness if you remain outdoors for long periods.",
    factorHeat: "Heat",
    factorCold: "Cold",
    factorUv: "UV radiation",
    factorWind: "Wind",
    factorHumidity: "Humidity",
    factorRain: "Rain",
    factorStorm: "Storms",
    factorNight: "Night",
    mild:
      "Mild heat caution. Heat fatigue may occur if physical effort continues. Drink water regularly and take breaks in cool places.",
    moderate:
      "Moderate heat stress risk. Schedule frequent breaks, reduce physical strain and maintain constant hydration.",
    high:
      "High heat risk. Limit prolonged exposure and avoid intense physical effort, especially during the hottest hours of the day.",
    highLateDay:
      "High heat risk. Stay well hydrated and avoid intense physical effort until conditions improve.",
    highEvening:
      "High heat risk. Stay well hydrated and continue limiting physical effort while the heat persists.",
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
      "Cool nighttime conditions. Comfortable clothing and a light extra layer are recommended if you stay outdoors for a while.",
    nightSafe:
      "Night conditions are pleasant and stable. No special measures are needed.",
    nightHeat:
      "Elevated nighttime temperatures. Ensure cross-ventilation, stay hydrated and wear light, breathable clothing.",
    cold_low:
      "Cool or mildly cold conditions. Light layers are recommended, especially if you remain still or it is windy.",
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
      "Strong wind. Reassess exposed tasks and secure light tools or materials.",
    safeUvCloudy:
      "Significant UV radiation may still be present even with clouds or rain. If you stay outdoors, keep basic sun protection and adapt activity according to weather evolution.",
    tropicalNight:
      "Tropical night conditions. Temperatures remain elevated overnight and may hinder rest and thermal recovery. Ventilate indoor spaces, stay hydrated and avoid unnecessary physical effort.",
    loading: "Loading recommendations…",
  },
} as const;

// ----------------------------------------------
// ✨ Icona fixa per reforçar que són mesures preventives
// ----------------------------------------------
const getIcon = (_key: string): string => "🛡️";

const normalizeLang = (lang: Lang | string): Lang => {
  const raw = String(lang || "ca").trim().toLowerCase();
  const primary = raw.split(/[-_]/)[0].slice(0, 2) as Lang;
  return (["ca", "es", "eu", "gl", "en"] as const).includes(primary) ? primary : "ca";
};

// ---------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------
type HeatKey = "safe" | "mild" | "moderate" | "high" | "ext";
type HeatRecommendationKey = HeatKey | "highLateDay" | "highEvening";
type ColdKey = "cold_low" | "cold_mod" | "cold_high" | "cold_ext";
type UvKey = "uvModerate" | "uvHigh" | "uvVeryHigh" | "uvExtreme";
type NightKey = "nightCool" | "nightSafe" | "nightHeat" | "tropicalNight";

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
    s === "safe"
  ) return "safe";

  if (s === "baix" || s === "bajo" || s === "low") return "mild";
  if (s.includes("lleu") || s.includes("leve") || s.includes("mild")) return "mild";
  if (s.includes("moderat") || s.includes("moderado") || s.includes("moderate")) return "moderate";
  if (s.includes("alt") || s.includes("alto") || s.includes("high")) return "high";
  if (s.includes("extrem") || s.includes("extremo") || s.includes("extreme")) return "ext";

  return "safe";
};

const getColdKey = (effectiveTemp: number): ColdKey | null => {
  const coldRisk = getColdRisk(effectiveTemp, null);
  if (coldRisk === "extrem") return "cold_ext";
  if (coldRisk === "alt" || coldRisk === "molt alt") return "cold_high";
  if (coldRisk === "moderat") return "cold_mod";
  if (coldRisk === "lleu") return "cold_low";
  return null;
};

const getUvKey = (uvi: number | null | undefined): UvKey | null => {
  if (typeof uvi !== "number" || !Number.isFinite(uvi)) return null;
  const level = getUvLevelIndex(uvi);
  if (level === 4) return "uvExtreme";
  if (level === 3) return "uvVeryHigh";
  if (level === 2) return "uvHigh";
  if (level === 1) return "uvModerate";
  return null;
};

const getNightKey = (effectiveTemp: number): NightKey => {
  if (effectiveTemp >= 25) return "tropicalNight";
  if (effectiveTemp < 18) return "nightCool";
  if (effectiveTemp < 25) return "nightSafe";
  return "nightHeat";
};

const isCentralHeatHour = (hour?: number): boolean =>
  typeof hour === "number" && Number.isFinite(hour) && hour >= 11 && hour < 17;

const getHeatRecommendationKey = (
  heatKey: HeatKey,
  heatDayPhase?: HeatDayPhase,
  currentHour?: number
): HeatRecommendationKey => {
  if (heatKey !== "high") return heatKey;

  if (heatDayPhase === "evening" || heatDayPhase === "night") {
    return "highEvening";
  }

  if (heatDayPhase === "late_day" || !isCentralHeatHour(currentHour)) {
    return "highLateDay";
  }

  return "high";
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

const ucfirst = (text: string): string =>
  text.length ? `${text.charAt(0).toLocaleUpperCase()}${text.slice(1)}` : text;

const compactGroupedRecommendationText = (item: RecommendationItem): string => {
  let text = item.text.trim();

  const replacements: Array<[RegExp, string]> = [
    [/^Radiació UV\s+/i, ""],
    [/^Radiación UV\s+/i, ""],
    [/^UV erradiazio\s+/i, ""],
    [/^UV radiation\s+/i, ""],
    [/^(Moderate|High|Very high|Extreme) UV radiation\b/i, "$1"],

    [/^Vent\s+/i, ""],
    [/^Viento\s+/i, ""],
    [/^Vento\s+/i, ""],
    [/^Haize\s+/i, ""],
    [/^(Moderate|Strong) wind\b/i, "$1"],

    [/^Humitat\s+/i, ""],
    [/^Humedad\s+/i, ""],
    [/^Humidade\s+/i, ""],
    [/^Hezetasun\s+/i, ""],
    [/^High humidity\b/i, "High"],

    [/^Fred\s+/i, ""],
    [/^Fr[ií]o\s+/i, ""],
    [/^Hotz\s+/i, ""],
    [/^Cold\s+/i, ""],

    [/^Nit\s+/i, ""],
    [/^Noche\s+/i, ""],
    [/^Noite\s+/i, ""],
    [/^Gau\s+/i, ""],

    [/^Precaució lleu per calor\./i, "Precaució lleu."],
    [/^Risc alt per calor\./i, "Risc alt."],
    [/^Risc extrem per calor\./i, "Risc extrem."],
    [/^Precaución leve por calor\./i, "Precaución leve."],
    [/^Riesgo alto por calor\./i, "Riesgo alto."],
    [/^Riesgo extremo por calor\./i, "Riesgo extremo."],
    [/^Precaución leve por calor\./i, "Precaución leve."],
    [/^Risco alto por calor\./i, "Risco alto."],
    [/^Risco extremo por calor\./i, "Risco extremo."],
    [/^Mild heat caution\./i, "Mild caution."],
    [/^High heat risk\./i, "High risk."],
    [/^Extreme heat risk\./i, "Extreme risk."],
    [/^Beroagatik arreta arina\./i, "Arreta arina."],
    [/^Bero-arrisku handia\./i, "Arrisku handia."],
    [/^Bero-arrisku muturrekoa\./i, "Arrisku muturrekoa."],
  ];

  for (const [pattern, replacement] of replacements) {
    if (pattern.test(text)) {
      text = text.replace(pattern, replacement).trim();
      break;
    }
  }

  return ucfirst(text);
};

export const sortItemsByRiskFactors = (
  items: RecommendationItem[],
  riskFactors?: FactorRisk[]
): RecommendationItem[] => {
  if (!riskFactors?.length) return items;

  const factorOrder = new Map<RecommendationFactor, number>(
    riskFactors.map((factor, index) => [factor.factor, index])
  );

  return [...items].sort((a, b) => {
    const orderA = a.factor ? factorOrder.get(a.factor) : undefined;
    const orderB = b.factor ? factorOrder.get(b.factor) : undefined;

    if (orderA === undefined && orderB === undefined) return 0;
    if (orderA === undefined) return 1;
    if (orderB === undefined) return -1;
    return orderA - orderB;
  });
};

const factorItems = (
  riskFactors: FactorRisk[] | undefined,
  ...items: Array<RecommendationItem | undefined | null | false>
): RecommendationItem[] | undefined => {
  const clean = items
    .filter(Boolean)
    .map((item) => item as RecommendationItem)
    .filter((item) => item.text.trim().length > 0);

  if (clean.length <= 1) return undefined;

  return sortItemsByRiskFactors(clean, riskFactors).map((item) => ({
        ...item,
        text: compactGroupedRecommendationText(item),
      }));
};

export const getRecommendationFactorState = (
  riskFactors?: FactorRisk[]
): RecommendationFactorState => {
  const hasEngineFactors = Array.isArray(riskFactors);
  const isActive = (factor: "heat" | "uv" | "wind"): boolean | null =>
    hasEngineFactors
      ? riskFactors.some(
          (riskFactor) =>
            riskFactor.factor === factor &&
            riskFactor.active !== false &&
            riskFactor.severity > 0
        )
      : null;

  return {
    hasEngineFactors,
    heat: isActive("heat"),
    uv: isActive("uv"),
    wind: isActive("wind"),
  };
};

// ---------------------------------------------------------------
// ✅ Caixa de recomanació reutilitzable
// ---------------------------------------------------------------
function RecommendationBox({
  className,
  title,
  body,
  extra,
  items,
}: {
  className: string;
  title: string;
  body: string;
  extra?: string;
  items?: RecommendationItem[];
}) {
  return (
    <div className={className}>
      <p className="recommendation-title">{title}</p>
      {items?.length ? (
        <div className="recommendation-factor-list">
          {items.map((item, index) => (
            <div className="recommendation-factor-item" key={`${item.icon}-${index}`}>
              <span className="recommendation-factor-icon" aria-hidden="true">
                {item.icon}
              </span>
              <span className="recommendation-factor-content">
                <strong className="recommendation-factor-label">{item.label}</strong>
                <span className="recommendation-factor-text">{item.text}</span>
              </span>
            </div>
          ))}
        </div>
      ) : (
        <>
          <p style={{ whiteSpace: "pre-line" }}>{body}</p>
          {extra ? (
            <p style={{ marginTop: "0.6rem", opacity: 0.95, whiteSpace: "pre-line" }}>
              {extra}
            </p>
          ) : null}
        </>
      )}
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
  activity,
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
  heatDayPhase,
  riskFactors,
}: Props) {
  const lng = normalizeLang(lang);

  const t = (TXT as Record<string, (typeof TXT)["ca"]>)[lng] ?? TXT.ca;

  const effectiveTemp = Number(temp);
  const uvKey = getUvKey(uvi);
  const coldKey = getColdKey(effectiveTemp);
  const rainy = isRainyWeather(weatherMain);
  const stormy = isStormWeather(weatherMain);
  const humid = typeof humidity === "number" && humidity >= 70 && effectiveTemp >= 24;
  const windyModerate = typeof windKmh === "number" && windKmh >= 25 && windKmh < 45;
  const windyStrong = typeof windKmh === "number" && windKmh >= 45;
  const factorState = getRecommendationFactorState(riskFactors);
  const heatActive = factorState.heat ?? true;
  const uvActive = factorState.uv ?? true;
  const windActive = factorState.wind ?? true;
  const showWindModerate = windActive && windyModerate;
  const showWindStrong = windActive && windyStrong;
  const veryCloudy = typeof cloudiness === "number" && cloudiness >= 75;
  const uvSuppressedByWeather =
  isDay &&
  uvActive &&
  !!uvKey &&
  (veryCloudy || rainy || stormy);

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
        items={factorItems(
          riskFactors,
          { factor: "cold", icon: "🥶", label: t.factorCold, text: t[coldKey] },
          showWindModerate && { factor: "wind", icon: "🌬️", label: t.factorWind, text: t.windModerate },
          showWindStrong && { factor: "wind", icon: "🌬️", label: t.factorWind, text: t.windStrong },
          stormy && { factor: "storm", icon: "⛈️", label: t.factorStorm, text: t.storm },
          rainy && !stormy && { factor: "rain", icon: "🌧️", label: t.factorRain, text: t.rain }
        )}
        extra={joinExtras(
          showWindModerate && t.windModerate,
          showWindStrong && t.windStrong,
          stormy && t.storm,
          rainy && !stormy && t.rain
        )}
      />
    );
  }

  /* =========================================================
     2️⃣ CALOR IMPORTANT — abans que UV moderat
  ========================================================== */
  if (heatActive && effectiveTemp >= 30 && isDay) {
    const riskObj = getHeatRisk(effectiveTemp, activity || "rest");
    const heatKey = mapHeatLevelToKey(riskObj.level);
    const heatRecommendationKey = getHeatRecommendationKey(heatKey, heatDayPhase, currentHour);

    return (
      <RecommendationBox
        className={`recommendation-box ${heatKey}`}
        title={`${getIcon(heatKey)} ${t.title}`}
        body={t[heatRecommendationKey]}
        items={factorItems(
          riskFactors,
          { factor: "heat", icon: "🌡️", label: t.factorHeat, text: t[heatRecommendationKey] },
          humid && { factor: "humidity", icon: "💧", label: t.factorHumidity, text: t.humid },
          uvActive && uvKey === "uvHigh" && { factor: "uv", icon: "☀️", label: t.factorUv, text: t.uvHigh },
          uvActive && uvKey === "uvVeryHigh" && { factor: "uv", icon: "☀️", label: t.factorUv, text: t.uvVeryHigh },
          uvActive && uvKey === "uvExtreme" && { factor: "uv", icon: "☀️", label: t.factorUv, text: t.uvExtreme },
          showWindModerate && { factor: "wind", icon: "🌬️", label: t.factorWind, text: t.windModerate },
          showWindStrong && { factor: "wind", icon: "🌬️", label: t.factorWind, text: t.windStrong }
        )}
        extra={joinExtras(
          humid && t.humid,
          uvActive && uvKey === "uvHigh" && t.uvHigh,
          uvActive && uvKey === "uvVeryHigh" && t.uvVeryHigh,
          uvActive && uvKey === "uvExtreme" && t.uvExtreme,
          showWindModerate && t.windModerate,
          showWindStrong && t.windStrong
        )}
      />
    );
  }

  /* =========================================================
     2.5️⃣ VENT FORT — prioritat sobre UV i casos suaus
  ========================================================== */
  if (showWindStrong) {
    return (
      <RecommendationBox
        className="recommendation-box windStrong"
        title={`${getIcon("windStrong")} ${t.title}`}
        body={t.windStrong}
        items={factorItems(
          riskFactors,
          { factor: "wind", icon: "🌬️", label: t.factorWind, text: t.windStrong },
          humid && { factor: "humidity", icon: "💧", label: t.factorHumidity, text: t.humid },
          uvActive && uvKey === "uvHigh" && { factor: "uv", icon: "☀️", label: t.factorUv, text: t.uvHigh },
          uvActive && uvKey === "uvVeryHigh" && { factor: "uv", icon: "☀️", label: t.factorUv, text: t.uvVeryHigh },
          uvActive && uvKey === "uvExtreme" && { factor: "uv", icon: "☀️", label: t.factorUv, text: t.uvExtreme },
          rainy && !stormy && { factor: "rain", icon: "🌧️", label: t.factorRain, text: t.rain },
          stormy && { factor: "storm", icon: "⛈️", label: t.factorStorm, text: t.storm }
        )}
        extra={joinExtras(
          humid && t.humid,
          uvActive && uvKey === "uvHigh" && t.uvHigh,
          uvActive && uvKey === "uvVeryHigh" && t.uvVeryHigh,
          uvActive && uvKey === "uvExtreme" && t.uvExtreme,
          rainy && !stormy && t.rain,
          stormy && t.storm
        )}
      />
    );
  }

  /* =========================================================
     3️⃣ UV — només si realment és rellevant de dia
  ========================================================== */
 if (uvSuppressedByWeather) {
  return (
    <RecommendationBox
      className="recommendation-box safe"
      title={`${getIcon("safe")} ${t.title}`}
      body={joinLines(
      stormy ? t.storm : rainy ? t.rain : t.safeUvCloudy,
      humid && t.humid,
      showWindModerate && t.windModerate
    )}
    />
  );
} 

if (isDay && uvActive && uvKey) {
    return (
      <RecommendationBox
        className={`recommendation-box ${uvKey}`}
        title={`${getIcon(uvKey)} ${t.title}`}
        body={t[uvKey]}
        items={factorItems(
          riskFactors,
          { factor: "uv", icon: "☀️", label: t.factorUv, text: t[uvKey] },
          humid && { factor: "humidity", icon: "💧", label: t.factorHumidity, text: t.humid },
          showWindModerate && { factor: "wind", icon: "🌬️", label: t.factorWind, text: t.windModerate },
          showWindStrong && { factor: "wind", icon: "🌬️", label: t.factorWind, text: t.windStrong },
          rainy && !stormy && { factor: "rain", icon: "🌧️", label: t.factorRain, text: t.rain },
          stormy && { factor: "storm", icon: "⛈️", label: t.factorStorm, text: t.storm }
        )}
        extra={joinExtras(
          humid && t.humid,
          showWindModerate && t.windModerate,
          showWindStrong && t.windStrong,
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
        items={factorItems(
          riskFactors,
          { factor: "night", icon: "🌙", label: t.factorNight, text: t[nightKey] },
          humid && { factor: "humidity", icon: "💧", label: t.factorHumidity, text: t.humid },
          showWindModerate && { factor: "wind", icon: "🌬️", label: t.factorWind, text: t.windModerate },
          showWindStrong && { factor: "wind", icon: "🌬️", label: t.factorWind, text: t.windStrong },
          rainy && !stormy && { factor: "rain", icon: "🌧️", label: t.factorRain, text: t.rain },
          stormy && { factor: "storm", icon: "⛈️", label: t.factorStorm, text: t.storm }
        )}
        extra={joinExtras(
          humid && t.humid,
          showWindModerate && t.windModerate,
          showWindStrong && t.windStrong,
          rainy && !stormy && t.rain,
          stormy && t.storm
        )}
      />
    );
  }

  /* =========================================================
     5️⃣ RISC PER CALOR (via getHeatRisk) — només en franges suaus
  ========================================================== */
  const riskObj = getHeatRisk(effectiveTemp, activity || "rest");
  const heatKey = mapHeatLevelToKey(riskObj?.level);

  if (heatActive && heatKey !== "safe" && isDay) {
    const heatRecommendationKey = getHeatRecommendationKey(heatKey, heatDayPhase, currentHour);

    return (
      <RecommendationBox
        className={`recommendation-box ${heatKey}`}
        title={`${getIcon(heatKey)} ${t.title}`}
        body={t[heatRecommendationKey]}
        items={factorItems(
          riskFactors,
          { factor: "heat", icon: "🌡️", label: t.factorHeat, text: t[heatRecommendationKey] },
          humid && { factor: "humidity", icon: "💧", label: t.factorHumidity, text: t.humid },
          showWindModerate && { factor: "wind", icon: "🌬️", label: t.factorWind, text: t.windModerate },
          showWindStrong && { factor: "wind", icon: "🌬️", label: t.factorWind, text: t.windStrong }
        )}
        extra={joinExtras(
          humid && t.humid,
          showWindModerate && t.windModerate,
          showWindStrong && t.windStrong
        )}
      />
    );
  }

  /* =========================================================
     6️⃣ CASOS SEGURS / CONTEXTUALS
  ========================================================== */
  if (isDay && uvActive && uvKey === "uvModerate") {
    return (
      <RecommendationBox
        className="recommendation-box safe"
        title={`${getIcon("safe")} ${t.title}`}
        body={joinLines(
          t.safeUvModerate,
          humid && t.humid,
          showWindModerate && t.windModerate
        )}
      />
    );
  }

  if (showWindModerate) {
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
