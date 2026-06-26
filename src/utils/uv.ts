// src/utils/uv.ts
// ======================================================
// 🌞 Helpers UV — nivell, text i recomanació multillenguatge
// ======================================================

export type UvLevelIndex = 0 | 1 | 2 | 3 | 4;

export function getRoundedUvi(uvi: number | null | undefined): number {
  if (typeof uvi !== "number" || !Number.isFinite(uvi)) return 0;
  return Math.max(0, Math.round(uvi));
}

export function normalizeUviForDisplay(
  uvi: number | null | undefined
): number | null {
  if (typeof uvi !== "number" || !Number.isFinite(uvi)) return null;
  return Number(Math.max(0, uvi).toFixed(1));
}

export function getUvLevelIndex(uvi: number | null | undefined): UvLevelIndex {
  const u = normalizeUviForDisplay(uvi) ?? 0;
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
    ca: ["Baix (0–2.9)", "Moderat (3–5.9)", "Alt (6–7.9)", "Molt alt (8–10.9)", "Extrem (11+)"],
    es: ["Bajo (0–2.9)", "Moderado (3–5.9)", "Alto (6–7.9)", "Muy alto (8–10.9)", "Extremo (11+)"],
    gl: ["Baixo (0–2.9)", "Moderado (3–5.9)", "Alto (6–7.9)", "Moi alto (8–10.9)", "Extremo (11+)"],
    eu: ["Baxua (0–2.9)", "Moderatua (3–5.9)", "Altua (6–7.9)", "Oso altua (8–10.9)", "Muturrekoa (11+)"],
  };

  return level === -1 ? "—" : (text[lang] || text["ca"])[level];
}

export function getUvAdvice(uvi: number | null, lang: string): string {
  if (uvi === null) return "";

  const level = getUvLevelIndex(uvi);

  const advice: Record<string, string[]> = {
    ca: [
      "Protecció mínima necessària.",
      "Si l’exposició és prolongada, utilitza protecció solar i cerca ombra a les hores centrals.",
      "Evita el sol de 12h a 16h. Protecció extra.",
      "Evita exposició directa. Usa roba i SPF 50+.",
      "Risc greu. Queda’t a l’ombra o dins casa."
    ],
    es: [
      "Protección mínima necesaria.",
      "Si la exposición es prolongada, utiliza protección solar y busca sombra en las horas centrales.",
      "Evita el sol de 12h a 16h. Protección extra.",
      "Evita la exposición directa. Usa ropa y SPF 50+.",
      "Riesgo extremo. Permanece en sombra o interior."
    ],
    gl: [
      "Protección mínima necesaria.",
      "Se a exposición é prolongada, usa protección solar e busca sombra nas horas centrais.",
      "Evita o sol de 12h a 16h. Protección extra.",
      "Evita exposición directa. Roupa e SPF 50+.",
      "Risco extremo. Permanece á sombra ou interior."
    ],
    eu: [
      "Gutxieneko babesa beharrezkoa.",
      "Esposizioa luzea bada, erabili eguzki-babesa eta bilatu itzala eguneko erdiko orduetan.",
      "12:00–16:00 saihestu eguzkia. Babes gehigarria.",
      "Saihestu esposizio zuzena. Arropa eta SPF 50+.",
      "Arrisku handia. Egon itzalean edo barrualdean."
    ]
  };

  return (advice[lang] || advice["ca"])[level];
}
