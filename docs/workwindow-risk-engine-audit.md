# Auditoria workWindow i RiskScoreEngine

Data: 2026-07-04

## Resum executiu

`getWorkWindow()` no és només un resum de severitats meteorològiques. És una capa de decisió per activitat exterior que combina riscos actuals amb context operatiu: AEMET, pluja/tempesta, calor nocturna, activitat física i combinacions específiques com fred + vent.

El `RiskScoreEngine` ja cobreix bé els factors base `heat`, `cold`, `uv` i `wind`, però encara no conté el context necessari per substituir `workWindow` sense risc. La recomanació és consumir-lo primer de manera parcial i passiva, començant per comparar factors ja equivalents, però mantenint `getWorkWindow()` com a font de decisió.

## Fitxers revisats

- `src/utils/workWindow.ts`
- `src/App.tsx`
- `src/utils/riskScoreEngine.ts`
- `src/utils/heatRisk.ts`
- `src/utils/getColdRisk.ts`
- `src/utils/windRisk.ts`
- `src/utils/uv.ts`
- `src/utils/riskTrend.ts`
- `tests/unit/risk.test.ts`

## Flux actual de workWindow

`App.tsx` construeix l'estat d'activitat exterior cridant `getWorkWindow()` amb dades ja calculades:

- `heatRisk`
- `heatIndex`
- `coldRisk`
- `windRisk`
- `uvi`
- `aemetActive || aemetSoon`
- `weatherMain`
- `preventiveActivity`
- `nocturnalHeat`

`getWorkWindow()` retorna un estat simple:

- `optimal`
- `caution`
- `limited`
- `avoid`

Aquest estat després s'utilitza per pintar la targeta `Activitat exterior` i generar el text amb `workWindowText()`.

## Inputs actuals de getWorkWindow

| Input | Origen | Ús dins workWindow |
|---|---|---|
| `heatRisk` | `getHeatRisk()` calculat fora | Calor alta/extrema, activitat amb calor |
| `heatIndex` | Sensació tèrmica / HI | Llindars directes `>= 27`, `>= 32`, `>= 41` |
| `coldRisk` | `getColdRisk()` calculat fora | Fred moderat, alt, molt alt, extrem |
| `windRisk` | `getWindRisk()` calculat fora | Vent moderat, fort, molt fort |
| `uvi` | OpenUV / UV actual | `getUvLevelIndex()` dins `workWindow` |
| `aemetActive` | AEMET actiu o proper | Eleva l'estat segons combinacions |
| `weatherMain` | OpenWeather | Pluja, plugim o tempesta |
| `activity` | Activitat preventiva | Precaució amb esforç si hi ha calor |
| `nocturnalHeat` | Lògica nocturna externa | Precaució per calor nocturna |

## Factors actuals

| Factor | Calculat dins workWindow? | Ja existeix al RiskScoreEngine? | Observacions |
|---|---:|---:|---|
| Calor | Parcialment | Sí | `workWindow` usa `heatRisk`, però també llindars directes de `heatIndex`. |
| Fred | No, rep `coldRisk` | Sí | El motor calcula fred amb `coldEffectiveTemp`. |
| Vent | No, rep `windRisk` | Sí | El motor calcula vent amb `windKmh`, però `workWindow` consumeix la categoria. |
| UV | Sí, amb `getUvLevelIndex(uvi)` | Sí | Hi ha duplicació directa de classificació UV. |
| AEMET | No | No | Context extern imprescindible. |
| Pluja/tempesta | Sí, des de `weatherMain` | No | No forma part del motor. |
| Calor nocturna | No, rep booleà | No | Context temporal extern. |
| Activitat física | Parcialment | Sí per calor | El motor incorpora activitat a `getHeatRisk`, però `workWindow` té una regla específica addicional. |
| Tendència | No | No | `riskTrend` és un sistema separat de previsió. |

## Taula de decisions

| Decisió workWindow | Font actual | Equivalent RiskScoreEngine | Preparada per migrar? | Observacions |
|---|---|---|---|---|
| AEMET + vent fort/molt fort -> `avoid` | `aemetActive`, `windRisk` | Només `wind` | No | El motor no coneix AEMET. |
| Fred extrem -> `avoid` | `coldRisk === "extrem"` | `cold` severity 4 | Sí, parcial | La decisió simple és equivalent, però cal conservar fallback. |
| Calor extrema -> `avoid` | `heatRisk.isExtreme` | `heat` severity 4 | Sí, parcial | Equivalent si l'input `heatIndex/activity` és el mateix. |
| Vent molt fort -> `avoid` | `windRisk === "very_strong"` | `wind` severity 4 | Sí, parcial | Equivalent de factor. |
| UV extrem -> `avoid` | `getUvLevelIndex(uvi) === 4` | `uv` severity 4 | Sí, parcial | Duplicació clara i migrable amb tests. |
| Fred + vent rellevant -> `limited/avoid` | `coldRisk`, `windRisk` | `cold` + `wind` | No encara | És una regla combinada, no només severitat màxima. |
| Heat index `>= 41` -> `avoid` | `heatIndex` | `heat` severity alta/extrema segons `getHeatRisk` | Revisar | Pot no ser exactament equivalent a `heatRisk.isExtreme`. |
| Heat index `>= 32` -> `limited` | `heatIndex` | `heat` severity 2+ | Revisar | Duplicació parcial dels llindars de calor. |
| `heatRisk.isHigh` -> `limited` | `heatRisk` | `heat` severity 3+ | Sí, parcial | Equivalent si severity mapping es manté. |
| Heat index `>= 27` -> `caution` | `heatIndex` | `heat` mild/moderate | Revisar | El motor pot classificar via activitat; cal paritat específica. |
| Activitat + calor no segura -> `caution` | `activity`, `heatRisk`, `heatIndex` | `heat` amb activitat | No encara | El motor incorpora activitat, però no exposa el motiu exacte. |
| Fred alt/molt alt -> `limited` | `coldRisk` | `cold` severity 3 | Sí, parcial | Compatible després de la paritat `molt alt = 3`. |
| Fred moderat -> `limited` | `coldRisk` | `cold` severity 2 | Sí, parcial | Migrable amb tests. |
| Vent fort -> `limited` | `windRisk === "strong"` | `wind` severity 3 | Sí, parcial | Migrable com a factor simple. |
| UV alt/molt alt -> `limited` | `uvLevel >= 3` | `uv` severity 3+ | Sí, parcial | Migrable com a factor simple. |
| AEMET + risc menor -> `limited` | `aemetActive`, fred/vent/UV/pluja | Parcial | No | AEMET i pluja queden fora del motor. |
| AEMET sol -> `caution` | `aemetActive` | No | No | Context extern. |
| Calor nocturna -> `caution` | `nocturnalHeat` | No | No | Context temporal extern. |
| Vent moderat -> `caution` | `windRisk === "moderate"` | `wind` severity 2 | Sí, parcial | Migrable com a factor simple. |
| UV moderat -> `caution` | `uvLevel >= 2` | `uv` severity 2 | Sí, parcial | Migrable com a factor simple. |
| Pluja/tempesta -> `caution` | `weatherMain` | No | No | Requereix context meteorològic textual. |
| Fred lleu -> `caution` | `coldRisk === "lleu"` | `cold` severity 1 | Sí, parcial | Migrable com a factor simple. |

## Duplicacions detectades

1. `workWindow` torna a calcular el nivell UV amb `getUvLevelIndex(uvi)`, mentre el `RiskScoreEngine` ja exposa el factor `uv`.

2. `workWindow` rep `windRisk` ja calculat i el motor també calcula `wind` amb `getWindRisk(windKmh)`.

3. `workWindow` rep `coldRisk` ja calculat i el motor també calcula `cold` amb `getColdRisk(coldEffectiveTemp)`.

4. La calor està duplicada parcialment: `workWindow` usa `heatRisk`, però també llindars directes sobre `heatIndex`.

5. `riskTrend.ts` manté una puntuació pròpia per tendència. No és part directa de `workWindow`, però és una tercera capa de criteri que convé mantenir documentada.

## Divergències o riscos

- `RiskScoreEngine.maxSeverity` no equival directament a `WorkWindowStatus`. Per exemple, `uv` severitat 3 dona `limited`, però `wind` severitat 3 també dona `limited`, mentre que combinacions com fred + vent poden pujar a `avoid`.

- L'ordre de factors actius del motor no pot substituir l'ordre de regles de `workWindow`. `workWindow` és una política de decisió, no només una priorització.

- AEMET té un paper amplificador que el motor no veu. Migrar massa aviat podria fer que una alerta oficial deixàs d'influir en l'activitat exterior.

- La pluja/tempesta es calcula a partir de `weatherMain` i no té equivalent al motor.

- La calor nocturna és context temporal i tampoc no existeix al motor.

- La regla d'activitat física amb calor utilitza `heatIndex`, `activity` i `heatRisk.class`. El motor aplica l'activitat dins `getHeatRisk`, però no exposa encara si el risc ve causat per activitat o per temperatura base.

## Què es pot migrar amb seguretat

Preparat per una migració parcial futura, sempre amb diagnòstic i fallback:

- Lectura del factor `uv` per evitar recalcular `getUvLevelIndex(uvi)` dins `workWindow`.
- Lectura del factor `wind` per decisions simples de vent moderat, fort o molt fort.
- Lectura del factor `cold` per decisions simples de fred lleu, moderat, alt, molt alt o extrem.
- Lectura del factor `heat` per decisions simples `isHigh/isExtreme`, però només després de tests específics de paritat amb `heatIndex`.

## Què no s'ha de migrar encara

- AEMET actiu o proper.
- Pluja, plugim i tempesta.
- Calor nocturna.
- Regles combinades fred + vent.
- Regles combinades AEMET + risc menor.
- Traducció de l'estat a text final.
- Substitució completa de `getWorkWindow()` per `RiskScoreEngine`.

## Recomanació per a FASE 6.1

No substituir `getWorkWindow()` encara.

La fase segura seria afegir una capa passiva opcional:

1. Passar `riskFactors` o `engineRisk` a `getWorkWindow()` com a prop opcional.
2. No usar-la encara per decidir.
3. En desenvolupament, comparar:
   - `uvLevel` actual vs factor `uv`;
   - `windRisk` actual vs factor `wind`;
   - `coldRisk` actual vs factor `cold`;
   - `heatRisk` actual vs factor `heat`.
4. Registrar només divergències en `import.meta.env.DEV`.
5. Després, migrar una decisió simple cada vegada, començant per UV.

Conclusió: `workWindow` està preparat per consumir parcialment el `RiskScoreEngine` com a font auxiliar de factors simples, però no està preparat per ser substituït. La part crítica que encara ha de quedar fora del motor és el context operatiu: AEMET, pluja/tempesta, nit i combinacions específiques.
