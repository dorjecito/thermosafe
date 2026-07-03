# RiskScoreEngine audit

Data: 2026-07-03

## Objectiu

Aquest document compara la seleccio de risc principal actual (`pickPrimaryRisk`) amb el nou motor paral.lel (`evaluateRiskScore`).

La fase es nomes d'analisi. No proposa cap canvi aplicat ni substitueix cap flux existent de ThermoSafe.

## Fitxers revisats

- `src/utils/PickPrimaryRisk.ts`
- `src/utils/riskScoreEngine.ts`
- `src/utils/heatRisk.ts`
- `src/utils/getColdRisk.ts`
- `src/utils/windRisk.ts`
- `src/utils/uv.ts`
- `src/App.tsx`
- `tests/unit/risk.test.ts`

## Criteri actual: `pickPrimaryRisk`

`pickPrimaryRisk` calcula internament quatre severitats:

- calor: a partir de `hi` i, si existeix, `heatRiskClass`.
- fred: a partir de `effForCold`.
- vent: a partir de `windRisk`.
- UV: a partir de `getUvLevelIndex(uvi)`.

Despres ordena els candidats per:

1. major severitat;
2. empat: calor > fred > vent fort/molt fort > UV > vent moderat/lleu.

L'ordre d'empat actual queda codificat com:

```text
heat: 5
cold: 4
strong/very strong wind: 3
uv: 2
moderate/breezy wind: 1
```

## Criteri del RiskScoreEngine

`evaluateRiskScore` reutilitza helpers existents:

- calor: `getHeatRisk`
- fred: `getColdRisk`
- UV: `getUvLevelIndex`
- vent: `getWindRisk`

Retorna:

- `factors`
- `activeFactors`
- `activeFactorsSorted`
- `primary`
- `maxSeverity`

L'ordre d'empat del motor nou queda alineat amb `pickPrimaryRisk` des de la FASE 2.4:

```text
aemet > heat > cold > strong/very strong wind > uv > moderate/breezy wind > other
```

Nota: `aemet` existeix com a tipus futur, pero encara no s'avalua dins `evaluateRiskScore`.

## Taula de divergencies

| Escenari | Sistema actual | Motor nou | Impacte visible si es connectes avui | Recomanacio |
| --- | --- | --- | --- | --- |
| UV alt + vent moderat amb la mateixa severitat | Prioritza `uv` des de FASE 2.4 | Prioritza `uv` | Canvi visible controlat: en empats UV vs vent moderat, la targeta principal pot passar a destacar UV. | Decisio aplicada. Es manté vent per damunt d'UV quan el vent es fort o molt fort. |
| Fred `molt alt` (`effForCold <= -25` i `> -40`) | Severitat 3 (`cold_very_high`) | Severitat 3 (`cold_very_high`) des de FASE 2.3 | Cap impacte visible previst: el motor ja manté paritat amb el criteri actual. | Divergencia resolta al motor nou. No cal tocar `pickPrimaryRisk`. |
| Vent `extreme` passat manualment a `pickPrimaryRisk` | Accepta `extreme` com severitat 4 | El motor no te `extreme` dins `WindRisk` perque `getWindRisk` no el retorna | Sense impacte visible actual: `App.tsx` usa `getWindRisk`, que nomes retorna `none`, `breezy`, `moderate`, `strong`, `very_strong`. | No tocar ara. Si algun dia s'afegeix vent extrem real, ampliar `WindRisk` primer. |
| Alertes oficials AEMET | No formen part de `pickPrimaryRisk`; es prioritzen a `getPrimaryStatusBlock` i afecten `workWindow` | Tipus `aemet` reservat, pero sense input ni calcul actual | Cap divergencia directa entre aquests dos motors, pero podria haver-hi confusio si en el futur el motor preten decidir riscos oficials. | Mantindre AEMET fora del motor fins definir contracte clar, o afegir-lo en una fase especifica amb tests propis. |

## Casos sense divergencia detectada

| Escenari | Resultat observat |
| --- | --- |
| Sense risc | Tots dos sistemes retornen cap risc principal i severitat 0. |
| Calor moderada | Tots dos identifiquen calor amb severitat 2. |
| Calor alta | Tots dos identifiquen calor amb severitat 3. |
| UV moderat | Tots dos identifiquen UV amb severitat 1. |
| UV alt | Tots dos identifiquen UV amb severitat 2 si no hi ha empat amb vent. |
| UV molt alt | Tots dos identifiquen UV amb severitat 3 si no hi ha un factor de la mateixa severitat amb preferencia superior. |
| Vent moderat aillat | Tots dos identifiquen vent amb severitat 2. |
| Fred moderat | Tots dos identifiquen fred amb severitat 2. |
| Calor + UV amb empat | Tots dos prioritzen calor. |
| Calor alta + UV molt alt + vent moderat | Tots dos prioritzen calor si calor i UV empaten a severitat 3. |
| UV alt + vent moderat | Tots dos prioritzen UV des de FASE 2.4. |
| UV moderat + vent fort | Tots dos prioritzen vent. |

## Causa probable de les divergencies

### 1. Empat UV + vent

La divergencia queda resolta en FASE 2.4 amb una decisio preventiva explicita:

- UV te prioritat sobre vent quan empaten i el vent es lleu o moderat.
- Vent continua tenint prioritat sobre UV quan el vent es fort o molt fort, o quan te severitat superior.

El criteri evita que un vent moderat amagui un risc UV rellevant durant exposicio diurna, pero conserva el pes preventiu del vent quan ja es un risc fort.

### 2. Fred molt alt

`pickPrimaryRisk` te llindars duplicats per fred:

```text
<= -15 => severity 3, cold_high
<= -25 => severity 3, cold_very_high
<= -40 => severity 4, cold_extreme
```

`evaluateRiskScore` reutilitza `getColdRisk` i despres mapeja:

```text
alt => 3
molt alt => 3
extrem => 4
```

A partir de la FASE 2.3, `molt alt` ja queda alineat amb el sistema actual. Abans de la FASE 2.3, el motor nou el mapejava com severitat 4; aquesta divergencia queda resolta sense tocar llindars ni comportament visible.

## Impacte visible potencial

`evaluateRiskScore` encara no alimenta cap targeta ni recomanacio. Nomes s'executa en mode desenvolupament dins `App.tsx` i registra divergencies amb `console.warn`.

Impacte visible de FASE 2.4:

- en empats UV alt vs vent moderat, la targeta principal pot destacar UV;
- si el vent es fort o molt fort, continua destacant vent;
- fred molt alt ja no guanya prioritat artificial sobre riscos de severitat 3, perque el motor nou el mante com severitat 3;
- AEMET podria quedar conceptualment duplicat si s'afegeix al motor sense coordinar-lo amb `getPrimaryStatusBlock`.

## Possibles inconsistencies futures

- UI vs notificacions: Cloud Functions poden tenir mapatges de severitat propis i no usar `RiskScoreEngine`.
- Client vs Cloud Functions: el client pot prioritzar UV en empat mentre les notificacions podrien prioritzar vent o calor.
- `getPrimaryStatusBlock` vs `Recommendations`: encara poden consumir criteris diferents si nomes una part migra al motor.
- `workWindow` vs motor: activitat exterior te una logica propia i no s'ha comparat encara amb `activeFactorsSorted`.
- AEMET: alertes oficials tenen prioritat visual separada; integrar-les al motor requeriria una fase especifica.
- Fred: `getColdRisk`, `pickPrimaryRisk`, recomanacions i notificacions haurien de compartir una mateixa escala abans de migrar completament.

## Recomanacions sense implementar

1. L'ordre d'empat UV vs vent queda decidit en FASE 2.4:
   - `heat > cold > strong/very strong wind > uv > moderate/breezy wind`;
   - mantenir aquest criteri en qualsevol connexio futura del motor.

2. Mapatge de fred `molt alt`:
   - la revisio de FASE 2.2 indica que la UI actual tracta `alt` i `molt alt` com a risc alt, i nomes `extrem` com a risc extrem;
   - la FASE 2.3 ja ajusta el `RiskScoreEngine` per fer `molt alt => 3`;
   - no es recomana corregir `pickPrimaryRisk`.

3. No integrar AEMET dins `RiskScoreEngine` fins definir si el motor ha de representar:
   - nomes riscos meteorologics locals calculats;
   - o tambe avisos oficials.

4. Mantenir el diagnositic DEV activat temporalment per recollir casos reals abans de qualsevol connexio funcional.

## Classificacio

| Divergencia | Tipus | Severitat tecnica | Possible bug real |
| --- | --- | --- | --- |
| UV + vent en empat | Decisio de prioritzacio aplicada en FASE 2.4 | Baixa-Mitjana | No; canvi visible controlat i documentat. |
| Fred `molt alt` | Inconsistencia de mapatge resolta en FASE 2.3 | Baixa | No queda bug actiu al motor nou; era una divergencia de paritat. |
| Vent `extreme` | Codi permissiu no usat | Baixa | No actualment. |
| AEMET reservat al motor | Arquitectura futura incompleta | Baixa | No actualment. |

## Conclusio

La implementacio paral.lela del `RiskScoreEngine` es estable per als casos principals. L'ordre definitiu dels empats UV vs vent queda decidit i aplicat en FASE 2.4.

La divergencia UV + vent queda resolta aplicant el criteri preventiu triat. La divergencia de fred `molt alt` queda resolta en FASE 2.3 ajustant el motor nou a la severitat actual.

## Annex FASE 2.2: revisio de fred molt alt

### Tests afegits

S'han afegit proves especifiques per comparar `getColdRisk`, `pickPrimaryRisk` i `evaluateRiskScore` en aquests casos:

| Cas | Temperatura efectiva | `getColdRisk` | `pickPrimaryRisk` | `evaluateRiskScore` |
| --- | ---: | --- | --- | --- |
| Fred lleu | 0 C | `lleu` | severitat 1 | severitat 1 |
| Fred moderat | -5 C | `moderat` | severitat 2 | severitat 2 |
| Fred alt | -15 C | `alt` | severitat 3 | severitat 3 |
| Fred molt alt | -25 C | `molt alt` | severitat 3 | severitat 3 des de FASE 2.3 |
| Fred extrem | -40 C | `extrem` | severitat 4 | severitat 4 |

També s'ha documentat el cas combinat `fred molt alt + vent moderat`:

- `pickPrimaryRisk`: `cold`, severitat 3, `cold_very_high`.
- `evaluateRiskScore`: `cold`, severitat 3, `cold_very_high`, amb vent moderat com a factor secundari.

### Conclusio tecnica

La divergencia detectada en FASE 2.2 no venia dels llindars de `getColdRisk`, sino del mapatge de severitat:

- `pickPrimaryRisk` considera `cold_very_high` com severitat 3.
- `RiskScoreEngine` considerava `molt alt` com severitat 4 abans de FASE 2.3.

La resta de la UI reforca el criteri de `pickPrimaryRisk`: a `getPrimaryStatusBlock`, `alt` i `molt alt` es presenten com risc alt per fred, mentre que nomes `extrem` es presenta com risc extrem.

### Criteri mes coherent

El criteri mes coherent amb el comportament visible actual es:

```text
lleu      => 1
moderat   => 2
alt       => 3
molt alt  => 3
extrem    => 4
```

### Recomanacio aplicada en FASE 2.3

No corregir `pickPrimaryRisk`. Per eliminar la divergencia sense canviar la UI, s'ha aplicat el canvi minim al motor nou:

```ts
// src/utils/riskScoreEngine.ts
const coldSeverityByRisk: Record<ColdRisk, RiskSeverity> = {
  cap: 0,
  lleu: 1,
  moderat: 2,
  alt: 3,
  "molt alt": 3,
  extrem: 4,
};
```

Aquesta correccio fa que el motor nou respecti la severitat actual abans de qualsevol connexio funcional.
