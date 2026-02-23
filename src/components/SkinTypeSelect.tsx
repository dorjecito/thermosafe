// src/components/SkinTypeSelect.tsx
import React, { useMemo } from "react";

export type Lang = "ca" | "es" | "eu" | "gl";
export type SkinType = 1 | 2 | 3 | 4 | 5 | 6;

type Props = {
  lang: Lang;
  value: SkinType;
  onChange: (v: SkinType) => void;
  compact?: boolean; // opcional: si vols que ocupi menys
};

/* ─── Textos UI ───────────────────────────────────── */
const ui = {
  ca: {
    label: "Fototip",
    help: "Guia orientativa segons com reacciona la pell al sol.",
  },
  es: {
    label: "Fototipo",
    help: "Guía orientativa según cómo reacciona la piel al sol.",
  },
  eu: {
    label: "Fototipoa",
    help: "Gida orientagarria: azalaren erreakzioa eguzkiarekin.",
  },
  gl: {
    label: "Fototipo",
    help: "Guía orientativa segundo como reacciona a pel ao sol.",
  },
} as const;

/* ─── Opcions (traduïdes) ─────────────────────────── */
const skinTypes = [
  {
    id: 1,
    title: { ca: "Tipus 1", es: "Tipo 1", eu: "1. mota", gl: "Tipo 1" },
    desc: {
      ca: "Molt clara: sempre es crema, mai es bronzega.",
      es: "Muy clara: siempre se quema, nunca se broncea.",
      eu: "Oso argia: beti erretzen da, inoiz ez da beltzarantzen.",
      gl: "Moi clara: sempre se queima, nunca se broncea.",
    },
  },
  {
    id: 2,
    title: { ca: "Tipus 2", es: "Tipo 2", eu: "2. mota", gl: "Tipo 2" },
    desc: {
      ca: "Clara: es crema sovint, es bronzega poc.",
      es: "Clara: se quema a menudo, se broncea poco.",
      eu: "Argia: sarri erretzen da, gutxi beltzarantzen da.",
      gl: "Clara: quéimase a miúdo, broncea pouco.",
    },
  },
  {
    id: 3,
    title: { ca: "Tipus 3", es: "Tipo 3", eu: "3. mota", gl: "Tipo 3" },
    desc: {
      ca: "Mitjana: es crema a vegades, es bronzega gradualment.",
      es: "Media: se quema a veces, se broncea gradualmente.",
      eu: "Ertaina: batzuetan erretzen da, pixkanaka beltzarantzen da.",
      gl: "Media: quéimase ás veces, broncea gradualmente.",
    },
  },
  {
    id: 4,
    title: { ca: "Tipus 4", es: "Tipo 4", eu: "4. mota", gl: "Tipo 4" },
    desc: {
      ca: "Oliva: es crema rarament, es bronzega fàcil.",
      es: "Oliva: rara vez se quema, se broncea fácil.",
      eu: "Oliba: gutxitan erretzen da, erraz beltzarantzen da.",
      gl: "Oliva: case nunca se queima, broncea doado.",
    },
  },
  {
    id: 5,
    title: { ca: "Tipus 5", es: "Tipo 5", eu: "5. mota", gl: "Tipo 5" },
    desc: {
      ca: "Fosca: gairebé mai es crema, es bronzega molt fàcil.",
      es: "Oscura: casi nunca se quema, se broncea muy fácil.",
      eu: "Iluna: ia inoiz ez da erretzen, oso erraz beltzarantzen da.",
      gl: "Escura: case nunca se queima, broncea moi doado.",
    },
  },
  {
    id: 6,
    title: { ca: "Tipus 6", es: "Tipo 6", eu: "6. mota", gl: "Tipo 6" },
    desc: {
      ca: "Molt fosca: mai es crema, pigmentació molt alta.",
      es: "Muy oscura: nunca se quema, pigmentación muy alta.",
      eu: "Oso iluna: inoiz ez da erretzen, pigmentazio oso handia.",
      gl: "Moi escura: nunca se queima, pigmentación moi alta.",
    },
  },
] as const;

/* ─── Component ───────────────────────────────────── */
export default function SkinTypeSelect({ lang, value, onChange, compact }: Props) {
  const t = ui[lang];

  const selected = useMemo(
    () => skinTypes.find((x) => x.id === value),
    [value]
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: compact ? 220 : 320 }}>
      <label style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <span style={{ fontWeight: 600 }}>{t.label}:</span>

        <select
          value={value}
          onChange={(e) => onChange(Number(e.target.value) as SkinType)}
          style={{ padding: "6px 8px", borderRadius: 6 }}
        >
          {skinTypes.map((s) => (
            <option key={s.id} value={s.id}>
              {s.title[lang]} — {s.desc[lang]}
            </option>
          ))}
        </select>
      </label>

      <div style={{ fontSize: 13, opacity: 0.85, lineHeight: 1.25 }}>
        {t.help}
        {selected ? (
          <div style={{ marginTop: 2 }}>
            <strong>{selected.title[lang]}:</strong> {selected.desc[lang]}
          </div>
        ) : null}
      </div>
    </div>
  );
}