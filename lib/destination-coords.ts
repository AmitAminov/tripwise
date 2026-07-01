/**
 * Shared destination resolver: takes a free-form trip.destination string
 * and returns coords + a display name, either from our seed data
 * (fast, no network) or via Google Geocoding (any city).
 *
 * Every consumer that needs to pin the destination on a map or query
 * nearby Places goes through here so behavior is consistent and we
 * only touch Geocoding once per unique destination per server process.
 */

import { DESTINATIONS } from "@/data/destinations";
import { geocode, type GeocodeResult } from "@/lib/geocoding";

export interface ResolvedDestination {
  name: string;
  coords: { lat: number; lng: number };
  source: "seed" | "geocoding";
  seedId?: string;
  country?: string | null;
}

function matchSeed(text: string): ResolvedDestination | null {
  const lower = text.toLowerCase();
  for (const d of DESTINATIONS) {
    if (
      lower.includes(d.name.toLowerCase()) ||
      lower.includes(d.country.toLowerCase()) ||
      (d.id === "south_italy" &&
        /naples|napoli|amalfi|positano|puglia/i.test(text))
    ) {
      return {
        name: d.name,
        coords: d.coords,
        source: "seed",
        seedId: d.id,
        country: d.country,
      };
    }
  }
  return null;
}

export async function resolveDestination(
  destination: string | null,
): Promise<ResolvedDestination | null> {
  if (!destination) return null;
  const clean = destination.trim();
  if (clean.length === 0) return null;

  // Seed first — cheap and deterministic.
  const seeded = matchSeed(clean);
  if (seeded) return seeded;

  // Geocoding fallback — 3s timeout, in-memory 24h cache.
  const geo: GeocodeResult | null = await geocode(clean);
  if (!geo) return null;

  return {
    name: geo.locality ?? geo.formattedAddress,
    coords: geo.coords,
    source: "geocoding",
    country: geo.country,
  };
}
