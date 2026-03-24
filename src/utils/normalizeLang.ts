export function normalizeLang(lng: string): "ca" | "es" | "eu" | "gl" | "en" {
  const s = (lng || "").slice(0, 2).toLowerCase();

  if (s === "ca" || s === "es" || s === "eu" || s === "gl" || s === "en") {
    return s;
  }

  return "ca";
}