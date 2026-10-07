import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { getTimeAwareUvAdvice, usesContextualUvAdvice, type UvAdviceWeather } from "../../src/utils/uvAdviceMessage";
import { getUvLevelIndex } from "../../src/utils/uv";
import UVAdvice from "../../src/components/UVAdvice";

const contexts: UvAdviceWeather[] = [
  ...["Rain","Drizzle","Thunderstorm","Fog","Snow"].map(weatherMain=>({weatherMain})),
  {rainMmH:1.8}, {weatherMain:"Clouds",weatherCode:804},
];
const textOf=(node:any):string => node == null || typeof node === "boolean" ? "" :
  Array.isArray(node) ? node.map(textOf).join(" ") : typeof node === "object" ? textOf(node.props.children) : String(node);

test("UV advice contextualizes only explicit weather states or valid positive current rain",()=>{
  const normal=getTimeAwareUvAdvice(3.8,"ca",12);
  assert.match(normal,/cerca ombra/);
  for(const weather of contexts){
    assert.equal(usesContextualUvAdvice(weather),true);
    assert.doesNotMatch(getTimeAwareUvAdvice(3.8,"ca",12,weather),/cerca ombra/);
  }
  const usual:UvAdviceWeather[]=[{},
    ...["Clear","Mist","Haze","Dust","Smoke","Clouds"].map(weatherMain=>({weatherMain})),
    ...[801,802,803].map(weatherCode=>({weatherMain:"Clouds",weatherCode})),
    ...[0,null,undefined,NaN,Infinity,-Infinity,-1,"1.8"].map(rainMmH=>({rainMmH})),
    {aemetActive:true,cloudiness:99,description:"heavy rain"} as UvAdviceWeather,
  ];
  for(const weather of usual){
    assert.equal(usesContextualUvAdvice(weather),false);
    assert.equal(getTimeAwareUvAdvice(3.8,"ca",12,weather),normal);
  }
  assert.equal(usesContextualUvAdvice({weatherMain:"Rain",rainMmH:0}),true);
});

test("contextual UV advice preserves distinct levels and summary/detail consistency in five languages",()=>{
  const markers={ca:["índex UV","UV és alta","UV és molt alta","UV és extrema"],
    es:["índice UV","UV es alta","UV es muy alta","UV es extrema"],
    eu:["UV indizea","UV erradiazioa handia","UV erradiazioa oso handia","UV erradiazioa muturrekoa"],
    gl:["índice UV","UV é alta","UV é moi alta","UV é extrema"],
    en:["UV index","UV radiation is high","UV radiation is very high","UV radiation is extreme"]};
  for(const [lang,expected] of Object.entries(markers))for(const weather of contexts){
    for(const [i,uvi] of [3.8,6,8,11].entries())for(const hour of [12,17,19]){
      const advice=getTimeAwareUvAdvice(uvi,lang,hour,weather);
      assert.ok(advice.includes(expected[i]));
      assert.equal(getUvLevelIndex(uvi),i+1);
      assert.doesNotMatch(advice,/ombra|sombra|shade|itzala/);
      const detail=UVAdvice({uvi,lang,currentHour:hour,...weather});
      assert.ok(textOf(detail).includes(advice));
      // Identical advice is already in the summary: no duplicate card or rainy note.
      assert.equal(UVAdvice({uvi,lang,currentHour:hour,...weather,summaryAdvice:advice}),null);
    }
  }
});

test("UV usual mode and low/no-data behavior survive context disappearance",()=>{
  for(const uvi of [2,3.8,6,8,11])for(const hour of [12,17,19]){
    const normal=getTimeAwareUvAdvice(uvi,"ca",hour);
    assert.equal(getTimeAwareUvAdvice(uvi,"ca",hour,{weatherMain:"Clear"}),normal);
    getTimeAwareUvAdvice(uvi,"ca",hour,{weatherMain:"Rain"});
    assert.equal(getTimeAwareUvAdvice(uvi,"ca",hour,{}),normal);
  }
  assert.equal(getTimeAwareUvAdvice(2,"ca",12,{weatherMain:"Snow"}),getTimeAwareUvAdvice(2,"ca",12));
  assert.equal(getTimeAwareUvAdvice(null,"ca",12,{weatherMain:"Rain"}),"");
  const usual=getTimeAwareUvAdvice(3.8,"ca",12);
  const detail=UVAdvice({uvi:3.8,lang:"ca",cloudiness:89,weatherMain:"Clouds",weatherCode:803,summaryAdvice:usual});
  assert.ok(textOf(detail).includes(usual));
  assert.ok(textOf(detail).includes("La nuvolositat pot reduir parcialment"));
});

test("App forwards current weather inputs to both summary and detail with reactive dependencies",()=>{
  const app=readFileSync("src/App.tsx","utf8");
  const start=app.indexOf("const uvSummaryAdvice");
  const summary=app.slice(start,app.indexOf("const compactUvAdvice",start));
  assert.match(summary,/rainMmH: data\?\.rain\?\.\["1h"\]/);
  assert.match(summary,/\[uvSummaryValue[^]*data\?\.rain\?\.\["1h"\]/);
  assert.match(summary,/weatherCode: data\?\.weather\?\.\[0\]\?\.id/);
  assert.match(app,/<UVAdvice[^]*?weatherCode=\{data\?\.weather\?\.\[0\]\?\.id\}[^]*?rainMmH=\{data\?\.rain\?\.\["1h"\]\}/);
});

const exposureCopies = {
  ca: ["Estimació orientativa basada en índex UV actual. Redueix exposició, reforça protecció i prioritza ombra.", "Estimació orientativa basada en l’índex UV actual. Redueix l’exposició i reforça la protecció solar."],
  es: ["Estimación orientativa basada en el índice UV actual. Reduce la exposición, refuerza la protección y prioriza la sombra.", "Estimación orientativa basada en el índice UV actual. Reduce la exposición y refuerza la protección solar."],
  eu: ["UV indize aktualean oinarritutako gutxi gorabeherako estimazioa. Murriztu esposizioa, indartu babesa eta lehenetsi itzala.", "Uneko UV indizean oinarritutako gutxi gorabeherako estimazioa. Murriztu esposizioa eta indartu eguzki-babesa."],
  gl: ["Estimación orientativa baseada no índice UV actual. Reduce a exposición, reforza a protección e prioriza a sombra.", "Estimación orientativa baseada no índice UV actual. Reduce a exposición e reforza a protección solar."],
  en: ["Approximate estimate based on current UV index. Reduce exposure, reinforce protection and prioritise shade.", "Approximate estimate based on the current UV index. Reduce exposure and strengthen sun protection."],
} as const;

import UVSafeTime from "../../src/components/UVSafeTime";

test("UVSafeTime changes only high-UV copy in five languages, preserving exposure and default behavior", () => {
  for (const lang of Object.keys(exposureCopies) as (keyof typeof exposureCopies)[]) {
    for (const uvi of [8, 8.5, 11]) for (const skinType of [1, 2, 3, 4, 5, 6] as const) {
      const props = { lang, uvi, skinType, lat: null, lon: null, onSkinTypeChange: () => {} };
      const usual = UVSafeTime(props);
      const contextual = UVSafeTime({ ...props, contextualAdvice: true });
      assert.ok(textOf(usual).includes(exposureCopies[lang][0]));
      assert.ok(textOf(contextual).includes(exposureCopies[lang][1]));
      assert.doesNotMatch(textOf(contextual), /ombra|sombra|shade|itzala/);
      // Everything except the final note, including the rendered time and phototype, is identical.
      assert.equal(textOf(usual.props.children.slice(0, -1)), textOf(contextual.props.children.slice(0, -1)));
      assert.match(textOf(contextual.props.children.slice(0, -1)), /min/);
      assert.equal(textOf(UVSafeTime({ ...props, contextualAdvice: false })), textOf(usual));
      assert.ok(textOf(UVSafeTime({ ...props, contextualAdvice: true, showEstimateBadge: false })).includes(exposureCopies[lang][1]));
    }
  }
});

test("UVSafeTime preserves all lower-UV notes, including the 7.9 / 8 boundary", () => {
  for (const lang of Object.keys(exposureCopies) as (keyof typeof exposureCopies)[]) {
    const props = { lang, skinType: 3 as const, lat: null, lon: null, onSkinTypeChange: () => {} };
    for (const uvi of [null, 0, 2, 3.8, 6, 7.9]) {
      assert.equal(textOf(UVSafeTime({ ...props, uvi, contextualAdvice: true })), textOf(UVSafeTime({ ...props, uvi })));
    }
    assert.ok(!textOf(UVSafeTime({ ...props, uvi: 7.9, contextualAdvice: true })).includes(exposureCopies[lang][1]));
    assert.ok(textOf(UVSafeTime({ ...props, uvi: 8, contextualAdvice: true })).includes(exposureCopies[lang][1]));
  }
});

test("App derives UVSafeTime context from current weather each render and restores usual copy after refresh", () => {
  const app = readFileSync("src/App.tsx", "utf8");
  const expression = app.match(/const contextualUvAdvice = (usesContextualUvAdvice\(\{[^]*?\}\));/);
  assert.ok(expression, "Context must be derived from current data, not retained in state or a stale memo");
  assert.match(app, /<UVSafeTime[^]*?contextualAdvice=\{contextualUvAdvice\}/);
  const evaluate = new Function("data", "usesContextualUvAdvice", `return ${expression[1]};`);
  const snapshots = [
    { weather: [{ main: "Clear", id: 800 }], rain: { "1h": 0 } },
    { weather: [{ main: "Clear", id: 800 }], rain: { "1h": 0.2 } },
    { weather: [{ main: "Rain", id: 500 }] },
    { weather: [{ main: "Clouds", id: 804 }] },
    { weather: [{ main: "Clear", id: 800 }], rain: { "1h": 0 } },
    undefined,
  ];
  const flags = snapshots.map(data => evaluate(data, usesContextualUvAdvice));
  assert.deepEqual(flags, [false, true, true, true, false, false]);
  for (const lang of Object.keys(exposureCopies) as (keyof typeof exposureCopies)[]) {
    for (const contextualAdvice of flags) {
      const output = textOf(UVSafeTime({ lang, uvi: 8.5, skinType: 3, lat: null, lon: null, onSkinTypeChange: () => {}, contextualAdvice }));
      assert.ok(output.includes(exposureCopies[lang][contextualAdvice ? 1 : 0]));
    }
  }
});

import { getPrimaryStatusBlock } from "../../src/utils/getPrimaryStatusBlock";
import { getPrimaryAdviceText } from "../../src/utils/getPrimaryAdviceText";
import Recommendations from "../../src/components/Recommendations";

const originalRecommendationUv = {
  "ca": [
    "Utilitza protecció solar si l’exposició és prolongada i evita confiar-te durant les hores centrals.",
    "Utilitza protecció solar, gorra i ulleres, i redueix l’exposició directa al sol.",
    "Prioritza l’ombra, utilitza gorra, ulleres i protector solar SPF 50+.",
    "Evita l’exposició directa i prioritza ombra, roba protectora i protecció ocular."
  ],
  "es": [
    "Utiliza protección solar si la exposición es prolongada y evita confiarte en las horas centrales.",
    "Usa protección solar, gorra y gafas, y reduce la exposición directa al sol.",
    "Prioriza la sombra, usa gorra, gafas y protector solar SPF 50+.",
    "Evita la exposición directa y prioriza sombra, ropa protectora y protección ocular."
  ],
  "eu": [
    "Erabili eguzki-babesa esposizioa luzea bada eta ez fidatu eguerdiko orduetan.",
    "Erabili eguzki-babesa, txapela eta betaurrekoak, eta murriztu eguzki zuzeneko esposizioa.",
    "Lehenetsi itzala, erabili txapela, betaurrekoak eta SPF 50+ eguzki-babesa.",
    "Saihestu eguzki zuzeneko esposizioa eta lehenetsi itzala, arropa babeslea eta begi-babesa."
  ],
  "gl": [
    "Emprega protección solar se a exposición é prolongada e evita confiarte nas horas centrais.",
    "Emprega protección solar, gorra e lentes, e reduce a exposición directa ao sol.",
    "Prioriza a sombra, usa gorra, lentes e protector solar SPF 50+.",
    "Evita a exposición directa e prioriza sombra, roupa protectora e protección ocular."
  ],
  "en": [
    "Use sun protection if exposure is prolonged and avoid underestimating midday sun.",
    "Use sunscreen, hat and eyewear, and reduce direct sun exposure.",
    "Prioritise shade, wear a hat and eyewear, and use SPF 50+ sunscreen.",
    "Avoid direct exposure and prioritise shade, protective clothing and eye protection."
  ]
} as const;

const langs = ["ca", "es", "eu", "gl", "en"] as const;
const translateFor = (lang: string) => {
  const catalog = JSON.parse(readFileSync(`src/i18n/locales/${lang}.json`, "utf8"));
  return (key: string): string => key.split(".").reduce((v, part) => v?.[part], catalog) ?? key;
};
const primaryInput = (uvi: number, lang: string) => {
  const t = translateFor(lang);
  const input = { alerts: [], primary: { kind: "uv" as const, severity: getUvLevelIndex(uvi), labelKey: "uv" },
    heatRisk: null, coldRisk: null, windRisk: null, hi: 22, temp: 22, uvi, day: true, t };
  return { ...input, primaryAdvice: getPrimaryAdviceText(input), contextualUVMessage: "legacy fallback" };
};
const contextualBody = (uvi: number, lang: string, weather?: UvAdviceWeather) =>
  usesContextualUvAdvice(weather) ? getTimeAwareUvAdvice(uvi, lang, 12, weather) : null;

test("primary UV keeps all original texts and presentation, contextualizes four levels in five languages", () => {
  for (const lang of langs) for (const [i, uvi] of [3.8, 7.6, 8.5, 11].entries()) {
    const input = primaryInput(uvi, lang);
    const original = getPrimaryStatusBlock(input);
    assert.equal(original.text, input.t(`officialAdviceDynamic.uv.${["moderate","high","very_high","extreme"][i]}`));
    for (const weather of [{weatherMain:"Clear"}, ...contexts, {weatherMain:"Clear"}, undefined]) {
      const body = contextualBody(uvi, lang, weather);
      const result = getPrimaryStatusBlock({ ...input, contextualPrimaryUvAdvice: body });
      assert.deepEqual(result, { ...original, text: body || original.text });
      assert.equal(input.primary.severity, i + 1);
    }
  }
  const input = primaryInput(7.6, "ca");
  const result = getPrimaryStatusBlock({ ...input, contextualPrimaryUvAdvice: contextualBody(7.6, "ca", {weatherMain:"Rain",rainMmH:0.9}) });
  assert.equal(result.title, "Radiació UV alta");
  assert.equal(result.text, "La radiació UV és alta, encara que el sol no sigui visible. Limita l'exposició exterior i utilitza protecció solar reforçada.");
});

test("contextual primary UV body cannot override official alerts or other primary risks", () => {
  const now = Math.floor(Date.now()/1000);
  const base = primaryInput(8.5,"ca");
  const cases = [
    {...base, alerts:[{event:"Thunderstorm",start:now-60,end:now+3600}]},
    {...base, alerts:[{event:"Thunderstorm",start:now+60,end:now+3600}]},
    ...["heat","cold","wind","none"].map(kind=>({...base,
      primary:{kind:kind as "heat"|"cold"|"wind"|"none",severity:3 as const,labelKey:kind},
      heatRisk:{isHigh:true},coldRisk:"alt",windRisk:"strong"})),
    {...base,day:false},
  ];
  for(const input of cases) assert.deepEqual(
    getPrimaryStatusBlock({...input,contextualPrimaryUvAdvice:"must not appear"}), getPrimaryStatusBlock(input));
});

test("Recommendations preserve usual copy and contextualize visible UV including strong wind in five languages", () => {
  for (const lang of langs) for (const [i,uvi] of [3.8,7.6,8.5,11].entries()) {
    for(const windKmh of [0,60]) {
      const base={temp:22,lang,isDay:true,uvi,windKmh,currentHour:12,heatDayPhase:"day" as const};
      const usual=Recommendations({...base,weatherMain:"Clear"}) as any;
      const usualUv=usual.props.items.filter((item:any)=>item.factor==="uv");
      if(usualUv.length) assert.equal(usualUv[0].text,originalRecommendationUv[lang][i]);
      for(const weather of contexts){
        const result=Recommendations({...base,...weather,weatherMain:weather.weatherMain ?? undefined}) as any;
        // Existing visibility/priority rules remain in place; only visible UV text changes.
        const items=result.props.items.filter((item:any)=>item.factor==="uv");
        if(windKmh===60 && i>0) assert.equal(items.length,1);
        if(weather.weatherMain==="Fog" || weather.weatherMain==="Snow" || weather.weatherCode===804) {
          if(windKmh===0) assert.equal(items.length,1);
        }
        for(const item of items){
          assert.equal(item.text,getTimeAwareUvAdvice(uvi,lang,12,weather));
          assert.doesNotMatch(item.text,/ombra|sombra|shade|itzala/);
        }
        if(windKmh===60) {
          assert.equal(result.props.className,usual.props.className);
          assert.deepEqual(result.props.items.filter((item:any)=>item.factor==="wind"),usual.props.items.filter((item:any)=>item.factor==="wind"));
        }
      }
      assert.deepEqual(Recommendations({...base,weatherMain:"Clear"}),usual);
      assert.deepEqual(Recommendations(base),usual);
    }
  }
});

test("App wires current weather into primary status and Recommendations without changing the UVSafeTime connection", () => {
  const app=readFileSync("src/App.tsx","utf8");
  const start=app.indexOf("const contextualUvAdvice =");
  assert.ok(start<app.indexOf("const primaryStatusInput"));
  const block=app.slice(app.indexOf("const primaryStatusInput"),app.indexOf("const primaryStatus ="));
  assert.equal((block.match(/contextualPrimaryUvAdvice/g)||[]).length,2,"input and memo dependencies");
  assert.match(app,/<Recommendations[^]*?weatherCode=\{data\?\.weather\?\.\[0\]\?\.id\}[^]*?rainMmH=\{data\?\.rain\?\.\["1h"\]\}/);
});
