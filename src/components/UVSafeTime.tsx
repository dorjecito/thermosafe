import * as React from "react";

type Lang = "ca" | "es" | "eu" | "gl" | "en";

type Props = {
  lat: number | null;
  lon: number | null;
  lang: Lang;
  uvi?: number | null;
};

type SkinType = "1" | "2" | "3" | "4" | "5" | "6";

const TXT: Record<
  Lang,
  {
    title: string;
    skinType: string;
    estimated: string;
    noRisk: string;
    night: string;
    unknown: string;
    noteLow: string;
    noteModerate: string;
    noteHigh: string;
    phototypes: Record<SkinType, string>;
  }
> = {
  ca: {
    title: "Exposició acumulada estimada",
    skinType: "Fototip",
    estimated: "Temps orientatiu",
    noRisk: "UVI molt baix: risc mínim per a jornada laboral habitual.",
    night: "És de nit o no hi ha risc UV rellevant.",
    unknown: "No es pot estimar amb les dades actuals.",
    noteLow: "Estimació orientativa basada en índex UV actual. Aplica protecció solar bàsica.",
    noteModerate:
      "Estimació orientativa basada en índex UV actual. Aplica protecció solar i organitza pauses en hores centrals.",
    noteHigh:
      "Estimació orientativa basada en índex UV actual. Redueix exposició, reforça protecció i prioritza ombra.",
    phototypes: {
      "1": "Tipus 1",
      "2": "Tipus 2",
      "3": "Tipus 3",
      "4": "Tipus 4",
      "5": "Tipus 5",
      "6": "Tipus 6",
    },
  },
  es: {
    title: "Exposición acumulada estimada",
    skinType: "Fototipo",
    estimated: "Tiempo orientativo",
    noRisk: "UVI muy bajo: riesgo mínimo para una jornada laboral habitual.",
    night: "Es de noche o no hay riesgo UV relevante.",
    unknown: "No se puede estimar con los datos actuales.",
    noteLow: "Estimación orientativa basada en el índice UV actual. Aplica protección solar básica.",
    noteModerate:
      "Estimación orientativa basada en el índice UV actual. Aplica protección solar y organiza pausas en horas centrales.",
    noteHigh:
      "Estimación orientativa basada en el índice UV actual. Reduce la exposición, refuerza la protección y prioriza la sombra.",
    phototypes: {
      "1": "Tipo 1",
      "2": "Tipo 2",
      "3": "Tipo 3",
      "4": "Tipo 4",
      "5": "Tipo 5",
      "6": "Tipo 6",
    },
  },
  eu: {
    title: "Metatutako esposizio estimatua",
    skinType: "Fototipoa",
    estimated: "Gutxi gorabeherako denbora",
    noRisk: "UVI oso baxua: ohiko lanaldi baterako arrisku minimoa.",
    night: "Gaua da edo ez dago UV arrisku nabarmenik.",
    unknown: "Ezin da kalkulatu uneko datuekin.",
    noteLow: "UV indize aktualean oinarritutako gutxi gorabeherako estimazioa. Aplikatu oinarrizko eguzki-babesa.",
    noteModerate:
      "UV indize aktualean oinarritutako gutxi gorabeherako estimazioa. Aplikatu eguzki-babesa eta antolatu atsedenak erdiko orduetan.",
    noteHigh:
      "UV indize aktualean oinarritutako gutxi gorabeherako estimazioa. Murriztu esposizioa, indartu babesa eta lehenetsi itzala.",
    phototypes: {
      "1": "1 mota",
      "2": "2 mota",
      "3": "3 mota",
      "4": "4 mota",
      "5": "5 mota",
      "6": "6 mota",
    },
  },
  gl: {
    title: "Exposición acumulada estimada",
    skinType: "Fototipo",
    estimated: "Tempo orientativo",
    noRisk: "UVI moi baixo: risco mínimo para unha xornada laboral habitual.",
    night: "É de noite ou non hai risco UV relevante.",
    unknown: "Non se pode estimar cos datos actuais.",
    noteLow: "Estimación orientativa baseada no índice UV actual. Aplica protección solar básica.",
    noteModerate:
      "Estimación orientativa baseada no índice UV actual. Aplica protección solar e organiza pausas nas horas centrais.",
    noteHigh:
      "Estimación orientativa baseada no índice UV actual. Reduce a exposición, reforza a protección e prioriza a sombra.",
    phototypes: {
      "1": "Tipo 1",
      "2": "Tipo 2",
      "3": "Tipo 3",
      "4": "Tipo 4",
      "5": "Tipo 5",
      "6": "Tipo 6",
    },
  },
  en: {
    title: "Estimated cumulative exposure",
    skinType: "Skin type",
    estimated: "Estimated time",
    noRisk: "Very low UVI: minimal risk for a typical workday.",
    night: "It is night-time or there is no relevant UV risk.",
    unknown: "Cannot estimate with current data.",
    noteLow: "Approximate estimate based on current UV index. Apply basic sun protection.",
    noteModerate:
      "Approximate estimate based on current UV index. Apply sun protection and organise breaks around midday.",
    noteHigh:
      "Approximate estimate based on current UV index. Reduce exposure, reinforce protection and prioritise shade.",
    phototypes: {
      "1": "Type 1",
      "2": "Type 2",
      "3": "Type 3",
      "4": "Type 4",
      "5": "Type 5",
      "6": "Type 6",
    },
  },
};

const UV_MULTIPLIER: Record<SkinType, number> = {
  "1": 0.67,
  "2": 0.83,
  "3": 1,
  "4": 1.33,
  "5": 1.67,
  "6": 2,
};

function fmtMinutes(totalMinutes: number, lang: Lang): string {
  const mins = Math.max(1, Math.round(totalMinutes));
  const h = Math.floor(mins / 60);
  const m = mins % 60;

  if (lang === "en") {
    if (h > 0 && m > 0) return `${h} h ${m} min`;
    if (h > 0) return `${h} h`;
    return `${m} min`;
  }

  if (h > 0 && m > 0) return `${h} h ${m} min`;
  if (h > 0) return `${h} h`;
  return `${m} min`;
}

function estimateSafeMinutes(uvi: number, skinType: SkinType): number | null {
  if (!Number.isFinite(uvi) || uvi <= 0) return null;
  if (uvi < 2) return 480;

  const basePhototype3 = 200 / uvi;
  const adjusted = basePhototype3 * UV_MULTIPLIER[skinType];
  return Math.max(5, Math.min(480, adjusted));
}

export default function UVSafeTime({ lang, uvi }: Props) {
  const t = TXT[lang] ?? TXT.ca;
  const [skinType, setSkinType] = React.useState<SkinType>("3");

  const safeMinutes =
    typeof uvi === "number" && Number.isFinite(uvi)
      ? estimateSafeMinutes(uvi, skinType)
      : null;

  let note = t.unknown;
  if (typeof uvi === "number" && Number.isFinite(uvi)) {
    if (uvi < 2) note = t.noRisk;
    else if (uvi < 6) note = t.noteLow;
    else if (uvi < 8) note = t.noteModerate;
    else note = t.noteHigh;
  }

  return (
    <div
      style={{
        marginTop: 10,
        padding: "0.85rem",
        borderRadius: 12,
        border: "1px solid rgba(255,255,255,0.12)",
        background: "rgba(255,255,255,0.04)",
      }}
    >
      <div style={{ fontWeight: 700, marginBottom: 10 }}>{t.title}</div>

      <div
        style={{
          display: "flex",
          gap: 12,
          alignItems: "center",
          flexWrap: "wrap",
          marginBottom: 10,
        }}
      >
        <label htmlFor="uv-skin-type" style={{ fontWeight: 600 }}>
          {t.skinType}:
        </label>

        <select
          id="uv-skin-type"
          value={skinType}
          onChange={(e) => setSkinType(e.target.value as SkinType)}
          style={{
            padding: "0.45rem 0.7rem",
            borderRadius: 8,
            border: "1px solid rgba(255,255,255,0.18)",
            background: "rgba(255,255,255,0.08)",
            color: "inherit",
          }}
        >
          {(
            Object.keys(t.phototypes) as SkinType[]
          ).map((key) => (
            <option key={key} value={key}>
              {t.phototypes[key]}
            </option>
          ))}
        </select>

        <div style={{ fontWeight: 600 }}>
          {t.estimated}:{" "}
          {typeof uvi !== "number" || !Number.isFinite(uvi)
            ? t.unknown
            : uvi <= 0
            ? t.night
            : safeMinutes != null
            ? fmtMinutes(safeMinutes, lang)
            : t.unknown}
        </div>
      </div>

      <div style={{ opacity: 0.92, lineHeight: 1.5 }}>{note}</div>
    </div>
  );
}