export function getAlertIcon(event: string): string {
  const e = (event || "").toLowerCase();

  if (e.includes("vent") || e.includes("wind")) return "💨";
  if (e.includes("tempest") || e.includes("storm") || e.includes("thunder")) return "⛈️";
  if (e.includes("pluja") || e.includes("rain")) return "🌧️";
  if (e.includes("neu") || e.includes("snow")) return "❄️";
  if (e.includes("calor") || e.includes("heat")) return "🔥";
  if (e.includes("fred") || e.includes("cold")) return "🥶";
  if (e.includes("boira") || e.includes("fog")) return "🌫️";
  if (e.includes("mar") || e.includes("wave")) return "🌊";

  return "⚠️";
}