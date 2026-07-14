import * as React from "react";
import { getUVDetailFromOpenUV } from "../services/openUV";

type Lang = "ca" | "es" | "eu" | "gl" | "en";

type Props = {
  lat: number | null;
  lon: number | null;
  lang: Lang;
  sourceNote?: string;
};

const TXT: Record<
  Lang,
  {
    dayInfo: string;
    sunrise: string;
    sunset: string;
    details: string;
    ozoneMeasurement: string;
    ozoneInfo: string;
    ozoneLow: string;
    ozoneNormal: string;
    ozoneHigh: string;
    na: string;
  }
> = {
  ca: {
    dayInfo: "Informació del dia",
    sunrise: "Sortida",
    sunset: "Posta",
    details: "Detalls",
    ozoneMeasurement: "Mesura d’ozó",
    ozoneInfo: "Valors habituals: 250–400 DU.",
    ozoneLow: "Capa d’ozó baixa (pot augmentar el risc UV).",
    ozoneNormal: "Capa d’ozó dins rang habitual.",
    ozoneHigh: "Capa d’ozó molt alta.",
    na: "—",
  },
  es: {
    dayInfo: "Información del día",
    sunrise: "Salida",
    sunset: "Puesta",
    details: "Detalles",
    ozoneMeasurement: "Medida de ozono",
    ozoneInfo: "Valores habituales: 250–400 DU.",
    ozoneLow: "Capa de ozono baja (puede aumentar el riesgo UV).",
    ozoneNormal: "Capa de ozono dentro de rangos habituales.",
    ozoneHigh: "Capa de ozono muy alta.",
    na: "—",
  },
  eu: {
    dayInfo: "Eguneko informazioa",
    sunrise: "Egunsentia",
    sunset: "Ilunabarra",
    details: "Xehetasunak",
    ozoneMeasurement: "Ozono-neurketa",
    ozoneInfo: "Balio arruntak: 250–400 DU.",
    ozoneLow: "Ozono-geruza baxua (UV arriskua handitu daiteke).",
    ozoneNormal: "Ozono-geruza ohiko tartean.",
    ozoneHigh: "Ozono-geruza oso altua.",
    na: "—",
  },
  gl: {
    dayInfo: "Información do día",
    sunrise: "Amencer",
    sunset: "Solpor",
    details: "Detalles",
    ozoneMeasurement: "Medida de ozono",
    ozoneInfo: "Valores habituais: 250–400 DU.",
    ozoneLow: "Capa de ozono baixa (pode aumentar o risco UV).",
    ozoneNormal: "Capa de ozono en rango habitual.",
    ozoneHigh: "Capa de ozono moi alta.",
    na: "—",
  },
  en: {
    dayInfo: "Day information",
    sunrise: "Sunrise",
    sunset: "Sunset",
    details: "Details",
    ozoneMeasurement: "Ozone measurement",
    ozoneInfo: "Typical values: 250–400 DU.",
    ozoneLow: "Low ozone layer (UV risk may increase).",
    ozoneNormal: "Ozone layer within typical range.",
    ozoneHigh: "Very high ozone layer.",
    na: "—",
  },
};

const DAY_INFO_ITEM_STYLE: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "flex-start",
  gap: 6,
  width: "fit-content",
  maxWidth: "100%",
  padding: "4px 8px",
  borderRadius: 10,
  border: "1px solid rgba(148, 163, 184, 0.28)",
  background: "rgba(148, 163, 184, 0.10)",
};

const DAY_INFO_ICON_STYLE: React.CSSProperties = {
  lineHeight: 1.2,
};

type UVDetailShape = {
  // underscore (OpenUV)
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

  // tolerància camelCase
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
  if (typeof x === "string" && x.trim() !== "" && Number.isFinite(Number(x))) return Number(x);
  return null;
}

// ✅ etiqueta curta segons DU
function ozoneLabel(du: number, t: (typeof TXT)[Lang]) {
  if (du < 220) return t.ozoneLow;
  if (du > 450) return t.ozoneHigh;
  return t.ozoneNormal;
}

export function formatOzoneMeasurement(
  ozone: number | null,
  ozoneTime: string | null,
  labels: { ozoneMeasurement: string }
): string | null {
  if (ozone == null) return null;
  return `${labels.ozoneMeasurement}: ${ozone} DU${ozoneTime ? ` (${ozoneTime})` : ""}`;
}

export default function UVDetailPanel({ lat, lon, lang, sourceNote }: Props) {
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
      .catch(() => {
        if (!alive) return;
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

  const sunrise =
    fmtTime(
      (detail?.sun_info?.sun_times?.sunrise ??
        detail?.sunInfo?.sunTimes?.sunrise ??
        null) as any
    ) ?? t.na;

  const sunset =
    fmtTime(
      (detail?.sun_info?.sun_times?.sunset ??
        detail?.sunInfo?.sunTimes?.sunset ??
        null) as any
    ) ?? t.na;

  const ozone = typeof detail?.ozone === "number" ? Math.round(detail.ozone) : null;
  const ozoneTime = fmtTime((detail?.ozone_time ?? detail?.ozoneTime ?? null) as any);
  const ozoneMeasurementText = formatOzoneMeasurement(ozone, ozoneTime, t);

  return (
    <div style={{ marginTop: 8 }}>
      <div className="muted" style={{ display: "grid", gap: 6 }}>
        <strong>{t.dayInfo}</strong>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
            gap: "4px 10px",
            lineHeight: 1.25,
          }}
        >
          <span style={DAY_INFO_ITEM_STYLE}>
            <span aria-hidden="true" style={DAY_INFO_ICON_STYLE}>
              🌅
            </span>
            <span>
              <strong>{t.sunrise}:</strong> {loading ? "…" : sunrise}
            </span>
          </span>
          <span style={DAY_INFO_ITEM_STYLE}>
            <span aria-hidden="true" style={DAY_INFO_ICON_STYLE}>
              🌇
            </span>
            <span>
              <strong>{t.sunset}:</strong> {loading ? "…" : sunset}
            </span>
          </span>
          {loading && (
            <span style={DAY_INFO_ITEM_STYLE}>
              <span aria-hidden="true" style={DAY_INFO_ICON_STYLE}>
                🛡️
              </span>
              <span>
                <strong>{t.ozoneMeasurement}:</strong> …
              </span>
            </span>
          )}
          {!loading && ozoneMeasurementText && (
            <span style={DAY_INFO_ITEM_STYLE}>
              <span aria-hidden="true" style={DAY_INFO_ICON_STYLE}>
                🛡️
              </span>
              <span>{ozoneMeasurementText}</span>
            </span>
          )}
        </div>
      </div>

      <details style={{ marginTop: 6 }}>
        <summary className="muted" style={{ cursor: "pointer" }}>
          {t.details}
        </summary>

        <div className="muted" style={{ marginTop: 6, display: "grid", gap: 6 }}>
          {/* ✅ línia curta d’interpretació + rang */}
          {!loading && ozone != null && (
            <div style={{ fontSize: "0.9em", opacity: 0.9 }}>
              {ozoneLabel(ozone, t)} {t.ozoneInfo}
            </div>
          )}

          {sourceNote && (
            <div style={{ fontSize: "0.9em", opacity: 0.9 }}>
              ℹ️ {sourceNote}
            </div>
          )}
        </div>
      </details>
    </div>
  );
}
