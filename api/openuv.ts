/*import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { lat, lon } = req.query;

  if (!lat || !lon) {
    return res.status(400).json({ error: 'Falten coordenades lat/lon' });
  }

  // 🔒 Comprovació de la clau
  const apiKey = process.env.OPENUV_API_KEY;
  if (!apiKey) {
    console.error('❌ No s’ha trobat la variable OPENUV_API_KEY al servidor');
    return res.status(500).json({ error: 'Clau API no configurada al servidor' });
  }

  try {
    const url = `https://api.openuv.io/api/v1/uv?lat=${lat}&lng=${lon}`;
    const response = await fetch(url, {
      headers: {
        'x-access-token': apiKey,
        'Content-Type': 'application/json',
      },
    });

    console.log('📡 OpenUV response status:', response.status);

    if (!response.ok) {
      const text = await response.text();
      console.error('❌ OpenUV error:', text);
      return res.status(response.status).json({ error: text });
    }

    const data = await response.json();
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.status(200).json(data);
  } catch (error: any) {
    console.error('💥 Error general OpenUV:', error.message);
    res.status(500).json({
      error: 'Error connectant amb OpenUV API',
      details: error.message,
    });
  }
}   */