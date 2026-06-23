import React from "react";
import { getUVBrainMessage } from "../utils/getUVBrainMessage";
import { normalizeUviForDisplay } from "../utils/uv";

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

export default function UVContextCard({ uvi, lang }: Props) {
  const normalizedLang = normalizeLang(lang);
  const u = normalizeUviForDisplay(uvi);

  if (u === null) return null;

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
