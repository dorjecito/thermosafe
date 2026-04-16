import * as React from "react";

type Lang = "ca" | "es" | "eu" | "gl" | "en";

type Props = {
  lat: number | null;
  lon: number | null;
  lang: Lang;
  uvi?: number | null;
};

type SkinType = "1" | "2" | "3" | "4" | "5" | "6";

const MAX_MINUTES = 480;
const MIN_UV_TO_SHOW_TIME = 3;

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
    moreThanMax: string;
    phototypes: Record<SkinType, string>;
  }
> = {
  ca: {
    title: "Exposició acumulada estimada",
    skinType: "Fototip",
    estimated: "Temps orientatiu",
    noRisk: "UVI baix o molt baix: el risc és mínim en condicions habituals.",
    night: "És de nit o no hi ha risc UV rellevant.",
    unknown: "No es pot estimar amb les dades actuals.",
    noteLow: "Protecció solar bàsica recomanable si l’exposició és prolongada.",
    noteModerate:
      "Estimació orientativa basada en índex UV actual. Aplica protecció solar i organitza pauses en hores centrals.",
    noteHigh:
      "Estimació orientativa basada en índex UV actual. Redueix exposició, reforça protecció i prioritza ombra.",
    moreThanMax: "> 8 h",
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
    noRisk: "UVI bajo o muy bajo: el riesgo es mínimo en condiciones habituales.",
    night: "Es de noche o no hay riesgo UV relevante.",
    unknown: "No se puede estimar con los datos actuales.",
    noteLow: "Protección solar básica recomendable si la exposición es prolongada.",
    noteModerate:
      "Estimación orientativa basada en el índice UV actual. Aplica protección solar y organiza pausas en horas centrales.",
    noteHigh:
      "Estimación orientativa basada en el índice UV actual. Reduce la exposición, refuerza la protección y prioriza la sombra.",
    moreThanMax: "> 8 h",
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
    noRisk: "UVI baxua edo oso baxua: arriskua minimoa da ohiko baldintzetan.",
    night: "Gaua da edo ez dago UV arrisku nabarmenik.",
    unknown: "Ezin da kalkulatu uneko datuekin.",
    noteLow: "Eguzki-babes oinarrizkoa gomendagarria da esposizioa luzea bada.",
    noteModerate:
      "UV indize aktualean oinarritutako gutxi gorabeherako estimazioa. Aplikatu eguzki-babesa eta antolatu atsedenak erdiko orduetan.",
    noteHigh:
      "UV indize aktualean oinarritutako gutxi gorabeherako estimazioa. Murriztu esposizioa, indartu babesa eta lehenetsi itzala.",
    moreThanMax: "> 8 h",
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
    noRisk: "UVI baixo ou moi baixo: o risco é mínimo en condicións habituais.",
    night: "É de noite ou non hai risco UV relevante.",
    unknown: "Non se pode estimar cos datos actuais.",
    noteLow: "Protección solar básica recomendable se a exposición é prolongada.",
    noteModerate:
      "Estimación orientativa baseada no índice UV actual. Aplica protección solar e organiza pausas nas horas centrais.",
    noteHigh:
      "Estimación orientativa baseada no índice UV actual. Reduce a exposición, reforza a protección e prioriza a sombra.",
    moreThanMax: "> 8 h",
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
    noRisk: "Low or very low UVI: risk is minimal under normal conditions.",
    night: "It is night-time or there is no relevant UV risk.",
    unknown: "Cannot estimate with current data.",
    noteLow: "Basic sun protection is recommended if exposure is prolonged.",
    noteModerate:
      "Approximate estimate based on current UV index. Apply sun protection and organise breaks around midday.",
    noteHigh:
      "Approximate estimate based on current UV index. Reduce exposure, reinforce protection and prioritise shade.",
    moreThanMax: "> 8 h",
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

function fmtMinutes(totalMinutes: number, lang: Lang, moreThanMax: string): string {
  if (totalMinutes > MAX_MINUTES) return moreThanMax;

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
  if (uvi < MIN_UV_TO_SHOW_TIME) return null;

  const basePhototype3 = 200 / uvi;
  const adjusted = basePhototype3 * UV_MULTIPLIER[skinType];

  return Math.max(5, adjusted);
}

export default function UVSafeTime({ lang, uvi }: Props) {
  const t = TXT[lang] ?? TXT.ca;
  const [skinType, setSkinType] = React.useState<SkinType>("3");

  const hasValidUvi = typeof uvi === "number" && Number.isFinite(uvi);
  const isNight = hasValidUvi && (uvi as number) <= 0;
  const shouldShowTime = hasValidUvi && (uvi as number) >= MIN_UV_TO_SHOW_TIME;

  const safeMinutes = shouldShowTime
    ? estimateSafeMinutes(uvi as number, skinType)
    : null;

  let note = t.unknown;
  if (hasValidUvi) {
    if ((uvi as number) <= 0) note = t.night;
    else if ((uvi as number) < MIN_UV_TO_SHOW_TIME) note = t.noRisk;
    else if ((uvi as number) < 6) note = t.noteLow;
    else if ((uvi as number) < 8) note = t.noteModerate;
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
          disabled={!shouldShowTime}
          style={{
            padding: "0.45rem 0.7rem",
            borderRadius: 8,
            border: "1px solid rgba(255,255,255,0.18)",
            background: "rgba(255,255,255,0.08)",
            color: "inherit",
            opacity: shouldShowTime ? 1 : 0.65,
          }}
        >
          {(Object.keys(t.phototypes) as SkinType[]).map((key) => (
            <option key={key} value={key}>
              {t.phototypes[key]}
            </option>
          ))}
        </select>

        <div style={{ fontWeight: 600 }}>
          {t.estimated}:{" "}
          {!hasValidUvi
            ? t.unknown
            : isNight
            ? t.night
            : !shouldShowTime
            ? "—"
            : safeMinutes != null
            ? fmtMinutes(safeMinutes, lang, t.moreThanMax)
            : t.unknown}
        </div>
      </div>

      <div style={{ opacity: 0.92, lineHeight: 1.5 }}>{note}</div>
    </div>
  );
}