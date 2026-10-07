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
