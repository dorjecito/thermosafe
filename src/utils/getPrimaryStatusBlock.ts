type TFunctionLike = (key: string) => string;

type PrimaryKind = "heat" | "cold" | "wind" | "uv" | "none";

type Primary = {
  kind: PrimaryKind;
  severity: 0 | 1 | 2 | 3 | 4;
  labelKey: string;
};

type HeatRiskLike = {
  isModerate?: boolean;
  isHigh?: boolean;
  isExtreme?: boolean;
} | null;

type PrimaryStatusBlockArgs = {
  alerts: any[];
  primary: Primary;
  heatRisk: HeatRiskLike;
  coldRisk: string | null;
  windRisk: string | null;
  uvi: number | null;
  day: boolean;
  primaryAdvice: string | null;
  contextualUVMessage: string;
  t: TFunctionLike;
};

type PrimaryStatusBlockResult = {
  icon: string;
  title: string;
  text: string;
  className: string;
};

export function getPrimaryStatusBlock({
  alerts,
  primary,
  heatRisk,
  coldRisk,
  windRisk,
  uvi,
  day,
  primaryAdvice,
  contextualUVMessage,
  t,
}: PrimaryStatusBlockArgs): PrimaryStatusBlockResult {
  const nowTs = Math.floor(Date.now() / 1000);

  const activeAlert =
    Array.isArray(alerts) &&
    alerts.find(
      (alert) =>
        typeof alert?.start === "number" &&
        typeof alert?.end === "number" &&
        nowTs >= alert.start &&
        nowTs <= alert.end
    );

  const soonAlert =
    Array.isArray(alerts) &&
    alerts.find(
      (alert) =>
        typeof alert?.start === "number" &&
        alert.start > nowTs
    );

  // 🔴 AVÍS OFICIAL ACTIU
  if (activeAlert) {
    return {
      icon: "🚨",
      title: t("official_alert") || "Avís meteorològic oficial actiu",
      text:
        t("follow_official_alerts") ||
        "Segueix les indicacions oficials i extrema la precaució.",
      className: "status-card status-alert",
    };
  }

  // 🟠 AVÍS OFICIAL PROPER
  if (soonAlert) {
    return {
      icon: "⚠️",
      title: t("official_alert_soon") || "Avís meteorològic oficial proper",
      text:
        t("follow_official_alerts_soon") ||
        "Hi ha un avís meteorològic previst. Revisa el detall i anticipa les mesures de precaució.",
      className: "status-card status-warning",
    };
  }

  // 🔥 CALOR
  if (primary.kind === "heat") {
    if (heatRisk?.isExtreme) {
      return {
        icon: "⛔",
        title: "Risc extrem per calor",
        text:
          t("officialAdviceDynamic.heat.extreme") ||
          "Evita completament l’exposició i interromp l’activitat física.",
        className: "status-card status-danger",
      };
    }

    if (heatRisk?.isHigh) {
      return {
        icon: "🔴",
        title: "Risc alt per calor",
        text:
          t("officialAdviceDynamic.heat.high") ||
          "Limita l’activitat exterior, hidrata’t sovint i cerca ombra.",
        className: "status-card status-danger",
      };
    }

    return {
      icon: "🟠",
      title: "Risc moderat per calor",
      text:
        t("officialAdviceDynamic.heat.moderate") ||
        "Evita esforços intensos i fes pauses en llocs frescos.",
      className: "status-card status-warning",
    };
  }

  // ❄️ FRED
  if (primary.kind === "cold") {
    if (coldRisk === "extrem") {
      return {
        icon: "⛔",
        title: "Risc extrem per fred",
        text:
          t("officialAdviceDynamic.cold.extreme") ||
          "Evita l’exterior. Hi ha risc greu de pèrdua ràpida de calor corporal.",
        className: "status-card status-cold",
      };
    }

    if (coldRisk === "alt" || coldRisk === "molt alt") {
      return {
        icon: "🔵",
        title: "Risc alt per fred",
        text:
          t("officialAdviceDynamic.cold.high") ||
          "Protegeix extremitats i limita el temps d’exposició exterior.",
        className: "status-card status-cold",
      };
    }

    return {
      icon: "❄️",
      title: "Risc moderat per fred",
      text:
        t("officialAdviceDynamic.cold.moderate") ||
        "Abriga’t per capes i evita exposicions prolongades.",
      className: "status-card status-cold",
    };
  }

  // 💨 VENT
  if (
    primary.kind === "wind" &&
    windRisk &&
    ["moderate", "strong", "very_strong"].includes(windRisk)
  ) {
    const windTitles: Record<string, string> = {
      moderate: "Risc moderat per vent",
      strong: "Risc alt per vent",
      very_strong: "Risc molt alt per vent",
    };

    return {
      icon: "💨",
      title: windTitles[windRisk] || "Risc per vent",
      text:
        primaryAdvice ||
        t(`officialAdviceDynamic.wind.${windRisk}`) ||
        "Assegura objectes lleugers i evita zones exposades.",
      className: "status-card status-wind",
    };
  }

  // ☀️ UV
  if (primary.kind === "uv" && day) {
    let uvTitle = "Radiació UV alta";

    if (typeof uvi === "number") {
      if (uvi >= 11) uvTitle = "Radiació UV extrema";
      else if (uvi >= 8) uvTitle = "Radiació UV molt alta";
      else if (uvi >= 6) uvTitle = "Radiació UV alta";
      else uvTitle = "Radiació UV moderada";
    }

    return {
      icon: "☀️",
      title: uvTitle,
      text:
        primaryAdvice ||
        contextualUVMessage ||
        t("highUVIWarning") ||
        "Utilitza protecció solar i redueix l’exposició directa.",
      className: "status-card status-uv",
    };
  }

  // 🟢 SITUACIÓ SEGURA
  return {
    icon: "🟢",
    title: t("safe_conditions") || "Condicions segures",
    text:
      t("safe_conditions_text_day") ||
      "No es detecta cap risc meteorològic destacable en aquest moment.",
    className: "status-card status-safe",
  };
}