/**
 * Google Routes API — travel-time matrix between itinerary items on
 * the same day, plus point-to-point queries. Uses computeRoutes
 * (single) and computeRouteMatrix when we need N×M pairs.
 *
 * Docs: https://developers.google.com/maps/documentation/routes/
 * Enable "Routes API" on the same Cloud project as Places/Geocoding.
 *
 * Timeout: 4s per spec.
 */

const BASE = "https://routes.googleapis.com/directions/v2";

export type TravelMode =
  | "WALK"
  | "DRIVE"
  | "BICYCLE"
  | "TRANSIT"
  | "TWO_WHEELER";

export interface RouteLeg {
  originIndex: number;
  destinationIndex: number;
  travelMode: TravelMode;
  distanceMeters: number;
  durationSeconds: number;
  status: "OK" | "NO_ROUTE" | "ERROR";
}

interface Point {
  lat: number;
  lng: number;
  label?: string;
}

interface RawRoute {
  distanceMeters?: number;
  duration?: string; // "684s"
}

function parseDuration(v: string | undefined): number {
  if (!v) return 0;
  const match = v.match(/(\d+)s$/);
  return match ? parseInt(match[1], 10) : 0;
}

/** Single origin → single destination. */
export async function computeRoute(
  origin: Point,
  destination: Point,
  travelMode: TravelMode = "WALK",
): Promise<RouteLeg | null> {
  const key = process.env.GOOGLE_MAPS_API_KEY;
  if (!key) return null;

  const body = {
    origin: {
      location: {
        latLng: { latitude: origin.lat, longitude: origin.lng },
      },
    },
    destination: {
      location: {
        latLng: { latitude: destination.lat, longitude: destination.lng },
      },
    },
    travelMode,
  };

  try {
    const res = await fetch(`${BASE}:computeRoutes`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": key,
        "X-Goog-FieldMask": "routes.duration,routes.distanceMeters",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(4_000),
    });

    if (!res.ok) return null;
    const data = (await res.json()) as { routes?: RawRoute[] };
    const first = data.routes?.[0];
    if (!first) return null;

    return {
      originIndex: 0,
      destinationIndex: 0,
      travelMode,
      distanceMeters: first.distanceMeters ?? 0,
      durationSeconds: parseDuration(first.duration),
      status: "OK",
    };
  } catch {
    return null;
  }
}

/**
 * Compute the walking travel time between consecutive itinerary items
 * on the same day. Returns null if the API is unavailable — callers
 * should degrade to showing items without transit context.
 */
export async function computeDayLegs(
  points: Point[],
  travelMode: TravelMode = "WALK",
): Promise<RouteLeg[] | null> {
  if (points.length < 2) return [];
  const legs: RouteLeg[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const leg = await computeRoute(points[i], points[i + 1], travelMode);
    if (!leg) return legs.length > 0 ? legs : null;
    legs.push({ ...leg, originIndex: i, destinationIndex: i + 1 });
  }
  return legs;
}

export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const min = Math.round(seconds / 60);
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const rem = min % 60;
  return rem === 0 ? `${h}h` : `${h}h ${rem}m`;
}

export function formatDistance(m: number): string {
  if (m < 1000) return `${m} m`;
  return `${(m / 1000).toFixed(1)} km`;
}
