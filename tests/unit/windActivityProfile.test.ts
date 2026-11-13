import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import { getHeatRisk } from "../../src/utils/heatRisk";
import { getWindRisk } from "../../src/utils/windRisk";
import {
  getWindActivityRisk,
  parseWindActivityProfile,
  readWindActivityProfile,
  WIND_ACTIVITY_PROFILE_STORAGE_KEY,
  WIND_ACTIVITY_PROFILES,
  WIND_ACTIVITY_THRESHOLDS,
  writeWindActivityProfile,
  type WindActivityStorage,
} from "../../src/utils/windActivityProfile";

function makeStorage(initial?: [string, string]): WindActivityStorage & {
  values: Map<string, string>;
} {
  const values = new Map(initial ? [initial] : []);
  return {
    values,
    getItem(key) {
      return values.get(key) ?? null;
    },
    setItem(key, value) {
      values.set(key, value);
    },
  };
}

test("wind activity profile defaults to generic and validates stored values", () => {
  assert.equal(readWindActivityProfile(makeStorage()), "generic");
  assert.equal(readWindActivityProfile(makeStorage([WIND_ACTIVITY_PROFILE_STORAGE_KEY, "unknown"])), "generic");
  assert.equal(readWindActivityProfile(makeStorage([WIND_ACTIVITY_PROFILE_STORAGE_KEY, "poda"])), "poda");
  assert.equal(parseWindActivityProfile(null), "generic");
});

test("wind activity profile selection persists locally", () => {
  const storage = makeStorage();
  assert.equal(writeWindActivityProfile("trekking", storage), true);
  assert.equal(storage.values.get(WIND_ACTIVITY_PROFILE_STORAGE_KEY), "trekking");
  assert.equal(readWindActivityProfile(storage), "trekking");
});

test("every displayed wind activity profile is recognized", () => {
  assert.deepEqual(WIND_ACTIVITY_PROFILES.map(parseWindActivityProfile), [
    "generic", "jardineria", "poda", "altura", "obra", "neteja", "trekking", "oci",
  ]);
});

test("activity wind limits mirror the current backend profiles", () => {
  assert.deepEqual(WIND_ACTIVITY_THRESHOLDS, {
    generic: { moderate: 30, high: 45, veryHigh: 65 },
    jardineria: { moderate: 30, high: 45, veryHigh: 65 },
    poda: { moderate: 25, high: 40, veryHigh: 60 },
    altura: { moderate: 20, high: 35, veryHigh: 55 },
    obra: { moderate: 28, high: 45, veryHigh: 65 },
    neteja: { moderate: 30, high: 50, veryHigh: 70 },
    trekking: { moderate: 35, high: 50, veryHigh: 70 },
    oci: { moderate: 35, high: 50, veryHigh: 70 },
  });
  assert.equal(getWindActivityRisk(30, "generic"), "caution");
  assert.equal(getWindActivityRisk(45, "generic"), "elevated");
  assert.equal(getWindActivityRisk(65, "generic"), "avoid");
  for (const profile of WIND_ACTIVITY_PROFILES) {
    const limits = WIND_ACTIVITY_THRESHOLDS[profile];
    assert.equal(getWindActivityRisk(limits.moderate, profile), "caution", `${profile} moderate boundary`);
    assert.equal(getWindActivityRisk(limits.high, profile), "elevated", `${profile} high boundary`);
    assert.equal(getWindActivityRisk(limits.veryHigh, profile), "avoid", `${profile} very-high boundary`);
  }
});

test("activity profile gives a separate wind context without changing weather severity", () => {
  assert.equal(getWindRisk(38), "moderate");
  assert.equal(getWindActivityRisk(38, "altura"), "elevated");
  assert.equal(getWindActivityRisk(38, "generic"), "caution");
  assert.equal(getWindActivityRisk(38, "trekking"), "caution");
  assert.equal(getWindRisk(38), "moderate");

  // Phase 2A reference scenarios remain based on sustained wind only.
  assert.equal(getWindRisk(48.2), "strong");
  assert.equal(getWindActivityRisk(48.2, "altura"), "elevated");
  assert.equal(getWindRisk(51.8), "strong");
  assert.equal(getWindActivityRisk(51.8, "poda"), "elevated");
});

test("contextual wind advice is actionable and consistent in all supported languages", () => {
  const expected = {
    ca: {
      generic: "Comprova les condicions abans de fer activitats a l’exterior i assegura els objectes lleugers, sobretot en zones exposades.",
      altura: "Comprova les condicions abans de continuar. El vent pot fer-te perdre l’equilibri i dificultar el control de les eines i els materials.",
      poda: "Comprova si convé continuar. El vent pot moure les branques i dificultar el control de les eines.",
      trekking: "Adapta el recorregut i evita els trams exposats si el vent dificulta mantenir l’equilibri.",
      avoid: "No comencis una activitat exposada al vent o atura-la fins que les condicions siguin més segures.",
      elevated: "Precaució elevada",
    },
    es: {
      generic: "Comprueba las condiciones antes de realizar actividades al aire libre y asegura los objetos ligeros, sobre todo en zonas expuestas.",
      altura: "Comprueba las condiciones antes de continuar. El viento puede hacerte perder el equilibrio y dificultar el control de las herramientas y los materiales.",
      poda: "Comprueba si conviene continuar. El viento puede mover las ramas y dificultar el control de las herramientas.",
      trekking: "Adapta la ruta y evita los tramos expuestos si el viento dificulta mantener el equilibrio.",
      avoid: "No empieces una actividad expuesta al viento o detenla hasta que las condiciones sean más seguras.",
      elevated: "Precaución elevada",
    },
    eu: {
      generic: "Egiaztatu baldintzak aire zabaleko jarduerak egin aurretik, eta finkatu objektu arinak, batez ere eremu agerietan.",
      altura: "Egiaztatu baldintzak jarraitu aurretik. Haizeak oreka galtzea eta tresnak eta materialak kontrolatzea zaildu dezake.",
      poda: "Egiaztatu jarraitzea komeni den. Haizeak adarrak mugitu eta tresnak kontrolatzea zaildu dezake.",
      trekking: "Aldatu ibilbidea eta saihestu agerian dauden tarteak, haizeak oreka mantentzea zailtzen badu.",
      avoid: "Ez hasi haizepeko jarduera edo eten ezazu, baldintzak seguruagoak izan arte.",
      elevated: "Kontu handiz ibili",
    },
    gl: {
      generic: "Comproba as condicións antes de realizar actividades ao aire libre e asegura os obxectos lixeiros, sobre todo nas zonas expostas.",
      altura: "Comproba as condicións antes de continuar. O vento pode facerche perder o equilibrio e dificultar o control das ferramentas e dos materiais.",
      poda: "Comproba se convén continuar. O vento pode mover as pólas e dificultar o control das ferramentas.",
      trekking: "Adapta a ruta e evita os tramos expostos se o vento dificulta manter o equilibrio.",
      avoid: "Non comeces unha actividade exposta ao vento ou detena ata que as condicións sexan máis seguras.",
      elevated: "Precaución elevada",
    },
    en: {
      generic: "Check conditions before outdoor activities and secure lightweight items, especially in exposed areas.",
      altura: "Check conditions before continuing. Wind can make you lose your balance and make tools and materials harder to control.",
      poda: "Check whether it is advisable to continue. Wind can move branches and make tools harder to control.",
      trekking: "Adapt your route and avoid exposed sections if wind makes it difficult to keep your balance.",
      avoid: "Do not start an activity exposed to wind, or stop it if underway, until conditions are safer.",
      elevated: "Increased caution",
    },
  };

  for (const [lang, messages] of Object.entries(expected)) {
    const locale = JSON.parse(
      readFileSync(resolve(process.cwd(), `src/i18n/locales/${lang}.json`), "utf8")
    );
    assert.equal(locale.windActivity.advice.generic, messages.generic, `${lang} generic advice`);
    assert.equal(locale.windActivity.advice.altura, messages.altura, `${lang} work-at-height advice`);
    assert.equal(locale.windActivity.advice.poda, messages.poda, `${lang} pruning advice`);
    assert.equal(locale.windActivity.advice.trekking, messages.trekking, `${lang} trekking advice`);
    assert.equal(locale.windActivity.level.avoid, messages.avoid, `${lang} avoid-level advice`);
    assert.equal(locale.windActivity.level.elevated, messages.elevated, `${lang} elevated label`);
  }
});

test("low wind yields no activity warning, and heat activity calculation remains independent", () => {
  for (const profile of WIND_ACTIVITY_PROFILES) {
    assert.equal(getWindActivityRisk(14, profile), null);
    assert.equal(
      getWindActivityRisk(WIND_ACTIVITY_THRESHOLDS[profile].moderate - 0.1, profile),
      null,
      `${profile} should not display an activity note below its preventive threshold`
    );
    assert.equal(
      getHeatRisk(33, "moderate").class,
      "ext",
      `automatic heat intensity remains unchanged for ${profile}`
    );
  }
  assert.equal(getWindActivityRisk(null, "altura"), null);
});
