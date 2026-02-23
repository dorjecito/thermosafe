import * as React from "react";
import type { SkinType } from "../utils/safeExposure";
import { formatMinutes, getSafeMinutes } from "../utils/safeExposure";
import { getUVDetailFromOpenUV } from "../services/openUV";

type Lang = "ca" | "es" | "eu" | "gl" | "en";

type Props = {
  lat: number | null;
  lon: number | null;
  lang: string; 
};

const TXT: Record<
  Lang,
  {
    title: string;
    skin: string;
    none: string;
    approx: string;
    tip: string;
    s: (n: number) => string;
  }
> = {
  ca: {
    title: "Temps segur d’exposició",
    skin: "Fototip",
    none: "No disponible",
    approx: "Estimació orientativa",
    tip: "Aplica protecció solar i redueix exposició en hores centrals.",
    s: (n) => `Tipus ${n}`,
  },
  es: {
    title: "Tiempo seguro de exposición",
    skin: "Fototipo",
    none: "No disponible",
    approx: "Estimación orientativa",
    tip: "Usa protección solar y reduce exposición en horas centrales.",
    s: (n) => `Tipo ${n}`,
  },
  eu: {
    title: "Esposizio-denbora segurua",
    skin: "Fototipoa",
    none: "Ez dago eskuragarri",
    approx: "Gutxi gorabeherako estimazioa",
    tip: "Erabili eguzki-babesa eta murriztu esposizioa erdiko orduetan.",
    s: (n) => `Mota ${n}`,
  },
  gl: {
    title: "Tempo seguro de exposición",
    skin: "Fototipo",
    none: "Non dispoñible",
    approx: "Estimación orientativa",
    tip: "Usa protección solar e reduce a exposición nas horas centrais.",
    s: (n) => `Tipo ${n}`,
  },
  en: {
    title: "Safe exposure time",
    skin: "Skin type",
    none: "Not available",
    approx: "Indicative estimate",
    tip: "Use sun protection and reduce exposure during peak hours.",
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
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    if (lat == null || lon == null) return;

    let alive = true;
    setLoading(true);

    getUVDetailFromOpenUV(lat, lon)
      .then((detail) => {
        if (!alive) return;
        const m = getSafeMinutes(detail?.safe_exposure_time, skin);
        setMins(m);
      })
      .catch(() => {
        if (!alive) return;
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
            <option value={1}>{t.s(1)}</option>
            <option value={2}>{t.s(2)}</option>
            <option value={3}>{t.s(3)}</option>
            <option value={4}>{t.s(4)}</option>
            <option value={5}>{t.s(5)}</option>
            <option value={6}>{t.s(6)}</option>
          </select>
        </label>

        <div>
          {loading ? (
            <span className="muted">…</span>
          ) : mins != null ? (
            <strong>{formatMinutes(mins)}</strong>
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