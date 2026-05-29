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
