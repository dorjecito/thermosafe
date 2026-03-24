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