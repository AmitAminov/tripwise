/**
 * Ticketmaster Discovery API events provider.
 *
 * Docs: https://developer.ticketmaster.com/products-and-docs/apis/discovery-api/v2/
 * Auth: apikey query parameter (free tier at
 * https://developer-acct.ticketmaster.com/).
 *
 * Behavior:
 *  - Only fires when TICKETMASTER_API_KEY is set.
 *  - Composite provider layers this on top of PredictHQ + curated.
 *  - SWR-cached; treats 429s as transient and lets the composite
 *    fall back to the other sources.
 */

import type {
  EventItem,
  EventSearchQuery,
  EventsProvider,
  ProviderResult,
} from "@/lib/providers/types";
import { SWRCache } from "@/lib/swr-cache";

const BASE = "https://app.ticketmaster.com/discovery/v2";

const cache = new SWRCache<{ events: unknown[]; error?: string }>({
  freshMs: 6 * 60 * 60 * 1000,
  staleMs: 48 * 60 * 60 * 1000,
  maxEntries: 400,
  name: "events-ticketmaster",
});

interface RawTMEvent {
  id: string;
  name: string;
  info?: string;
  url?: string;
  dates?: {
    start?: { dateTime?: string; localDate?: string; localTime?: string };
    end?: { dateTime?: string };
  };
  classifications?: Array<{
    segment?: { name?: string };
    genre?: { name?: string };
  }>;
  _embedded?: {
    venues?: Array<{
      name?: string;
      city?: { name?: string };
      location?: { latitude?: string; longitude?: string };
    }>;
  };
  priceRanges?: Array<{ min?: number; max?: number; currency?: string }>;
}

interface TMResponse {
  _embedded?: { events?: RawTMEvent[] };
  page?: { totalElements?: number };
  fault?: { faultstring?: string };
}

function toKey(q: EventSearchQuery): string {
  const cats = [...(q.categories ?? [])].sort().join(",");
  return `tm|${q.city}|${q.from.slice(0, 10)}|${q.to.slice(0, 10)}|${cats}|${q.limit ?? "def"}`;
}

// Ticketmaster classification "segment" names.
const CATEGORY_TO_SEGMENT: Record<string, string> = {
  music: "Music",
  concerts: "Music",
  sports: "Sports",
  culture: "Arts & Theatre",
  art: "Arts & Theatre",
  festival: "Miscellaneous",
  family_activities: "Family",
};

function normalize(raw: RawTMEvent): EventItem | null {
  const venue = raw._embedded?.venues?.[0];
  const startAt =
    raw.dates?.start?.dateTime ??
    (raw.dates?.start?.localDate
      ? `${raw.dates.start.localDate}T${raw.dates.start.localTime ?? "20:00"}:00`
      : null);
  if (!startAt || !raw.name) return null;

  const lat = venue?.location?.latitude
    ? parseFloat(venue.location.latitude)
    : undefined;
  const lng = venue?.location?.longitude
    ? parseFloat(venue.location.longitude)
    : undefined;

  const cats: string[] = [];
  for (const c of raw.classifications ?? []) {
    if (c.segment?.name) cats.push(c.segment.name.toLowerCase());
    if (c.genre?.name) cats.push(c.genre.name.toLowerCase());
  }

  return {
    id: `tm:${raw.id}`,
    name: raw.name,
    startAt,
    endAt: raw.dates?.end?.dateTime,
    venueName: venue?.name,
    city: venue?.city?.name ?? "",
    coords:
      lat !== undefined && lng !== undefined ? { lat, lng } : undefined,
    categories: cats,
    priceMinUSD: raw.priceRanges?.[0]?.min,
    ticketUrl: raw.url,
    source: "ticketmaster",
  };
}

async function fetchLive(
  q: EventSearchQuery,
): Promise<{ events: RawTMEvent[]; error?: string }> {
  const key = process.env.TICKETMASTER_API_KEY;
  if (!key) return { events: [], error: "TICKETMASTER_API_KEY not set" };

  const params = new URLSearchParams({
    apikey: key,
    city: q.city,
    startDateTime: `${q.from.slice(0, 10)}T00:00:00Z`,
    endDateTime: `${q.to.slice(0, 10)}T23:59:59Z`,
    size: String(Math.min(q.limit ?? 30, 100)),
    sort: "date,asc",
  });

  if (q.categories && q.categories.length > 0) {
    const segments = new Set<string>();
    for (const c of q.categories) {
      const mapped = CATEGORY_TO_SEGMENT[c.toLowerCase()];
      if (mapped) segments.add(mapped);
    }
    if (segments.size > 0) {
      params.set("segmentName", [...segments].join(","));
    }
  }

  try {
    const res = await fetch(`${BASE}/events.json?${params}`, {
      signal: AbortSignal.timeout(5_000),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return {
        events: [],
        error: `HTTP ${res.status}: ${text.slice(0, 200)}`,
      };
    }
    const body = (await res.json()) as TMResponse;
    if (body.fault) {
      return { events: [], error: body.fault.faultstring ?? "TM fault" };
    }
    return { events: body._embedded?.events ?? [] };
  } catch (e) {
    return {
      events: [],
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

export const ticketmasterEventsProvider: EventsProvider = {
  name: "ticketmaster",
  async search(q: EventSearchQuery): Promise<ProviderResult<EventItem[]>> {
    const now = new Date().toISOString();
    const cacheKey = toKey(q);
    const cached = await cache.get(cacheKey, async () => {
      const result = await fetchLive(q);
      return {
        events: result.events as unknown[],
        error: result.error,
      };
    });

    const rawEvents = cached.value.events as RawTMEvent[];
    if (cached.value.error && rawEvents.length === 0) {
      return {
        data: null,
        status: "error",
        source: "ticketmaster",
        checkedAt: now,
        error: cached.value.error,
      };
    }

    const events = rawEvents
      .map(normalize)
      .filter((e): e is EventItem => e !== null);

    return {
      data: events,
      status:
        cached.status.status === "fresh" ? "live_checked" : "cached",
      source: "ticketmaster",
      checkedAt: now,
    };
  },
};
