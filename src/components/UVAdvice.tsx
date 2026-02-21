import React from "react";

type Lang = "ca" | "es" | "eu" | "gl" | "en";

interface UVAdviceProps {
  uvi: number | null;
  lang: string; // pot venir com "ca-ES", etc.
}

const texts = {
  ca: {
    idx: "Índex UV",
    levels: ["Baix (0–2)", "Moderat (3–5)", "Alt (6–7)", "Molt alt (8–10)", "Extrem (11+)"],
    msgs: [
      "Protecció mínima necessària.",
      "Evita el sol de 12 h a 16 h. Protecció extra.",
      "Evita el sol de 12 h a 16 h. Protecció extra.",
      "Evita el sol en hores centrals i utilitza protecció màxima.",
      "Evita totalment l’exposició solar. Risc molt elevat.",
    ],
  },
  es: {
    idx: "Índice UV",
    levels: ["Bajo (0–2)", "Moderado (3–5)", "Alto (6–7)", "Muy alto (8–10)", "Extremo (11+)"],
    msgs: [
      "Protección mínima necesaria.",
      "Evita el sol de 12 h a 16 h. Protección extra.",
      "Evita el sol de 12 h a 16 h. Protección extra.",
      "Evita el sol en horas centrales y usa protección máxima.",
      "Evita totalmente la exposición solar. Riesgo muy elevado.",
    ],
  },
  eu: {
    idx: "UV indizea",
    levels: ["Baxua (0–2)", "Moderatua (3–5)", "Altua (6–7)", "Oso altua (8–10)", "Muturrekoa (11+)"],
    msgs: [
      "Babes minimoa behar da.",
      "12etatik 16etara eguzkia saihestu. Babes gehigarria.",
      "12etatik 16etara eguzkia saihestu. Babes gehigarria.",
      "Eguneko ordu nagusietan saihestu eguzkia eta babes maximoa erabili.",
      "Saihestu guztiz eguzki-esposizioa. Arrisku oso handia.",
    ],
  },
  gl: {
    idx: "Índice UV",
    levels: ["Baixo (0–2)", "Moderado (3–5)", "Alto (6–7)", "Moi alto (8–10)", "Extremo (11+)"],
    msgs: [
      "Precísase protección mínima.",
      "Evita o sol de 12 h a 16 h. Protección extra.",
      "Evita o sol de 12 h a 16 h. Protección extra.",
      "Evita o sol nas horas centrais e usa protección máxima.",
      "Evita totalmente a exposición solar. Risco moi elevado.",
    ],
  },
  en: {
    idx: "UV index",
    levels: ["Low (0–2)", "Moderate (3–5)", "High (6–7)", "Very high (8–10)", "Extreme (11+)"],
    msgs: [
      "Minimal protection required.",
      "Avoid sun from 12:00 to 16:00. Extra protection.",
      "Avoid sun from 12:00 to 16:00. Extra protection.",
      "Avoid peak hours and use maximum protection.",
      "Avoid sun exposure completely. Very high risk.",
    ],
  },
} as const;

const colors = ["#4caf50", "#ffeb3b", "#ff9800", "#f44336", "#9c27b0"] as const;

const normalizeLang = (lang: string): Lang => {
  const raw = String(lang || "ca").trim().toLowerCase();
  const primary = raw.split(/[-_]/)[0].slice(0, 2) as Lang;
  return (["ca", "es", "eu", "gl", "en"] as const).includes(primary) ? primary : "ca";
};

// ✅ Clamp a 0
const safeUvi = (uvi: number) => Math.max(0, uvi);

// ✅ Bandes OMS/WHO (0–2, 3–5, 6–7, 8–10, 11+)
// IMPORTANT: classificar amb el mateix valor que es mostra (1 decimal)
const band = (uviRounded1: number) => {
  const u = safeUvi(uviRounded1);
  return u < 3 ? 0 : u < 6 ? 1 : u < 8 ? 2 : u < 11 ? 3 : 4;
};

const UVAdvice: React.FC<UVAdviceProps> = ({ uvi, lang }) => {
  const lng = normalizeLang(lang);
  const L = texts[lng];

  if (uvi === null || !Number.isFinite(uvi)) {
    return (
      <div
        style={{
          backgroundColor: "#e5e7eb",
          color: "#000",
          padding: "1rem",
          borderRadius: 8,
          marginTop: "1rem",
        }}
      >
        <strong>🔆 {L.idx}: —</strong>
      </div>
    );
  }

  // ✅ 1) Clamp + 2) arrodonim a 1 decimal (això és el que mostrarem)
  const u = Number(safeUvi(uvi).toFixed(1));

  // ✅ classifiquem amb el mateix valor arrodonit que mostrem (evita 3.0 → "Baix (0–2)")
  const b = band(u);

  return (
    <div
      style={{
        backgroundColor: colors[b],
        color: "#000",
        padding: "1rem",
        borderRadius: 8,
        marginTop: "1rem",
      }}
    >
      <strong>
        🔆 {L.idx}: {u.toFixed(1)} — {L.levels[b]}
      </strong>

      {L.msgs[b] ? <p style={{ marginTop: ".5rem" }}>{L.msgs[b]}</p> : null}
    </div>
  );
};

export default UVAdvice;