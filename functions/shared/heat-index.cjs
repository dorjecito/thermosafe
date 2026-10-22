"use strict";

/**
 * NWS heat-index procedure. Inputs are Celsius and relative humidity percent.
 * Returns null when either observation is unavailable or invalid.
 */
function calcHeatIndexCelsius(tempC, relativeHumidity) {
  if (
    typeof tempC !== "number" ||
    !Number.isFinite(tempC) ||
    typeof relativeHumidity !== "number" ||
    !Number.isFinite(relativeHumidity) ||
    relativeHumidity < 0 ||
    relativeHumidity > 100
  ) {
    return null;
  }

  const temperatureF = (tempC * 9) / 5 + 32;
  let heatIndexF =
    0.5 *
    (temperatureF +
      61 +
      (temperatureF - 68) * 1.2 +
      relativeHumidity * 0.094);
  heatIndexF = (heatIndexF + temperatureF) / 2;

  if (heatIndexF >= 80) {
    const t2 = temperatureF * temperatureF;
    const rh2 = relativeHumidity * relativeHumidity;

    heatIndexF =
      -42.379 +
      2.04901523 * temperatureF +
      10.14333127 * relativeHumidity -
      0.22475541 * temperatureF * relativeHumidity -
      0.00683783 * t2 -
      0.05481717 * rh2 +
      0.00122874 * t2 * relativeHumidity +
      0.00085282 * temperatureF * rh2 -
      0.00000199 * t2 * rh2;

    if (relativeHumidity < 13 && temperatureF >= 80 && temperatureF <= 112) {
      const adjustment =
        ((13 - relativeHumidity) / 4) *
        Math.sqrt((17 - Math.abs(temperatureF - 95)) / 17);
      heatIndexF -= adjustment;
    } else if (
      relativeHumidity > 85 &&
      temperatureF >= 80 &&
      temperatureF <= 87
    ) {
      const adjustment =
        ((relativeHumidity - 85) / 10) * ((87 - temperatureF) / 5);
      heatIndexF += adjustment;
    }
  }

  const heatIndexC = ((heatIndexF - 32) * 5) / 9;
  return Number.isFinite(heatIndexC)
    ? Math.round(heatIndexC * 10) / 10
    : null;
}

module.exports = { calcHeatIndexCelsius };
