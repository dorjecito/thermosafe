import assert from "node:assert/strict";
import test from "node:test";
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

test("generic profile keeps the existing general caution wording", () => {
  const generalLevel = getWorkWindow({ windRisk: getWindRisk(42.6) });
  const risk = getWindActivityRisk(42.6, "generic");
  assert.equal(risk, "caution");
  assert.equal(composeWindActivityWorkWindowText(getWorkWindowText(generalLevel, "ca"), generalLevel, risk, "ca"), basicCaution.ca);
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

test("absent or caution contextual risk leaves the general message unchanged", () => {
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
