import { getUvLevelIndex } from "./uv";
import type { HeatDayPhase } from "./isDayAtLocation";
import { detectAemetHazard, type HazardId } from "./aemetAi";

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
  isLateDay?: boolean;
  heatDayPhase?: HeatDayPhase;
  nocturnalHeat?: boolean;
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
  isLateDay = false,
  heatDayPhase,
  nocturnalHeat = false,
  primaryAdvice,
  contextualUVMessage,
  t,
}: PrimaryStatusBlockArgs): PrimaryStatusBlockResult {
  const tr = (key: string, fallback: string) => {
    const text = t(key);
    return text && text !== key ? text : fallback;
  };

  const translated = (key: string) => {
    const text = t(key);
    return text && text !== key ? text : null;
  };

  const getOfficialAlertSummary = (alertList: any[], phase: "active" | "soon") => {
    const hazards = [
      ...new Set(
        alertList
          .map((alert) =>
            detectAemetHazard(
              String(alert?.event || ""),
              typeof alert?.description === "string" ? alert.description : ""
            )
          )
          .filter((hazard): hazard is Exclude<HazardId, "other"> => hazard !== "other")
      ),
    ];

    if (hazards.length === 0) {
      return { title: null, text: null };
    }

    if (hazards.length > 1) {
      return {
        title: translated(
          phase === "active"
            ? "official_alert_active_multiple"
            : "official_alert_soon_multiple"
        ),
        text: translated(
          phase === "active"
            ? "official_alert_active_multiple_text"
            : "official_alert_soon_multiple_text"
        ),
      };
    }

    return {
      title: translated(
        phase === "active"
          ? "official_alert_active_prefix"
          : "official_alert_soon_prefix"
      ),
      text: translated(
        `${phase === "active" ? "official_alert_active_hazard" : "official_alert_soon_hazard"}.${hazards[0]}`
      ),
    };
  };

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

  const activeAlerts =
    Array.isArray(alerts)
      ? alerts.filter(
          (alert) =>
            typeof alert?.start === "number" &&
            typeof alert?.end === "number" &&
            nowTs >= alert.start &&
            nowTs <= alert.end
        )
      : [];

  const soonAlert =
    Array.isArray(alerts) &&
    alerts.find(
      (alert) =>
        typeof alert?.start === "number" &&
        alert.start > nowTs
    );

  const soonAlerts =
    Array.isArray(alerts)
      ? alerts.filter(
          (alert) =>
            typeof alert?.start === "number" &&
            alert.start > nowTs
        )
      : [];

  // 🔴 AVÍS OFICIAL ACTIU
  if (activeAlert) {
    const activeSummary = getOfficialAlertSummary(activeAlerts, "active");

    return {
      icon: "🚨",
      title:
        activeSummary.title ||
        t("official_alert") ||
        "Avís meteorològic oficial actiu",
      text:
        activeSummary.text ||
        t("follow_official_alerts") ||
        "Segueix les indicacions oficials i extrema la precaució.",
      className: "status-card status-alert",
    };
  }

  // 🟠 AVÍS OFICIAL PROPER
  if (soonAlert) {
    const soonSummary = getOfficialAlertSummary(soonAlerts, "soon");

    return {
      icon: "⚠️",
      title:
        soonSummary.title ||
        t("official_alert_soon") ||
        "Avís meteorològic oficial proper",
      text:
        soonSummary.text ||
        t("follow_official_alerts_soon") ||
        "Hi ha un avís meteorològic previst. Revisa el detall i anticipa les mesures de precaució.",
      className: "status-card status-warning",
    };
  }

  // 🔥 CALOR
  if (primary.kind === "heat") {
    const isLowHeat = primary.severity <= 1;
    const phase: HeatDayPhase =
      heatDayPhase ?? (day ? (isLateDay ? "late_day" : "day") : "night");

    if (heatRisk?.isExtreme) {
      return {
        icon: "⛔",
        title: phase === "night"
          ? tr("primaryStatus.heat.hotNight", "Nit calorosa")
          : phase === "evening"
            ? tr("primaryStatus.heat.mildLateDay", "Temperatura encara elevada")
            : tr("primaryStatus.heat.extreme", "Risc extrem per calor"),
        text: phase === "night"
          ? tr(
              "primaryStatus.heat.hotNightText",
              "La calor acumulada durant la nit pot dificultar el descans i la recuperació tèrmica. Hidrata’t i evita esforços físics intensos fins que refresqui."
            )
          : phase === "evening"
            ? tr(
                "primaryStatus.heat.mildEveningText",
                "La temperatura encara es manté elevada després de la posta de sol. Tot i que el risc disminueix respecte al dia, la calor acumulada pot fer menys confortable l’activitat a l’exterior."
              )
            : tr(
              "officialAdviceDynamic.heat.extreme",
              "Evita completament l’exposició i interromp l’activitat física."
            ),
        className: "status-card status-danger",
      };
    }

    if (heatRisk?.isHigh) {
      return {
        icon: "🔴",
        title: phase === "night"
          ? tr("primaryStatus.heat.hotNight", "Nit calorosa")
          : phase === "evening"
            ? tr("primaryStatus.heat.mildLateDay", "Temperatura encara elevada")
            : tr("primaryStatus.heat.high", "Risc alt per calor"),
        text: phase === "night"
          ? tr(
              "primaryStatus.heat.hotNightText",
              "La calor acumulada durant la nit pot dificultar el descans i la recuperació tèrmica. Hidrata’t i evita esforços físics intensos fins que refresqui."
            )
          : phase === "evening"
            ? tr(
                "primaryStatus.heat.mildEveningText",
                "La temperatura encara es manté elevada després de la posta de sol. Tot i que el risc disminueix respecte al dia, la calor acumulada pot fer menys confortable l’activitat a l’exterior."
              )
            : tr(
              "officialAdviceDynamic.heat.high",
              "Limita l’activitat exterior, hidrata’t sovint i cerca ombra."
            ),
        className: "status-card status-danger",
      };
    }

    if (isLowHeat) {
      return {
        icon: "🟡",
        title: phase === "night"
          ? tr("primaryStatus.heat.hotNight", "Nit calorosa")
          : phase === "late_day" || phase === "evening"
            ? tr("primaryStatus.heat.mildLateDay", "Temperatura encara elevada")
            : tr("primaryStatus.heat.mild", "Precaució lleu per calor"),
        text: phase === "night"
          ? tr(
              "primaryStatus.heat.hotNightText",
              "La calor acumulada durant la nit pot dificultar el descans i la recuperació tèrmica. Hidrata’t i evita esforços físics intensos fins que refresqui."
            )
          : phase === "evening"
            ? tr(
                "primaryStatus.heat.mildEveningText",
                "La temperatura encara es manté elevada després de la posta de sol. Tot i que el risc disminueix respecte al dia, la calor acumulada pot fer menys confortable l’activitat a l’exterior."
              )
            : phase === "late_day"
            ? tr(
                "primaryStatus.heat.mildLateDayText",
                "Tot i que el sol ja baixa, la sensació tèrmica encara pot provocar cansament. Hidrata’t i evita esforços innecessaris."
              )
            : tr(
                "primaryStatus.heat.mildText",
                "La sensació tèrmica és moderadament elevada. Hidrata’t i adapta l’activitat si mantens esforç físic."
              ),
        className: "status-card status-warning",
      };
    }

    return {
      icon: "🟠",
      title: phase === "night"
        ? tr("primaryStatus.heat.hotNight", "Nit calorosa")
        : phase === "evening"
          ? tr("primaryStatus.heat.mildLateDay", "Temperatura encara elevada")
          : phase === "late_day"
          ? tr("primaryStatus.heat.moderateLateDay", "Calor encara elevada")
          : tr("primaryStatus.heat.moderate", "Risc moderat per calor"),
      text: phase === "night"
        ? tr(
            "primaryStatus.heat.hotNightText",
            "La calor acumulada durant la nit pot dificultar el descans i la recuperació tèrmica. Hidrata’t i evita esforços físics intensos fins que refresqui."
          )
        : phase === "evening"
          ? tr(
              "primaryStatus.heat.mildEveningText",
              "La temperatura encara es manté elevada després de la posta de sol. Tot i que el risc disminueix respecte al dia, la calor acumulada pot fer menys confortable l’activitat a l’exterior."
            )
          : phase === "late_day"
          ? tr(
              "primaryStatus.heat.moderateLateDayText",
              "Tot i ser capvespre, la sensació tèrmica continua elevada. Redueix esforços intensos, hidrata’t i fes pauses en llocs frescos."
            )
          : tr(
              "officialAdviceDynamic.heat.moderate",
              "Evita esforços intensos i fes pauses en llocs frescos."
            ),
      className: "status-card status-warning",
    };
  }

  // ❄️ FRED
  if (primary.kind === "cold") {
    if (coldRisk === "extrem") {
      return {
        icon: "⛔",
        title: tr("primaryStatus.cold.extreme", "Risc extrem per fred"),
        text:
          t("officialAdviceDynamic.cold.extreme") ||
          "Evita l’exterior. Hi ha risc greu de pèrdua ràpida de calor corporal.",
        className: "status-card status-cold",
      };
    }

    if (coldRisk === "alt" || coldRisk === "molt alt") {
      return {
        icon: "🔵",
        title: tr("primaryStatus.cold.high", "Risc alt per fred"),
        text:
          t("officialAdviceDynamic.cold.high") ||
          "Protegeix extremitats i limita el temps d’exposició exterior.",
        className: "status-card status-cold",
      };
    }

    if (coldRisk === "lleu") {
      return {
        icon: "❄️",
        title: tr("primaryStatus.cold.mild", "Precaució lleu per fred"),
        text:
          t("officialAdviceDynamic.cold.mild") ||
          "Abriga’t lleugerament si passes temps a l’exterior.",
        className: "status-card status-cold",
      };
    }

    return {
      icon: "❄️",
      title: tr("primaryStatus.cold.moderate", "Risc moderat per fred"),
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
      moderate: tr("primaryStatus.wind.moderate", "Risc moderat per vent"),
      strong: tr("primaryStatus.wind.high", "Risc alt per vent"),
      very_strong: tr("primaryStatus.wind.veryHigh", "Risc molt alt per vent"),
    };

    return {
      icon: "💨",
      title: windTitles[windRisk] || tr("primaryStatus.wind.default", "Risc per vent"),
      text:
        primaryAdvice ||
        t(`officialAdviceDynamic.wind.${windRisk}`) ||
        "Assegura objectes lleugers i evita zones exposades.",
      className: "status-card status-wind",
    };
  }

  // ☀️ UV
  if (primary.kind === "uv" && day) {
    const uvLevel = getUvLevelIndex(uvi);
    let uvTitle = tr("primaryStatus.uv.high", "Radiació UV alta");

    if (uvLevel === 4) uvTitle = tr("primaryStatus.uv.extreme", "Radiació UV extrema");
    else if (uvLevel === 3) uvTitle = tr("primaryStatus.uv.veryHigh", "Radiació UV molt alta");
    else if (uvLevel === 2) uvTitle = tr("primaryStatus.uv.high", "Radiació UV alta");
    else uvTitle = tr("primaryStatus.uv.moderate", "Radiació UV moderada");

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

  // 🌙 CALOR NOCTURNA SUAU
  if (nocturnalHeat) {
    return {
      icon: "🟡",
      title: tr("primaryStatus.heat.hotNight", "Nit calorosa"),
      text: tr(
        "primaryStatus.heat.hotNightText",
        "La calor acumulada durant la nit pot dificultar el descans i la recuperació tèrmica. Hidrata’t i evita esforços físics intensos fins que refresqui."
      ),
      className: "status-card status-warning",
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
