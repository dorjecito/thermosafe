// src/utils/uv.ts
// ======================================================
// 🌞 Helpers UV — nivell, text i recomanació multillenguatge
// ======================================================

export type UvLevelIndex = 0 | 1 | 2 | 3 | 4;

export function getRoundedUvi(uvi: number | null | undefined): number {
  if (typeof uvi !== "number" || !Number.isFinite(uvi)) return 0;
  return Math.max(0, Math.round(uvi));
}

export function getUvLevelIndex(uvi: number | null | undefined): UvLevelIndex {
  const u =
    typeof uvi === "number" && Number.isFinite(uvi)
      ? Math.max(0, uvi)
      : 0;
  if (u < 3) return 0;
  if (u < 6) return 1;
  if (u < 8) return 2;
  if (u < 11) return 3;
  return 4;
}

export function getUvLevel(uvi: number | null): string {
  return ["low", "moderate", "high", "very-high", "extreme"][
    getUvLevelIndex(uvi)
  ];
}

export function getUvText(uvi: number | null, lang: string): string {
  const level = uvi === null ? -1 : getUvLevelIndex(uvi);

  const text: Record<string, string[]> = {
    ca: ["Baix (0–2)", "Moderat (3–5)", "Alt (6–7.9)", "Molt alt (8–10.9)", "Extrem (11+)"],
    es: ["Bajo (0–2)", "Moderado (3–5)", "Alto (6–7.9)", "Muy alto (8–10.9)", "Extremo (11+)"],
    gl: ["Baixo (0–2)", "Moderado (3–5)", "Alto (6–7.9)", "Moi alto (8–10.9)", "Extremo (11+)"],
    eu: ["Baxua (0–2)", "Moderatua (3–5)", "Altua (6–7.9)", "Oso altua (8–10.9)", "Muturrekoa (11+)"],
  };

  return level === -1 ? "—" : (text[lang] || text["ca"])[level];
}

export function getUvAdvice(uvi: number | null, lang: string): string {
  if (uvi === null) return "";

  const level = getUvLevelIndex(uvi);

  const advice: Record<string, string[]> = {
    ca: [
      "Protecció mínima necessària.",
      "Gorra, ulleres i SPF 30+.",
      "Evita el sol de 12h a 16h. Protecció extra.",
      "Evita exposició directa. Usa roba i SPF 50+.",
      "Risc greu. Queda’t a l’ombra o dins casa."
    ],
    es: [
      "Protección mínima necesaria.",
      "Gorra, gafas y SPF 30+.",
      "Evita el sol de 12h a 16h. Protección extra.",
      "Evita la exposición directa. Usa ropa y SPF 50+.",
      "Riesgo extremo. Permanece en sombra o interior."
    ],
    gl: [
      "Protección mínima necesaria.",
      "Gorra, lentes e SPF 30+.",
      "Evita o sol de 12h a 16h. Protección extra.",
      "Evita exposición directa. Roupa e SPF 50+.",
      "Risco extremo. Permanece á sombra ou interior."
    ],
    eu: [
      "Gutxieneko babesa beharrezkoa.",
      "Txanoa, betaurrekoak eta SPF 30+.",
      "12:00–16:00 saihestu eguzkia. Babes gehigarria.",
      "Saihestu esposizio zuzena. Arropa eta SPF 50+.",
      "Arrisku handia. Egon itzalean edo barrualdean."
    ]
  };

  return (advice[lang] || advice["ca"])[level];
}
