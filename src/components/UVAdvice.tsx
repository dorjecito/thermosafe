import React from "react";

type Lang = "ca" | "es" | "eu" | "gl" | "en";

interface UVAdviceProps {
  uvi: number | null;
  lang: string; // pot venir com "ca-ES", etc.
  weatherMain?: string | null;
  cloudiness?: number | null;
}

const texts = {
  ca: {
    idx: "Índex UV",
    levels: ["Baix (0–2)", "Moderat (3–5)", "Alt (6–7)", "Molt alt (8–10)", "Extrem (11+)"],
    msgs: [
      "Protecció mínima necessària.",
      "Evita el sol de 12 h a 16 h. Protecció extra.",
      "Evita el sol de 12 h a 16 h. Protecció extra.",
      "Evita el sol en hores centrals i utilitza protecció màxima.",
      "Evita totalment l’exposició solar. Risc molt elevat.",
    ],
    cloudyMsgs: [
      "Protecció mínima necessària.",
      "Tot i la nuvolositat, la radiació UV continua present. Si l’exposició és prolongada, utilitza protecció solar.",
      "Tot i la nuvolositat, la radiació UV continua present. Utilitza protecció solar i evita exposicions llargues.",
      "Malgrat la nuvolositat, la radiació UV continua sent elevada. Reforça la protecció solar.",
      "Fins i tot amb molta nuvolositat, la radiació UV és extrema. Evita l’exposició prolongada.",
    ],
    cloudyNote: "La nuvolositat pot reduir parcialment l’exposició, però la radiació UV continua present.",
    rainyNote: "Tot i la pluja o els núvols, la radiació UV pot continuar afectant.",
    noData: "Sense dades UV disponibles.",
  },
  es: {
    idx: "Índice UV",
    levels: ["Bajo (0–2)", "Moderado (3–5)", "Alto (6–7)", "Muy alto (8–10)", "Extremo (11+)"],
    msgs: [
      "Protección mínima necesaria.",
      "Evita el sol de 12 h a 16 h. Protección extra.",
      "Evita el sol de 12 h a 16 h. Protección extra.",
      "Evita el sol en horas centrales y usa protección máxima.",
      "Evita totalmente la exposición solar. Riesgo muy elevado.",
    ],
    cloudyMsgs: [
      "Protección mínima necesaria.",
      "Aunque haya nubosidad, la radiación UV sigue presente. Si la exposición es prolongada, utiliza protección solar.",
      "Aunque haya nubosidad, la radiación UV sigue presente. Usa protección solar y evita exposiciones largas.",
      "A pesar de la nubosidad, la radiación UV sigue siendo elevada. Refuerza la protección solar.",
      "Incluso con mucha nubosidad, la radiación UV es extrema. Evita la exposición prolongada.",
    ],
    cloudyNote: "La nubosidad puede reducir parcialmente la exposición, pero la radiación UV sigue presente.",
    rainyNote: "Aunque haya lluvia o nubes, la radiación UV puede seguir afectando.",
    noData: "Sin datos UV disponibles.",
  },
  eu: {
    idx: "UV indizea",
    levels: ["Baxua (0–2)", "Moderatua (3–5)", "Altua (6–7)", "Oso altua (8–10)", "Muturrekoa (11+)"],
    msgs: [
      "Babes minimoa behar da.",
      "12etatik 16etara eguzkia saihestu. Babes gehigarria.",
      "12etatik 16etara eguzkia saihestu. Babes gehigarria.",
      "Eguerdiko orduetan eguzkia saihestu eta babes handiena erabili.",
      "Saihestu guztiz eguzki-esposizioa. Arrisku oso handia.",
    ],
    cloudyMsgs: [
      "Babes minimoa behar da.",
      "Hodeiak egon arren, UV erradiazioa presente dago. Esposizioa luzea bada, erabili eguzki-babesa.",
      "Hodeiak egon arren, UV erradiazioa presente dago. Erabili babesa eta saihestu esposizio luzeak.",
      "Hodeitasun handiarekin ere, UV erradiazioa handia da. Indartu eguzki-babesa.",
      "Hodei askorekin ere, UV erradiazioa muturrekoa da. Saihestu esposizio luzea.",
    ],
    cloudyNote: "Hodeitasunak esposizioa neurri batean murriztu dezake, baina UV erradiazioak hor jarraitzen du.",
    rainyNote: "Euria edo hodeiak egonda ere, UV erradiazioak eragina izan dezake.",
    noData: "Ez dago UV daturik eskuragarri.",
  },
  gl: {
    idx: "Índice UV",
    levels: ["Baixo (0–2)", "Moderado (3–5)", "Alto (6–7)", "Moi alto (8–10)", "Extremo (11+)"],
    msgs: [
      "Precísase protección mínima.",
      "Evita o sol de 12 h a 16 h. Protección extra.",
      "Evita o sol de 12 h a 16 h. Protección extra.",
      "Evita o sol nas horas centrais e usa protección máxima.",
      "Evita totalmente a exposición solar. Risco moi elevado.",
    ],
    cloudyMsgs: [
      "Precísase protección mínima.",
      "Aínda con nubosidade, a radiación UV segue presente. Se a exposición é prolongada, usa protección solar.",
      "Aínda con nubosidade, a radiación UV segue presente. Usa protección solar e evita exposicións longas.",
      "Mesmo con moita nubosidade, a radiación UV segue sendo alta. Reforza a protección solar.",
      "Mesmo con moita nubosidade, a radiación UV é extrema. Evita exposicións prolongadas.",
    ],
    cloudyNote: "A nubosidade pode reducir parcialmente a exposición, pero a radiación UV segue presente.",
    rainyNote: "Mesmo con choiva ou nubes, a radiación UV pode seguir afectando.",
    noData: "Non hai datos UV dispoñibles.",
  },
  en: {
    idx: "UV index",
    levels: ["Low (0–2)", "Moderate (3–5)", "High (6–7)", "Very high (8–10)", "Extreme (11+)"],
    msgs: [
      "Minimal protection required.",
      "Avoid sun from 12:00 to 16:00. Extra protection.",
      "Avoid sun from 12:00 to 16:00. Extra protection.",
      "Avoid peak hours and use maximum protection.",
      "Avoid sun exposure completely. Very high risk.",
    ],
    cloudyMsgs: [
      "Minimal protection required.",
      "Even with heavy cloud cover, UV radiation is still present. Use sun protection if exposure is prolonged.",
      "Even with heavy cloud cover, UV radiation is still present. Use protection and avoid long exposure.",
      "Despite the cloud cover, UV radiation remains high. Reinforce sun protection.",
      "Even with very cloudy skies, UV radiation is extreme. Avoid prolonged exposure.",
    ],
    cloudyNote: "Cloud cover may partly reduce exposure, but UV radiation is still present.",
    rainyNote: "Even with rain or clouds, UV radiation may still affect you.",
    noData: "No UV data available.",
  },
} as const;

const colors = ["#4caf50", "#ffeb3b", "#ff9800", "#f44336", "#9c27b0"] as const;

const normalizeLang = (lang: string): Lang => {
  const raw = String(lang || "ca").trim().toLowerCase();
  const primary = raw.split(/[-_]/)[0].slice(0, 2) as Lang;
  return (["ca", "es", "eu", "gl", "en"] as const).includes(primary) ? primary : "ca";
};

const safeUvi = (uvi: number) => Math.max(0, uvi);

const band = (uviRounded1: number): 0 | 1 | 2 | 3 | 4 => {
  const u = safeUvi(uviRounded1);
  if (u < 3) return 0;
  if (u < 6) return 1;
  if (u < 8) return 2;
  if (u < 11) return 3;
  return 4;
};

const isRainyWeather = (weatherMain?: string | null): boolean => {
  return (
    weatherMain === "Rain" ||
    weatherMain === "Drizzle" ||
    weatherMain === "Thunderstorm"
  );
};

const isVeryCloudy = (cloudiness?: number | null): boolean => {
  return typeof cloudiness === "number" && cloudiness >= 85;
};

const UVAdvice: React.FC<UVAdviceProps> = ({
  uvi,
  lang,
  weatherMain,
  cloudiness,
}) => {
  const lng = normalizeLang(lang);
  const L = texts[lng];

  if (uvi === null || !Number.isFinite(uvi)) {
    return (
      <div
        style={{
          backgroundColor: "#e5e7eb",
          color: "#000",
          padding: "1rem",
          borderRadius: 8,
          marginTop: "1rem",
        }}
      >
        <strong>🔆 {L.idx}: —</strong>
        <p style={{ marginTop: ".5rem" }}>{L.noData}</p>
      </div>
    );
  }

  const u = Number(safeUvi(uvi).toFixed(1));
  const b = band(u);

  const rainy = isRainyWeather(weatherMain);
  const veryCloudy = isVeryCloudy(cloudiness);

  let extraNote: string | null = null;

  if (rainy) {
    extraNote = L.rainyNote;
  } else if (veryCloudy && u >= 3) {
    extraNote = L.cloudyNote;
  }

  const mainMsg =
    veryCloudy && u >= 3 && !rainy
      ? L.cloudyMsgs[b]
      : L.msgs[b];

  return (
    <div
      style={{
        backgroundColor: colors[b],
        color: "#000",
        padding: "1rem",
        borderRadius: 8,
        marginTop: "1rem",
      }}
    >
      <strong>
        🔆 {L.idx}: {u.toFixed(1)} — {L.levels[b]}
      </strong>

      <p style={{ marginTop: ".5rem", marginBottom: extraNote ? ".4rem" : 0 }}>
        {mainMsg}
      </p>

      {extraNote && (
        <p style={{ marginTop: 0, fontSize: "0.95rem", opacity: 0.9 }}>
          {extraNote}
        </p>
      )}
    </div>
  );
};

export default UVAdvice;