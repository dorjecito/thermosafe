export type UVAssessmentStatus = "pending" | "available" | "unavailable";

export type UVAssessment = {
  locationKey: string;
  requestId: number;
  status: UVAssessmentStatus;
  value: number | null;
};

export function makeUVLocationKey(lat: number, lon: number): string {
  return `${lat.toFixed(3)}:${lon.toFixed(3)}`;
}

export function startUVAssessment(
  current: UVAssessment | null,
  lat: number,
  lon: number,
  requestId: number
): UVAssessment {
  const locationKey = makeUVLocationKey(lat, lon);
  const previousValue = current?.locationKey === locationKey &&
    typeof current.value === "number" && Number.isFinite(current.value) && current.value >= 0
    ? current.value
    : null;

  return {
    locationKey,
    requestId,
    status: "pending",
    value: previousValue,
  };
}

export function settleUVAssessment(
  current: UVAssessment | null,
  requestId: number,
  value: unknown
): UVAssessment | null {
  if (!current || current.requestId !== requestId || current.status !== "pending") return current;

  const validValue = typeof value === "number" && Number.isFinite(value) && value >= 0
    ? value
    : null;
  if (validValue === null && typeof current.value === "number" && Number.isFinite(current.value) && current.value >= 0) {
    return { ...current, status: "available" };
  }
  return {
    ...current,
    status: validValue === null ? "unavailable" : "available",
    value: validValue,
  };
}

export function getUVAssessmentForLocation(
  assessment: UVAssessment | null,
  locationKey: string | null
): UVAssessment | null {
  return assessment && locationKey && assessment.locationKey === locationKey
    ? assessment
    : null;
}
