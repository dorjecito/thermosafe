import React, { useMemo } from "react";

export type Lang = "ca" | "es" | "eu" | "gl" | "en";
export type SkinType = 1 | 2 | 3 | 4 | 5 | 6;

type Props = {
  lang: Lang;
  value: SkinType;
  onChange: (v: SkinType) => void;
};

const COLORS: Record<SkinType, string> = {
  1: "#E03E2D", // molt alt risc (vermell)
  2: "#F88C2B", // alt (taronja)
  3: "#F9D648", // moderat (groc)
  4: "#6EC664", // baix-moderat (verd)
  5: "#2E8B57", // baix (verd fosc)
  6: "#4B5563", // molt baix (gris)
};

const TEXT: Record<Lang, {
  title: string;
  label: string;
  types: Record<SkinType, string>;
  desc: Record<SkinType, string>;
}> = {
  ca: {
    title: "🧴 Informació del fototip",
    label: "Fototip",
    types: {
      1: "Tipus 1 — Molt clara",
      2: "Tipus 2 — Clara",
      3: "Tipus 3 — Mitjana",
      4: "Tipus 4 — Oliva",
      5: "Tipus 5 — Fosca",
      6: "Tipus 6 — Molt fosca",
    },
    desc: {
      1: "Sempre es crema, mai es bronzega. Risc molt alt de cremada.",
      2: "Es crema sovint, es bronzega poc. Risc alt.",
      3: "Es crema a vegades, es bronzega gradualment. Risc moderat.",
      4: "Es crema rarament, es bronzega fàcil. Risc baix-moderat.",
      5: "Gairebé mai es crema, es bronzega molt fàcil. Risc baix.",
      6: "Mai es crema. Pigmentació molt alta. Risc molt baix.",
    },
  },
  es: {
    title: "🧴 Información del fototipo",
    label: "Fototipo",
    types: {
      1: "Tipo 1 — Muy clara",
      2: "Tipo 2 — Clara",
      3: "Tipo 3 — Media",
      4: "Tipo 4 — Oliva",
      5: "Tipo 5 — Oscura",
      6: "Tipo 6 — Muy oscura",
    },
    desc: {
      1: "Siempre se quema, nunca se broncea. Riesgo muy alto.",
      2: "Se quema a menudo, se broncea poco. Riesgo alto.",
      3: "Se quema a veces, se broncea gradualmente. Riesgo moderado.",
      4: "Rara vez se quema, se broncea fácil. Riesgo bajo-moderado.",
      5: "Casi nunca se quema, se broncea muy fácil. Riesgo bajo.",
      6: "Nunca se quema. Pigmentación muy alta. Riesgo muy bajo.",
    },
  },
  eu: {
    title: "🧴 Fototipoari buruzko informazioa",
    label: "Fototipoa",
    types: {
      1: "1 mota — Oso argia",
      2: "2 mota — Argia",
      3: "3 mota — Ertaina",
      4: "4 mota — Oliba",
      5: "5 mota — Iluna",
      6: "6 mota — Oso iluna",
    },
    desc: {
      1: "Beti erretzen da, inoiz ez da beltzaran jartzen. Arrisku oso handia.",
      2: "Sarri erretzen da, gutxi beltzaran. Arrisku handia.",
      3: "Batzuetan erretzen da, pixkanaka beltzaran. Arrisku ertaina.",
      4: "Gutxitan erretzen da, erraz beltzaran. Arrisku baxu-ertaina.",
      5: "Ia inoiz ez da erretzen, oso erraz beltzaran. Arrisku baxua.",
      6: "Inoiz ez da erretzen. Pigmentazio oso altua. Arrisku oso baxua.",
    },
  },
  gl: {
    title: "🧴 Información do fototipo",
    label: "Fototipo",
    types: {
      1: "Tipo 1 — Moi clara",
      2: "Tipo 2 — Clara",
      3: "Tipo 3 — Media",
      4: "Tipo 4 — Oliva",
      5: "Tipo 5 — Escura",
      6: "Tipo 6 — Moi escura",
    },
    desc: {
      1: "Sempre se queima, nunca se broncea. Risco moi alto.",
      2: "Quéimase a miúdo, broncéase pouco. Risco alto.",
      3: "Quéimase ás veces, broncéase gradualmente. Risco moderado.",
      4: "Raramente se queima, broncéase doado. Risco baixo-moderado.",
      5: "Case nunca se queima, broncéase moi doado. Risco baixo.",
      6: "Nunca se queima. Pigmentación moi alta. Risco moi baixo.",
    },
  },
  en: {
    title: "🧴 Skin type info",
    label: "Skin type",
    types: {
      1: "Type 1 — Very fair",
      2: "Type 2 — Fair",
      3: "Type 3 — Medium",
      4: "Type 4 — Olive",
      5: "Type 5 — Dark",
      6: "Type 6 — Very dark",
    },
    desc: {
      1: "Always burns, never tans. Very high burn risk.",
      2: "Often burns, tans slightly. High risk.",
      3: "Sometimes burns, gradually tans. Moderate risk.",
      4: "Rarely burns, tans easily. Low–moderate risk.",
      5: "Almost never burns, tans very easily. Low risk.",
      6: "Never burns. Very high pigmentation. Very low risk.",
    },
  },
};

export default function SkinTypeInfo({ lang, value, onChange }: Props) {
  const cfg = TEXT[lang] ?? TEXT.ca;

  const color = useMemo(() => COLORS[value], [value]);

  return (
    <div
      style={{
        borderLeft: `4px solid ${color}`,
        background: "rgba(255,255,255,0.06)",
        padding: "0.9rem 1rem",
        borderRadius: "10px",
        boxShadow: "0 1px 6px rgba(0,0,0,0.18)",
        display: "flex",
        flexDirection: "column",
        gap: "0.6rem",
      }}
    >
      <div style={{ fontWeight: 700 }}>{cfg.title}</div>

      <label style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <span style={{ fontWeight: 700 }}>{cfg.label}:</span>

        <select
          value={value}
          onChange={(e) => onChange(Number(e.target.value) as SkinType)}
          style={{ padding: "6px 8px", borderRadius: 6, minWidth: 190 }}
        >
          {(Object.keys(cfg.types) as unknown as SkinType[]).map((k) => (
            <option key={k} value={k}>
              {cfg.types[k]}
            </option>
          ))}
        </select>

        {/* Badge visual (afecta visualment) */}
        <span
          style={{
            padding: "4px 8px",
            borderRadius: 999,
            background: color,
            color: "white",
            fontWeight: 700,
            fontSize: 12,
          }}
        >
          {cfg.types[value].split("—")[0].trim()}
        </span>
      </label>

      <div style={{ opacity: 0.9, fontSize: 14, lineHeight: 1.4 }}>
        {cfg.desc[value]}
      </div>
    </div>
  );
}
