import type { WorkWindow, WorkWindowLang } from "./workWindow";
import type { WindActivityRisk } from "./windActivityProfile";

const COPY: Record<WorkWindowLang, {
  optimal: string;
  caution: string;
  activityCaution: string;
  limited: string;
  elevated: string;
  elevatedNote: string;
  avoid: string;
  avoidNote: string;
}> = {
  ca: {
    optimal: "Les condicions són adequades per a activitats a l’aire lliure.",
    caution: "Es poden realitzar activitats a l’aire lliure amb precaucions bàsiques.",
    activityCaution: "Es poden realitzar activitats a l’aire lliure, però cal tenir en compte les precaucions específiques de l’activitat seleccionada.",
    limited: "Convé limitar les activitats exigents o adaptar-les a les condicions actuals.",
    elevated: "El vent requereix precaucions addicionals per a l’activitat seleccionada. Consulta les recomanacions específiques.",
    elevatedNote: "El perfil seleccionat també requereix precaucions addicionals pel vent.",
    avoid: "El vent pot fer necessari aturar o ajornar l’activitat seleccionada. Consulta el consell específic.",
    avoidNote: "El vent també pot fer necessari aturar o ajornar l’activitat seleccionada.",
  },
  es: {
    optimal: "Las condiciones son adecuadas para actividades al aire libre.",
    caution: "Puedes hacer actividades al aire libre con precauciones básicas.",
    activityCaution: "Puedes realizar actividades al aire libre, pero debes tener en cuenta las precauciones específicas de la actividad seleccionada.",
    limited: "Conviene limitar las actividades exigentes o adaptarlas a las condiciones actuales.",
    elevated: "El viento requiere precauciones adicionales para la actividad seleccionada. Consulta las recomendaciones específicas.",
    elevatedNote: "El perfil seleccionado también requiere precauciones adicionales por el viento.",
    avoid: "El viento puede hacer necesario detener o aplazar la actividad seleccionada. Consulta el consejo específico.",
    avoidNote: "El viento también puede hacer necesario detener o aplazar la actividad seleccionada.",
  },
  eu: {
    optimal: "Baldintzak egokiak dira kanpoko jardueretarako.",
    caution: "Kanpoko jarduerak egin daitezke oinarrizko neurriak hartuta.",
    activityCaution: "Kanpoko jarduerak egin daitezke, baina hautatutako jardueraren berariazko neurriak kontuan hartu behar dira.",
    limited: "Komeni da jarduera zorrotzak mugatzea edo uneko baldintzetara egokitzea.",
    elevated: "Haizeak neurri gehiago hartzea eskatzen du hautatutako jarduerarako. Kontsultatu gomendio espezifikoak.",
    elevatedNote: "Hautatutako profilak haizeagatik neurri gehiago hartzea ere eskatzen du.",
    avoid: "Haizearen ondorioz, hautatutako jarduera eten edo atzeratu behar izatea gerta daiteke. Kontsultatu aholku espezifikoa.",
    avoidNote: "Haizearen ondorioz, hautatutako jarduera eten edo atzeratu behar izatea ere gerta daiteke.",
  },
  gl: {
    optimal: "As condicións son axeitadas para actividades ao aire libre.",
    caution: "Podes facer actividades ao aire libre con precaucións básicas.",
    activityCaution: "Podes realizar actividades ao aire libre, pero debes ter en conta as precaucións específicas da actividade seleccionada.",
    limited: "Convén limitar as actividades esixentes ou adaptalas ás condicións actuais.",
    elevated: "O vento require precaucións adicionais para a actividade seleccionada. Consulta as recomendacións específicas.",
    elevatedNote: "O perfil seleccionado tamén require precaucións adicionais polo vento.",
    avoid: "O vento pode facer necesario deter ou aprazar a actividade seleccionada. Consulta o consello específico.",
    avoidNote: "O vento tamén pode facer necesario deter ou aprazar a actividade seleccionada.",
  },
  en: {
    optimal: "Conditions are suitable for outdoor activities.",
    caution: "You can do outdoor activities with basic precautions.",
    activityCaution: "You can do outdoor activities, but you should take into account the specific precautions for the selected activity.",
    limited: "Limit demanding activities or adapt them to current conditions.",
    elevated: "Wind requires extra precautions for the selected activity. Check the specific recommendations.",
    elevatedNote: "The selected profile also calls for extra precautions because of the wind.",
    avoid: "Wind may make it necessary to stop or postpone the selected activity. Check the specific advice.",
    avoidNote: "Wind may also make it necessary to stop or postpone the selected activity.",
  },
};

/** Adjusts only the displayed text; work-window and contextual-risk classifications remain independent. */
export function composeWindActivityWorkWindowText(
  generalText: string,
  generalLevel: WorkWindow,
  windRisk: WindActivityRisk | null,
  lang: WorkWindowLang
): string {
  if (!windRisk) return generalText;

  const copy = COPY[lang] ?? COPY.ca;
  const expectedGeneric = copy[generalLevel];
  const isGeneric = generalText === expectedGeneric;

  if (windRisk === "caution") {
    return generalLevel === "caution" && isGeneric ? copy.activityCaution : generalText;
  }

  if (windRisk === "elevated") {
    if (generalLevel === "avoid" || (generalLevel === "limited" && isGeneric)) return generalText;
    return isGeneric ? copy.elevated : `${generalText} ${copy.elevatedNote}`;
  }

  if (generalLevel === "avoid") return generalText;
  if (isGeneric) return copy.avoid;
  return `${generalText} ${copy.avoidNote}`;
}
