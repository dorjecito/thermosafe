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
import { getColdRisk, type ColdRisk } from "../utils/getColdRisk";
import { getUvLevelIndex } from "../utils/uv";
import type { HeatDayPhase } from "../utils/isDayAtLocation";
import type { FactorRisk, NightHeatLevel } from "../utils/riskScoreEngine";
import type { WeatherContext } from "../utils/weatherContext";

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
  | "factorTropicalNight"
  | "factorTorridNight"
  | "factorSnow"
  | "factorFog"
  | "factorHail"
  | "factorDust"
  | "factorSmoke"
  | "factorIce"
  | "mild"
  | "mildMorning"
  | "moderate"
  | "moderateMorning"
  | "moderateLateDay"
  | "high"
  | "highLateDay"
  | "highEvening"
  | "ext"
  | "uvModerate"
  | "uvHigh"
  | "uvVeryHigh"
  | "uvExtreme"
  | "uvLateDay"
  | "uvEvening"
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
  | "tropicalNight"
  | "torridNight"
  | "snow"
  | "fog"
  | "hail"
  | "dust"
  | "smoke"
  | "ice";

type TextPack = Record<TextKeys, string>;
type TxtDict = Record<Lang, TextPack>;
type RecommendationFactor =
  | FactorRisk["factor"]
  | "humidity"
  | "rain"
  | "storm"
  | "night"
  | "snow"
  | "fog"
  | "hail"
  | "dust"
  | "smoke"
  | "ice";
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

export function getRecommendationRainy(
  legacyRainy: boolean,
  weatherContext?: WeatherContext
): boolean {
  return weatherContext?.rainy ?? legacyRainy;
}

export function getRecommendationStormy(
  legacyStormy: boolean,
  weatherContext?: WeatherContext
): boolean {
  return weatherContext?.stormy ?? legacyStormy;
}

export function getRecommendationHumid(
  legacyHumid: boolean,
  weatherContext?: WeatherContext
): boolean {
  return weatherContext?.humid ?? legacyHumid;
}

export function getRecommendationVeryCloudy(
  legacyVeryCloudy: boolean,
  weatherContext?: WeatherContext
): boolean {
  return weatherContext?.veryCloudy ?? legacyVeryCloudy;
}

export function getRecommendationSuppressUv(
  legacySuppressUv: boolean,
  weatherContext?: WeatherContext
): boolean {
  return weatherContext?.suppressUv ?? legacySuppressUv;
}

export function getRecommendationSlipperySurface(
  legacySlipperySurface: boolean,
  weatherContext?: WeatherContext
): boolean {
  return weatherContext?.slipperySurface ?? legacySlipperySurface;
}

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
  coldRisk?: ColdRisk;
  coldEffectiveTemp?: number | null;
  riskFactors?: FactorRisk[];
  nightHeatLevel?: NightHeatLevel;
  weatherContext?: WeatherContext;
}

// ---------------------------------------------------------------
// 🗣️ Textos multilingües
// ---------------------------------------------------------------
const TXT: TxtDict = {
  ca: {
    title: "Recomanacions preventives",
    safe:
      "El confort tèrmic és favorable. Mantén una hidratació adequada i adapta l’activitat al teu ritme.",
    safeUvModerate:
      "Radiació UV moderada. Es recomana protecció solar si l’exposició és prolongada.",
    safeWind:
      "Vent moderat. Assegura objectes, evita manipular materials lleugers exposats i augmenta la precaució amb eines o treballs a l’exterior.",
    safeCloudy:
      "Les condicions són adequades per a l’activitat habitual. Tot i els núvols, conserva una precaució bàsica si passes molta estona a l’exterior.",
    factorHeat: "Calor",
    factorCold: "Fred",
    factorUv: "Radiació UV",
    factorWind: "Vent",
    factorHumidity: "Humitat",
    factorRain: "Pluja",
    factorStorm: "Tempestes",
    factorNight: "Nit",
    factorTropicalNight: "Nit tropical",
    factorTorridNight: "Nit tòrrida",
    factorSnow: "Neu",
    factorFog: "Boira",
    factorHail: "Calamarsa",
    factorDust: "Pols",
    factorSmoke: "Fum",
    factorIce: "Gel",
    mild:
      "Mantén una hidratació adequada i evita esforços prolongats. Fes pauses si notes fatiga.",
    mildMorning:
      "Planifica les activitats més exigents abans del migdia, beu aigua amb freqüència i fes pauses en llocs frescos.",
    moderate:
      "Programa pauses freqüents, redueix la càrrega física i procura hidratar-te de manera regular.",
    moderateMorning:
      "Prioritza les activitats més exigents abans del migdia i preveu pauses i hidratació regulars.",
    moderateLateDay:
      "Redueix els esforços sostinguts i mantén pauses regulars mentre persisteixi l’estrès tèrmic.",
    high:
      "Limita l’exposició prolongada, redueix la càrrega física i fes pauses freqüents en llocs frescos.",
    highLateDay:
      "Prioritza una bona hidratació i evita esforços físics intensos fins que les condicions millorin.",
    highEvening:
      "Continua hidratant-te bé i limita els esforços físics mentre persisteixi la calor.",
    ext:
      "Atura l’activitat exigent i prioritza espais frescos o ombrívols. Aplica mesures actives de refredament corporal.",
    uvModerate:
      "Utilitza protecció solar si l’exposició és prolongada i evita confiar-te durant les hores centrals.",
    uvHigh:
      "Utilitza protecció solar, gorra i ulleres, i redueix l’exposició directa al sol.",
    uvVeryHigh:
      "Prioritza l’ombra, utilitza gorra, ulleres i protector solar SPF 50+.",
    uvExtreme:
      "Evita l’exposició directa i prioritza ombra, roba protectora i protecció ocular.",
    uvLateDay:
      "La radiació UV encara és elevada. Reforça la protecció solar i limita les exposicions prolongades.",
    uvEvening:
      "Encara hi ha radiació UV significativa. Si continues a l’exterior, utilitza protecció solar.",
    nightCool:
      "Ambient nocturn fresc. Es recomana roba còmoda i una capa lleugera si passes temps a l’exterior.",
    nightSafe:
      "Condicions nocturnes agradables i estables. No calen mesures especials.",
    nightHeat:
      "Temperatura nocturna elevada. Afavoreix la ventilació creuada, hidrata’t i utilitza roba lleugera i transpirable.",
    cold_low:
      "Vesteix per capes lleugeres, sobretot si estàs quiet o fa vent.",
    cold_mod:
      "Limita l’exposició a l’exterior i protegeix mans, peus i vies respiratòries.",
    cold_high:
      "Evita exposicions prolongades a l’exterior i reforça la protecció tèrmica.",
    cold_ext:
      "Roman en un espai interior, protegeix extremitats i conserva la calor corporal.",
    rain:
      "Augmenta la precaució davant possibles relliscades, pèrdua d’adherència i menor confort.",
    storm:
      "Situació potencialment adversa per precipitació o tempesta. Limita l’activitat exterior si no és imprescindible.",
    humid:
      "Pot augmentar la sensació de xafogor i empitjorar el confort tèrmic. Adapta el ritme de l’activitat.",
    windModerate:
      "Vigila eines, materials lleugers i maniobres en zones exposades.",
    windStrong:
      "Revalora tasques exposades i assegura eines o materials lleugers.",
    safeUvCloudy:
      "Pot existir radiació UV significativa encara que hi hagi núvols o pluja. Si passes temps a l’exterior, utilitza protecció solar bàsica i adapta l’activitat segons l’evolució del temps.",
    tropicalNight:
      "Ventila els espais abans d’anar a dormir, hidrata’t amb regularitat i evita esforços físics innecessaris durant la nit.",
    torridNight:
      "Refresca i ventila els espais, hidrata’t amb freqüència i procura dormir en l’entorn més fresc possible.",
    snow: "La neu pot reduir la visibilitat i fer relliscoses les superfícies.",
    fog: "La boira redueix la visibilitat. Incrementa la precaució durant els desplaçaments.",
    hail: "Hi pot haver calamarsa puntual. Evita les zones exposades mentre duri el fenomen.",
    dust: "La pols en suspensió pot reduir la visibilitat i irritar les vies respiratòries. Limita l’exposició si notes molèsties.",
    smoke: "La presència de fum pot afectar la visibilitat i la qualitat de l’aire. Redueix l’exposició a l’exterior.",
    ice: "Pot haver-hi superfícies gelades. Incrementa la precaució per evitar relliscades.",
    loading: "Carregant recomanacions…",
  },

  es: {
    title: "Recomendaciones preventivas",
    safe:
      "El confort térmico es favorable. Mantén una hidratación adecuada y adapta la actividad a tu ritmo.",
    safeUvModerate:
      "Radiación UV moderada. Se recomienda protección solar si la exposición es prolongada.",
    safeWind:
      "Viento moderado. Asegura objetos, evita manipular materiales ligeros expuestos y aumenta la precaución con herramientas o trabajos al aire libre.",
    safeCloudy:
      "Las condiciones son adecuadas para la actividad habitual. Aunque haya nubes, conserva una precaución básica si pasas mucho tiempo al aire libre.",
    factorHeat: "Calor",
    factorCold: "Frío",
    factorUv: "Radiación UV",
    factorWind: "Viento",
    factorHumidity: "Humedad",
    factorRain: "Lluvia",
    factorStorm: "Tormentas",
    factorNight: "Noche",
    factorTropicalNight: "Noche tropical",
    factorTorridNight: "Noche tórrida",
    factorSnow: "Nieve",
    factorFog: "Niebla",
    factorHail: "Granizo",
    factorDust: "Polvo",
    factorSmoke: "Humo",
    factorIce: "Hielo",
    mild:
      "Mantén una hidratación adecuada y evita esfuerzos prolongados. Haz pausas si notas fatiga.",
    mildMorning:
      "Planifica las actividades más exigentes antes del mediodía, bebe agua con frecuencia y haz pausas en lugares frescos.",
    moderate:
      "Programa pausas frecuentes, reduce la carga física y procura hidratarte de forma regular.",
    moderateMorning:
      "Prioriza las actividades más exigentes antes del mediodía y prevé pausas e hidratación regulares.",
    moderateLateDay:
      "Reduce los esfuerzos sostenidos y mantén pausas regulares mientras persista el estrés térmico.",
    high:
      "Limita la exposición prolongada, reduce la carga física y haz pausas frecuentes en lugares frescos.",
    highLateDay:
      "Prioriza una buena hidratación y evita esfuerzos físicos intensos hasta que las condiciones mejoren.",
    highEvening:
      "Sigue hidratándote bien y limita los esfuerzos físicos mientras persista el calor.",
    ext:
      "Interrumpe la actividad exigente y prioriza espacios frescos o sombreados. Aplica medidas activas de enfriamiento corporal.",
    uvModerate:
      "Utiliza protección solar si la exposición es prolongada y evita confiarte en las horas centrales.",
    uvHigh:
      "Usa protección solar, gorra y gafas, y reduce la exposición directa al sol.",
    uvVeryHigh:
      "Prioriza la sombra, usa gorra, gafas y protector solar SPF 50+.",
    uvExtreme:
      "Evita la exposición directa y prioriza sombra, ropa protectora y protección ocular.",
    uvLateDay:
      "La radiación UV todavía es elevada. Refuerza la protección solar y limita las exposiciones prolongadas.",
    uvEvening:
      "Todavía hay radiación UV significativa. Si continúas al aire libre, utiliza protección solar.",
    nightCool:
      "Ambiente nocturno fresco. Se recomienda ropa cómoda y una capa ligera si pasas tiempo al aire libre.",
    nightSafe:
      "Condiciones nocturnas agradables y estables. No se requieren medidas especiales.",
    nightHeat:
      "Temperatura nocturna elevada. Favorece la ventilación cruzada, hidrátate y utiliza ropa ligera y transpirable.",
    cold_low:
      "Viste por capas ligeras, sobre todo si permaneces quieto o hace viento.",
    cold_mod:
      "Limita la exposición al exterior y protege manos, pies y vías respiratorias.",
    cold_high:
      "Evita exposiciones prolongadas al aire libre y refuerza la protección térmica.",
    cold_ext:
      "Permanece en interiores, protege las extremidades y conserva el calor corporal.",
    rain:
      "Aumenta la precaución ante posibles resbalones, pérdida de adherencia y menor confort.",
    storm:
      "Situación potencialmente adversa por precipitación o tormenta. Limita la actividad exterior si no es imprescindible.",
    humid:
      "Puede aumentar la sensación de bochorno y empeorar el confort térmico. Adapta el ritmo de la actividad.",
    windModerate:
      "Vigila herramientas, materiales ligeros y maniobras en zonas expuestas.",
    windStrong:
      "Reevalúa tareas expuestas y asegura herramientas o materiales ligeros.",
    safeUvCloudy:
      "Puede existir radiación UV significativa aunque haya nubes o lluvia. Si pasas tiempo al aire libre, utiliza protección solar básica y adapta la actividad según la evolución del tiempo.",
    tropicalNight:
      "Ventila los espacios antes de dormir, hidrátate con regularidad y evita esfuerzos físicos innecesarios durante la noche.",
    torridNight:
      "Refresca y ventila los espacios, hidrátate con frecuencia y procura dormir en el entorno más fresco posible.",
    snow: "La nieve puede reducir la visibilidad y hacer que las superficies sean resbaladizas.",
    fog: "La niebla reduce la visibilidad. Aumenta la precaución durante los desplazamientos.",
    hail: "Puede producirse granizo de forma puntual. Evita las zonas expuestas mientras dure el fenómeno.",
    dust: "El polvo en suspensión puede reducir la visibilidad e irritar las vías respiratorias. Limita la exposición si notas molestias.",
    smoke: "La presencia de humo puede afectar a la visibilidad y la calidad del aire. Reduce la exposición al aire libre.",
    ice: "Puede haber superficies heladas. Aumenta la precaución para evitar resbalones.",
    loading: "Cargando recomendaciones…",
  },

  eu: {
    title: "Prebentzio-gomendioak",
    safe:
      "Erosotasun termikoa egokia da. Mantendu hidratazio egokia eta egokitu jarduera zure erritmora.",
    safeUvModerate:
      "UV erradiazio moderatua. Eguzki-babesa gomendatzen da esposizio luzea bada.",
    safeWind:
      "Haize moderatua. Lotu objektuak, saihestu agerian dauden material arinak manipulatzea eta handitu arreta tresnekin edo kanpoko lanetan.",
    safeCloudy:
      "Baldintzak egokiak dira ohiko jarduerarako. Hodeiak egon arren, eutsi oinarrizko arretari kanpoan denbora asko ematen baduzu.",
    factorHeat: "Beroa",
    factorCold: "Hotza",
    factorUv: "UV erradiazioa",
    factorWind: "Haizea",
    factorHumidity: "Hezetasuna",
    factorRain: "Euria",
    factorStorm: "Ekaitzak",
    factorNight: "Gaua",
    factorTropicalNight: "Gau tropikala",
    factorTorridNight: "Gau sargoria",
    factorSnow: "Elurra",
    factorFog: "Lainoa",
    factorHail: "Txingorra",
    factorDust: "Hautsa",
    factorSmoke: "Kea",
    factorIce: "Izotza",
    mild:
      "Mantendu hidratazio egokia eta saihestu ahalegin luzeak. Egin atsedenaldiak nekea sumatzen baduzu.",
    mildMorning:
      "Planifikatu jarduera zorrotzenak eguerdia baino lehen, edan ura maiz eta egin atsedenaldiak leku freskoetan.",
    moderate:
      "Egin atsedenaldi maizak, murriztu lan-karga fisikoa eta saiatu hidratazio erregularra mantentzen.",
    moderateMorning:
      "Lehenetsi jarduera zorrotzenak eguerdia baino lehen, eta aurreikusi atsedenaldiak eta hidratazio erregularra.",
    moderateLateDay:
      "Murriztu ahalegin jarraituak eta mantendu atsedenaldi erregularrak bero-estresak iraun bitartean.",
    high:
      "Mugatu esposizio luzea, murriztu lan-karga fisikoa eta egin atsedenaldi maizak leku freskoetan.",
    highLateDay:
      "Lehenetsi hidratazio egokia eta saihestu ahalegin fisiko handiak baldintzak hobetu arte.",
    highEvening:
      "Jarraitu ondo hidratatzen eta mugatu ahalegin fisikoak beroak irauten duen bitartean.",
    ext:
      "Eten jarduera zorrotza eta lehenetsi espazio freskoak edo itzalpekoak. Aplikatu gorputza hozteko neurri aktiboak.",
    uvModerate:
      "Erabili eguzki-babesa esposizioa luzea bada eta ez fidatu eguerdiko orduetan.",
    uvHigh:
      "Erabili eguzki-babesa, txapela eta betaurrekoak, eta murriztu eguzki zuzeneko esposizioa.",
    uvVeryHigh:
      "Lehenetsi itzala, erabili txapela, betaurrekoak eta SPF 50+ eguzki-babesa.",
    uvExtreme:
      "Saihestu eguzki zuzeneko esposizioa eta lehenetsi itzala, arropa babeslea eta begi-babesa.",
    uvLateDay:
      "UV erradiazioa handia da oraindik. Indartu eguzki-babesa eta mugatu esposizio luzeak.",
    uvEvening:
      "UV erradiazio esanguratsua dago oraindik. Kanpoan jarraitzen baduzu, erabili eguzki-babesa.",
    nightCool:
      "Gaueko giro freskoa. Erabili arropa erosoa eta geruza arin bat kanpoan denbora pasatuko baduzu.",
    nightSafe:
      "Gaueko baldintzak atseginak eta egonkorrak dira. Ez da neurri berezirik behar.",
    nightHeat:
      "Gaueko tenperatura altua. Bultzatu aireztapen gurutzatua, hidratatu eta erabili arropa arina eta transpiragarria.",
    cold_low:
      "Jantzi geruza arinak, batez ere geldirik bazaude edo haizea badabil.",
    cold_mod:
      "Mugatu kanpoko esposizioa eta babestu eskuak, oinak eta arnasbideak.",
    cold_high:
      "Saihestu kanpoan denbora luzez egotea eta indartu babes termikoa.",
    cold_ext:
      "Egon barruan, babestu gorputz-adarrak eta mantendu gorputz-berotasuna.",
    rain:
      "Handitu arreta balizko labainketen, atxikidura-galeraren eta erosotasun txikiagoaren aurrean.",
    storm:
      "Prezipitazio edo ekaitz egoera kaltegarria izan daiteke. Mugatu kanpoko jarduera beharrezkoa ez bada.",
    humid:
      "Sargoria handitu eta erosotasun termikoa okertu dezake. Egokitu jardueraren erritmoa.",
    windModerate:
      "Zaindu tresnak, material arinak eta eremu irekietan egindako maniobrak.",
    windStrong:
      "Berrikusi kanpoan egiteko lanak eta ziurtatu tresna edo material arinak.",
    safeUvCloudy:
      "Hodeiak edo euria egon arren, UV erradiazio esanguratsua egon daiteke. Kanpoan denbora ematen baduzu, erabili oinarrizko eguzki-babesa eta egokitu jarduera eguraldiaren bilakaeraren arabera.",
    tropicalNight:
      "Aireztatu espazioak lo egin aurretik, hidratatu erregularki eta saihestu gauean beharrezkoak ez diren ahalegin fisikoak.",
    torridNight:
      "Freskatu eta aireztatu espazioak, hidratatu maiz eta saiatu ahalik eta ingurunerik freskoenean lo egiten.",
    snow: "Elurrak ikuspena murriztu eta gainazalak irristakor bihur ditzake.",
    fog: "Lainoak ikuspena murrizten du. Handitu arreta joan-etorrietan.",
    hail: "Txingorra egin dezake tarteka. Saihestu ageriko eremuak fenomenoak irauten duen bitartean.",
    dust: "Aireko hautsak ikuspena murriztu eta arnasbideak narrita ditzake. Mugatu esposizioa ondoeza sumatzen baduzu.",
    smoke: "Keak ikuspenari eta airearen kalitateari eragin diezaieke. Murriztu kanpoko esposizioa.",
    ice: "Gainazal izoztuak egon daitezke. Handitu arreta irristaketak saihesteko.",
    loading: "Gomendioak kargatzen…",
  },

  gl: {
    title: "Recomendacións preventivas",
    safe:
      "O confort térmico é favorable. Mantén unha hidratación adecuada e adapta a actividade ao teu ritmo.",
    safeUvModerate:
      "Radiación UV moderada. Recoméndase protección solar se a exposición é prolongada.",
    safeWind:
      "Vento moderado. Asegura obxectos, evita manipular materiais lixeiros expostos e aumenta a precaución con ferramentas ou traballos ao aire libre.",
    safeCloudy:
      "As condicións son adecuadas para a actividade habitual. Aínda con nubes, conserva unha precaución básica se pasas moito tempo ao aire libre.",
    factorHeat: "Calor",
    factorCold: "Frío",
    factorUv: "Radiación UV",
    factorWind: "Vento",
    factorHumidity: "Humidade",
    factorRain: "Chuvia",
    factorStorm: "Treboadas",
    factorNight: "Noite",
    factorTropicalNight: "Noite tropical",
    factorTorridNight: "Noite tórrida",
    factorSnow: "Neve",
    factorFog: "Néboa",
    factorHail: "Sarabia",
    factorDust: "Po",
    factorSmoke: "Fume",
    factorIce: "Xeo",
    mild:
      "Mantén unha hidratación adecuada e evita esforzos prolongados. Fai pausas se notas fatiga.",
    mildMorning:
      "Planifica as actividades máis esixentes antes do mediodía, bebe auga con frecuencia e fai pausas en lugares frescos.",
    moderate:
      "Programa pausas frecuentes, reduce a carga física e procura hidratarte de forma regular.",
    moderateMorning:
      "Prioriza as actividades máis esixentes antes do mediodía e prevé pausas e hidratación regulares.",
    moderateLateDay:
      "Reduce os esforzos sostidos e mantén pausas regulares mentres persista o estrés térmico.",
    high:
      "Limita a exposición prolongada, reduce a carga física e fai pausas frecuentes en lugares frescos.",
    highLateDay:
      "Prioriza unha boa hidratación e evita esforzos físicos intensos ata que as condicións melloren.",
    highEvening:
      "Continúa hidratándote ben e limita os esforzos físicos mentres persista a calor.",
    ext:
      "Interrompe a actividade esixente e prioriza espazos frescos ou con sombra. Aplica medidas activas de arrefriamento corporal.",
    uvModerate:
      "Emprega protección solar se a exposición é prolongada e evita confiarte nas horas centrais.",
    uvHigh:
      "Emprega protección solar, gorra e lentes, e reduce a exposición directa ao sol.",
    uvVeryHigh:
      "Prioriza a sombra, usa gorra, lentes e protector solar SPF 50+.",
    uvExtreme:
      "Evita a exposición directa e prioriza sombra, roupa protectora e protección ocular.",
    uvLateDay:
      "A radiación UV aínda é elevada. Reforza a protección solar e limita as exposicións prolongadas.",
    uvEvening:
      "Aínda hai radiación UV significativa. Se continúas no exterior, usa protección solar.",
    nightCool:
      "Ambiente nocturno fresco. Recoméndase roupa cómoda e unha capa lixeira se pasas tempo ao aire libre.",
    nightSafe:
      "Condicións nocturnas agradables e estables. Non se requiren medidas especiais.",
    nightHeat:
      "Temperatura nocturna elevada. Favorece a ventilación cruzada, hidrátate e emprega roupa lixeira e transpirable.",
    cold_low:
      "Viste por capas lixeiras, sobre todo se permaneces quieto ou hai vento.",
    cold_mod:
      "Limita a exposición ao exterior e protexe mans, pés e vías respiratorias.",
    cold_high:
      "Evita exposicións prolongadas ao aire libre e reforza a protección térmica.",
    cold_ext:
      "Permanece en interiores, protexe as extremidades e conserva a calor corporal.",
    rain:
      "Aumenta a precaución ante posibles esvaróns, perda de adherencia e menor confort.",
    storm:
      "Situación potencialmente adversa por precipitación ou treboada. Limita a actividade exterior se non é imprescindible.",
    humid:
      "Pode aumentar a sensación de abafamento e empeorar o confort térmico. Adapta o ritmo da actividade.",
    windModerate:
      "Vixía ferramentas, materiais lixeiros e manobras en zonas expostas.",
    windStrong:
      "Reavalia tarefas expostas e asegura ferramentas ou materiais lixeiros.",
    safeUvCloudy:
      "Pode existir radiación UV significativa aínda que haxa nubes ou choiva. Se permaneces ao aire libre, usa protección solar básica e adapta a actividade segundo a evolución do tempo.",
    tropicalNight:
      "Ventila os espazos antes de durmir, hidrátate con regularidade e evita esforzos físicos innecesarios durante a noite.",
    torridNight:
      "Refresca e ventila os espazos, hidrátate con frecuencia e procura durmir no ambiente máis fresco posible.",
    snow: "A neve pode reducir a visibilidade e facer esvaradías as superficies.",
    fog: "A néboa reduce a visibilidade. Aumenta a precaución durante os desprazamentos.",
    hail: "Pode producirse sarabia de forma puntual. Evita as zonas expostas mentres dure o fenómeno.",
    dust: "O po en suspensión pode reducir a visibilidade e irritar as vías respiratorias. Limita a exposición se notas molestias.",
    smoke: "A presenza de fume pode afectar a visibilidade e a calidade do aire. Reduce a exposición no exterior.",
    ice: "Pode haber superficies xeadas. Aumenta a precaución para evitar esvaróns.",
    loading: "Cargando recomendacións…",
  },

  en: {
    title: "Preventive recommendations",
    safe:
      "Thermal comfort is favourable. Keep adequate hydration and adapt activity to your pace.",
    safeUvModerate:
      "Moderate UV radiation. Sun protection is recommended if exposure is prolonged.",
    safeWind:
      "Moderate wind. Secure objects, avoid handling exposed light materials and increase caution with tools or outdoor work.",
    safeCloudy:
      "Conditions are suitable for usual activity. Even with clouds, keep basic awareness if you remain outdoors for long periods.",
    factorHeat: "Heat",
    factorCold: "Cold",
    factorUv: "UV radiation",
    factorWind: "Wind",
    factorHumidity: "Humidity",
    factorRain: "Rain",
    factorStorm: "Storms",
    factorNight: "Night",
    factorTropicalNight: "Tropical night",
    factorTorridNight: "Torrid night",
    factorSnow: "Snow",
    factorFog: "Fog",
    factorHail: "Hail",
    factorDust: "Dust",
    factorSmoke: "Smoke",
    factorIce: "Ice",
    mild:
      "Keep hydrated and avoid prolonged effort. Take breaks if fatigue appears.",
    mildMorning:
      "Plan the most demanding activities before midday, drink water regularly and take breaks in cool places.",
    moderate:
      "Schedule frequent breaks, reduce physical strain and keep hydration regular.",
    moderateMorning:
      "Prioritise the most demanding activities before midday and plan regular breaks and hydration.",
    moderateLateDay:
      "Reduce sustained effort and keep regular breaks while heat stress persists.",
    high:
      "Limit prolonged exposure, reduce physical strain and take frequent breaks in cool places.",
    highLateDay:
      "Stay well hydrated and avoid intense physical effort until conditions improve.",
    highEvening:
      "Stay well hydrated and continue limiting physical effort while the heat persists.",
    ext:
      "Stop demanding activity and prioritise cool or shaded places. Apply active body-cooling measures.",
    uvModerate:
      "Use sun protection if exposure is prolonged and avoid underestimating midday sun.",
    uvHigh:
      "Use sunscreen, hat and eyewear, and reduce direct sun exposure.",
    uvVeryHigh:
      "Prioritise shade, wear a hat and eyewear, and use SPF 50+ sunscreen.",
    uvExtreme:
      "Avoid direct exposure and prioritise shade, protective clothing and eye protection.",
    uvLateDay:
      "UV radiation remains elevated. Reinforce sun protection and limit prolonged exposure.",
    uvEvening:
      "Significant UV radiation is still present. Continue using sun protection if you remain outdoors.",
    nightCool:
      "Cool nighttime conditions. Comfortable clothing and a light extra layer are recommended if you stay outdoors for a while.",
    nightSafe:
      "Night conditions are pleasant and stable. No special measures are needed.",
    nightHeat:
      "Elevated nighttime temperatures. Ensure cross-ventilation, stay hydrated and wear light, breathable clothing.",
    cold_low:
      "Wear light layers, especially if you remain still or it is windy.",
    cold_mod:
      "Limit outdoor exposure and protect hands, feet and airways.",
    cold_high:
      "Avoid prolonged time outdoors and reinforce thermal protection.",
    cold_ext:
      "Stay indoors, protect extremities and preserve body heat.",
    rain:
      "Increase caution due to possible slips, loss of traction and lower comfort.",
    storm:
      "Potentially adverse weather due to precipitation or storm activity. Limit outdoor activity if not essential.",
    humid:
      "It may increase mugginess and worsen thermal comfort. Adapt the pace of activity.",
    windModerate:
      "Watch tools, light materials and manoeuvres in exposed areas.",
    windStrong:
      "Reassess exposed tasks and secure light tools or materials.",
    safeUvCloudy:
      "Significant UV radiation may still be present even with clouds or rain. If you stay outdoors, use basic sun protection and adapt activity as the weather evolves.",
    tropicalNight:
      "Ventilate indoor spaces before going to sleep, hydrate regularly and avoid unnecessary physical effort overnight.",
    torridNight:
      "Cool and ventilate indoor spaces, hydrate often and try to sleep in the coolest environment available.",
    snow: "Snow may reduce visibility and make surfaces slippery.",
    fog: "Fog reduces visibility. Take extra care when travelling.",
    hail: "Localised hail is possible. Avoid exposed areas while it persists.",
    dust: "Airborne dust may reduce visibility and irritate the airways. Limit exposure if discomfort occurs.",
    smoke: "Smoke may affect visibility and air quality. Reduce outdoor exposure.",
    ice: "Icy surfaces may be present. Take extra care to avoid slips.",
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
type HeatRecommendationKey =
  | HeatKey
  | "mildMorning"
  | "moderateMorning"
  | "moderateLateDay"
  | "highLateDay"
  | "highEvening";
type ColdKey = "cold_low" | "cold_mod" | "cold_high" | "cold_ext";
type UvKey = "uvModerate" | "uvHigh" | "uvVeryHigh" | "uvExtreme";
type NightKey = "nightCool" | "nightSafe" | "nightHeat" | "tropicalNight" | "torridNight";

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
  return mapColdRiskToRecommendationKey(coldRisk);
};

export const mapColdRiskToRecommendationKey = (
  coldRisk: ColdRisk | null | undefined
): ColdKey | null => {
  if (coldRisk === "extrem") return "cold_ext";
  if (coldRisk === "alt" || coldRisk === "molt alt") return "cold_high";
  if (coldRisk === "moderat") return "cold_mod";
  if (coldRisk === "lleu") return "cold_low";
  return null;
};

export const getRecommendationColdKey = (
  coldRisk: ColdRisk | null | undefined,
  effectiveTemp: number
): ColdKey | null =>
  coldRisk ? mapColdRiskToRecommendationKey(coldRisk) : getColdKey(effectiveTemp);

const getUvKey = (uvi: number | null | undefined): UvKey | null => {
  if (typeof uvi !== "number" || !Number.isFinite(uvi)) return null;
  const level = getUvLevelIndex(uvi);
  if (level === 4) return "uvExtreme";
  if (level === 3) return "uvVeryHigh";
  if (level === 2) return "uvHigh";
  if (level === 1) return "uvModerate";
  return null;
};

const getNightKey = (nightHeatLevel: NightHeatLevel): NightKey | "torridNight" => {
  if (nightHeatLevel === "torrid") return "torridNight";
  if (nightHeatLevel === "tropical") return "tropicalNight";
  return "nightSafe";
};

const isCentralHeatHour = (hour?: number): boolean =>
  typeof hour === "number" && Number.isFinite(hour) && hour >= 11 && hour < 17;

const getHeatRecommendationKey = (
  heatKey: HeatKey,
  heatDayPhase?: HeatDayPhase,
  currentHour?: number
): HeatRecommendationKey => {
  if (heatDayPhase === "day" && typeof currentHour === "number" && currentHour < 12) {
    if (heatKey === "mild") return "mildMorning";
    if (heatKey === "moderate") return "moderateMorning";
  }

  if (
    heatKey === "moderate" &&
    (heatDayPhase === "late_day" || heatDayPhase === "evening")
  ) {
    return "moderateLateDay";
  }

  if (heatKey !== "high") return heatKey;

  if (heatDayPhase === "evening" || heatDayPhase === "night") {
    return "highEvening";
  }

  if (heatDayPhase === "late_day" || !isCentralHeatHour(currentHour)) {
    return "highLateDay";
  }

  return "high";
};

const getUvRecommendationKey = (
  uvKey: UvKey,
  heatDayPhase?: HeatDayPhase
): UvKey | "uvLateDay" | "uvEvening" => {
  if (heatDayPhase === "evening") return "uvEvening";
  if (heatDayPhase === "late_day") return "uvLateDay";
  return uvKey;
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

export const factorItems = (
  riskFactors: FactorRisk[] | undefined,
  ...items: Array<RecommendationItem | undefined | null | false>
): RecommendationItem[] => {
  const clean = items
    .filter(Boolean)
    .map((item) => item as RecommendationItem)
    .filter((item) => item.text.trim().length > 0);

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
  coldRisk,
  coldEffectiveTemp,
  riskFactors,
  nightHeatLevel = "none",
  weatherContext,
}: Props) {
  const lng = normalizeLang(lang);

  const t = (TXT as Record<string, (typeof TXT)["ca"]>)[lng] ?? TXT.ca;

  const effectiveTemp = Number(temp);
  const uvKey = getUvKey(uvi);
  const uvRecommendationKey = uvKey
    ? getUvRecommendationKey(uvKey, heatDayPhase)
    : null;
  const uvRecommendationText = uvRecommendationKey
    ? t[uvRecommendationKey]
    : null;
  const recommendationsColdRisk = getColdRisk(effectiveTemp, null);
  const coldKey = getRecommendationColdKey(coldRisk, effectiveTemp);
  const legacyRainy = isRainyWeather(weatherMain);
  const rainy = getRecommendationRainy(legacyRainy, weatherContext);
  const legacyStormy = isStormWeather(weatherMain);
  const stormy = getRecommendationStormy(legacyStormy, weatherContext);
  const legacyHumid =
    typeof humidity === "number" &&
    humidity >= 70 &&
    effectiveTemp >= 24;
  const humid = getRecommendationHumid(legacyHumid, weatherContext);
  const windyModerate = typeof windKmh === "number" && windKmh >= 25 && windKmh < 45;
  const windyStrong = typeof windKmh === "number" && windKmh >= 45;
  const factorState = getRecommendationFactorState(riskFactors);
  const heatActive = factorState.heat ?? true;
  const uvActive = factorState.uv ?? true;
  const windActive = factorState.wind ?? true;
  const showWindModerate = windActive && windyModerate;
  const showWindStrong = windActive && windyStrong;
  const legacyVeryCloudy = typeof cloudiness === "number" && cloudiness >= 75;
  const veryCloudy = getRecommendationVeryCloudy(
    legacyVeryCloudy,
    weatherContext
  );
  const legacySuppressUv = veryCloudy || rainy || stormy;
  const suppressUv = getRecommendationSuppressUv(
    legacySuppressUv,
    weatherContext
  );
  const legacySlipperySurface = rainy || stormy;
  const slipperySurface = getRecommendationSlipperySurface(
    legacySlipperySurface,
    weatherContext
  );
  const contextualItems: RecommendationItem[] = [
    weatherContext?.snowy && {
      factor: "snow" as const,
      icon: "❄️",
      label: t.factorSnow,
      text: t.snow,
    },
    weatherContext?.foggy && {
      factor: "fog" as const,
      icon: "🌫️",
      label: t.factorFog,
      text: t.fog,
    },
    weatherContext?.hail && {
      factor: "hail" as const,
      icon: "🧊",
      label: t.factorHail,
      text: t.hail,
    },
    weatherContext?.dusty && {
      factor: "dust" as const,
      icon: "🌪️",
      label: t.factorDust,
      text: t.dust,
    },
    weatherContext?.smoky && {
      factor: "smoke" as const,
      icon: "💨",
      label: t.factorSmoke,
      text: t.smoke,
    },
    weatherContext?.icySurface &&
      !weatherContext.snowy && {
        factor: "ice" as const,
        icon: "🧊",
        label: t.factorIce,
        text: t.ice,
      },
  ].filter(Boolean) as RecommendationItem[];
  const contextualText = contextualItems.map((item) => item.text).join("\n\n");
  const uvSuppressedByWeather =
  isDay &&
  uvActive &&
  !!uvKey &&
  suppressUv;

  if (
    import.meta.env.DEV &&
    coldRisk &&
    coldRisk !== recommendationsColdRisk
  ) {
    console.warn("[Recommendations][DEV] Divergència fred props vs intern", {
      propsColdRisk: coldRisk,
      recommendationsColdRisk,
      propsColdEffectiveTemp: coldEffectiveTemp,
      recommendationsEffectiveTemp: effectiveTemp,
      windKmh,
    });
  }

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
          rainy && !stormy && { factor: "rain", icon: "🌧️", label: t.factorRain, text: t.rain },
          ...contextualItems
        )}
        extra={joinExtras(
          showWindModerate && t.windModerate,
          showWindStrong && t.windStrong,
          stormy && t.storm,
          rainy && !stormy && t.rain,
          contextualText
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
          uvActive && uvKey === "uvHigh" && uvRecommendationText && { factor: "uv", icon: "☀️", label: t.factorUv, text: uvRecommendationText },
          uvActive && uvKey === "uvVeryHigh" && uvRecommendationText && { factor: "uv", icon: "☀️", label: t.factorUv, text: uvRecommendationText },
          uvActive && uvKey === "uvExtreme" && uvRecommendationText && { factor: "uv", icon: "☀️", label: t.factorUv, text: uvRecommendationText },
          showWindModerate && { factor: "wind", icon: "🌬️", label: t.factorWind, text: t.windModerate },
          showWindStrong && { factor: "wind", icon: "🌬️", label: t.factorWind, text: t.windStrong },
          ...contextualItems
        )}
        extra={joinExtras(
          humid && t.humid,
          uvActive && uvKey === "uvHigh" && uvRecommendationText,
          uvActive && uvKey === "uvVeryHigh" && uvRecommendationText,
          uvActive && uvKey === "uvExtreme" && uvRecommendationText,
          showWindModerate && t.windModerate,
          showWindStrong && t.windStrong,
          contextualText
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
          uvActive && uvKey === "uvHigh" && uvRecommendationText && { factor: "uv", icon: "☀️", label: t.factorUv, text: uvRecommendationText },
          uvActive && uvKey === "uvVeryHigh" && uvRecommendationText && { factor: "uv", icon: "☀️", label: t.factorUv, text: uvRecommendationText },
          uvActive && uvKey === "uvExtreme" && uvRecommendationText && { factor: "uv", icon: "☀️", label: t.factorUv, text: uvRecommendationText },
          rainy && !stormy && { factor: "rain", icon: "🌧️", label: t.factorRain, text: t.rain },
          stormy && { factor: "storm", icon: "⛈️", label: t.factorStorm, text: t.storm },
          ...contextualItems
        )}
        extra={joinExtras(
          humid && t.humid,
          uvActive && uvKey === "uvHigh" && uvRecommendationText,
          uvActive && uvKey === "uvVeryHigh" && uvRecommendationText,
          uvActive && uvKey === "uvExtreme" && uvRecommendationText,
          rainy && !stormy && t.rain,
          stormy && t.storm,
          contextualText
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
	      showWindModerate && t.windModerate,
        contextualText
    )}
    />
  );
} 

if (isDay && uvActive && uvKey) {
    return (
      <RecommendationBox
        className={`recommendation-box ${uvKey}`}
        title={`${getIcon(uvKey)} ${t.title}`}
        body={uvRecommendationText ?? t[uvKey]}
        items={factorItems(
          riskFactors,
	          { factor: "uv", icon: "☀️", label: t.factorUv, text: uvRecommendationText ?? t[uvKey] },
          humid && { factor: "humidity", icon: "💧", label: t.factorHumidity, text: t.humid },
          showWindModerate && { factor: "wind", icon: "🌬️", label: t.factorWind, text: t.windModerate },
          showWindStrong && { factor: "wind", icon: "🌬️", label: t.factorWind, text: t.windStrong },
          rainy && !stormy && { factor: "rain", icon: "🌧️", label: t.factorRain, text: t.rain },
          stormy && { factor: "storm", icon: "⛈️", label: t.factorStorm, text: t.storm },
          ...contextualItems
        )}
        extra={joinExtras(
          humid && t.humid,
          showWindModerate && t.windModerate,
          showWindStrong && t.windStrong,
          rainy && !stormy && t.rain,
          stormy && t.storm,
          contextualText
        )}
      />
    );
  }

  /* =========================================================
     4️⃣ RECOMANACIONS NOCTURNES
  ========================================================== */
  if (!isDay) {
    const nightKey = getNightKey(nightHeatLevel);
    const nightClassKey = nightKey === "torridNight" ? "tropicalNight" : nightKey;
    const nightLabel =
      nightHeatLevel === "torrid"
        ? t.factorTorridNight
        : nightHeatLevel === "tropical"
          ? t.factorTropicalNight
          : t.factorNight;

    return (
      <RecommendationBox
        className={`recommendation-box ${nightClassKey}`}
        title={`${getIcon(nightKey)} ${t.title}`}
        body={t[nightKey]}
        items={factorItems(
          riskFactors,
          { factor: "night", icon: "🌙", label: nightLabel, text: t[nightKey] },
          humid && { factor: "humidity", icon: "💧", label: t.factorHumidity, text: t.humid },
          showWindModerate && { factor: "wind", icon: "🌬️", label: t.factorWind, text: t.windModerate },
          showWindStrong && { factor: "wind", icon: "🌬️", label: t.factorWind, text: t.windStrong },
          rainy && !stormy && { factor: "rain", icon: "🌧️", label: t.factorRain, text: t.rain },
          stormy && { factor: "storm", icon: "⛈️", label: t.factorStorm, text: t.storm },
          ...contextualItems
        )}
        extra={joinExtras(
          humid && t.humid,
          showWindModerate && t.windModerate,
          showWindStrong && t.windStrong,
          rainy && !stormy && t.rain,
          stormy && t.storm,
          contextualText
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
          showWindStrong && { factor: "wind", icon: "🌬️", label: t.factorWind, text: t.windStrong },
          ...contextualItems
        )}
        extra={joinExtras(
          humid && t.humid,
          showWindModerate && t.windModerate,
          showWindStrong && t.windStrong,
          contextualText
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
          showWindModerate && t.windModerate,
          contextualText
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
          humid && t.humid,
          contextualText
        )}
      />
    );
  }

  if (slipperySurface) {
    return (
      <RecommendationBox
        className="recommendation-box safe"
        title={`${getIcon("safe")} ${t.title}`}
        body={joinLines(
          t.safe,
          stormy ? t.storm : t.rain,
          contextualText
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
          humid && t.humid,
          contextualText
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
        humid && t.humid,
        contextualText
      )}
    />
  );
}
