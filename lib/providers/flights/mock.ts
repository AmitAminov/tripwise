/**
 * Mocked flight provider. Deterministic-ish output based on the query,
 * so the UI shell is testable without any API keys.
 * Swap for Duffel / Amadeus / Kiwi in ./duffel.ts and ./amadeus.ts.
 */

import type {
  FlightOffer,
  FlightProvider,
  FlightSearchQuery,
  ProviderResult,
} from "@/lib/providers/types";

const CARRIERS = ["EL", "LY", "TP", "LH", "TK", "QR", "EK", "AF", "BA"];

function pseudoRandom(seed: string): () => number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return () => {
    h += 0x6d2b79f5;
    let t = h;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function iso(d: Date): string {
  return d.toISOString();
}

function baselinePrice(query: FlightSearchQuery): number {
  const table: Record<string, number> = {
    "TLV-BKK": 550,
    "TLV-PRG": 220,
    "TLV-NAP": 210,
    "TLV-FCO": 200,
    "TLV-BRI": 260,
  };
  const key = `${query.originAirport}-${query.destinationAirport}`;
  return table[key] ?? 400;
}

export const mockFlightProvider: FlightProvider = {
  name: "mock",
  async search(query): Promise<ProviderResult<FlightOffer[]>> {
    const rand = pseudoRandom(JSON.stringify(query));
    const base = baselinePrice(query);
    const offers: FlightOffer[] = [];

    for (let i = 0; i < 4; i++) {
      const layoverCount = query.directOnly ? 0 : rand() < 0.5 ? 0 : 1;
      const priceJitter = 0.7 + rand() * 0.6;
      const totalPriceUSD =
        Math.round(base * priceJitter * (layoverCount === 0 ? 1.15 : 1)) *
        Math.max(1, query.adults);
      const durMin =
        (layoverCount === 0 ? 210 : 380) + Math.round((rand() - 0.5) * 60);

      const depart = new Date(`${query.departDate}T${8 + i * 3}:00:00Z`);
      const arrive = new Date(depart.getTime() + durMin * 60000);

      offers.push({
        id: `mock-${i}-${query.destinationAirport}`,
        totalPriceUSD,
        currency: "USD",
        totalDurationMinutes: durMin,
        layoverCount,
        carriers: [CARRIERS[Math.floor(rand() * CARRIERS.length)]],
        outboundSegments: [
          {
            from: query.originAirport,
            to: query.destinationAirport,
            departAt: iso(depart),
            arriveAt: iso(arrive),
            carrier: CARRIERS[Math.floor(rand() * CARRIERS.length)],
            durationMinutes: durMin,
          },
        ],
        inboundSegments: query.returnDate
          ? [
              {
                from: query.destinationAirport,
                to: query.originAirport,
                departAt: iso(
                  new Date(`${query.returnDate}T${10 + i * 2}:00:00Z`),
                ),
                arriveAt: iso(
                  new Date(
                    new Date(`${query.returnDate}T${10 + i * 2}:00:00Z`).getTime() +
                      durMin * 60000,
                  ),
                ),
                carrier: CARRIERS[Math.floor(rand() * CARRIERS.length)],
                durationMinutes: durMin,
              },
            ]
          : [],
        baggageIncluded: rand() < 0.6,
        source: "mock",
        checkedAt: new Date().toISOString(),
      });
    }

    offers.sort((a, b) => a.totalPriceUSD - b.totalPriceUSD);

    return {
      data: offers,
      status: "estimated",
      source: "mock",
      checkedAt: new Date().toISOString(),
    };
  },
};
