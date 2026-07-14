import { getUvLevelIndex } from "./uv";

type Lang = "ca" | "es" | "eu" | "gl" | "en";

const normalizeLang = (lang: string): Lang => {
  const raw = String(lang || "ca").trim().toLowerCase();
  const primary = raw.split(/[-_]/)[0].slice(0, 2) as Lang;
  return (["ca", "es", "eu", "gl", "en"] as const).includes(primary) ? primary : "ca";
};

const messages: Record<
  Lang,
  {
    base: string[];
    lateHigh: string;
    lateVeryHigh: string;
    lateExtreme: string;
  }
> = {
  ca: {
    base: [
      "Protecció mínima necessària.",
      "Si l’exposició és prolongada, utilitza protecció solar i cerca ombra a les hores centrals.",
      "Evita el sol entre les 12 i les 16 h. Protecció extra.",
      "Evita el sol en hores centrals i utilitza protecció màxima.",
      "Evita totalment l’exposició solar. Risc molt elevat.",
    ],
    lateHigh:
      "Encara hi ha radiació UV significativa. Si continues a l’exterior, utilitza protecció solar.",
    lateVeryHigh:
      "La radiació UV disminueix, però encara convé protegir la pell si l’exposició és prolongada.",
    lateExtreme:
      "La radiació UV continua sent molt intensa. Mantén la màxima protecció si continues a l’exterior.",
  },
  es: {
    base: [
      "Protección mínima necesaria.",
      "Si la exposición es prolongada, utiliza protección solar y busca sombra en las horas centrales.",
      "Evita el sol entre las 12 y las 16 h. Protección extra.",
      "Evita el sol en horas centrales y usa protección máxima.",
      "Evita totalmente la exposición solar. Riesgo muy elevado.",
    ],
    lateHigh:
      "Todavía hay radiación UV significativa. Si continúas al aire libre, utiliza protección solar.",
    lateVeryHigh:
      "La radiación UV disminuye, pero aún conviene proteger la piel si la exposición es prolongada.",
    lateExtreme:
      "La radiación UV sigue siendo muy intensa. Mantén la máxima protección si continúas al aire libre.",
  },
  eu: {
    base: [
      "Babes minimoa behar da.",
      "Esposizioa luzea bada, erabili eguzki-babesa eta bilatu itzala eguneko erdiko orduetan.",
      "12:00etatik 16:00etara eguzkia saihestu. Babes gehigarria.",
      "Eguerdiko orduetan eguzkia saihestu eta babes handiena erabili.",
      "Saihestu guztiz eguzki-esposizioa. Arrisku oso handia.",
    ],
    lateHigh:
      "UV erradiazio esanguratsua dago oraindik. Kanpoan jarraitzen baduzu, erabili eguzki-babesa.",
    lateVeryHigh:
      "UV erradiazioa jaisten ari da, baina esposizioa luzea bada azala babestea komeni da.",
    lateExtreme:
      "UV erradiazioa oso bizia da oraindik. Kanpoan jarraitzen baduzu, mantendu babes handiena.",
  },
  gl: {
    base: [
      "Precísase protección mínima.",
      "Se a exposición é prolongada, usa protección solar e busca sombra nas horas centrais.",
      "Evita o sol entre as 12 e as 16 h. Protección extra.",
      "Evita o sol nas horas centrais e usa protección máxima.",
      "Evita totalmente a exposición solar. Risco moi elevado.",
    ],
    lateHigh:
      "Aínda hai radiación UV significativa. Se continúas no exterior, usa protección solar.",
    lateVeryHigh:
      "A radiación UV diminúe, pero aínda convén protexer a pel se a exposición é prolongada.",
    lateExtreme:
      "A radiación UV segue sendo moi intensa. Mantén a máxima protección se continúas no exterior.",
  },
  en: {
    base: [
      "Minimal protection required.",
      "Use sun protection for prolonged exposure and seek shade during peak hours.",
      "Avoid sun between 12:00 and 16:00. Extra protection.",
      "Avoid peak hours and use maximum protection.",
      "Avoid sun exposure completely. Very high risk.",
    ],
    lateHigh:
      "Significant UV radiation is still present. If you remain outdoors, use sun protection.",
    lateVeryHigh:
      "UV radiation is decreasing, but skin protection is still advisable for prolonged exposure.",
    lateExtreme:
      "UV radiation remains very intense. Use maximum protection if you remain outdoors.",
  },
};

export const getTimeAwareUvAdvice = (
  uvi: number | null,
  lang: string,
  currentHour?: number | null
): string => {
  if (uvi === null) return "";

  const level = getUvLevelIndex(uvi);
  const t = messages[normalizeLang(lang)];

  if (typeof currentHour === "number" && currentHour >= 18 && level >= 2) {
    return t.lateVeryHigh;
  }

  if (typeof currentHour === "number" && currentHour >= 16) {
    if (level === 2) return t.lateHigh;
    if (level === 3) return t.lateVeryHigh;
    if (level === 4) return t.lateExtreme;
  }

  return t.base[level] ?? "";
};
