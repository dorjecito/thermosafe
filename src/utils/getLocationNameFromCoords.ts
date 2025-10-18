// utils/getLocationNameFromCoords.ts
export async function getLocationNameFromCoords(lat: number, lon: number): Promise<string> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`,
      {
        headers: {
          'User-Agent': 'ThermoSafeApp/1.0 (esteve.montalvo@example.com)',
        },
      }
    );
    const data = await res.json();
    const address = data.address;
    return (
      address.village ||
      address.town ||
      address.city ||
      address.hamlet ||
      address.county ||
      data.display_name
    );
  } catch (error) {
    console.error("Error obtenint el nom de la ubicació:", error);
    return '';
  }
}