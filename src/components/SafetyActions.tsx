import React from "react";
import { useTranslation } from "react-i18next";
import type { LangKey as AemetLangKey } from "../utils/aemetAi";
import { getUvLevelIndex } from "../utils/uv";

type LangKey = AemetLangKey | "en";

type Props = {
  lang: LangKey;              // "ca" | "es" | "eu" | "gl" | "en"
  risk: string;               // ex: "heat_moderate", "cold_mild", "cap", ...
  uvi: number | null;
  windRisk: string;           // ex: "none" | "breezy" | "moderate" | ...
  city?: string | null;       // opcional, per fer el share més útil
};

export type ShareNavigator = {
  share?: (data: { title: string; text: string }) => Promise<void>;
  clipboard?: { writeText: (text: string) => Promise<void> };
};

export type ShareMessages = { copied: string; failed: string };

export async function shareTextWithFallback(
  text: string,
  title: string,
  nav: ShareNavigator,
  messages: ShareMessages,
  setStatus: (status: string) => void,
): Promise<void> {
  setStatus("");
  if (typeof nav.share === "function") {
    try {
      await nav.share({ title, text });
      return;
    } catch (error) {
      if (
        error &&
        typeof error === "object" &&
        "name" in error &&
        (error as { name?: unknown }).name === "AbortError"
      ) {
        return;
      }
    }
  }

  try {
    if (typeof nav.clipboard?.writeText !== "function") throw new Error("Clipboard unavailable");
    await nav.clipboard.writeText(text);
    setStatus(messages.copied);
  } catch {
    setStatus(messages.failed);
  }
}

function normalizeLang(lng: string): LangKey {
  const s = (lng || "ca").slice(0, 2).toLowerCase();
  if (s === "ca" || s === "es" || s === "eu" || s === "gl" || s === "en") return s;
  return "ca";
}

export default function SafetyActions({
  lang,
  risk,
  uvi,
  windRisk,
  city,
}: Props) {
  const { t } = useTranslation();
  const [shareStatus, setShareStatus] = React.useState("");

  const l = normalizeLang(lang);

  // 🆘 Confirmació 112 (multiidioma)
  function confirmCall112(lng: LangKey) {
    const msg =
      ({
        ca: "Segur que vols trucar a emergències?",
        es: "¿Seguro que quieres llamar a emergencias?",
        eu: "Larrialdietara deitu nahi duzula ziur zaude?",
        gl: "Tes certeza de que queres chamar ás emerxencias?",
        en: "Are you sure you want to call emergency services?",
      } as const)[lng] ?? t("confirm_emergency");

    if (window.confirm(msg)) window.location.href = "tel:112";
  }

  // 📤 Compartir (compacte, però coherent)
  const share = async () => {
    const lines: string[] = [];

    lines.push(`🛡️ ${t("share_title")}`);
    if (city) lines.push(`📍 ${city}`);
    lines.push("");

    const riskLines: string[] = [];

    // 🔥 Calor
    if (risk.startsWith("heat_") && !risk.endsWith("_safe")) {
      const lvl = risk.replace("heat_", "");
      riskLines.push(`• ${t("heat_risk")}: ${t(`risk_levels.${lvl}`, lvl)}`);
    }

    // ❄️ Fred
    if (risk.startsWith("cold_") && !risk.endsWith("_safe")) {
      const lvl = risk.replace("cold_", "");
      riskLines.push(`• ${t("cold_risk_title")}: ${t(`risk_levels.${lvl}`, lvl)}`);
    }

    // ☀️ UV
    if (typeof uvi === "number" && getUvLevelIndex(uvi) >= 1) {
      riskLines.push(`• ${t("uvi")}: ${uvi.toFixed(1)}`);
    }

    // 💨 Vent
    if (
      windRisk &&
      ["moderate", "strong", "very_strong", "extreme"].includes(windRisk)
    ) {
      riskLines.push(`• ${t("wind_risk")}: ${t(`windRisk.${windRisk}`, windRisk)}`);
    }

    if (riskLines.length > 0) {
      lines.push(`📍 ${t("current_risk")}:`);
      riskLines.forEach((x) => lines.push(x));
      lines.push("");
    }

    lines.push(`ℹ️ ${t("official_advice_footer")}`);
    lines.push("");
    lines.push("ThermoSafe · INSST · AEMET");
    lines.push("");
    lines.push("🍎 iOS: https://thermosafe.app");
    lines.push("🤖 Android: https://play.google.com/store/apps/details?id=app.vercel.thermosafe.twa");

    const text = lines.join("\n");

    await shareTextWithFallback(
      text,
      t("share_title"),
      navigator,
      { copied: t("share_copied"), failed: t("share_failed") },
      setShareStatus,
    );
  };

  return (
    <div className="safety-actions">
      <button type="button" className="safety-share-btn" onClick={share}>
        📤 {t("share")}
      </button>
      {shareStatus ? (
        <div aria-live="polite" role="status" style={{ fontSize: "0.82rem" }}>
          {shareStatus}
        </div>
      ) : null}

      <button
        className="safety-112-btn"
        onClick={() => confirmCall112(l)}
        title="Emergències"
      >
        🚨 112
      </button>
    </div>
  );
}
