import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import "./GuidePage.css";

export const GUIDE_SECTIONS = [
  ["about", "que-es", "☀"],
  ["start", "primers-passos", "⌖"],
  ["personalization", "activitat", "↟"],
  ["risks", "riscos", "◈"],
  ["notifications", "notificacions", "🔔"],
  ["location", "ubicacio", "⌖"],
  ["official", "avisos-oficials", "⚑"],
  ["installation", "installacio", "↓"],
  ["faq", "preguntes-frequents", "?"],
  ["sources", "fonts-seguretat", "ⓘ"],
  ["contact", "contacte", "✉"],
] as const;

const LANGUAGES = [
  ["ca", "Català"], ["es", "Español"], ["eu", "Euskara"],
  ["gl", "Galego"], ["en", "English"],
] as const;

type Block = { title: string; text: string };
type Section = { title: string; paragraphs: string[]; blocks: Block[]; details?: Block; email?: string; emergencyNote?: string };

type TableRow = { interval: string; level: string };

const scaleNames: Record<string, string[]> = {
  ca: ["Calor", "Fred", "Vent", "Radiació UV"], es: ["Calor", "Frío", "Viento", "Radiación UV"],
  eu: ["Beroa", "Hotza", "Haizea", "UV"], gl: ["Calor", "Frío", "Vento", "Radiación UV"], en: ["Heat", "Cold", "Wind", "UV"],
};
const tableHeadings: Record<string, [string, string]> = {
  ca: ["Interval", "Nivell de risc"], es: ["Intervalo", "Nivel de riesgo"], eu: ["Tartea", "Arrisku-maila"], gl: ["Intervalo", "Nivel de risco"], en: ["Range", "Risk level"],
};
const activityHeadings: Record<string, string> = { ca: "Activitat", es: "Actividad", eu: "Jarduera", gl: "Actividade", en: "Activity" };
const windExplanations: Record<string, string> = {
  ca: "Els llindars s’apliquen a partir del valor indicat.",
  es: "Los umbrales se aplican a partir del valor indicado.",
  eu: "Atalaseak adierazitako baliotik aurrera aplikatzen dira.",
  gl: "Os limiares aplícanse a partir do valor indicado.",
  en: "Thresholds apply from the stated value.",
};
const intervalHeadings: Record<string, string[]> = {
  ca: ["Interval (°C)", "Interval (°C)", "Interval (km/h)", "Índex UV"],
  es: ["Intervalo (°C)", "Intervalo (°C)", "Intervalo (km/h)", "Índice UV"],
  eu: ["Tartea (°C)", "Tartea (°C)", "Tartea (km/h)", "UV indizea"],
  gl: ["Intervalo (°C)", "Intervalo (°C)", "Intervalo (km/h)", "Índice UV"],
  en: ["Range (°C)", "Range (°C)", "Range (km/h)", "UV index"],
};

function parseScale(text: string, language: string) {
  return text.split("\n").filter(Boolean).map((line, index) => {
    const colon = line.indexOf(":");
    const context = line.slice(0, colon);
    const [, explanation] = context.split(", ");
    const entries = line.slice(colon + 1).split("; ").map((item) => {
      const comma = item.lastIndexOf(", ");
      return { interval: item.slice(0, comma), level: item.slice(comma + 2) };
    });
    return { name: scaleNames[language]?.[index] ?? scaleNames.en[index], note: explanation, entries };
  });
}

function parseWind(text: string, language: string) {
  const lines = text.split("\n");
  const intro = lines.shift() ?? "";
  const colon = intro.indexOf(":");
  const labels = intro.slice(colon + 1).split("/").map((label) => {
    const value = label.trim().split(". ")[0];
    return value.charAt(0).toLocaleUpperCase() + value.slice(1);
  });
  const rows = lines.filter(Boolean).map((line) => {
    const split = line.lastIndexOf(": ");
    const values = line.slice(split + 2).split(" / ").map((value) => value.replace(/\.$/, ""));
    return { activity: line.slice(0, split), values };
  });
  const explanation = windExplanations[language] ?? windExplanations.en;
  return { labels, rows, explanation };
}

function setMeta(attribute: "name" | "property", key: string, content: string) {
  let element = document.head.querySelector<HTMLMetaElement>(`meta[${attribute}="${key}"]`);
  if (!element) {
    element = document.createElement("meta");
    element.setAttribute(attribute, key);
    document.head.appendChild(element);
  }
  element.content = content;
}

export default function GuidePage() {
  const { t, i18n } = useTranslation();
  const language = (i18n.resolvedLanguage || i18n.language || "en").slice(0, 2);

  // Match the existing switcher's ts-lang precedence, without importing push code.
  useEffect(() => {
    try {
      const saved = localStorage.getItem("ts-lang")?.slice(0, 2);
      if (LANGUAGES.some(([code]) => code === saved)) void i18n.changeLanguage(saved);
    } catch { /* Storage may be unavailable in private browsing. */ }
  }, [i18n]);

  useEffect(() => {
    document.documentElement.lang = language;
    document.title = t("guide.metaTitle");
    setMeta("name", "description", t("guide.description"));
    document.querySelector('link[rel="canonical"]')?.setAttribute("href", "https://thermosafe.app/guia");
    setMeta("property", "og:title", t("guide.metaTitle"));
    setMeta("name", "twitter:title", t("guide.metaTitle"));
    setMeta("property", "og:description", t("guide.description"));
    setMeta("name", "twitter:description", t("guide.description"));
    setMeta("property", "og:url", "https://thermosafe.app/guia");
  }, [language, t]);

  const changeLanguage = (next: string) => {
    void i18n.changeLanguage(next);
    try { localStorage.setItem("ts-lang", next); } catch { /* Keep the current session usable. */ }
  };

  return (
    <div className="guide-page" id="guide-top">
      <a className="guide-skip" href="#guide-content">{t("guide.skip")}</a>
      <header className="guide-header">
        <a className="guide-brand" href="/">☀️ ThermoSafe</a>
        <label className="guide-language">
          <span>{t("guide.language")}</span>
          <select value={language} onChange={(event) => changeLanguage(event.target.value)}>
            {LANGUAGES.map(([code, name]) => <option key={code} value={code}>{name}</option>)}
          </select>
        </label>
      </header>
      <main id="guide-content">
        <div className="guide-hero">
          <p className="guide-eyebrow">{t("guide.eyebrow")}</p>
          <h1>{t("guide.title")}</h1>
          <p>{t("guide.description")}</p>
          <a className="guide-home" href="/">← {t("guide.back")}</a>
        </div>
        <aside className="guide-warning" aria-label={t("guide.safetyTitle")}>
          <strong>{t("guide.safetyTitle")}</strong>
          <p>{t("guide.safety")}</p>
        </aside>
        <nav className="guide-index" aria-label={t("guide.index")}>
          <h2>{t("guide.index")}</h2>
          <ol>
            {GUIDE_SECTIONS.map(([key, id]) => (
              <li key={key}><a href={`#${id}`}>{t(`guide.sections.${key}.title`)}</a></li>
            ))}
          </ol>
        </nav>
        {GUIDE_SECTIONS.map(([key, id, icon], index) => {
          const section = t(`guide.sections.${key}`, { returnObjects: true }) as Section;
          return (
            <section className="guide-section" id={id} key={key} aria-labelledby={`${id}-title`}>
              <h2 id={`${id}-title`}><span aria-hidden="true">{icon}</span> {index + 1}. {section.title}</h2>
              {section.paragraphs.map((paragraph, i) => <p key={i}>{paragraph}</p>)}
              {key === "contact" && <p><a href={`mailto:${section.email}`}>{section.email}</a></p>}
              {key === "contact" && <p>{(section as Section & { emergencyNote: string }).emergencyNote}</p>}
              <div className="guide-blocks">
                {section.blocks.map((block, i) => key === "faq" ? (
                  <details key={i}><summary>{block.title}</summary><p>{block.text}</p></details>
                ) : (
                  <div className="guide-block" key={i}><h3>{block.title}</h3><p>{block.text}</p></div>
                ))}
              </div>
              {section.details && <details className="guide-data-details"><summary>{section.details.title}{key === "personalization" ? " (km/h)" : ""}</summary>
                {key === "risks" ? parseScale(section.details.text, language).map((risk) => <div className="guide-scale" key={risk.name}>
                  <h3>{risk.name}</h3>{risk.note && <p className="guide-table-note">{risk.note}</p>}
                  <div className="guide-table-wrap"><table><thead><tr><th scope="col">{intervalHeadings[language]?.[scaleNames[language]?.indexOf(risk.name) ?? 0]}</th><th scope="col">{tableHeadings[language]?.[1]}</th></tr></thead>
                    <tbody>{risk.entries.map((row) => <tr key={row.interval}><td>{row.interval}</td><td>{row.level}</td></tr>)}</tbody></table></div>
                </div>) : key === "personalization" ? (() => { const wind = parseWind(section.details!.text, language); return <><p className="guide-table-note">{wind.explanation}</p><div className="guide-table-wrap guide-wind-table"><table><thead><tr><th scope="col">{activityHeadings[language]}</th>{wind.labels.map((label) => <th scope="col" key={label}>{label}</th>)}</tr></thead><tbody>{wind.rows.map((row) => <tr key={row.activity}><th scope="row">{row.activity}</th>{row.values.map((value, i) => <td key={i}><span className="guide-mobile-label">{wind.labels[i]}</span>{value}</td>)}</tr>)}</tbody></table></div></>; })() : <p>{section.details.text}</p>}
              </details>}
              <a className="guide-to-top" href="#guide-top">↑ {t("guide.top")}</a>
            </section>
          );
        })}
      </main>
      <footer className="guide-footer"><a className="guide-home" href="/">← {t("guide.back")}</a><p>ThermoSafe · {t("guide.title")}</p></footer>
    </div>
  );
}
