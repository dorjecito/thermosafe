// src/services/uviAPI.ts

export async function getUVI(lat: number, lon: number): Promise<number | null> {
  const apiKey = 'openuv-22kxrmbmqs9k5-io'; // substitueix amb la teva clau real
  const url = `https://api.openuv.io/api/v1/uv?lat=${lat}&lng=${lon}`;

  try {
    const response = await fetch(url, {
      headers: {
        'x-access-token': apiKey
      }
    });

    if (!response.ok) {
      throw new Error('Failed to fetch UVI');
    }

    const data = await response.json();
    return data.result.uv ?? null;
  } catch (error) {
    console.error('Error fetching UVI:', error);
    return null;
  }
}
