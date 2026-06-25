export function isDayAtLocation(
  nowUtcSec: number,
  timezoneOffsetSec: number,
  sunriseUtcSec?: number,
  sunsetUtcSec?: number
): boolean {
  if (!sunriseUtcSec || !sunsetUtcSec) return true;

  const localNow = nowUtcSec + timezoneOffsetSec;
  const localSunrise = sunriseUtcSec + timezoneOffsetSec;
  const localSunset = sunsetUtcSec + timezoneOffsetSec;

  return localNow >= localSunrise && localNow < localSunset;
}

export function isLateDayAtLocation(
  nowUtcSec: number,
  timezoneOffsetSec: number,
  sunriseUtcSec?: number,
  sunsetUtcSec?: number,
  windowMinutes = 90
): boolean {
  if (!isDayAtLocation(nowUtcSec, timezoneOffsetSec, sunriseUtcSec, sunsetUtcSec)) {
    return false;
  }

  if (!sunsetUtcSec) return false;

  const localNow = nowUtcSec + timezoneOffsetSec;
  const localSunset = sunsetUtcSec + timezoneOffsetSec;
  const secondsUntilSunset = localSunset - localNow;

  return secondsUntilSunset >= 0 && secondsUntilSunset <= windowMinutes * 60;
}

export type HeatDayPhase = "day" | "late_day" | "evening" | "night";

export function getHeatDayPhase(
  nowUtcSec: number,
  timezoneOffsetSec: number,
  sunriseUtcSec?: number,
  sunsetUtcSec?: number,
  lateDayWindowMinutes = 90,
  eveningWindowMinutes = 120
): HeatDayPhase {
  if (!sunriseUtcSec || !sunsetUtcSec) return "day";

  const localNow = nowUtcSec + timezoneOffsetSec;
  const localSunrise = sunriseUtcSec + timezoneOffsetSec;
  const localSunset = sunsetUtcSec + timezoneOffsetSec;

  if (localNow >= localSunrise && localNow < localSunset) {
    const secondsUntilSunset = localSunset - localNow;
    return secondsUntilSunset <= lateDayWindowMinutes * 60
      ? "late_day"
      : "day";
  }

  if (
    localNow >= localSunset &&
    localNow < localSunset + eveningWindowMinutes * 60
  ) {
    return "evening";
  }

  return "night";
}
