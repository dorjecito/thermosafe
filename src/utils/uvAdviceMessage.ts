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

export type UvAdviceWeather = {
  weatherMain?: string | null;
  weatherCode?: number | null;
  rainMmH?: unknown;
};

/** Presentation only: never changes the UV value or classification. */
export function usesContextualUvAdvice(weather?: UvAdviceWeather): boolean {
  return Boolean(weather && (
    (typeof weather.rainMmH === "number" && Number.isFinite(weather.rainMmH) && weather.rainMmH > 0) ||
    ["Rain", "Drizzle", "Thunderstorm", "Snow", "Fog"].includes(weather.weatherMain ?? "") ||
    weather.weatherCode === 804
  ));
}

const contextualMessages: Record<Lang, readonly string[]> = {
  ca: [
    "Encara que el sol no sigui visible, cal tenir en compte l'índex UV. Si l'exposició exterior és prolongada, mantén una protecció solar adequada.",
    "La radiació UV és alta, encara que el sol no sigui visible. Limita l'exposició exterior i utilitza protecció solar reforçada.",
    "La radiació UV és molt alta, encara que el sol no sigui visible. Evita l'exposició prolongada a l'exterior i utilitza protecció solar màxima.",
    "La radiació UV és extrema, encara que el sol no sigui visible. Evita l'exposició a l'exterior. Risc molt elevat.",
  ],
  es: [
    "Aunque el sol no sea visible, hay que tener en cuenta el índice UV. Si la exposición al aire libre es prolongada, mantén una protección solar adecuada.",
    "La radiación UV es alta, aunque el sol no sea visible. Limita la exposición al aire libre y utiliza protección solar reforzada.",
    "La radiación UV es muy alta, aunque el sol no sea visible. Evita la exposición prolongada al aire libre y utiliza protección solar máxima.",
    "La radiación UV es extrema, aunque el sol no sea visible. Evita la exposición al aire libre. Riesgo muy elevado.",
  ],
  eu: [
    "Eguzkia ikusten ez bada ere, UV indizea kontuan hartu behar da. Kanpoan luzaroan egonez gero, mantendu eguzki-babes egokia.",
    "UV erradiazioa handia da, eguzkia ikusten ez bada ere. Mugatu kanpoko esposizioa eta indartu eguzki-babesa.",
    "UV erradiazioa oso handia da, eguzkia ikusten ez bada ere. Saihestu kanpoan luzaroan egotea eta erabili eguzki-babes handiena.",
    "UV erradiazioa muturrekoa da, eguzkia ikusten ez bada ere. Saihestu kanpoko esposizioa. Arrisku oso handia.",
  ],
  gl: [
    "Aínda que o sol non sexa visible, cómpre ter en conta o índice UV. Se a exposición ao aire libre é prolongada, mantén unha protección solar adecuada.",
    "A radiación UV é alta, aínda que o sol non sexa visible. Limita a exposición ao aire libre e utiliza protección solar reforzada.",
    "A radiación UV é moi alta, aínda que o sol non sexa visible. Evita a exposición prolongada ao aire libre e utiliza protección solar máxima.",
    "A radiación UV é extrema, aínda que o sol non sexa visible. Evita a exposición ao aire libre. Risco moi elevado.",
  ],
  en: [
    "Even when the sun is not visible, the UV index still matters. Use adequate sun protection if you spend a long time outdoors.",
    "UV radiation is high, even when the sun is not visible. Limit outdoor exposure and use extra sun protection.",
    "UV radiation is very high, even when the sun is not visible. Avoid prolonged outdoor exposure and use maximum sun protection.",
    "UV radiation is extreme, even when the sun is not visible. Avoid outdoor exposure. Very high risk.",
  ],
};

export const getTimeAwareUvAdvice = (
  uvi: number | null,
  lang: string,
  currentHour?: number | null,
  weather?: UvAdviceWeather
): string => {
  if (uvi === null) return "";

  const level = getUvLevelIndex(uvi);
  const t = messages[normalizeLang(lang)];

  if (level > 0 && usesContextualUvAdvice(weather)) {
    return contextualMessages[normalizeLang(lang)][level - 1];
  }

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
