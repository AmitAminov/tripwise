/**
 * PredictHQ events provider — real inventory upgrade over the curated
 * seed. Spec-recommended.
 *
 * Docs: https://docs.predicthq.com/api/events
 * Auth: Authorization: Bearer <token>
 *
 * Behavior:
 *  - Queries city + date window + optional category
 *  - PredictHQ returns matches for cities globally, including some very
 *    similar-named cities (e.g. "New Prague, MN"). We filter loosely
 *    by country when the caller supplies one.
 *  - On any error, returns error result; caller layers with curated seed.
 */

import type {
  EventItem,
  EventSearchQuery,
  EventsProvider,
  ProviderResult,
} from "@/lib/providers/types";
import { SWRCache } from "@/lib/swr-cache";

const BASE = "https://api.predicthq.com/v1";

// Events change slowly — 6h fresh / 48h stale is a safe window.
// Keyed by city + date window + categories.
const eventsCache = new SWRCache<{ events: unknown[]; error?: string }>({
  freshMs: 6 * 60 * 60 * 1000,
  staleMs: 48 * 60 * 60 * 1000,
  maxEntries: 400,
  name: "events-predicthq",
});

// Reasonable defaults for a couple trip: skip low-rank noise and
// prefer culturally-significant + tourist-oriented events. Full
// PredictHQ rank range is 0-100.
const MIN_LOCAL_RANK = 25;
const DEFAULT_LIMIT = 30;

// Rough spec-category → PredictHQ category mapping.
const CATEGORY_MAP: Record<string, string> = {
  music: "concerts,performing-arts",
  culture: "performing-arts,festivals,community",
  food: "festivals,community",
  nightlife: "concerts,performing-arts",
  sports: "sports",
  art: "performing-arts,festivals",
  festival: "festivals",
  family_activities: "community",
  history: "festivals,community",
  photography: "festivals,community",
};

/**
 * Look up a country hint for our seeded destinations so PredictHQ
 * doesn't match e.g. "New Prague, Minnesota" when the user meant
 * "Prague, Czech Republic".
 */
function countryFor(city: string): string | null {
  const lower = city.toLowerCase();
  if (/prague|praha/.test(lower)) return "CZ";
  if (/bangkok|thailand|krung thep/.test(lower)) return "TH";
  if (
    /naples|napoli|amalfi|positano|puglia|bari|sorrento|italy/.test(lower)
  )
    return "IT";
  return null;
}

interface RawEvent {
  id: string;
  title: string;
  description?: string;
  category?: string;
  labels?: string[];
  start?: string;
  end?: string;
  timezone?: string;
  country?: string;
  location?: [number, number]; // [lng, lat]
  entities?: Array<{
    type?: string;
    name?: string;
    formatted_address?: string;
  }>;
  local_rank?: number;
  aviation_rank?: number;
  rank?: number;
  predicted_end?: string;
}

interface EventsResponse {
  count?: number;
  results?: RawEvent[];
  error?: string;
}

function normalize(raw: RawEvent): EventItem {
  const venue = raw.entities?.find((e) => e.type === "venue");
  const coordsRaw = raw.location; // [lng, lat]
  return {
    id: `phq:${raw.id}`,
    name: raw.title,
    startAt: raw.start ?? new Date().toISOString(),
    endAt: raw.end ?? raw.predicted_end,
    venueName: venue?.name,
    city: raw.entities?.find((e) => e.type === "locality")?.name ?? "",
    coords:
      coordsRaw && coordsRaw.length === 2
        ? { lat: coordsRaw[1], lng: coordsRaw[0] }
        : undefined,
    categories: [raw.category, ...(raw.labels ?? [])].filter(
      (v): v is string => Boolean(v),
    ),
    priceMinUSD: undefined, // PredictHQ doesn't include ticket prices
    ticketUrl: undefined,
    source: "predicthq",
  };
}

function eventsKey(q: EventSearchQuery): string {
  const cats = [...(q.categories ?? [])].sort().join(",");
  return `${q.city}|${q.from.slice(0, 10)}|${q.to.slice(0, 10)}|${cats}|${q.limit ?? "def"}`;
}

async function fetchEventsLive(
  q: EventSearchQuery,
): Promise<{ events: RawEvent[]; error?: string }> {
  const key = process.env.PREDICTHQ_API_KEY;
  if (!key) return { events: [], error: "PREDICTHQ_API_KEY not set" };

  const country = countryFor(q.city);
  const params = new URLSearchParams({
    q: q.city,
    "active.gte": q.from.slice(0, 10),
    "active.lte": q.to.slice(0, 10),
    limit: String(Math.min(q.limit ?? DEFAULT_LIMIT, 50)),
    sort: "rank",
  });
  if (country) params.set("country", country);
  params.set("local_rank.gte", String(MIN_LOCAL_RANK));

  if (q.categories && q.categories.length > 0) {
    const phqCats = new Set<string>();
    for (const c of q.categories) {
      const mapped = CATEGORY_MAP[c.toLowerCase()];
      if (mapped) mapped.split(",").forEach((v) => phqCats.add(v));
    }
    if (phqCats.size > 0) {
      params.set("category", [...phqCats].join(","));
    }
  }

  const res = await fetch(`${BASE}/events/?${params}`, {
    headers: {
      Authorization: `Bearer ${key}`,
      Accept: "application/json",
    },
    signal: AbortSignal.timeout(5_000),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    return {
      events: [],
      error: `HTTP ${res.status}: ${text.slice(0, 200)}`,
    };
  }

  const body = (await res.json()) as EventsResponse;
  return { events: body.results ?? [] };
}

async function fetchEvents(
  q: EventSearchQuery,
): Promise<{ events: RawEvent[]; error?: string }> {
  const cacheKey = eventsKey(q);
  const cached = await eventsCache.get(cacheKey, async () => {
    const result = await fetchEventsLive(q);
    return {
      events: result.events as unknown[],
      error: result.error,
    };
  });
  return {
    events: cached.value.events as RawEvent[],
    error: cached.value.error,
  };
}

export const predictHqEventsProvider: EventsProvider = {
  name: "predicthq",
  async search(q: EventSearchQuery): Promise<ProviderResult<EventItem[]>> {
    const now = new Date().toISOString();
    try {
      const { events, error } = await fetchEvents(q);
      if (error) {
        return {
          data: null,
          status: "error",
          source: "predicthq",
          checkedAt: now,
          error,
        };
      }
      return {
        data: events.map(normalize),
        status: "live_checked",
        source: "predicthq",
        checkedAt: now,
      };
    } catch (e) {
      return {
        data: null,
        status: "error",
        source: "predicthq",
        checkedAt: now,
        error: e instanceof Error ? e.message : String(e),
      };
    }
  },
};
