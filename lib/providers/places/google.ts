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

const BASE = "https://places.googleapis.com/v1";

// Category → included place types for Places API (New).
// See https://developers.google.com/maps/documentation/places/web-service/place-types
const CATEGORY_TYPES: Record<PlaceSearchQuery["kind"], string[]> = {
  attractions: [
    "tourist_attraction",
    "museum",
    "art_gallery",
    "landmark",
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

export const googlePlacesProvider: PlacesProvider = {
  name: "google-places",

  async search(query): Promise<ProviderResult<Place[]>> {
    const now = new Date().toISOString();

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
    return {
      data: normalized,
      status: "live_checked",
      source: "google-places",
      checkedAt: now,
    };
  },
};
