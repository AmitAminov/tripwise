/**
 * Open-Meteo weather provider — free public API, no key required.
 *
 * Docs: https://open-meteo.com/en/docs/climate-api
 *
 * For dates in the future beyond the standard forecast window, we use
 * the climate-normals endpoint (ERA5-based climatology) so we still
 * have something usable for trip planning months out.
 *
 * Cached 24h via SWR — climatology doesn't change hour-to-hour.
 */

import type {
  WeatherForecast,
  WeatherProvider,
  ProviderResult,
} from "@/lib/providers/types";
import { SWRCache } from "@/lib/swr-cache";

const FORECAST_BASE = "https://api.open-meteo.com/v1/forecast";
const CLIMATE_BASE = "https://climate-api.open-meteo.com/v1/climate";

const cache = new SWRCache<WeatherForecast | null>({
  freshMs: 24 * 60 * 60 * 1000,
  staleMs: 7 * 24 * 60 * 60 * 1000,
  maxEntries: 300,
  name: "weather-openmeteo",
});

interface DailyResponse {
  daily?: {
    temperature_2m_max?: number[];
    temperature_2m_min?: number[];
    precipitation_sum?: number[];
    time?: string[];
  };
}

function toKey(lat: number, lng: number, from: string, to: string): string {
  const rlat = Math.round(lat * 100) / 100;
  const rlng = Math.round(lng * 100) / 100;
  return `${rlat},${rlng}|${from.slice(0, 10)}|${to.slice(0, 10)}`;
}

function daysUntil(iso: string): number {
  const target = new Date(iso).getTime();
  const now = Date.now();
  return Math.floor((target - now) / 86_400_000);
}

async function fetchForecastLive(
  lat: number,
  lng: number,
  from: string,
  to: string,
): Promise<WeatherForecast | null> {
  const startDate = from.slice(0, 10);
  const endDate = to.slice(0, 10);

  // Open-Meteo forecast goes ~16 days out. Beyond that, use the
  // climate-normals endpoint which returns average conditions.
  const daysAhead = daysUntil(from);
  const isFar = daysAhead > 14;
  const base = isFar ? CLIMATE_BASE : FORECAST_BASE;

  const params = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lng),
    daily:
      "temperature_2m_max,temperature_2m_min,precipitation_sum",
    timezone: "UTC",
    start_date: startDate,
    end_date: endDate,
  });

  // Climate endpoint needs an ensemble model
  if (isFar) params.set("models", "EC_Earth3P_HR");

  try {
    const res = await fetch(`${base}?${params}`, {
      signal: AbortSignal.timeout(5_000),
    });
    if (!res.ok) return null;
    const body = (await res.json()) as DailyResponse;
    const highs = body.daily?.temperature_2m_max ?? [];
    const lows = body.daily?.temperature_2m_min ?? [];
    const rain = body.daily?.precipitation_sum ?? [];
    if (highs.length === 0 || lows.length === 0) return null;

    const maxT = Math.max(...highs);
    const minT = Math.min(...lows);
    const avgT =
      (highs.reduce((a, b) => a + b, 0) / highs.length +
        lows.reduce((a, b) => a + b, 0) / lows.length) /
      2;
    const rainDays = rain.filter((mm) => mm > 1).length;

    let summary: string;
    if (avgT > 26 && rainDays < 2) summary = "Hot and dry";
    else if (avgT > 22 && rainDays <= 3) summary = "Warm, mostly dry";
    else if (avgT < 10 && rainDays > 3) summary = "Cold and wet";
    else if (avgT < 5) summary = "Cold";
    else if (rainDays > 5) summary = "Wet";
    else summary = "Mild";

    return {
      city: `${lat.toFixed(2)},${lng.toFixed(2)}`,
      from: startDate,
      to: endDate,
      avgTempC: Math.round(avgT * 10) / 10,
      minTempC: Math.round(minT * 10) / 10,
      maxTempC: Math.round(maxT * 10) / 10,
      rainDays,
      summary,
    };
  } catch {
    return null;
  }
}

export const openMeteoProvider: WeatherProvider = {
  name: "open-meteo",
  async forecast(
    lat: number,
    lng: number,
    from: string,
    to: string,
  ): Promise<ProviderResult<WeatherForecast>> {
    const now = new Date().toISOString();
    const cacheKey = toKey(lat, lng, from, to);
    const cached = await cache.get(cacheKey, () =>
      fetchForecastLive(lat, lng, from, to),
    );
    if (!cached.value) {
      return {
        data: null,
        status: "unavailable",
        source: "open-meteo",
        checkedAt: now,
        error: "no data",
      };
    }
    return {
      data: cached.value,
      status:
        cached.status.status === "fresh" ? "live_checked" : "cached",
      source: "open-meteo",
      checkedAt: now,
    };
  },
};
