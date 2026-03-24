export async function fetchSolarIrr(
  lat: number,
  lon: number,
  d: string
): Promise<number | null> {
  try {
    const cleanDate = d.replaceAll("-", "");

    const url =
      `https://power.larc.nasa.gov/api/temporal/daily/point?parameters=ALLSKY_SFC_SW_DWN&start=${cleanDate}` +
      `&end=${cleanDate}&latitude=${lat}&longitude=${lon}&format=JSON&community=re`;

    const r = await fetch(url);
    const j = await r.json();

    return j.properties.parameter.ALLSKY_SFC_SW_DWN[d] ?? null;
  } catch {
    return null;
  }
}