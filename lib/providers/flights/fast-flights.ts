/**
 * FlightProvider backed by the local fast-flights FastAPI microservice.
 * See python-services/flights/main.py.
 *
 * Behaviour:
 *  - Base URL from FAST_FLIGHTS_BASE_URL, defaults to http://localhost:8001
 *  - Returns provider "estimated" until currency conversion + validation
 *    upgrades to "live_checked" (spec's status ladder).
 *  - On any error, returns { data: null, status: "error", ... } so callers
 *    can degrade to mocked/estimated pricing without hard-failing.
 */

import type {
  FlightOffer,
  FlightProvider,
  FlightSearchQuery,
  ProviderResult,
} from "@/lib/providers/types";
import { toUSDMany } from "@/lib/fx";

interface UpstreamOffer {
  id: string;
  total_price_usd: number;
  currency: string;
  total_duration_minutes: number;
  layover_count: number;
  carriers: string[];
  departure?: string | null;
  arrival?: string | null;
  is_best?: boolean;
  source: string;
  checked_at: string;
  raw_price?: string | null;
}

interface UpstreamResponse {
  origin: string;
  destination: string;
  depart_date: string;
  return_date: string | null;
  price_hint: string | null;
  offer_count: number;
  offers: UpstreamOffer[];
  source: string;
  checked_at: string;
}

function baseUrl(): string {
  return (
    process.env.FAST_FLIGHTS_BASE_URL ?? "http://localhost:8001"
  ).replace(/\/+$/, "");
}

export const fastFlightsProvider: FlightProvider = {
  name: "fast-flights",
  async search(
    query: FlightSearchQuery,
  ): Promise<ProviderResult<FlightOffer[]>> {
    const url = `${baseUrl()}/search`;
    const now = new Date().toISOString();

    const payload = {
      origin: query.originAirport,
      destination: query.destinationAirport,
      depart_date: query.departDate,
      return_date: query.returnDate ?? null,
      adults: query.adults,
      children: query.children ?? 0,
      cabin: (query.cabinClass ?? "economy").replace("_", "-"),
      limit: 25,
    };

    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        // fast-flights scrapes; 8s max per spec's flight timeout.
        signal: AbortSignal.timeout(8_000),
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        return {
          data: null,
          status: "error",
          source: "fast-flights",
          checkedAt: now,
          error: `Upstream ${res.status}: ${text.slice(0, 200)}`,
        };
      }

      const body = (await res.json()) as UpstreamResponse;

      // Batch-convert every offer's local-currency price to USD in one FX lookup.
      const usdPrices = await toUSDMany(
        body.offers.map((o) => ({
          amount: o.total_price_usd,
          currency: o.currency,
        })),
      );

      const offers: FlightOffer[] = body.offers.map((o, i) => ({
        id: o.id,
        totalPriceUSD: Math.round(usdPrices[i] ?? o.total_price_usd),
        currency: "USD",
        totalDurationMinutes: o.total_duration_minutes,
        layoverCount: o.layover_count,
        carriers: o.carriers,
        outboundSegments: [
          {
            from: body.origin,
            to: body.destination,
            departAt: o.departure ?? body.depart_date,
            arriveAt: o.arrival ?? body.depart_date,
            carrier: o.carriers[0] ?? "unknown",
            durationMinutes: o.total_duration_minutes,
          },
        ],
        inboundSegments: [],
        source: "fast-flights",
        checkedAt: o.checked_at,
      }));

      // Re-sort by USD price now that everything is normalized.
      offers.sort((a, b) => a.totalPriceUSD - b.totalPriceUSD);

      return {
        data: offers,
        status: "live_checked",
        source: "fast-flights",
        checkedAt: body.checked_at,
      };
    } catch (e) {
      return {
        data: null,
        status: "error",
        source: "fast-flights",
        checkedAt: now,
        error: e instanceof Error ? e.message : String(e),
      };
    }
  },
};
