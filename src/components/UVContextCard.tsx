import React from "react";
import { getUVBrainMessage } from "../utils/getUVBrainMessage";

type Lang = "ca" | "es" | "eu" | "gl" | "en";

type Props = {
  uvi: number | null;
  lang: string;
};

function normalizeLang(lang: string): Lang {
  const raw = String(lang || "ca").trim().toLowerCase();
  const primary = raw.split(/[-_]/)[0];
  return ["ca", "es", "eu", "gl", "en"].includes(primary)
    ? (primary as Lang)
    : "ca";
}

function safeUvi(value: number | null): number | null {
  if (value === null || !Number.isFinite(value)) return null;
  return Math.max(0, value);
}

export default function UVContextCard({ uvi, lang }: Props) {
  const normalizedLang = normalizeLang(lang);
  const safeValue = safeUvi(uvi);

  if (safeValue === null) return null;

  // Feim servir el mateix valor que mostrarem
  const u = Number(safeValue.toFixed(1));

  const levelClass =
    u >= 11 ? "uv-context-card--warning" : "uv-context-card--info";

  return (
    <div className={`uv-context-card ${levelClass}`}>
      <span className="uv-context-icon" aria-hidden="true">
        🧠
      </span>

      <span className="uv-context-text">
        {getUVBrainMessage(u, normalizedLang)}
      </span>
    </div>
  );
}