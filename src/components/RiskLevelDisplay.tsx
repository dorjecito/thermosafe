import * as React from "react";
import { getHeatRisk } from "../utils/heatRisk";

type Lang = "ca" | "es" | "eu" | "gl";

interface Props {
  temp: number;
  lang: Lang;
  className?: string;
}

const LABEL: Record<Lang, string> = {
  ca: "Risc actual:",
  es: "Riesgo actual:",
  eu: "Uneko arriskua:",
  gl: "Risco actual:",
};

const HEAT_LABEL: Record<Lang, string> = {
  ca: "Risc per calor:",
  es: "Riesgo por calor:",
  eu: "Bero arriskua:",
  gl: "Risco por calor:",
};

const COLD_LABEL: Record<Lang, string> = {
  ca: "Risc per fred:",
  es: "Riesgo por frío:",
  eu: "Hotz arriskua:",
  gl: "Risco por frío:",
};

const LEVEL: Record<
  "Cap risc" | "Baix" | "Moderat" | "Alt" | "Extrem",
  Record<Lang, string>
> = {
  "Cap risc": { ca: "Cap risc", es: "Sin riesgo", eu: "Arriskurik ez", gl: "Sen risco" },
  Baix: { ca: "Baix", es: "Bajo", eu: "Baxua", gl: "Baixo" },
  Moderat: { ca: "Moderat", es: "Moderado", eu: "Moderatua", gl: "Moderado" },
  Alt: { ca: "Alt", es: "Alto", eu: "Handia", gl: "Alto" },
  Extrem: { ca: "Extrem", es: "Extremo", eu: "Larri", gl: "Extremo" },
};

export default function RiskLevelDisplay({ temp, lang, className }: Props) {
  const { level } = getHeatRisk(temp);

  const levelClass: Record<
    "Cap risc" | "Baix" | "Moderat" | "Alt" | "Extrem",
    string
  > = {
    "Cap risc": "safe",
    Baix: "mild",
    Moderat: "moderate",
    Alt: "high",
    Extrem: "ext",
  };

  let labelText = LABEL[lang];
  if (temp >= 27) labelText = HEAT_LABEL[lang];
  else if (temp <= 10) labelText = COLD_LABEL[lang];

  return (
    <h2 className={className}>
      {labelText}{" "}
      <span className={`risk-level ${levelClass[level]}`}>
        {LEVEL[level][lang]}
      </span>
    </h2>
  );
}