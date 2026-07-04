# Auditoria del factor calor dins workWindow

Data: 2026-07-04

## Resum executiu

La calor dins `getWorkWindow()` encara no convé migrar-la directament al `RiskScoreEngine`.

El motor ja calcula el factor `heat` amb `getHeatRisk(heatIndex, activity)`, però `workWindow` no consumeix només aquesta classificació. També aplica llindars directes de sensació tèrmica (`27`, `32`, `41`) i una regla específica d'activitat física amb `hi >= 24`.

Conclusió: la calor necessita una FASE 6.6 intermèdia de cablejat/diagnòstic o helper d'adaptació abans de migrar-la com s'ha fet amb UV, vent i fred.

## Fitxers revisats

- `src/utils/workWindow.ts`
- `src/utils/riskScoreEngine.ts`
- `src/utils/heatRisk.ts`
- `src/App.tsx`
- `tests/unit/risk.test.ts`

## Flux actual de calor

`App.tsx` calcula:

- `hi`, com a sensació tèrmica / heat index.
- `heatRisk`, amb `getHeatRisk(hi, preventiveActivity)`.
- `engineRisk`, amb `evaluateRiskScore({ heatIndex: hi, activity: preventiveActivity, ... })`.

Després passa a `getWorkWindow()`:

- `heatRisk`
- `heatIndex: hi`
- `activity: preventiveActivity`
- `engineRisk`

Actualment `getWorkWindow()` encara decideix calor amb `heatRisk`, `heatIndex` i `activity`; no consumeix el factor `heat` del motor.

## Regles de calor existents a workWindow

| Regla | Fitxer | Condició | Decisió | Usa | Cobreix RiskScoreEngine? | Estat |
|---|---|---|---|---|---|---|
| Calor extrema per `heatRisk` | `workWindow.ts` | `heatRisk?.isExtreme` | `avoid` | `heatRisk` | Sí, severity 4 / `level: "ext"` | ✅ preparada |
| Heat index extrem operatiu | `workWindow.ts` | `hi >= 41` | `avoid` | `heatIndex` | Parcialment. `getHeatRisk(41)` és `high`, no `ext` | 🟡 necessita fase intermèdia |
| Heat index moderat/alt operatiu | `workWindow.ts` | `hi >= 32` | `limited` | `heatIndex` | Sí, `getHeatRisk(32)` és `moderate` | ✅ preparada, amb tests |
| Calor alta per `heatRisk` | `workWindow.ts` | `heatRisk?.isHigh` | `limited` | `heatRisk` | Sí, severity 3+ | ✅ preparada |
| Heat index lleu | `workWindow.ts` | `hi >= 27` | `caution` | `heatIndex` | Sí, `getHeatRisk(27)` és `mild` | ✅ preparada |
| Activitat amb calor subllindar | `workWindow.ts` | `hi >= 24 && activity !== "rest" && heatRisk?.class !== "safe"` | `caution` | `heatIndex`, `activity`, `heatRisk` | Parcialment. El motor incorpora activitat, però no exposa el motiu | 🟡 necessita fase intermèdia |
| Calor nocturna | `workWindow.ts` | `nocturnalHeat` | `caution` | context extern | No | 🔴 no migrable en aquesta fase |

## Comparació amb getHeatRisk

`getBaseHeatRisk(st)` usa:

- `< 27` -> `safe`
- `27-31.9` -> `mild`
- `32-40.9` -> `moderate`
- `41-53.9` -> `high`
- `>= 54` -> `ext`

`getHeatRisk(st, activity)` aplica activitat:

- `rest` -> +0
- `walk` -> +1
- `moderate` -> +2
- `intense` -> +3

Però té límits preventius:

- si la base és `safe`, només pot pujar a `mild` quan `st >= 24`;
- si `st < 28`, l'activitat no pot passar de `mild`;
- si `st < 32`, l'activitat no pot passar de `moderate`.

## Duplicacions detectades

| Duplicació | Detall | Risc |
|---|---|---|
| `hi >= 27` vs `getHeatRisk(...).class === "mild"` | Equivalent en repòs i amb dades normals | Baix |
| `hi >= 32` vs `getHeatRisk(...).class === "moderate"` | Equivalent en repòs | Baix |
| `hi >= 41` vs `heatRisk.isHigh` | No equivalent: `41` és `high`, no `ext` | Mitjà |
| `heatRisk?.isHigh` i `hi >= 32` | Amb activitat, `heatRisk` pot ser més alt que el llindar directe | Mitjà |
| Regla `hi >= 24 && activity !== rest` | Molt lligada a la lògica d'activitat de `getHeatRisk` | Mitjà |

## Casos sensibles de regressió

| Escenari | Comportament actual | Risc si es migra directe |
|---|---|---|
| `hi = 26.4`, activitat intensa | `heatRisk` puja a `mild`; `workWindow` retorna `caution` | Si només es mira `heatIndex >= 27`, es perdria la precaució |
| `hi = 27.3`, repòs | `caution` per llindar directe | Migrable amb heat severity 1 |
| `hi = 31`, repòs | `caution` | Migrable amb heat severity 1 |
| `hi = 31`, activitat moderada/intensa | Pot pujar a `moderate`; `workWindow` pot limitar segons `heatRisk` | Cal preservar l'efecte activitat |
| `hi = 35`, repòs | `limited` | Migrable amb heat severity 2 |
| `hi = 41`, repòs | `avoid` per llindar directe | El motor dona `heat high` severity 3, no severity 4 |
| `hi = 45`, repòs | `avoid` per `hi >= 41`, tot i no ser `extreme` | Migració directa per severity podria baixar-ho a `limited` |
| `hi >= 54` | `avoid` per `heatRisk.isExtreme` | Migrable |

## Classificació de migrabilitat

| Regla | Classificació | Motiu |
|---|---|---|
| `heatRisk?.isExtreme` | ✅ preparada | El motor exposa `heat` `level: "ext"` i severity 4. |
| `hi >= 41` | 🟡 necessita fase intermèdia | `workWindow` tracta `41+` com `avoid`; el motor ho classifica com `high`, no `extreme`. |
| `hi >= 32` | ✅ preparada | El motor exposa `moderate` o superior. |
| `heatRisk?.isHigh` | ✅ preparada | El motor exposa `high/ext`. |
| `hi >= 27` | ✅ preparada | El motor exposa `mild` o superior. |
| `hi >= 24 + activity` | 🟡 necessita fase intermèdia | El motor incorpora activitat, però no exposa encara si la pujada ve de l'activitat. |
| `nocturnalHeat` | 🔴 no migrable | És context temporal extern al motor. |

## Recomanació

No recomanaria una migració directa de calor a la FASE 6.6.

La següent fase hauria de ser una fase intermèdia:

1. Afegir un helper intern a `workWindow`, per exemple `getHeatRiskFromEngine(engineRisk)`, però no substituir encara totes les regles.
2. Crear un `effectiveHeatRisk` des del motor quan estigui disponible, mantenint `heatRisk` com fallback.
3. Continuar deixant `hi >= 41` com a regla directa, perquè és una decisió operativa més estricta que el `RiskScoreEngine`.
4. Migrar només:
   - `heatRisk?.isExtreme`
   - `heatRisk?.isHigh`
   - comprovacions de classe `safe/mild/moderate/high/ext`
5. No migrar encara els llindars directes `hi >= 41`, `hi >= 32`, `hi >= 27` fins que es decideixi si `workWindow` ha de continuar sent més estricte que el motor.

Conclusió: la calor està parcialment preparada, però no totalment. El millor pas és una FASE 6.6 de cablejat controlat amb `effectiveHeatRisk`, preservant explícitament les regles directes de `heatIndex`.
