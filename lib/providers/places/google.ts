/**
 * PlacesProvider backed by Google Places API (New).
 *
 * Requires: GOOGLE_MAPS_API_KEY env, "Places API (New)" enabled on the
 * Cloud project, and the key must allow the places.googleapis.com service.
 *
 * Endpoints used:
 *   POST https://places.googleapis.com/v1/places:searchText  — text search
 *   POST https://places.googleapis.com/v1/places:searchNearby — lat/lng search
 *   GET  https://places.googleapis.com/v1/{name}             — place details
 *
 * Photos come back as opaque `photoName` references; a follow-up GET on
 * places.googleapis.com/v1/{photoName}/media?maxHeightPx=... returns the
 * actual bytes. We store the reference, not the URL, so we can proxy /
 * cache later.
 */

import type {
  Place,
  PlaceSearchQuery,
  PlacesProvider,
  ProviderResult,
} from "@/lib/providers/types";
import { SWRCache } from "@/lib/swr-cache";

const BASE = "https://places.googleapis.com/v1";

// Places search / detail cache. Places metadata changes on the order of
// hours (open hours can move, ratings drift); 1h fresh / 12h stale is
// a reasonable middle-ground per spec's "cache Places details by place ID".
const searchCache = new SWRCache<Place[]>({
  freshMs: 60 * 60 * 1000,
  staleMs: 12 * 60 * 60 * 1000,
  maxEntries: 500,
  name: "places-search",
});
const detailCache = new SWRCache<Place | null>({
  freshMs: 60 * 60 * 1000,
  staleMs: 12 * 60 * 60 * 1000,
  maxEntries: 500,
  name: "places-detail",
});

// Category → included place types for Places API (New).
// See https://developers.google.com/maps/documentation/places/web-service/place-types
// IMPORTANT: only Table A "Types" are allowed in searchNearby.includedTypes.
// "landmark" is NOT in Table A — the closest valid types are
// "tourist_attraction" and "historical_landmark".
const CATEGORY_TYPES: Record<PlaceSearchQuery["kind"], string[]> = {
  attractions: [
    "tourist_attraction",
    "museum",
    "art_gallery",
    "park",
    "historical_landmark",
  ],
  restaurants: ["restaurant"],
  cafes: ["cafe", "coffee_shop"],
  bars: ["bar", "wine_bar"],
  custom: [],
};

const FIELD_MASK = [
  "places.id",
  "places.displayName",
  "places.rating",
  "places.userRatingCount",
  "places.priceLevel",
  "places.location",
  "places.formattedAddress",
  "places.types",
  "places.regularOpeningHours",
  "places.websiteUri",
  "places.photos",
].join(",");

interface RawPlace {
  id: string;
  displayName?: { text?: string };
  rating?: number;
  userRatingCount?: number;
  priceLevel?: string; // "PRICE_LEVEL_INEXPENSIVE" | ... | "PRICE_LEVEL_VERY_EXPENSIVE"
  location?: { latitude?: number; longitude?: number };
  formattedAddress?: string;
  types?: string[];
  regularOpeningHours?: { weekdayDescriptions?: string[] };
  websiteUri?: string;
  photos?: Array<{ name: string; widthPx?: number; heightPx?: number }>;
}

function priceLevelToNumber(pl?: string): Place["priceLevel"] | undefined {
  switch (pl) {
    case "PRICE_LEVEL_FREE":
      return 0;
    case "PRICE_LEVEL_INEXPENSIVE":
      return 1;
    case "PRICE_LEVEL_MODERATE":
      return 2;
    case "PRICE_LEVEL_EXPENSIVE":
      return 3;
    case "PRICE_LEVEL_VERY_EXPENSIVE":
      return 4;
    default:
      return undefined;
  }
}

function normalize(p: RawPlace, kind: PlaceSearchQuery["kind"]): Place | null {
  if (!p.location?.latitude || !p.location?.longitude) return null;
  return {
    id: p.id,
    name: p.displayName?.text ?? "Untitled",
    category: p.types?.[0] ?? kind,
    coords: { lat: p.location.latitude, lng: p.location.longitude },
    rating: p.rating,
    ratingCount: p.userRatingCount,
    priceLevel: priceLevelToNumber(p.priceLevel),
    photoUrl: p.photos?.[0]?.name ? photoUrl(p.photos[0].name, 800) : undefined,
    address: p.formattedAddress,
    openingHours: p.regularOpeningHours?.weekdayDescriptions,
    websiteUrl: p.websiteUri,
  };
}

function photoUrl(photoName: string, maxHeightPx: number): string {
  const key = process.env.GOOGLE_MAPS_API_KEY;
  return `${BASE}/${photoName}/media?maxHeightPx=${maxHeightPx}&key=${key}`;
}

async function callPlaces<T>(
  path: string,
  body: unknown,
): Promise<{ ok: true; data: T } | { ok: false; error: string }> {
  const key = process.env.GOOGLE_MAPS_API_KEY;
  if (!key) return { ok: false, error: "GOOGLE_MAPS_API_KEY not set" };

  const res = await fetch(`${BASE}/${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": key,
      "X-Goog-FieldMask": FIELD_MASK,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(3_000), // spec's Places timeout
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    return {
      ok: false,
      error: `HTTP ${res.status}: ${text.slice(0, 300)}`,
    };
  }
  const data = (await res.json()) as T;
  return { ok: true, data };
}

function searchKey(query: PlaceSearchQuery): string {
  const lat = Math.round(query.center.lat * 1000) / 1000;
  const lng = Math.round(query.center.lng * 1000) / 1000;
  return `${query.kind}|${lat},${lng}|${query.radiusMeters ?? "def"}|${query.keyword ?? ""}|${query.limit ?? "def"}`;
}

export const googlePlacesProvider: PlacesProvider = {
  name: "google-places",

  async search(query): Promise<ProviderResult<Place[]>> {
    const now = new Date().toISOString();
    const cacheKey = searchKey(query);

    // Fast path: SWR hit within fresh window.
    const preview = searchCache.peek(cacheKey);
    if (preview && preview.status.status !== "miss") {
      return {
        data: preview.value,
        status: preview.status.status === "fresh" ? "live_checked" : "cached",
        source: "google-places",
        checkedAt: now,
      };
    }

    // Prefer nearby when we have coords; text otherwise.
    const useNearby =
      Boolean(query.center.lat && query.center.lng) &&
      (query.kind !== "custom" || !query.keyword);

    if (useNearby) {
      const included = CATEGORY_TYPES[query.kind];
      const result = await callPlaces<{ places?: RawPlace[] }>(
        "places:searchNearby",
        {
          includedTypes: included.length > 0 ? included : undefined,
          maxResultCount: query.limit ?? 20,
          locationRestriction: {
            circle: {
              center: {
                latitude: query.center.lat,
                longitude: query.center.lng,
              },
              radius: query.radiusMeters ?? 5000,
            },
          },
          languageCode: "en",
        },
      );

      if (!result.ok) {
        return {
          data: null,
          status: "error",
          source: "google-places",
          checkedAt: now,
          error: result.error,
        };
      }

      const places = (result.data.places ?? [])
        .map((p) => normalize(p, query.kind))
        .filter((x): x is Place => x !== null);

      searchCache.set(cacheKey, places);
      return {
        data: places,
        status: "live_checked",
        source: "google-places",
        checkedAt: now,
      };
    }

    // Text search
    const textQuery =
      query.keyword ??
      `${query.kind} near ${query.center.lat},${query.center.lng}`;
    const result = await callPlaces<{ places?: RawPlace[] }>(
      "places:searchText",
      {
        textQuery,
        maxResultCount: query.limit ?? 20,
        languageCode: "en",
        locationBias: {
          circle: {
            center: {
              latitude: query.center.lat,
              longitude: query.center.lng,
            },
            radius: query.radiusMeters ?? 8000,
          },
        },
      },
    );

    if (!result.ok) {
      return {
        data: null,
        status: "error",
        source: "google-places",
        checkedAt: now,
        error: result.error,
      };
    }

    const places = (result.data.places ?? [])
      .map((p) => normalize(p, query.kind))
      .filter((x): x is Place => x !== null);

    searchCache.set(cacheKey, places);
    return {
      data: places,
      status: "live_checked",
      source: "google-places",
      checkedAt: now,
    };
  },

  async detail(placeId): Promise<ProviderResult<Place>> {
    const now = new Date().toISOString();
    const key = process.env.GOOGLE_MAPS_API_KEY;
    if (!key) {
      return {
        data: null,
        status: "error",
        source: "google-places",
        checkedAt: now,
        error: "GOOGLE_MAPS_API_KEY not set",
      };
    }

    const preview = detailCache.peek(placeId);
    if (preview && preview.value && preview.status.status !== "miss") {
      return {
        data: preview.value,
        status: preview.status.status === "fresh" ? "live_checked" : "cached",
        source: "google-places",
        checkedAt: now,
      };
    }

    const detailMask = FIELD_MASK.replace(/places\./g, "");
    const res = await fetch(`${BASE}/places/${placeId}`, {
      headers: {
        "X-Goog-Api-Key": key,
        "X-Goog-FieldMask": detailMask,
      },
      signal: AbortSignal.timeout(3_000),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return {
        data: null,
        status: "error",
        source: "google-places",
        checkedAt: now,
        error: `HTTP ${res.status}: ${text.slice(0, 300)}`,
      };
    }

    const p = (await res.json()) as RawPlace;
    const normalized = normalize(p, "custom");
    if (!normalized) {
      return {
        data: null,
        status: "error",
        source: "google-places",
        checkedAt: now,
        error: "Place missing coordinates",
      };
    }
    detailCache.set(placeId, normalized);
    return {
      data: normalized,
      status: "live_checked",
      source: "google-places",
      checkedAt: now,
    };
  },
};
