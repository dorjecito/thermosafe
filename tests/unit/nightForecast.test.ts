import assert from "node:assert/strict";
import test from "node:test";
import vm from "node:vm";
import { readFileSync } from "node:fs";
import SunCalc from "suncalc";
import { buildNightForecast, type NightForecast } from "../../src/utils/nightForecast";
import { getHourlyForecastByCoords } from "../../src/services/weatherService";
import Recommendations from "../../src/components/Recommendations";
import { evaluateRiskScore } from "../../src/utils/riskScoreEngine";
import { getWorkWindow } from "../../src/utils/workWindow";

const day = Date.UTC(2026, 8, 25) / 1000;
const coords = { lat: 39.49, lon: 2.89 };
const solarTimes = (date: Date) => {
  const d = Math.floor(date.getTime() / 86400000) * 86400000;
  return { sunrise: new Date(d + 6.5 * 3600000), sunset: new Date(d + 18.5 * 3600000) };
};
const input = (min = 21, now = day + 12 * 3600) => ({
  nowUtcSec: now, coords, forecastCoords: coords, solarTimes,
  forecast: { fetchedAt: now * 1000, hourly: Array.from({ length: 48 }, (_, i) => ({
    dt: day + i * 3600, temp: min, feels_like: 99,
  })) },
});

test("night forecast classifies air-temperature minima independently of current conditions", () => {
  for (const [current, min, category] of [[22.7,18,"none"],[23,21,"tropical"],[27,19,"none"],[23,20,"tropical"],[23,25,"torrid"],[30,19.99,"none"],[30,24.99,"tropical"]] as const) {
    const result = buildNightForecast(input(min));
    assert.equal(result.status, "ready"); assert.equal(result.category, category);
    assert.equal(result.minForecastTemp, min);
    const risk = evaluateRiskScore({ heatIndex: current, coldEffectiveTemp: current, uvi: 0, windKmh: 0 });
    assert.equal(risk.factors.find(f => f.factor === "heat")?.active, current >= 27);
    assert.equal("nightHeatLevel" in risk, false);
  }
});
test("night forecast interpolates both astronomical boundaries, ignoring outside minima", () => {
  const data = input(30);
  data.forecast.hourly[18].temp = 10; data.forecast.hourly[19].temp = 30;
  data.forecast.hourly[30].temp = 30; data.forecast.hourly[31].temp = 8;
  const result = buildNightForecast(data);
  assert.equal(result.minForecastTemp, 19); assert.equal(result.category, "none");
  assert.equal(result.sunsetUtcSec, day + 18.5 * 3600);
  assert.equal(result.sunriseUtcSec, day + 30.5 * 3600);
});
test("night forecast rejects missing boundaries, hourly gaps and unreliable temperatures", () => {
  for (const mutate of [
    (d: ReturnType<typeof input>) => { d.forecast.hourly.splice(22,1); },
    (d: ReturnType<typeof input>) => { d.forecast.hourly = d.forecast.hourly.slice(19); },
    (d: ReturnType<typeof input>) => { d.forecast.hourly = d.forecast.hourly.slice(0,31); },
    (d: ReturnType<typeof input>) => { d.forecast.hourly[25].temp = NaN; },
    (d: ReturnType<typeof input>) => { d.forecast.hourly[25].dt = NaN; },
    (d: ReturnType<typeof input>) => { d.forecast.hourly.push({ ...d.forecast.hourly[25], temp: 5 }); },
  ]) {
    const d = input(); mutate(d); const result = buildNightForecast(d);
    assert.equal(result.status, "incomplete"); assert.equal(result.category, null);
  }
  const d = input(); d.forecast.hourly.reverse();
  assert.equal(buildNightForecast(d).category, "tropical");
});
test("night forecast rejects stale, expired, missing/future acquisition times and other locations", () => {
  const d = input();
  for (const forecast of [
    { ...d.forecast, stale: true },
    { ...d.forecast, fetchedAt: d.nowUtcSec * 1000 - 3600001 },
    { ...d.forecast, fetchedAt: undefined },
    { ...d.forecast, fetchedAt: d.nowUtcSec * 1000 + 1 },
  ]) assert.equal(buildNightForecast({ ...d, forecast }).category, null);
  assert.equal(buildNightForecast({ ...d, forecast: { ...d.forecast, fetchedAt: d.nowUtcSec*1000-3600000 } }).status, "ready");
  assert.equal(buildNightForecast({ ...d, forecastCoords: { lat: 40, lon: 3 } }).reason, "location-mismatch");
});
test("midnight keeps the same night; morning partial forecast cannot establish the full night", () => {
  const before = buildNightForecast(input(21,day+23*3600));
  const after = buildNightForecast(input(21,day+27*3600));
  assert.equal(before.sunsetUtcSec,after.sunsetUtcSec); assert.equal(after.period,"ongoing");
  const d = input(21,day+27*3600); d.forecast.hourly=d.forecast.hourly.filter(p=>p.dt>=d.nowUtcSec);
  // Deliberate extension: cannot establish a FULL night, but exact coverage
  // starting now can describe the remaining night without asserting its past.
  assert.equal(buildNightForecast(d).status,"ready");
  assert.equal(buildNightForecast(d).scope,"remaining-night");
  assert.equal(buildNightForecast(input(21,day+30.5*3600)).period,"upcoming");
});
test("real astronomy remains UTC-based across device timezones and daylight-saving transitions", () => {
  const original = process.env.TZ;
  try {
    for (const date of ["2026-03-28T12:00:00Z","2026-10-24T12:00:00Z"]) {
      const now = Date.parse(date)/1000;
      const d = { ...input(), nowUtcSec: now, solarTimes: SunCalc.getTimes,
        forecast:{ fetchedAt:now*1000, hourly:Array.from({length:48},(_,i)=>({dt:now+i*3600,temp:21})) } };
      const outputs = ["UTC","Europe/Madrid","Pacific/Auckland","America/Los_Angeles"].map(tz=>{
        process.env.TZ=tz; return buildNightForecast(d);
      });
      for (const result of outputs) { assert.equal(result.status,"ready");assert.deepEqual(result,outputs[0]); }
      assert.ok(outputs[0].sunriseUtcSec! > outputs[0].sunsetUtcSec!);
    }
  } finally { if(original===undefined)delete process.env.TZ;else process.env.TZ=original; }
});
test("missing polar solar events do not manufacture a night", () => {
  assert.equal(buildNightForecast({...input(),solarTimes:()=>({sunrise:new Date(NaN),sunset:new Date(NaN)})}).status,"unavailable");
});
const render = (temp:number, nightForecast?:NightForecast, extras:Record<string,unknown>={}) => {
  const risk=evaluateRiskScore({heatIndex:temp,coldEffectiveTemp:temp,windKmh:0,uvi:0});
  return Recommendations({temp,lang:"ca",isDay:false,activity:"rest",humidity:50,windKmh:0,uvi:0,
    riskFactors:risk.activeFactorsSorted, nightForecast,...extras} as any) as any;
};
test("night forecast is appended without removing any existing recommendation in five languages", () => {
  const titles={ca:"Previsió de nit tropical",es:"Previsión de noche tropical",eu:"Gau tropikalaren iragarpena",gl:"Previsión de noite tropical",en:"Tropical night forecast"};
  const torridTitles: Record<string,string> = {ca:"Previsió de nit tòrrida",es:"Previsión de noche tórrida",eu:"Gau sargoriaren iragarpena",gl:"Previsión de noite tórrida",en:"Torrid night forecast"};
  for(const [lang,title] of Object.entries(titles)) {
    for(const extras of [{},{windKmh:50},{weatherMain:"Rain"},{weatherMain:"Thunderstorm"},{isDay:true,uvi:8},{aemetActive:true}] ) {
      const plain=render(23,undefined,{...extras,lang});
      const withForecast=render(23,buildNightForecast(input()),{...extras,lang});
      assert.deepEqual(withForecast.props.items.slice(0,-1),plain.props.items);
      assert.equal(withForecast.props.items.at(-1).label,title);
      assert.ok(withForecast.props.items.at(-1).text.includes("21"));
      assert.equal(render(23,buildNightForecast(input(25)),{lang}).props.items.at(-1).label,torridTitles[lang]);
    }
  }
  const cold=render(-5); const coldForecast=render(-5,buildNightForecast(input()));
  assert.deepEqual(coldForecast.props.items.slice(0,-1),cold.props.items);
});
test("current nocturnal heat advice and activity do not depend on the night forecast", () => {
  for(const min of [19,21,25]) {
    const forecast=buildNightForecast(input(min));
    assert.ok(render(27,forecast).props.items.some((i:any)=>i.factor==="heat"));
    const risk=evaluateRiskScore({heatIndex:23,coldEffectiveTemp:23,windKmh:0,uvi:0});
    assert.equal(risk.maxSeverity,0);
    assert.equal(getWorkWindow({engineRisk:risk,heatIndex:23,uvi:0,coldRisk:"cap",windRisk:"none"}),"optimal");
    assert.equal(render(23,forecast).props.items.some((i:any)=>i.factor==="heat"),false);
  }
  for(const forecast of [buildNightForecast(input(19)),{...buildNightForecast(input()),status:"stale" as const}])
    assert.deepEqual(render(23,forecast).props.items,render(23).props.items);
});
test("forecast cache reads preserve acquisition time; stale fallback never becomes fresh", async () => {
  const originalFetch=globalThis.fetch;const originalWindow=(globalThis as any).window;
  const originalDocument=(globalThis as any).document;const originalNow=Date.now;
  let now=Date.UTC(2026,8,25,12,5), calls=0;const storage=new Map<string,string>();
  try {
    Date.now=()=>now;
    (globalThis as any).window={location:{origin:"https://local.test"},localStorage:{getItem:(k:string)=>storage.get(k)??null,setItem:(k:string,v:string)=>storage.set(k,v)}};
    (globalThis as any).document={hidden:false};
    globalThis.fetch=(async()=>{calls++;return {ok:true,json:async()=>({hourly:[{dt:now/1000,temp:21}]})};}) as any;
    const first=await getHourlyForecastByCoords(39.12345,2.54321,"en","test-only-not-a-real-key");
    now+=600000;
    const cached=await getHourlyForecastByCoords(39.12345,2.54321,"en","test-only-not-a-real-key");
    assert.equal(calls,1); assert.equal(cached?.fetchedAt,first?.fetchedAt);
    now+=3600000;globalThis.fetch=(async()=>({ok:false,status:503})) as any;
    const stale=await getHourlyForecastByCoords(39.12345,2.54321,"en","test-only-not-a-real-key");
    assert.equal(stale?.stale,true);assert.equal(stale?.fetchedAt,first?.fetchedAt);
  } finally {globalThis.fetch=originalFetch;Date.now=originalNow;
    if(originalWindow===undefined)delete (globalThis as any).window;else (globalThis as any).window=originalWindow;
    if(originalDocument===undefined)delete (globalThis as any).document;else (globalThis as any).document=originalDocument;}
});


test("presentation expiry clock schedules boundaries without fetching or synchronizing location", () => {
  const source=readFileSync("src/App.tsx","utf8");
  const start=source.indexOf("// Presentation clock only:");
  const end=source.indexOf("const workWindow =",start);
  const effect=source.slice(start,end);
  assert.doesNotMatch(effect,/fetch\(|refreshCurrentData|updateRiskAlert|locate\(/);
  let now=100000, scheduled:(()=>void)|undefined,delay=0,ticks=0;
  let cleanup:(()=>void)|undefined;
  const context={
    Date:{now:()=>now},Number,Math,
    nightForecast:{sunsetUtcSec:101,sunriseUtcSec:500},
    hourlyForecast:{fetchedAt:now-3590000},nightForecastTick:0,
    setNightForecastTick:(fn:(n:number)=>number)=>{ticks=fn(ticks);},
    window:{setTimeout:(fn:()=>void,ms:number)=>{scheduled=fn;delay=ms;return 1;},clearTimeout:()=>{}},
    useEffect:(fn:()=>()=>void)=>{cleanup=fn();},
  };
  vm.runInNewContext(effect,context);
  assert.equal(delay,1001);scheduled!();assert.equal(ticks,1);cleanup!();
  now+=1001;context.nightForecastTick=ticks;
  vm.runInNewContext(effect,context);
  assert.equal(delay,9001); // Next wake-up is forecast expiry, not another weather refresh.
});


const remainingInput = (min = 21) => {
  const d = input(min, day + 23.5 * 3600);
  d.forecast.hourly = d.forecast.hourly.filter(p => p.dt >= day + 21 * 3600);
  return d;
};
test("full-night remains preferred after sunset, even when only remaining hours are warmer", () => {
  const d = input(25, day + 23.5 * 3600);
  d.forecast.hourly[20].temp = 18;
  const result = buildNightForecast(d);
  assert.equal(result.status,"ready");assert.equal(result.scope,"full-night");
  assert.equal(result.category,"none");assert.equal(result.minForecastTemp,18);
});
test("missing past coverage permits remaining-night using temp and interpolation at now", () => {
  const d = remainingInput(30);
  d.forecast.hourly.find(p=>p.dt===day+23*3600)!.temp=18;
  d.forecast.hourly.find(p=>p.dt===day+24*3600)!.temp=24;
  const result=buildNightForecast(d);
  assert.equal(result.status,"ready");assert.equal(result.scope,"remaining-night");
  assert.equal(result.minForecastTemp,21);assert.equal(result.category,"tropical");
  assert.equal(result.sunsetUtcSec,day+18.5*3600);
});
test("remaining-night cannot hide gaps, invalid temperatures, missing future or missing now", () => {
  const mutations: Array<[string,(d:ReturnType<typeof remainingInput>)=>void]> = [
    ["missing-start",d=>{d.forecast.hourly=d.forecast.hourly.filter(p=>p.dt>d.nowUtcSec);}],
    ["missing-end",d=>{d.forecast.hourly=d.forecast.hourly.filter(p=>p.dt<day+31*3600);}],
    ["hourly-gap",d=>{d.forecast.hourly=d.forecast.hourly.filter(p=>p.dt!==day+26*3600);}],
    ["hourly-gap",d=>{d.forecast.hourly=d.forecast.hourly.filter(p=>p.dt!==day+22*3600);}],
    ["invalid-temperature",d=>{d.forecast.hourly[0].temp=NaN;}],
    ["invalid-temperature",d=>{d.forecast.hourly.find(p=>p.dt===day+26*3600)!.temp=NaN;}],
  ];
  for(const [reason,mutate] of mutations){const d=remainingInput();mutate(d);const r=buildNightForecast(d);
    assert.equal(r.status,"incomplete");assert.equal(r.reason,reason);assert.equal(r.scope,null);assert.equal(r.category,null);}
  // Full coverage with a past error must never be rescued by dropping the past.
  for(const invalid of [true,false]){const d=input(21,day+23.5*3600);
    if(invalid)d.forecast.hourly[20].temp=NaN;else d.forecast.hourly.splice(20,1);
    const r=buildNightForecast(d);assert.equal(r.scope,null);assert.equal(r.category,null);
    assert.equal(r.reason,invalid?"invalid-temperature":"hourly-gap");}
});
test("remaining-night retains freshness and location guards and never applies before sunset", () => {
  const d=remainingInput();
  for(const override of [
    {forecast:{...d.forecast,stale:true}},
    {forecast:{...d.forecast,fetchedAt:d.nowUtcSec*1000-3600001}},
    {forecast:{...d.forecast,fetchedAt:undefined}},
    {forecastCoords:{lat:40,lon:3}},
  ]) {const r=buildNightForecast({...d,...override});assert.equal(r.scope,null);assert.equal(r.category,null);}
  const before=input();before.forecast.hourly=before.forecast.hourly.filter(p=>p.dt>=day+19*3600);
  assert.equal(buildNightForecast(before).reason,"missing-start");
});
test("remaining-night messages and preservation of current advice in all five languages", () => {
  const titles={ca:"Resta de la nit: mínima prevista",es:"Resto de la noche: mínima prevista",eu:"Gauaren gainerako zatia: aurreikusitako gutxienekoa",gl:"Resto da noite: mínima prevista",en:"Rest of the night: forecast minimum"};
  const bodyMarkers={ca:"des d’ara fins a la sortida",es:"desde ahora hasta la salida",eu:"Hemendik eguzki-irteerara",gl:"desde agora ata o amencer",en:"from now until sunrise"};
  for(const [lang,title] of Object.entries(titles))for(const min of [19,21,25]) {
    const forecast=buildNightForecast(remainingInput(min));
    assert.equal(forecast.scope,"remaining-night");
    for(const extras of [{},{windKmh:50},{weatherMain:"Rain"},{weatherMain:"Thunderstorm"},{aemetActive:true},{isDay:true,uvi:8}]) {
      const plain=render(23,undefined,{lang,...extras});const rendered=render(23,forecast,{lang,...extras});
      if(min<20){assert.deepEqual(rendered.props.items,plain.props.items);continue;}
      assert.deepEqual(rendered.props.items.slice(0,-1),plain.props.items);
      const last=rendered.props.items.at(-1);
      assert.equal(last.label,`${title} ≥${min>=25?25:20} °C`);
      assert.ok(last.text.includes(bodyMarkers[lang as keyof typeof bodyMarkers]));
      assert.doesNotMatch(last.label,/tropical|tòrrid|tórrid|torrid|tropikal|sargori/i);
    }
  }
});
test("remaining-night preserves current cold/heat and does not affect outdoor activity", () => {
  const forecast=buildNightForecast(remainingInput(25));
  for(const temp of [-5,23,27,35]) {
    const plain=render(temp);const result=render(temp,forecast);
    assert.deepEqual(result.props.items.slice(0,-1),plain.props.items);
    if(temp>=27)assert.ok(result.props.items.some((i:any)=>i.factor==="heat"));
  }
  const risk=evaluateRiskScore({heatIndex:23,coldEffectiveTemp:23,uvi:0,windKmh:0});
  assert.equal(risk.maxSeverity,0);
  assert.equal(getWorkWindow({engineRisk:risk,heatIndex:23,uvi:0,coldRisk:"cap",windRisk:"none"}),"optimal");
});
