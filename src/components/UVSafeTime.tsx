import * as React from "react";
import type { SkinType } from "../utils/safeExposure";
import { formatMinutes, getSafeMinutes } from "../utils/safeExposure";
import { getUVDetailFromOpenUV } from "../services/openUV";

type Lang = "ca" | "es" | "eu" | "gl" | "en";

type Props = {
  lat: number | null;
  lon: number | null;
  lang: Lang | string;
};

const MIN_UV_FOR_SAFE_TIME = 2;
const MAX_MINUTES_TO_DISPLAY = 6 * 60; // 6 hores (enfoc laboral)

const TXT: Record<
  Lang,
  {
    title: string;
    skin: string;
    none: string;
    approx: string;
    tip: string;
    lowUv: string;
    atLeast: (h: number) => string;
    s: (n: number) => string;
  }
> = {
  ca: {
    title: "Exposició acumulada estimada",
    skin: "Fototip",
    none: "No disponible",
    approx: "Estimació orientativa basada en índex UV actual",
    tip: "Aplica protecció solar i organitza pauses en hores centrals.",
    lowUv: "UVI molt baix: risc mínim per a jornada laboral habitual.",
    atLeast: (h) => `≥ ${h} h`,
    s: (n) => `Tipus ${n}`,
  },
  es: {
    title: "Exposición acumulada estimada",
    skin: "Fototipo",
    none: "No disponible",
    approx: "Estimación orientativa basada en índice UV actual",
    tip: "Usa protección solar y organiza pausas en horas centrales.",
    lowUv: "UVI muy bajo: riesgo mínimo para jornada laboral habitual.",
    atLeast: (h) => `≥ ${h} h`,
    s: (n) => `Tipo ${n}`,
  },
  eu: {
    title: "Metatutako esposizio estimatua",
    skin: "Fototipoa",
    none: "Ez dago eskuragarri",
    approx: "Uneko UV indizean oinarritutako estimazioa",
    tip: "Erabili eguzki-babesa eta antolatu atsedenaldiak erdiko orduetan.",
    lowUv: "UVI oso baxua: arrisku txikia lan-jardunean.",
    atLeast: (h) => `≥ ${h} h`,
    s: (n) => `Mota ${n}`,
  },
  gl: {
    title: "Exposición acumulada estimada",
    skin: "Fototipo",
    none: "Non dispoñible",
    approx: "Estimación orientativa baseada no índice UV actual",
    tip: "Usa protección solar e organiza pausas nas horas centrais.",
    lowUv: "UVI moi baixo: risco mínimo na xornada laboral habitual.",
    atLeast: (h) => `≥ ${h} h`,
    s: (n) => `Tipo ${n}`,
  },
  en: {
    title: "Estimated cumulative exposure",
    skin: "Skin type",
    none: "Not available",
    approx: "Indicative estimate based on current UV index",
    tip: "Use sun protection and schedule breaks during peak hours.",
    lowUv: "Very low UV: minimal risk for a typical workday.",
    atLeast: (h) => `≥ ${h} h`,
    s: (n) => `Type ${n}`,
  },
};

function safeLang(raw?: string | null): Lang {
  const base = (raw || "ca").split("-")[0];
  return (["ca", "es", "eu", "gl", "en"].includes(base) ? base : "ca") as Lang;
}

export default function UVSafeTime({ lat, lon, lang }: Props) {
  const L = safeLang(lang);
  const t = TXT[L];

  const [skin, setSkin] = React.useState<SkinType>(3);
  const [mins, setMins] = React.useState<number | null>(null);
  const [uvNow, setUvNow] = React.useState<number | null>(null);
  const [loading, setLoading] = React.useState(false);

  const lowUv = uvNow != null && uvNow < MIN_UV_FOR_SAFE_TIME;

  const displayTime = React.useMemo(() => {
    if (mins == null) return null;
    if (mins > MAX_MINUTES_TO_DISPLAY) return t.atLeast(MAX_MINUTES_TO_DISPLAY / 60);
    return formatMinutes(mins);
  }, [mins, t]);

  React.useEffect(() => {
    if (lat == null || lon == null) return;

    let alive = true;
    setLoading(true);

    // reset mentre carrega (evita mostrar estat antic quan canvies ubicació)
    setUvNow(null);
    setMins(null);

    getUVDetailFromOpenUV(lat, lon)
      .then((detail) => {
        if (!alive) return;

        const uv = typeof (detail as any)?.uv === "number" ? (detail as any).uv : null;
        setUvNow(uv);

        if (uv != null && uv < MIN_UV_FOR_SAFE_TIME) {
          setMins(null);
          return;
        }

        const m = getSafeMinutes((detail as any)?.safe_exposure_time, skin);
        setMins(m);
      })
      .catch(() => {
        if (!alive) return;
        setUvNow(null);
        setMins(null);
      })
      .finally(() => {
        if (!alive) return;
        setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [lat, lon, skin]);

  return (
    <div className="info-block uv-block">
      <div className="block-title">{t.title}</div>

      <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <label className="muted">
          {t.skin}:{" "}
          <select value={skin} onChange={(e) => setSkin(Number(e.target.value) as SkinType)}>
            {[1, 2, 3, 4, 5, 6].map((n) => (
              <option key={n} value={n}>
                {t.s(n)}
              </option>
            ))}
          </select>
        </label>

        <div>
          {loading ? (
            <span className="muted">…</span>
          ) : lowUv ? (
            <span className="muted">{t.lowUv}</span>
          ) : displayTime != null ? (
            <strong>{displayTime}</strong>
          ) : (
            <span className="muted">{t.none}</span>
          )}
        </div>
      </div>

      <div className="muted" style={{ marginTop: 6 }}>
        {t.approx}. {t.tip}
      </div>
    </div>
  );
}