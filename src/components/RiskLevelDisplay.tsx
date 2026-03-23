import * as React from "react";
import { getHeatRisk } from "../utils/heatRisk";

type Lang = "ca" | "es" | "eu" | "gl" | "en";

interface Props {
  temp: number;
  lang: Lang;
  className?: string;
}

type RawLevel = "Cap risc" | "Baix" | "Moderat" | "Alt" | "Extrem";
type UiLevel = "safe" | "mild" | "moderate" | "high" | "ext";

const LEVEL_CLASS: Record<RawLevel, UiLevel> = {
  "Cap risc": "safe",
  Baix: "mild",
  Moderat: "moderate",
  Alt: "high",
  Extrem: "ext",
};

const ICON_BY_LEVEL: Record<RawLevel, string> = {
  "Cap risc": "🟢",
  Baix: "🟡",
  Moderat: "🟠",
  Alt: "🔴",
  Extrem: "⛔",
};

const HEAT_TEXT: Record<RawLevel, Record<Lang, string>> = {
  "Cap risc": {
    ca: "Condicions segures",
    es: "Condiciones seguras",
    eu: "Baldintza seguruak",
    gl: "Condicións seguras",
    en: "Safe conditions",
  },
  Baix: {
    ca: "Precaució lleu per calor",
    es: "Precaución leve por calor",
    eu: "Beroagatik kontuz",
    gl: "Precaución leve por calor",
    en: "Mild heat caution",
  },
  Moderat: {
    ca: "Risc moderat per calor",
    es: "Riesgo moderado por calor",
    eu: "Bero arrisku ertaina",
    gl: "Risco moderado por calor",
    en: "Moderate heat risk",
  },
  Alt: {
    ca: "Risc alt per calor",
    es: "Riesgo alto por calor",
    eu: "Bero arrisku handia",
    gl: "Risco alto por calor",
    en: "High heat risk",
  },
  Extrem: {
    ca: "Risc extrem per calor",
    es: "Riesgo extremo por calor",
    eu: "Bero arrisku muturrekoa",
    gl: "Risco extremo por calor",
    en: "Extreme heat risk",
  },
};

const COLD_TEXT: Record<RawLevel, Record<Lang, string>> = {
  "Cap risc": {
    ca: "Condicions segures",
    es: "Condiciones seguras",
    eu: "Baldintza seguruak",
    gl: "Condicións seguras",
    en: "Safe conditions",
  },
  Baix: {
    ca: "Fred lleu",
    es: "Frío leve",
    eu: "Hotz arina",
    gl: "Frío leve",
    en: "Mild cold",
  },
  Moderat: {
    ca: "Risc moderat per fred",
    es: "Riesgo moderado por frío",
    eu: "Hotz arrisku ertaina",
    gl: "Risco moderado por frío",
    en: "Moderate cold risk",
  },
  Alt: {
    ca: "Risc alt per fred",
    es: "Riesgo alto por frío",
    eu: "Hotz arrisku handia",
    gl: "Risco alto por frío",
    en: "High cold risk",
  },
  Extrem: {
    ca: "Risc extrem per fred",
    es: "Riesgo extremo por frío",
    eu: "Hotz arrisku muturrekoa",
    gl: "Risco extremo por frío",
    en: "Extreme cold risk",
  },
};

function normalizeLevel(level: unknown): RawLevel {
  const value = String(level ?? "").trim();

  if (value === "Baix") return "Baix";
  if (value === "Moderat") return "Moderat";
  if (value === "Alt") return "Alt";
  if (value === "Extrem") return "Extrem";
  return "Cap risc";
}

export default function RiskLevelDisplay({ temp, lang, className }: Props) {
  const { level } = getHeatRisk(temp, "rest");
  const normalizedLevel = normalizeLevel(level);

  const isCold = temp <= 10 && normalizedLevel !== "Cap risc";
  const text = isCold
    ? COLD_TEXT[normalizedLevel][lang]
    : HEAT_TEXT[normalizedLevel][lang];

  const icon = ICON_BY_LEVEL[normalizedLevel];

  return (
    <h2 className={className}>
      <span className={`risk-level ${LEVEL_CLASS[normalizedLevel]}`}>
        {icon} {text}
      </span>
    </h2>
  );
}