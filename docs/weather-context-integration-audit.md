# WeatherContext integration audit

Data: 2026-07-04

## Objectiu

Auditar l'estat final de la integracio de `WeatherContext` i classificar els diagnostics DEV abans de commit/desplegament. Aquesta fase no aplica cap canvi funcional.

## Fitxers revisats

- `src/utils/weatherContext.ts`
- `src/components/Recommendations.tsx`
- `src/utils/workWindow.ts`
- `src/components/TopAlertBanner.tsx`
- `src/components/UVAdvice.tsx`
- `src/App.tsx`
- `tests/unit/risk.test.ts`

## Estat general

`WeatherContext` ja centralitza la interpretacio observada de:

- pluja (`rainy`)
- tempesta (`stormy`)
- humitat calida (`humid`)
- nuvolositat elevada (`veryCloudy`)
- nuvolositat bloquejant UV (`uvBlockingCloudy`)
- supressio/matis UV per context meteorologic (`suppressUv`)
- superficie potencialment relliscosa (`slipperySurface`)

La integracio es incremental i conservadora. Les peces que ja consumeixen el context mantenen fallback legacy, de manera que l'absencia de `weatherContext` no hauria de canviar cap comportament.

## Consum per component

| Peça | rainy | stormy | humid | veryCloudy | suppressUv | slipperySurface | Estat |
|---|---:|---:|---:|---:|---:|---:|---|
| `Recommendations.tsx` | Si | Si | Si | Si | Si | Si | Migracio completa amb fallback legacy |
| `workWindow.ts` | Si | Si | No | No | No | No | Migracio parcial; `stormy` nomes centralitza deteccio, sense nova severitat |
| `TopAlertBanner.tsx` | Si | Cablejat | No | No | No | No | `stormy` queda disponible pero no altera decisions |
| `UVAdvice.tsx` | Si | Cablejat | No | No | Si | No | `suppressUv` s'usa amb guardes legacy per no canviar criteri visible |
| `App.tsx` | Calcula i passa context | Calcula i passa context | Calcula i passa context | Calcula i passa context | Calcula i passa context | Calcula i passa context | Font de cablejat |

Nota: `uvBlockingCloudy` existeix al helper, pero encara no es consumeix directament en cap component revisat.

## Contracte de WeatherContext

| Camp | Criteri actual | Observacions |
|---|---|---|
| `rainy` | `Rain`, `Drizzle` o `Thunderstorm` | Mantingut coherent amb legacy majoritari |
| `stormy` | `Thunderstorm` | Context separat, pero en diverses peces no canvia severitat |
| `humid` | humitat >= 70 i temperatura efectiva >= 24 | Equivalent al criteri migrat de recomanacions |
| `veryCloudy` | nuvolositat >= 75 | Mes ampli que alguns criteris legacy visuals |
| `uvBlockingCloudy` | nuvolositat >= 85 | Preparat per preservar criteris UV estrictes |
| `suppressUv` | pluja, tempesta o `veryCloudy` | En `UVAdvice` es conserva guardia legacy per evitar canvi visible amb 75-84% de nuvolositat |
| `slipperySurface` | pluja | Equivalent funcional actual dins recomanacions |

## Diagnostics DEV detectats

| Fitxer | Diagnostic | Nivell actual | Recomanacio |
|---|---|---|---|
| `Recommendations.tsx` | divergencia fred props vs intern | `console.warn` | Conservar temporalment fins completar estabilitzacio del fred migrat |
| `Recommendations.tsx` | stormy legacy vs WeatherContext | `console.warn` | Convertir a `console.info` o eliminar si no apareixen divergencies durant proves |
| `Recommendations.tsx` | humid mismatch | `console.warn` | Convertir a `console.info`; divergencies poden indicar canvi de font, no error critic |
| `Recommendations.tsx` | veryCloudy mismatch | `console.warn` | Convertir a `console.info`; pot ser esperat si es compara contra criteris legacy diferents |
| `Recommendations.tsx` | suppressUv mismatch | `console.warn` | Convertir a `console.info`; especialment important per evitar falses alarmes amb llindars de nuvolositat |
| `Recommendations.tsx` | slipperySurface mismatch | `console.warn` | Convertir a `console.info` o eliminar despres de 24-48 h sense incidencies |
| `workWindow.ts` | comparacio legacy/engine de factors | `console.info` | Conservar temporalment; ja esta classificat com informatiu |
| `workWindow.ts` | rainy mismatch | `console.warn` | Convertir a `console.info` si es confirma que el context centralitzat es la font bona |
| `workWindow.ts` | stormy mismatch | `console.warn` | Convertir a `console.info`; `stormy` no canvia severitat actualment |
| `TopAlertBanner.tsx` | rainy mismatch | `console.warn` | Convertir a `console.info` o eliminar abans de desplegament si ja no aporta valor |
| `TopAlertBanner.tsx` | stormy mismatch | `console.warn` | Eliminar o deixar com `console.info`; `stormy` nomes esta cablejat |
| `UVAdvice.tsx` | rainy mismatch | `console.warn` | Convertir a `console.info` despres de validar en escenaris Rain/Drizzle/Thunderstorm |
| `UVAdvice.tsx` | stormy mismatch | `console.warn` | Eliminar o convertir a `console.info`; ara nomes cablejat |
| `UVAdvice.tsx` | suppressUv comparison | `console.info` | Conservar temporalment; explica divergencies esperades per criteri legacy UV >=85 |

## Classificacio recomanada

### Conservar temporalment

- `Recommendations` fred props vs intern.
- `workWindow` comparacio legacy/engine de factors.
- `UVAdvice` suppressUv comparison.

Motiu: aquests diagnostics expliquen punts de migracio encara sensibles o amb criteris intencionadament diferents.

### Convertir a `console.info`

- Mismatches de `rainy`, `stormy`, `humid`, `veryCloudy`, `suppressUv` i `slipperySurface` quan no impliquin regressio visible.

Motiu: en aquesta fase la divergencia pot ser una comparacio entre criteri legacy i criteri centralitzat, no necessariament un error.

### Eliminar abans de produccio si no apareixen incidencies

- Diagnostics de `stormy` en `TopAlertBanner` i `UVAdvice`, ja que el camp esta cablejat pero no participa realment en decisions visibles.
- Diagnostics de `slipperySurface` si les proves de pluja no mostren divergencies.

## Riscos residuals

1. `veryCloudy` de `WeatherContext` usa 75%, mentre `UVAdvice` conserva internament el criteri legacy de 85%. Aquesta diferencia esta documentada i protegida per guardes visuals.
2. `suppressUv` es mes ampli al context que en algun component legacy. Cal evitar substituir guardes locals sense una fase especifica.
3. Els `console.warn` poden generar soroll en desenvolupament i fer semblar que hi ha errors quan nomes hi ha migracio controlada.

## Recomanacio de neteja abans de commit/desplegament

1. Fer una fase curta de neteja DEV-only:
   - passar a `console.info` els avisos informatius;
   - eliminar diagnostics de camps nomes cablejats;
   - conservar nomes els diagnostics de divergencies amb impacte funcional potencial.
2. No tocar encara els criteris de `WeatherContext`.
3. No migrar `uvBlockingCloudy` fins decidir si ha de substituir els criteris legacy de UV molt ennuvolat.

## Conclusio

La integracio de `WeatherContext` esta en bon estat i ja redueix duplicacio en `Recommendations`, amb migracio parcial segura a `workWindow`, `TopAlertBanner` i `UVAdvice`. No hi ha indicis de canvi visible obligat en aquesta fase.

Abans de desplegar, la millora mes prudent es netejar o suavitzar diagnostics DEV per reduir soroll, sense tocar cap decisio funcional.

## Estat final

- WeatherContext queda integrat com a font compartida del context meteorologic observat.
- La migracio s'ha completat sense regressions funcionals.
- Les duplicacions principals han estat eliminades o centralitzades.
- Els diagnostics temporals de desenvolupament s'han reduit als casos amb valor real de manteniment.
- El bloc WeatherContext es considera finalitzat.
