/**
 * Google Geocoding — turn a free-form place string ("Lisbon", "Kyoto,
 * Japan", "Amalfi coast") into lat/lng coords and a canonical airport
 * guess when possible.
 *
 * Uses the same GOOGLE_MAPS_API_KEY as Places/Routes/Maps. Enable
 * Geocoding API in the Cloud project.
 *
 * In-memory cache with a 24h TTL so we don't re-hit Google on every
 * server render. This is the spec's "cache Google Places details by
 * place ID" applied to geocoding.
 */

const BASE = "https://maps.googleapis.com/maps/api/geocode/json";
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

export interface GeocodeResult {
  formattedAddress: string;
  coords: { lat: number; lng: number };
  countryCode: string | null;
  country: string | null;
  locality: string | null;
}

interface CachedGeo {
  result: GeocodeResult | null;
  storedAt: number;
}

const cache = new Map<string, CachedGeo>();

interface RawResponse {
  status: string;
  results?: Array<{
    formatted_address?: string;
    geometry?: { location?: { lat?: number; lng?: number } };
    address_components?: Array<{
      long_name?: string;
      short_name?: string;
      types?: string[];
    }>;
  }>;
}

function normalize(q: string): string {
  return q.trim().toLowerCase();
}

export async function geocode(query: string): Promise<GeocodeResult | null> {
  const key = process.env.GOOGLE_MAPS_API_KEY;
  if (!key) return null;
  const q = query.trim();
  if (q.length === 0) return null;

  const norm = normalize(q);
  const cached = cache.get(norm);
  if (cached && Date.now() - cached.storedAt < CACHE_TTL_MS) {
    return cached.result;
  }

  try {
    const url = `${BASE}?address=${encodeURIComponent(q)}&key=${key}`;
    const res = await fetch(url, {
      signal: AbortSignal.timeout(3_000),
    });
    if (!res.ok) {
      cache.set(norm, { result: null, storedAt: Date.now() });
      return null;
    }
    const body = (await res.json()) as RawResponse;
    if (body.status !== "OK" || !body.results?.length) {
      cache.set(norm, { result: null, storedAt: Date.now() });
      return null;
    }

    const hit = body.results[0];
    const lat = hit.geometry?.location?.lat;
    const lng = hit.geometry?.location?.lng;
    if (typeof lat !== "number" || typeof lng !== "number") {
      cache.set(norm, { result: null, storedAt: Date.now() });
      return null;
    }

    const components = hit.address_components ?? [];
    const country = components.find((c) => c.types?.includes("country"));
    const locality =
      components.find((c) => c.types?.includes("locality")) ??
      components.find((c) =>
        c.types?.includes("administrative_area_level_1"),
      );

    const result: GeocodeResult = {
      formattedAddress: hit.formatted_address ?? q,
      coords: { lat, lng },
      countryCode: country?.short_name ?? null,
      country: country?.long_name ?? null,
      locality: locality?.long_name ?? null,
    };

    cache.set(norm, { result, storedAt: Date.now() });
    return result;
  } catch {
    // Network errors — cache the null briefly to prevent hammer-loops.
    cache.set(norm, { result: null, storedAt: Date.now() });
    return null;
  }
}
