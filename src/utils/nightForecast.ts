import SunCalc from "suncalc";
import type { HourlyForecastResponse } from "../services/weatherService";

export type NightForecastCategory = "none" | "tropical" | "torrid";
export type NightForecast = {
  status: "ready" | "unavailable" | "stale" | "incomplete";
  reason: string | null;
  scope: "full-night" | "remaining-night" | null;
  category: NightForecastCategory | null;
  minForecastTemp: number | null;
  sunsetUtcSec: number | null;
  sunriseUtcSec: number | null;
  period: "upcoming" | "ongoing" | null;
  fetchedAt: number | null;
};
type Coordinates = { lat: number; lon: number };
type SolarTimes = (date: Date, lat: number, lon: number) => { sunrise: Date; sunset: Date };

/** UTC instants only: independent of device timezone and daylight-saving offsets. */
export function buildNightForecast({ nowUtcSec, coords, forecastCoords, forecast, solarTimes = SunCalc.getTimes }: {
  nowUtcSec: number;
  coords: Coordinates;
  forecastCoords: Coordinates | null;
  forecast: HourlyForecastResponse | null;
  solarTimes?: SolarTimes;
}): NightForecast {
  const result: NightForecast = {
    status: "unavailable", reason: null, scope: null, category: null, minForecastTemp: null,
    sunsetUtcSec: null, sunriseUtcSec: null, period: null, fetchedAt: forecast?.fetchedAt ?? null,
  };
  const fail = (status: NightForecast["status"], reason: string): NightForecast => ({ ...result, status, reason });
  if (!Number.isFinite(nowUtcSec) || !Number.isFinite(coords.lat) || !Number.isFinite(coords.lon) ||
      Math.abs(coords.lat) > 90 || Math.abs(coords.lon) > 180) return fail("unavailable", "invalid-location-or-time");
  if (!forecastCoords || coords.lat !== forecastCoords.lat || coords.lon !== forecastCoords.lon)
    return fail("unavailable", "location-mismatch");
  if (!forecast) return fail("unavailable", "missing-forecast");
  if (forecast.stale) return fail("stale", "stale-forecast");
  const ageMs = nowUtcSec * 1000 - (forecast.fetchedAt ?? NaN);
  if (!Number.isFinite(ageMs) || ageMs < 0) return fail("unavailable", "unreliable-timestamp");
  if (ageMs > 3600000) return fail("stale", "expired-forecast");

  const rises = new Set<number>();
  const sets = new Set<number>();
  // Sampling surrounding UTC days avoids local Date constructors and date-line assumptions.
  try {
    for (let day = -2; day <= 2; day++) {
      const times = solarTimes(new Date((nowUtcSec + day * 86400) * 1000), coords.lat, coords.lon);
      const rise = times.sunrise.getTime() / 1000;
      const set = times.sunset.getTime() / 1000;
      if (Number.isFinite(rise)) rises.add(rise);
      if (Number.isFinite(set)) sets.add(set);
    }
  } catch { return fail("unavailable", "missing-solar-events"); }
  const sortedRises = [...rises].sort((a, b) => a - b);
  const nights = [...sets].sort((a, b) => a - b).flatMap(start => {
    const end = sortedRises.find(rise => rise > start);
    return end === undefined ? [] : [{ start, end }];
  });
  const night = nights.find(n => n.start <= nowUtcSec && nowUtcSec < n.end) ??
    nights.find(n => n.start > nowUtcSec);
  if (!night) return fail("unavailable", "missing-solar-events");
  result.sunsetUtcSec = night.start;
  result.sunriseUtcSec = night.end;
  result.period = nowUtcSec < night.start ? "upcoming" : "ongoing";

  if (!Array.isArray(forecast.hourly) || !forecast.hourly.length) return fail("incomplete", "missing-hourly");
  if (forecast.hourly.some(p => !Number.isFinite(p.dt))) return fail("incomplete", "invalid-timestamp");
  const points: typeof forecast.hourly = [];
  for (const point of [...forecast.hourly].sort((a, b) => a.dt - b.dt)) {
    const previous = points[points.length - 1];
    if (previous?.dt === point.dt) {
      if (previous.temp !== point.temp) return fail("incomplete", "conflicting-timestamp");
      continue;
    }
    points.push(point);
  }
  const firstAfterStart = points.findIndex(p => p.dt >= night.start);
  const last = points.findIndex(p => p.dt >= night.end);
  if (firstAfterStart < 0 || last < 0) return fail("incomplete", "missing-end");
  let first = points[firstAfterStart].dt === night.start ? firstAfterStart : firstAfterStart - 1;
  let intervalStart = night.start;
  let scope: "full-night" | "remaining-night" = "full-night";
  if (first < 0) {
    // Only a missing past boundary permits fallback. Never extrapolate to now.
    if (nowUtcSec <= night.start || points[0].dt > nowUtcSec)
      return fail("incomplete", "missing-start");
    first = 0;
    intervalStart = nowUtcSec;
    scope = "remaining-night";
  }
  // Validate ALL available samples of the original night, including those before
  // now: fallback must not hide an invalid temperature or a gap in the past.

  const needed = points.slice(first, last + 1);
  const samples: Array<{ dt: number; temp: number }> = [];
  for (const point of needed) {
    if (typeof point.temp !== "number" || !Number.isFinite(point.temp)) return fail("incomplete", "invalid-temperature");
    const prev = samples[samples.length - 1];
    if (prev?.dt === point.dt) {
      if (prev.temp !== point.temp) return fail("incomplete", "conflicting-timestamp");
      continue;
    }
    if (prev && point.dt - prev.dt > 3600) return fail("incomplete", "hourly-gap");
    samples.push({ dt: point.dt, temp: point.temp });
  }
  const at = (time: number) => {
    const i = samples.findIndex(p => p.dt >= time);
    const right = samples[i];
    if (right.dt === time) return right.temp;
    const left = samples[i - 1];
    return left.temp + (right.temp - left.temp) * (time - left.dt) / (right.dt - left.dt);
  };
  const min = Math.min(at(intervalStart), at(night.end),
    ...samples.filter(p => p.dt > intervalStart && p.dt < night.end).map(p => p.temp));
  return { ...result, status: "ready", reason: null, scope, minForecastTemp: min,
    category: min >= 25 ? "torrid" : min >= 20 ? "tropical" : "none" };
}
