# Auditoria de pluja, tempesta i humitat

Data: 2026-07-04

## Resum executiu

ThermoSafe tracta pluja, tempesta i humitat com a factors contextuals, no com a riscos principals del `RiskScoreEngine`.

- Pluja i tempesta es detecten principalment amb `weatherMain` (`Rain`, `Drizzle`, `Thunderstorm`) i s'usen per matisar recomanacions, activitat exterior i UV.
- Humitat es detecta dins `Recommendations.tsx` amb una regla simple: `humidity >= 70 && effectiveTemp >= 24`.
- AEMET també pot detectar pluja/tempesta com a fenomen oficial mitjançant `detectAemetHazard()`, però és un flux separat del temps observat d'OpenWeather.

Conclusió: no recomanaria migrar pluja, tempesta ni humitat directament al `RiskScoreEngine` encara. Són més adequats com a context extern o com a factors auxiliars en una fase intermèdia.

## Fitxers revisats

- `src/components/Recommendations.tsx`
- `src/utils/workWindow.ts`
- `src/App.tsx`
- `src/utils/riskScoreEngine.ts`
- `src/utils/getPrimaryStatusBlock.ts`
- `src/utils/riskTrend.ts`
- `src/components/TopAlertBanner.tsx`
- `src/components/UVAdvice.tsx`
- `src/utils/aemetAi.ts`
- `tests/unit/risk.test.ts`
- `functions/index.js` com a referència de notificacions UV remotes

## Flux actual de pluja

### Font

La pluja observada ve de `weatherMain`, normalment des d'OpenWeather:

- `Rain`
- `Drizzle`
- `Thunderstorm`

### Ús principal

`Recommendations.tsx` defineix:

```ts
const isRainyWeather = (weatherMain?: string): boolean =>
  weatherMain === "Rain" ||
  weatherMain === "Drizzle" ||
  weatherMain === "Thunderstorm";
```

La pluja:

- afegeix recomanacions de precaució per superfícies humides;
- suprimeix o matisa recomanacions UV quan el temps és plujós;
- apareix com a factor agrupat `rain` si no hi ha tempesta;
- pot formar part del cas segur/contextual final.

`workWindow.ts` també calcula `rainy` amb la mateixa lògica i retorna `caution` si plou.

## Flux actual de tempesta

### Font

La tempesta observada es detecta amb:

- `weatherMain === "Thunderstorm"`

### Ús principal

`Recommendations.tsx` dona prioritat a `stormy` sobre `rainy`:

- si `stormy` és cert, mostra text de tempesta;
- si `rainy && !stormy`, mostra text de pluja;
- evita duplicar pluja i tempesta simultàniament dins els factors agrupats.

`workWindow.ts`, en canvi, no diferencia tempesta de pluja: `Thunderstorm` entra dins `rainy` i només provoca `caution`, excepte si AEMET eleva la situació per altres vies.

## Flux actual d'humitat

### Font

La humitat ve de `data.main.humidity` d'OpenWeather i arriba a `Recommendations.tsx` com a prop:

```tsx
humidity={data?.main?.humidity ?? undefined}
```

### Regla actual

`Recommendations.tsx` calcula:

```ts
const humid = typeof humidity === "number" && humidity >= 70 && effectiveTemp >= 24;
```

Per tant, la humitat elevada només genera missatge quan coincideix amb temperatura/sensació càlida. No hi ha risc d'humitat independent si fa fresc.

### Ús actual

La humitat:

- s'afegeix com a text extra a recomanacions de calor, UV, vent, nit, núvols i cas segur;
- pot aparèixer com a factor agrupat `humidity`;
- no afecta `workWindow`;
- no afecta el risc principal;
- no existeix al `RiskScoreEngine`.

## Taula de factors

| Factor | Font actual | On impacta | Existeix al RiskScoreEngine? | Migrable? | Observacions |
|---|---|---|---|---|---|
| Pluja observada | `weatherMain === "Rain" || "Drizzle" || "Thunderstorm"` | `Recommendations`, `workWindow`, UV, ocultació/matisació UV | No | 🟡 necessita fase intermèdia | És context de superfície/activitat, no severitat meteorològica completa. |
| Tempesta observada | `weatherMain === "Thunderstorm"` | `Recommendations`, UV | No | 🟡 necessita fase intermèdia | Ara `workWindow` no la diferencia de pluja. |
| Humitat elevada | `humidity >= 70 && effectiveTemp >= 24` | `Recommendations` | No | 🟡 necessita fase intermèdia | Funciona com a amplificador de confort tèrmic, no com a factor autònom. |
| Pluja AEMET | `detectAemetHazard(...)=rain` | Targeta principal, avisos oficials, textos i18n | No | 🔴 millor extern | És avís oficial, no estat local observat. |
| Tempesta AEMET | `detectAemetHazard(...)=storm` | Targeta principal, avisos oficials, textos i18n | No | 🔴 millor extern | Ha de continuar separat del motor local. |
| Pluja en notificacions UV remotes | `functions/index.js` usa `weatherMain` per suavitzar missatge UV | Push UV | No | 🔴 millor extern ara | Pertany a Cloud Functions i no s'ha de barrejar amb el motor client. |

## Taula de regles actuals

| Regla actual | Fitxer | Condició | Resultat | Risc de migració |
|---|---|---|---|---|
| Pluja observada | `Recommendations.tsx` | `Rain`, `Drizzle`, `Thunderstorm` | Recomanació de pluja o superfície humida | Mitjà: no distingeix intensitat. |
| Tempesta observada | `Recommendations.tsx` | `Thunderstorm` | Recomanació de tempesta; prioritat sobre pluja | Mitjà: depèn només de `weatherMain`. |
| Humitat elevada | `Recommendations.tsx` | `humidity >= 70 && effectiveTemp >= 24` | Text extra de xafogor/confort tèrmic | Baix-mitjà: útil però no és risc independent. |
| UV matisat per pluja/tempesta | `Recommendations.tsx` | `uvKey && (veryCloudy || rainy || stormy)` | Missatge contextual en lloc d'UV directe | Mitjà: risc de rebaixar massa la percepció UV si es migra malament. |
| Pluja en activitat exterior | `workWindow.ts` | `rainy` | `caution` | Baix, però només si es conserva com a context. |
| AEMET + pluja | `workWindow.ts` | `aemetActive && rainy` | `limited` | Alt: depèn d'alerta oficial i temps observat. |
| Ocultar bloc UV | `App.tsx` | `isRainy || veryCloudy+cold || coldRisk` | Oculta/matisa UV | Mitjà: és lògica visual contextual. |
| Banner UV alt no apareix amb pluja | `TopAlertBanner.tsx` | no `Rain/Drizzle/Thunderstorm` | Evita banner UV alt en temps plujós | Mitjà: decisió visual, no motor. |
| Nota UV amb pluja | `UVAdvice.tsx` | `Rain/Drizzle/Thunderstorm` | Afegeix nota que UV encara pot afectar | Baix: contextual i local al component. |
| Avisos oficials de pluja/tempesta | `aemetAi.ts`, `getPrimaryStatusBlock.ts` | text d'alerta conté pluja/tempesta | Títol/text d'avís oficial | Alt: ha de quedar separat del motor local. |

## Duplicacions detectades

1. Detecció de pluja `Rain/Drizzle/Thunderstorm` repetida a:
   - `Recommendations.tsx`
   - `workWindow.ts`
   - `App.tsx`
   - `TopAlertBanner.tsx`
   - `UVAdvice.tsx`
   - `functions/index.js`

2. Tempesta es detecta de dues maneres:
   - com `weatherMain === "Thunderstorm"` per estat observat;
   - com hazard oficial `storm` a `aemetAi.ts`.

3. Humitat elevada només té una regla clara a `Recommendations.tsx`, però el valor d'humitat apareix també a UI de condicions actuals i serveis.

4. Pluja/tempesta apareixen en textos i18n d'AEMET, recomanacions i UV, però no comparteixen un helper únic de classificació local.

## Riscos si es migren massa aviat

- `weatherMain` és massa gruixut: no diferencia pluja feble, moderada, intensa ni acumulació.
- `Thunderstorm` pot representar una tempesta local observada, però els avisos oficials poden tenir una gravetat superior i una finestra temporal pròpia.
- Humitat elevada pot ser important amb calor, però no sempre és un risc independent.
- Migrar pluja/tempesta al motor podria barrejar estat observat amb avís oficial AEMET.
- El motor actual és de factors quantitatius (`heat`, `cold`, `wind`, `uv`); pluja/tempesta necessiten més context o severitat.
- Les notificacions UV remotes ja usen pluja/núvols per modular el missatge. Migrar només client podria crear divergències client vs Functions.

## Classificació

| Factor | Classificació | Motiu |
|---|---|---|
| Pluja observada | 🟡 necessita fase intermèdia | Pot entrar com a context normalitzat, però no com a severitat simple. |
| Tempesta observada | 🟡 necessita fase intermèdia | Convé separar-la de pluja i valorar si ha de pujar `workWindow` més que `caution`. |
| Humitat elevada | 🟡 necessita fase intermèdia | És un amplificador de calor/confort, no factor principal autònom. |
| Pluja/tempesta AEMET | 🔴 millor mantenir extern al motor | És font oficial i ja té prioritat pròpia. |

## Recomanació per a FASE 7.1

No migrar encara aquests factors al `RiskScoreEngine`.

La fase més segura seria crear un helper compartit, sense canviar comportament:

```ts
getObservedWeatherContext({
  weatherMain,
  humidity,
  effectiveTemp,
  cloudiness,
})
```

Aquest helper podria retornar:

- `rainy`
- `stormy`
- `humid`
- `veryCloudy`

I després substituir gradualment les deteccions duplicades en `Recommendations`, `workWindow`, `TopAlertBanner` i `UVAdvice`.

Només després d'aquesta normalització convindria valorar si algun d'aquests contextos entra al motor com a `other/context`, no com a factor de risc principal.

Conclusió: pluja, tempesta i humitat han de continuar com a context extern de moment. La millora amb més valor i menys risc és reduir duplicació amb un helper compartit en una fase posterior.
