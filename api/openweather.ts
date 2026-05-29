const OPENWEATHER_BASE = "https://api.openweathermap.org";

const ROUTES = {
  weather: "/data/2.5/weather",
  onecall: "/data/3.0/onecall",
  "geo-direct": "/geo/1.0/direct",
  "geo-reverse": "/geo/1.0/reverse",
} as const;

type RouteKey = keyof typeof ROUTES;

function firstQueryValue(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] || "" : value || "";
}

function getOpenWeatherKey(): string {
  return (
    process.env.OPENWEATHER_KEY ||
    process.env.OPENWEATHER_API_KEY ||
    process.env.VITE_OPENWEATHER_API_KEY ||
    ""
  ).trim();
}

function isAllowedRoute(route: string): route is RouteKey {
  return Object.prototype.hasOwnProperty.call(ROUTES, route);
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=600");

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const apiKey = getOpenWeatherKey();
  if (!apiKey) {
    return res.status(500).json({ error: "Missing OPENWEATHER_KEY" });
  }

  const route = firstQueryValue(req.query.route);
  if (!isAllowedRoute(route)) {
    return res.status(400).json({ error: "Invalid route" });
  }

  const upstreamUrl = new URL(`${OPENWEATHER_BASE}${ROUTES[route]}`);

  for (const [key, rawValue] of Object.entries(req.query)) {
    if (key === "route" || key === "appid") continue;

    const value = firstQueryValue(rawValue as string | string[] | undefined);
    if (value) upstreamUrl.searchParams.set(key, value);
  }

  upstreamUrl.searchParams.set("appid", apiKey);

  try {
    const upstream = await fetch(upstreamUrl.toString());
    const body = await upstream.text();

    res.status(upstream.status);
    res.setHeader(
      "Content-Type",
      upstream.headers.get("content-type") || "application/json; charset=utf-8"
    );

    return res.send(body);
  } catch (error) {
    console.error("[openweather proxy] upstream error", error);
    return res.status(502).json({ error: "OpenWeather upstream failed" });
  }
}
