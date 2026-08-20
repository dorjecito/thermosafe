import type { VercelRequest, VercelResponse } from "@vercel/node";
import { waitUntil } from "@vercel/functions";
import {
  getOpenWeatherUsageFieldForRoute,
  trackOpenWeatherApiUsage,
} from "./openweatherUsage.js";

const OPENWEATHER_BASE = "https://api.openweathermap.org";

const ROUTES = {
  weather: "/data/2.5/weather",
  onecall: "/data/3.0/onecall",
  "geo-direct": "/geo/1.0/direct",
  "geo-reverse": "/geo/1.0/reverse",
} as const;

type RouteKey = keyof typeof ROUTES;
type OpenWeatherHandlerDeps = {
  fetchFn?: typeof fetch;
  trackUsageFn?: typeof trackOpenWeatherApiUsage;
  getOpenWeatherKeyFn?: typeof getOpenWeatherKey;
  waitUntilFn?: typeof waitUntil;
};

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

export async function handleOpenWeatherRequest(
  req: VercelRequest,
  res: VercelResponse,
  deps: OpenWeatherHandlerDeps = {}
) {
  const fetchFn = deps.fetchFn || fetch;
  const trackUsageFn = deps.trackUsageFn || trackOpenWeatherApiUsage;
  const getOpenWeatherKeyFn = deps.getOpenWeatherKeyFn || getOpenWeatherKey;
  const waitUntilFn = deps.waitUntilFn || waitUntil;
  async function safeTrackUsage(
    field: NonNullable<ReturnType<typeof getOpenWeatherUsageFieldForRoute>>,
    hasError: boolean
  ) {
    try {
      await trackUsageFn(field, hasError);
    } catch (error) {
      console.warn("[apiUsage] No s'ha pogut registrar consum OpenWeather:", error);
    }
  }
  function scheduleTrackUsage(
    field: NonNullable<ReturnType<typeof getOpenWeatherUsageFieldForRoute>>,
    hasError: boolean
  ) {
    try {
      waitUntilFn(safeTrackUsage(field, hasError));
    } catch (error) {
      console.warn("[apiUsage] No s'ha pogut programar consum OpenWeather:", error);
    }
  }

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

  const apiKey = getOpenWeatherKeyFn();
  if (!apiKey) {
    return res.status(500).json({ error: "Missing OPENWEATHER_KEY" });
  }

  const route = firstQueryValue(req.query.route);
  if (!isAllowedRoute(route)) {
    return res.status(400).json({ error: "Invalid route" });
  }
  const usageField = getOpenWeatherUsageFieldForRoute(route);
  let usageTracked = false;

  const upstreamUrl = new URL(`${OPENWEATHER_BASE}${ROUTES[route]}`);

  for (const [key, rawValue] of Object.entries(req.query)) {
    if (key === "route" || key === "appid") continue;

    const value = firstQueryValue(rawValue as string | string[] | undefined);
    if (value) upstreamUrl.searchParams.set(key, value);
  }

  upstreamUrl.searchParams.set("appid", apiKey);

  try {
    const upstream = await fetchFn(upstreamUrl.toString());
    const body = await upstream.text();

    res.status(upstream.status);
    res.setHeader(
      "Content-Type",
      upstream.headers.get("content-type") || "application/json; charset=utf-8"
    );

    if (usageField) {
      scheduleTrackUsage(usageField, !upstream.ok);
      usageTracked = true;
    }

    return res.send(body);
  } catch (error) {
    if (usageField && !usageTracked) {
      scheduleTrackUsage(usageField, true);
    }
    console.error("[openweather proxy] upstream error", error);
    return res.status(502).json({ error: "OpenWeather upstream failed" });
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  return handleOpenWeatherRequest(req, res);
}
