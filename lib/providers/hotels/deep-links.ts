/**
 * Hotel deep-links provider — the spec's fallback when we don't have
 * a paid inventory API. Estimates come from the seed data in
 * data/destinations.ts; deep links open a pre-filled search on the
 * major providers so the couple can actually book.
 *
 * Follows spec: DO NOT scrape Booking / Airbnb / Vrbo. We only
 * construct search URLs with the destination + dates — the user
 * lands on the provider's site and does the browse + book flow there.
 */

import type {
  HotelArea,
  HotelEstimate,
  HotelEstimateQuery,
  HotelProvider,
  ProviderResult,
} from "@/lib/providers/types";
import { DESTINATIONS } from "@/data/destinations";

const COMFORT_MULTIPLIER: Record<
  HotelEstimateQuery["comfortLevel"],
  number
> = {
  budget: 0.55,
  standard: 1.0,
  premium: 1.6,
  luxury: 2.5,
};

function baseNightlyForDestination(destination: string): {
  min: number;
  expected: number;
  max: number;
} {
  const d = DESTINATIONS.find((x) =>
    destination.toLowerCase().includes(x.name.toLowerCase()),
  );
  if (!d) return { min: 60, expected: 100, max: 180 };
  const lodging = d.estimates.find((e) =>
    e.component.toLowerCase().startsWith("lodging"),
  );
  if (!lodging) return { min: 60, expected: 100, max: 180 };
  // Convert per-week estimate → per-night
  return {
    min: Math.round(lodging.min / 7),
    expected: Math.round(lodging.expected / 7),
    max: Math.round(lodging.max / 7),
  };
}

const AREA_SEEDS: Record<string, HotelArea[]> = {
  Bangkok: [
    {
      name: "Sukhumvit",
      vibe: "Central, walkable, tons of restaurants + BTS access",
      perNight: {
        component: "avg / night",
        min: 40,
        expected: 90,
        max: 220,
        currency: "USD",
        confidence: "medium",
        status: "estimated",
        source: "seed",
        checkedAt: new Date().toISOString(),
      },
      walkableTo: ["Terminal 21", "Nana", "Asok BTS"],
    },
    {
      name: "Riverside (Charoenkrung)",
      vibe: "Chao Phraya views, temple-hopping by longtail",
      perNight: {
        component: "avg / night",
        min: 60,
        expected: 130,
        max: 350,
        currency: "USD",
        confidence: "medium",
        status: "estimated",
        source: "seed",
        checkedAt: new Date().toISOString(),
      },
      walkableTo: ["Wat Arun (by boat)", "Icon Siam"],
    },
  ],
  Prague: [
    {
      name: "Old Town (Staré Město)",
      vibe: "Storybook, walkable to everything iconic",
      perNight: {
        component: "avg / night",
        min: 80,
        expected: 150,
        max: 320,
        currency: "USD",
        confidence: "medium",
        status: "estimated",
        source: "seed",
        checkedAt: new Date().toISOString(),
      },
      walkableTo: ["Charles Bridge", "Old Town Square", "Jewish Quarter"],
    },
    {
      name: "Vinohrady",
      vibe: "Neighborhood-feel, cafés, cheaper, quick tram to center",
      perNight: {
        component: "avg / night",
        min: 55,
        expected: 100,
        max: 200,
        currency: "USD",
        confidence: "medium",
        status: "estimated",
        source: "seed",
        checkedAt: new Date().toISOString(),
      },
      walkableTo: ["Náměstí Míru", "Riegrovy sady park"],
    },
  ],
  "South Italy": [
    {
      name: "Positano",
      vibe: "Cliffside photogenic, coastal walks, pricey",
      perNight: {
        component: "avg / night",
        min: 130,
        expected: 260,
        max: 600,
        currency: "USD",
        confidence: "medium",
        status: "estimated",
        source: "seed",
        checkedAt: new Date().toISOString(),
      },
      walkableTo: ["Spiaggia Grande", "Path of the Gods trailhead"],
    },
    {
      name: "Naples (historic center)",
      vibe: "Best pizza on the planet, gritty and authentic, cheap",
      perNight: {
        component: "avg / night",
        min: 55,
        expected: 110,
        max: 220,
        currency: "USD",
        confidence: "medium",
        status: "estimated",
        source: "seed",
        checkedAt: new Date().toISOString(),
      },
      walkableTo: ["Spaccanapoli", "Duomo", "Piazza del Plebiscito"],
    },
  ],
};

export const deepLinkHotelProvider: HotelProvider = {
  name: "deep-links",
  async estimate(
    q: HotelEstimateQuery,
  ): Promise<ProviderResult<HotelEstimate>> {
    const now = new Date().toISOString();
    const base = baseNightlyForDestination(q.destination);
    const mul = COMFORT_MULTIPLIER[q.comfortLevel] * Math.max(1, q.guests / 2);
    const perNight = {
      component: "avg / night",
      min: Math.round(base.min * mul),
      expected: Math.round(base.expected * mul),
      max: Math.round(base.max * mul),
      currency: "USD",
      confidence: "medium" as const,
      status: "estimated" as const,
      source: "internal_heuristic_v1",
      checkedAt: now,
    };
    const areas =
      Object.entries(AREA_SEEDS).find(([name]) =>
        q.destination.toLowerCase().includes(name.toLowerCase()),
      )?.[1] ?? [];

    return {
      data: {
        destination: q.destination,
        nights: q.nights,
        perNight,
        areas,
      },
      status: "estimated",
      source: "deep-links",
      checkedAt: now,
    };
  },
};

export function buildBookingUrl(
  destination: string,
  checkIn: string | null,
  checkOut: string | null,
  guests: number,
): string {
  const q = new URLSearchParams({
    ss: destination,
    group_adults: String(guests),
    no_rooms: "1",
  });
  if (checkIn) q.set("checkin", checkIn);
  if (checkOut) q.set("checkout", checkOut);
  return `https://www.booking.com/searchresults.html?${q.toString()}`;
}

export function buildAirbnbUrl(
  destination: string,
  checkIn: string | null,
  checkOut: string | null,
  guests: number,
): string {
  const encoded = encodeURIComponent(destination);
  const q = new URLSearchParams({ adults: String(guests) });
  if (checkIn) q.set("checkin", checkIn);
  if (checkOut) q.set("checkout", checkOut);
  return `https://www.airbnb.com/s/${encoded}/homes?${q.toString()}`;
}

export function buildHostelworldUrl(destination: string): string {
  const encoded = encodeURIComponent(destination);
  return `https://www.hostelworld.com/search?search_keywords=${encoded}`;
}
