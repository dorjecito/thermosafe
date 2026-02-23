import * as React from "react";
import { getUVDetailFromOpenUV } from "../services/openUV"; // ✅ IMPORTANT: ajusta al nom real del fitxer (openuv.ts)

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
    na: "—",
  },
  es: {
    maxToday: "UV máximo hoy",
    sunrise: "Salida",
    sunset: "Puesta",
    details: "Detalles",
    updated: "Actualizado",
    ozone: "Ozono",
    na: "—",
  },
  eu: {
    maxToday: "Gaurko UV max",
    sunrise: "Egunsentia",
    sunset: "Ilunabarra",
    details: "Xehetasunak",
    updated: "Eguneratua",
    ozone: "Ozonoa",
    na: "—",
  },
  gl: {
    maxToday: "UV máximo hoxe",
    sunrise: "Amencer",
    sunset: "Solpor",
    details: "Detalles",
    updated: "Actualizado",
    ozone: "Ozono",
    na: "—",
  },
  en: {
    maxToday: "Today's max UV",
    sunrise: "Sunrise",
    sunset: "Sunset",
    details: "Details",
    updated: "Updated",
    ozone: "Ozone",
    na: "—",
  },
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

  // ✅ tolerància camelCase (per si el servei/mapper t’ho retorna així)
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

export default function UVDetailPanel({ lat, lon, lang }: Props) {
  const t = TXT[lang] ?? TXT.ca;

  const [detail, setDetail] = React.useState<UVDetailShape | null>(null);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    // Si encara no hi ha coordenades, neteja i no facis fetch
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

  // ✅ UV màxim tolerant (underscore o camelCase)
  const uvMax = toNum(detail?.uv_max ?? detail?.uvMax);
  const uvMaxTime = fmtTime((detail?.uv_max_time ?? detail?.uvMaxTime) ?? null) ?? t.na;

  // ✅ sunrise/sunset tolerant (sun_info o sunInfo / sun_times o sunTimes)
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

  const updated = fmtTime((detail?.uv_time ?? detail?.uvTime ?? null) as any);
  const ozone = typeof detail?.ozone === "number" ? Math.round(detail.ozone) : null;
  const ozoneTime = fmtTime((detail?.ozone_time ?? detail?.ozoneTime ?? null) as any);

  return (
    <div style={{ marginTop: 8 }}>
      {/* Línies bàsiques sempre visibles */}
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

      {/* Detalls plegables */}
      <details style={{ marginTop: 6 }}>
        <summary className="muted" style={{ cursor: "pointer" }}>
          {t.details}
        </summary>

        <div className="muted" style={{ marginTop: 6, display: "grid", gap: 4 }}>
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
        </div>
      </details>
    </div>
  );
}