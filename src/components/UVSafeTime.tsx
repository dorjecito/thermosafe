import * as React from "react";
import { getUVDetailFromOpenUV } from "../services/openUV";

type Lang = "ca" | "es" | "eu" | "gl" | "en";

type Props = {
  lat: number | null;
  lon: number | null;
  lang: Lang;
};

const TXT: Record<
  Lang,
  {
    maxToday: string;
    sunrise: string;
    sunset: string;
    details: string;
    updated: string;
    ozone: string;
    ozoneInfo: string;
    ozoneLow: string;
    ozoneNormal: string;
    ozoneHigh: string;
    na: string;
  }
> = {
  ca: {
    maxToday: "UV màxim avui",
    sunrise: "Sortida",
    sunset: "Posta",
    details: "Detalls",
    updated: "Actualitzat",
    ozone: "Ozò",
    ozoneInfo: "Valors habituals: 250–400 DU.",
    ozoneLow: "Capa d’ozó baixa (pot augmentar el risc UV).",
    ozoneNormal: "Capa d’ozó dins rang habitual.",
    ozoneHigh: "Capa d’ozó molt alta.",
    na: "—",
  },
  es: {
    maxToday: "UV máximo hoy",
    sunrise: "Salida",
    sunset: "Puesta",
    details: "Detalles",
    updated: "Actualizado",
    ozone: "Ozono",
    ozoneInfo: "Valores habituales: 250–400 DU.",
    ozoneLow: "Capa de ozono baja (puede aumentar el riesgo UV).",
    ozoneNormal: "Capa de ozono dentro de rangos habituales.",
    ozoneHigh: "Capa de ozono muy alta.",
    na: "—",
  },
  eu: {
    maxToday: "Gaurko UV max",
    sunrise: "Egunsentia",
    sunset: "Ilunabarra",
    details: "Xehetasunak",
    updated: "Eguneratua",
    ozone: "Ozonoa",
    ozoneInfo: "Balio arruntak: 250–400 DU.",
    ozoneLow: "Ozono-geruza baxua (UV arriskua handitu daiteke).",
    ozoneNormal: "Ozono-geruza ohiko tartean.",
    ozoneHigh: "Ozono-geruza oso altua.",
    na: "—",
  },
  gl: {
    maxToday: "UV máximo hoxe",
    sunrise: "Amencer",
    sunset: "Solpor",
    details: "Detalles",
    updated: "Actualizado",
    ozone: "Ozono",
    ozoneInfo: "Valores habituais: 250–400 DU.",
    ozoneLow: "Capa de ozono baixa (pode aumentar o risco UV).",
    ozoneNormal: "Capa de ozono en rango habitual.",
    ozoneHigh: "Capa de ozono moi alta.",
    na: "—",
  },
  en: {
    maxToday: "Today's max UV",
    sunrise: "Sunrise",
    sunset: "Sunset",
    details: "Details",
    updated: "Updated",
    ozone: "Ozone",
    ozoneInfo: "Typical values: 250–400 DU.",
    ozoneLow: "Low ozone layer (UV risk may increase).",
    ozoneNormal: "Ozone layer within typical range.",
    ozoneHigh: "Very high ozone layer.",
    na: "—",
  },
};

type UVDetailShape = {
  uv_max?: number | string | null;
  uv_max_time?: string | null;
  uv_time?: string | null;
  ozone?: number | null;
  ozone_time?: string | null;
  sun_info?: {
    sun_times?: {
      sunrise?: string | null;
      sunset?: string | null;
    } | null;
  } | null;

  uvMax?: number | string | null;
  uvMaxTime?: string | null;
  uvTime?: string | null;
  ozoneTime?: string | null;
  sunInfo?: {
    sunTimes?: {
      sunrise?: string | null;
      sunset?: string | null;
    } | null;
  } | null;
};

function fmtTime(iso?: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function toNum(x: unknown): number | null {
  if (typeof x === "number" && Number.isFinite(x)) return x;
  if (typeof x === "string" && x.trim() !== "" && Number.isFinite(Number(x))) {
    return Number(x);
  }
  return null;
}

function ozoneLabel(du: number, t: (typeof TXT)[Lang]) {
  if (du < 220) return t.ozoneLow;
  if (du > 450) return t.ozoneHigh;
  return t.ozoneNormal;
}

export default function UVDetailPanel({ lat, lon, lang }: Props) {
  const t = TXT[lang] ?? TXT.ca;

  const [detail, setDetail] = React.useState<UVDetailShape | null>(null);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    if (lat == null || lon == null) {
      setDetail(null);
      setLoading(false);
      return;
    }

    let alive = true;
    setLoading(true);

    getUVDetailFromOpenUV(lat, lon)
      .then((d) => {
        if (!alive) return;
        setDetail((d as UVDetailShape) ?? null);
      })
      .catch((err) => {
        if (!alive) return;
        console.error("[UVDetailPanel] Error carregant detall UV:", err);
        setDetail(null);
      })
      .finally(() => {
        if (!alive) return;
        setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [lat, lon]);

  const uvMax = toNum(detail?.uv_max ?? detail?.uvMax);
  const uvMaxTime = fmtTime(detail?.uv_max_time ?? detail?.uvMaxTime ?? null) ?? t.na;

  const sunrise =
    fmtTime(
      detail?.sun_info?.sun_times?.sunrise ??
        detail?.sunInfo?.sunTimes?.sunrise ??
        null
    ) ?? t.na;

  const sunset =
    fmtTime(
      detail?.sun_info?.sun_times?.sunset ??
        detail?.sunInfo?.sunTimes?.sunset ??
        null
    ) ?? t.na;

  const updated = fmtTime(detail?.uv_time ?? detail?.uvTime ?? null);
  const ozone = typeof detail?.ozone === "number" ? Math.round(detail.ozone) : null;
  const ozoneTime = fmtTime(detail?.ozone_time ?? detail?.ozoneTime ?? null);

  return (
    <div style={{ marginTop: 8 }}>
      <div className="muted" style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <span>
          <strong>{t.maxToday}:</strong>{" "}
          {loading ? "…" : uvMax != null ? `${uvMax.toFixed(1)} (${uvMaxTime})` : t.na}
        </span>

        <span>
          <strong>{t.sunrise}:</strong> {loading ? "…" : sunrise} ·{" "}
          <strong>{t.sunset}:</strong> {loading ? "…" : sunset}
        </span>
      </div>

      <details style={{ marginTop: 6 }}>
        <summary className="muted" style={{ cursor: "pointer" }}>
          {t.details}
        </summary>

        <div className="muted" style={{ marginTop: 6, display: "grid", gap: 6 }}>
          <div>
            <strong>{t.updated}:</strong> {loading ? "…" : updated ?? t.na}
          </div>

          <div>
            <strong>{t.ozone}:</strong>{" "}
            {loading
              ? "…"
              : ozone != null
              ? `${ozone} DU${ozoneTime ? ` (${ozoneTime})` : ""}`
              : t.na}
          </div>

          {!loading && ozone != null && (
            <div style={{ fontSize: "0.9em", opacity: 0.9 }}>
              {ozoneLabel(ozone, t)} {t.ozoneInfo}
            </div>
          )}
        </div>
      </details>
    </div>
  );
}