import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { getAemetAlertTimelineState } from "../../src/utils/aemetAlertTimeline";
import Recommendations from "../../src/components/Recommendations";
import { composeWindActivityWorkWindowText } from "../../src/utils/composeWindActivityWorkWindowText";
import { getWindActivityRisk } from "../../src/utils/windActivityProfile";
import { getWindRisk } from "../../src/utils/windRisk";
import { getWorkWindow, getWorkWindowText, type WorkWindowLang } from "../../src/utils/workWindow";

const langs: WorkWindowLang[] = ["ca", "es", "eu", "gl", "en"];
const basicCaution: Record<WorkWindowLang, string> = {
  ca: "Es poden realitzar activitats a l’aire lliure amb precaucions bàsiques.",
  es: "Puedes hacer actividades al aire libre con precauciones básicas.",
  eu: "Kanpoko jarduerak egin daitezke oinarrizko neurriak hartuta.",
  gl: "Podes facer actividades ao aire libre con precaucións básicas.",
  en: "You can do outdoor activities with basic precautions.",
};
const activityCaution: Record<WorkWindowLang, string> = {
  ca: "Es poden realitzar activitats a l’aire lliure, però cal tenir en compte les precaucions específiques de l’activitat seleccionada.",
  es: "Puedes realizar actividades al aire libre, pero debes tener en cuenta las precauciones específicas de la actividad seleccionada.",
  eu: "Kanpoko jarduerak egin daitezke, baina hautatutako jardueraren berariazko neurriak kontuan hartu behar dira.",
  gl: "Podes realizar actividades ao aire libre, pero debes ter en conta as precaucións específicas da actividade seleccionada.",
  en: "You can do outdoor activities, but you should take into account the specific precautions for the selected activity.",
};

test("Fisterra: eight profiles use sustained wind and compose caution in five languages", () => {
  const timeline = getAemetAlertTimelineState([
    { start: 2000, end: 3000, event: "Costa y oleaje", severity: "Moderate" },
  ], 1000);
  assert.equal(timeline.aemetSoon, true);
  assert.equal(timeline.aemetActive, false);
  const input = { windRisk: getWindRisk(29.8), heatIndex: 16.1 };
  const level = getWorkWindow({ ...input, aemetActive: timeline.aemetActive });
  assert.equal(level, "caution");
  assert.equal(level, getWorkWindow(input));
  for (const lang of langs) {
    const general = getWorkWindowText(level, lang, timeline.aemetActive);
    assert.equal(general, basicCaution[lang]);
    // Return to profiles without a warning after each contextual warning.
    for (const profile of ["generic", "poda", "jardineria", "altura", "neteja", "obra", "trekking", "oci", "generic"] as const) {
      const risk = getWindActivityRisk(29.8, profile);
      const hasCaution = ["poda", "altura", "obra"].includes(profile);
      assert.equal(risk, hasCaution ? "caution" : null);
      assert.equal(composeWindActivityWorkWindowText(general, level, risk, lang),
        hasCaution ? activityCaution[lang] : general, `${lang}: ${profile}`);
    }
  }
});

test("activity and risk memo dependencies refresh displayed text without stale state", () => {
  const app = readFileSync("src/App.tsx", "utf8");
  assert.match(app, /getWindActivityRisk\(windKmh, windActivityProfile\),\s*\[windKmh, windActivityProfile\]/);
  const composition = app.slice(app.indexOf("const workWindowText = useMemo("), app.indexOf("const workWindowText = useMemo(") + 800);
  assert.match(composition, /composeWindActivityWorkWindowText\([\s\S]*windActivityRisk,/);
  assert.match(composition, /\[[^\]]*windActivityRisk\]/);
});

test("future coastal warning does not alter current preventive wind recommendations", () => {
  for (const lang of langs) {
    // Wind-only advice and wind advice alongside another factor use different copy.
    for (const uvi of [0, 3]) {
      const props = { temp: 16.1, coldEffectiveTemp: 16.1, windKmh: 29.8, lang, isDay: true, uvi };
      const current = Recommendations(props);
      const future = Recommendations({ ...props, aemetActive: false, aemetSoon: true, alertType: "Costa y oleaje" });
      assert.deepEqual(future.props, current.props);
      if (lang === "ca" && uvi === 3) {
        assert.ok(JSON.stringify(current.props).includes("Extrema la precaució en zones exposades"));
      }
    }
  }
});

test("contextual caution preserves restrictive and specific general messages in every language", () => {
  for (const lang of langs) {
    for (const level of ["optimal", "limited", "avoid"] as const) {
      const general = getWorkWindowText(level, lang);
      assert.equal(composeWindActivityWorkWindowText(general, level, "caution", lang), general);
    }
    const official = getWorkWindowText("caution", lang, true, undefined, true);
    const heat = getWorkWindowText("caution", lang, false, undefined, false, false, "moderate", "heat");
    for (const general of [official, heat]) {
      assert.notEqual(general, basicCaution[lang]);
      assert.equal(composeWindActivityWorkWindowText(general, "caution", "caution", lang), general);
    }
  }
});

test("42.6 km/h contextual elevated risk is reflected for pruning and height", () => {
  const windRisk = getWindRisk(42.6);
  const generalLevel = getWorkWindow({ windRisk });
  assert.equal(windRisk, "moderate");
  assert.equal(generalLevel, "caution");
  for (const profile of ["poda", "altura"] as const) {
    const level = getWindActivityRisk(42.6, profile);
    assert.equal(level, "elevated");
    const existingText = getWorkWindowText(generalLevel, "ca");
    const text = composeWindActivityWorkWindowText(existingText, generalLevel, level, "ca");
    assert.equal(text, "El vent requereix precaucions addicionals per a l’activitat seleccionada. Consulta les recomanacions específiques.");
  }
});

test("generic profile also uses contextual caution wording when its existing threshold is reached", () => {
  const generalLevel = getWorkWindow({ windRisk: getWindRisk(42.6) });
  const risk = getWindActivityRisk(42.6, "generic");
  assert.equal(risk, "caution");
  assert.equal(composeWindActivityWorkWindowText(getWorkWindowText(generalLevel, "ca"), generalLevel, risk, "ca"), activityCaution.ca);
});

test("avoid contextual risk replaces a less restrictive generic message", () => {
  const risk = getWindActivityRisk(60, "poda");
  assert.equal(risk, "avoid");
  assert.match(composeWindActivityWorkWindowText(getWorkWindowText("limited", "ca"), "limited", risk, "ca"), /^El vent pot fer necessari aturar o ajornar/);
  assert.match(composeWindActivityWorkWindowText(getWorkWindowText("optimal", "ca"), "optimal", risk, "ca"), /^El vent pot fer necessari aturar o ajornar/);
});

test("higher-priority heat, cold, UV and AEMET messages are preserved", () => {
  for (const text of [
    "Calor: adapta l’esforç i fes pauses regulars.",
    "Fred: protegeix-te i limita l’exposició.",
    "UV: busca l’ombra i protegeix la pell.",
    "Hi ha un avís meteorològic oficial actiu. Consulta’n el detall.",
  ]) {
    const result = composeWindActivityWorkWindowText(text, "caution", "elevated", "ca");
    assert.ok(result.startsWith(text));
    assert.match(result, /vent/);
  }
});

test("absent risk or non-generic text leaves the general message unchanged", () => {
  assert.equal(composeWindActivityWorkWindowText("General", "caution", null, "ca"), "General");
  assert.equal(composeWindActivityWorkWindowText("General", "caution", "caution", "ca"), "General");
});

test("elevated and avoid copy is available in all five languages", () => {
  const expectedElevated = [
    "El vent requereix precaucions addicionals per a l’activitat seleccionada. Consulta les recomanacions específiques.",
    "El viento requiere precauciones adicionales para la actividad seleccionada. Consulta las recomendaciones específicas.",
    "Haizeak neurri gehiago hartzea eskatzen du hautatutako jarduerarako. Kontsultatu gomendio espezifikoak.",
    "O vento require precaucións adicionais para a actividade seleccionada. Consulta as recomendacións específicas.",
    "Wind requires extra precautions for the selected activity. Check the specific recommendations.",
  ];
  const expectedAvoid = [
    "El vent pot fer necessari aturar o ajornar l’activitat seleccionada. Consulta el consell específic.",
    "El viento puede hacer necesario detener o aplazar la actividad seleccionada. Consulta el consejo específico.",
    "Haizearen ondorioz, hautatutako jarduera eten edo atzeratu behar izatea gerta daiteke. Kontsultatu aholku espezifikoa.",
    "O vento pode facer necesario deter ou aprazar a actividade seleccionada. Consulta o consello específico.",
    "Wind may make it necessary to stop or postpone the selected activity. Check the specific advice.",
  ];
  langs.forEach((lang, index) => {
    assert.equal(composeWindActivityWorkWindowText(basicCaution[lang], "caution", "elevated", lang), expectedElevated[index]);
    assert.equal(composeWindActivityWorkWindowText(basicCaution[lang], "caution", "avoid", lang), expectedAvoid[index]);
  });
  assert.doesNotMatch(expectedElevated[0], /Comprova les condicions abans de continuar/);
});

test("an already avoid-level general message is never weakened", () => {
  const general = getWorkWindowText("avoid", "ca");
  assert.equal(composeWindActivityWorkWindowText(general, "avoid", "avoid", "ca"), general);
});
