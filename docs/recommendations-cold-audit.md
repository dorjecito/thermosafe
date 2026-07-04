# Auditoria del factor fred a Recommendations

Data: 2026-07-04

## Objectiu

Auditar exclusivament el factor `cold` dins `Recommendations.tsx` per decidir si en una fase posterior es pot migrar al `RiskScoreEngine`, sense aplicar cap canvi funcional.

## Fitxers revisats

- `src/components/Recommendations.tsx`
- `src/utils/getColdRisk.ts`
- `src/utils/riskScoreEngine.ts`
- `src/utils/primaryRiskFromEngine.ts`
- `src/utils/getPrimaryStatusBlock.ts`
- `src/utils/workWindow.ts`
- `src/utils/PickPrimaryRisk.ts`
- `src/App.tsx`
- `tests/unit/risk.test.ts`

## Flux actual del fred

### App.tsx

`App.tsx` calcula una temperatura efectiva de fred (`effForCold`) a partir de temperatura real i vent quan aplica windchill:

- usa la temperatura real (`tempReal`);
- calcula `wcVal` si `tempReal <= WINDCHILL_TEMP_MAX` i el vent supera `WINDCHILL_WIND_MIN`;
- guarda `wcVal` a l'estat `wc`;
- calcula `coldRisk` amb `getColdRisk(effForCold, wKmH)`.

Aquest `coldRisk` es passa a:

- `getWorkWindow(...)`;
- `getPrimaryStatusBlock(...)`;
- notificacions locals de fred;
- `pickPrimaryRisk` / `evaluateRiskScore` mitjançant `effForCold: wc ?? temp` o `coldEffectiveTemp: wc ?? temp`.

### Recommendations.tsx

`Recommendations.tsx` no rep ni `coldRisk` ni `wc`.

El component rep:

```tsx
temp={hi ?? data?.main?.temp ?? 0}
windKmh={windKmh}
riskFactors={engineRisk?.activeFactorsSorted}
```

Per al fred, internament fa:

```ts
const effectiveTemp = Number(temp);
const coldKey = getColdKey(effectiveTemp);
```

i `getColdKey` crida:

```ts
const coldRisk = getColdRisk(effectiveTemp, null);
```

Per tant, ara mateix les recomanacions de fred depenen de `hi ?? temp`, no de `wc ?? temp`, i passen `null` com a vent. El vent pot aparèixer com a factor addicional (`windModerate` / `windStrong`), però no altera el càlcul del fred dins `Recommendations`.

### getColdRisk.ts

`getColdRisk(tempEff, _windKmh)` utilitza només `tempEff`.

El segon paràmetre existeix però no s'utilitza:

```ts
export function getColdRisk(tempEff: number | null, _windKmh: number | null): ColdRisk
```

Llindars actuals:

| `tempEff` | ColdRisk |
|---|---|
| `null` / `NaN` | `cap` |
| `> 0` | `cap` |
| `<= 0` | `lleu` |
| `<= -5` | `moderat` |
| `<= -15` | `alt` |
| `<= -25` | `molt alt` |
| `<= -40` | `extrem` |

### RiskScoreEngine

`RiskScoreEngine` crea el factor fred amb:

```ts
const coldEffectiveTemp = finiteNumber(input.coldEffectiveTemp);
const windKmh = finiteNumber(input.windKmh);
const coldRisk = getColdRisk(coldEffectiveTemp, windKmh);
```

Com que `getColdRisk` ignora el vent, el motor tampoc recalcula el fred amb vent per si mateix. La diferència és que el motor rep `coldEffectiveTemp` ja preparat des d'`App.tsx`, normalment `wc ?? temp`.

Severitats del motor:

| ColdRisk | Severitat |
|---|---:|
| `cap` | 0 |
| `lleu` | 1 |
| `moderat` | 2 |
| `alt` | 3 |
| `molt alt` | 3 |
| `extrem` | 4 |

### primaryRiskFromEngine

`primaryRiskFromEngine` només adapta el `primary` del motor al contracte històric:

```ts
{ kind, severity, labelKey }
```

No reinterpreta el fred. Si el motor diu `cold`, la UI rep `kind: "cold"`.

### getPrimaryStatusBlock

`getPrimaryStatusBlock` mostra la targeta principal de fred quan `primary.kind === "cold"`.

La severitat textual final depèn de `coldRisk`, no només del `labelKey`:

- `lleu` -> `Precaució lleu per fred`;
- `moderat` -> `Risc moderat per fred`;
- `alt` / `molt alt` -> `Risc alt per fred`;
- `extrem` -> `Risc extrem per fred`.

És coherent amb `getColdRisk`, però consumeix el `coldRisk` calculat a `App.tsx`, que sí pot venir de windchill.

### workWindow

`workWindow` consumeix `coldRisk` ja calculat i `windRisk`.

El fred té efecte clar sobre activitat exterior:

- `extrem` -> `avoid`;
- `moderat`, `alt`, `molt alt` + vent rellevant -> `limited` o `avoid`;
- `alt` / `molt alt` -> `limited`;
- `moderat` -> `limited`;
- `lleu` -> `caution`.

La combinació fred + vent està explícitament contemplada a `workWindow`.

## Comparació Recommendations vs RiskScoreEngine

| Aspecte | Recommendations actual | RiskScoreEngine |
|---|---|---|
| Input tèrmic fred | `temp` prop, que a `App.tsx` és `hi ?? temp` | `coldEffectiveTemp`, que a `App.tsx` és `wc ?? temp` |
| Vent al càlcul de fred | passa `null` a `getColdRisk` | passa `windKmh`, però `getColdRisk` l'ignora |
| Windchill | no rep `wc`; només l'aprofita indirectament si `hi` ja ho reflecteix | rep `wc ?? temp` des d'`App.tsx` |
| Llindars | `getColdRisk` | `getColdRisk` |
| Sortida interna | `cold_low`, `cold_mod`, `cold_high`, `cold_ext` | `cold_safe`, `cold_mild`, `cold_moderate`, `cold_high`, `cold_very_high`, `cold_extreme` |
| `molt alt` | es mostra com `cold_high` | es conserva com `cold_very_high`, severitat 3 |
| Paper del vent | text extra de vent si `windKmh >= 25` | factor separat `wind`; no modifica fred |

## Taula de casos

| Escenari | Recommendations actual | RiskScoreEngine | Possible impacte si es migra | Recomanació |
|---|---|---|---|---|
| Fred lleu sense vent (`temp/hi = 0`) | `cold_low` | `cold_mild` si `coldEffectiveTemp = 0` | Equivalent en severitat i missatge general | Preparat si es conserva el text actual |
| Fred moderat sense vent (`temp/hi = -5`) | `cold_mod` | `cold_moderate` | Equivalent | Preparat |
| Fred alt sense vent (`temp/hi = -15`) | `cold_high` | `cold_high` | Equivalent | Preparat |
| Fred molt alt (`temp/hi = -25`) | `cold_high` | `cold_very_high`, severitat 3 | Pot canviar etiqueta interna, però no necessàriament text visible si es manté el mapping actual | Necessita adaptador de text |
| Fred extrem (`temp/hi = -40`) | `cold_ext` | `cold_extreme` | Equivalent si es mapeja correctament | Preparat |
| Temperatura real 3 ºC + vent fort amb windchill -5 ºC | pot no mostrar fred si `hi ?? temp` queda per damunt de 0 | motor pot marcar `cold_moderate` si rep `wc = -5` | La migració podria fer aparèixer recomanació de fred que ara no apareix | Necessita fase intermèdia |
| Temperatura real 4 ºC + vent moderat, sense windchill crític | no mostra fred; pot afegir vent si toca | motor no marca fred si `coldEffectiveTemp > 0`; pot marcar vent | Equivalent | Preparat |
| Fred moderat + vent moderat | recomanació de fred amb extra de vent | motor exposa `cold` i `wind` ordenats | Pot millorar coherència, però cal conservar ordre i textos | Migrable amb test |
| Fred extrem + vent | fred domina; vent pot aparèixer com extra | motor ordena per severitat, fred extrem domina | Equivalent esperat | Preparat amb test |

## Divergències trobades

### 1. `Recommendations` no consumeix `coldRisk` ni `wc`

A diferència del bloc principal i activitat exterior, `Recommendations` calcula el fred a partir del `temp` que rep. Actualment aquest `temp` és `hi ?? temp`, no `wc ?? temp`.

Impacte potencial:

- en condicions de fred amb vent, la targeta principal i activitat exterior poden considerar fred per windchill;
- `Recommendations` podria no mostrar fred si `hi ?? temp` no cau sota els llindars;
- si es migra directament a `riskFactors`, podria aparèixer una recomanació de fred nova en aquests casos.

### 2. `getColdRisk` accepta vent però no l'utilitza

El disseny suggereix que el vent podria haver format part del càlcul, però actualment el càlcul real depèn només de `tempEff`.

Impacte potencial:

- no és un bug per si mateix si `tempEff` ja és una temperatura efectiva;
- sí que és important documentar que el vent s'ha d'aplicar abans de cridar `getColdRisk`.

### 3. `molt alt` es compacta a `cold_high` dins `Recommendations`

`Recommendations` converteix tant `alt` com `molt alt` a `cold_high`. El motor manté `cold_very_high`.

Impacte potencial:

- migrar fred sense adaptador podria crear una distinció interna que els textos actuals de `Recommendations` no tenen;
- si es vol mantenir exactament la UI, `cold_very_high` s'hauria de mapar al mateix text que `cold_high` en la fase de migració.

### 4. `workWindow` ja contempla fred + vent de forma més rica

`workWindow` fa servir `coldRisk` + `windRisk` i pot limitar o desaconsellar activitat en combinacions fred + vent.

Impacte potencial:

- migrar `Recommendations` a `riskFactors` pot millorar coherència amb activitat exterior;
- però només si `Recommendations` rep el mateix fred efectiu que el motor.

## Riscos de migració

| Risc | Gravetat | Motiu |
|---|---|---|
| Aparició de recomanacions de fred en casos amb windchill que abans no sortien | Mitjana | Seria preventivament coherent, però visible |
| Canvi de text per `molt alt` | Baixa/mitjana | El motor distingeix `cold_very_high`; `Recommendations` ho compacta |
| Desalineació entre targeta principal i recomanacions si es fa una migració parcial | Mitjana | El bloc principal ja usa `coldRisk` calculat amb `wc`; recomanacions no |
| Duplicació fred + vent mal ordenada | Baixa | `factorItems` ja pot ordenar per `riskFactors`, però cal test específic |

## Conclusió

El factor fred no està tan preparat per migrar directament com `heat`, `uv` i `wind`.

La raó principal no són els llindars, que són compartits via `getColdRisk`, sinó l'input:

- `RiskScoreEngine` rep `coldEffectiveTemp = wc ?? temp`;
- `Recommendations` calcula fred amb `temp = hi ?? temp`;
- `Recommendations` no rep `coldRisk` ni `wc`.

## Recomanació final

Classificació: 🟡 Necessita adaptació.

Abans d'una FASE 5.3 de migració del fred, recomanaria una fase intermèdia petita:

1. Passar a `Recommendations` un valor opcional i no intrusiu, per exemple `coldRisk` o `coldEffectiveTemp`.
2. Mantenir fallback actual si no existeix.
3. Mapar `cold_very_high` al mateix text visible que `cold_high` per preservar comportament.
4. Afegir tests específics:
   - fred sense vent;
   - fred amb windchill;
   - fred moderat + vent moderat;
   - fred molt alt;
   - fred extrem;
   - `riskFactors` absent manté comportament actual.

No recomano migrar `cold` només activant-lo des de `riskFactors` dins `Recommendations` sense abans alinear l'input de temperatura efectiva.

