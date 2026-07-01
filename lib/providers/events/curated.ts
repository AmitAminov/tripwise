/**
 * Curated events provider — hand-curated recurring / annual events for the
 * three seeded destinations. Not real-time inventory; complements
 * Ticketmaster / PredictHQ when those keys are wired.
 *
 * Every returned event carries source: "curated" and status: "estimated"
 * per the spec's provenance labelling rule.
 */

import type {
  EventItem,
  EventSearchQuery,
  EventsProvider,
  ProviderResult,
} from "@/lib/providers/types";

interface Seed {
  name: string;
  city: string;
  windowStart: string; // MM-DD
  windowEnd: string; // MM-DD
  categories: string[];
  priceMinUSD?: number;
  url?: string;
  venue?: string;
  coords?: { lat: number; lng: number };
}

const CURATED: Seed[] = [
  // Prague
  {
    name: "Signal Festival (light art)",
    city: "Prague",
    windowStart: "10-15",
    windowEnd: "10-18",
    categories: ["culture", "art", "nightlife"],
    priceMinUSD: 0,
    url: "https://www.signalfestival.com/en/",
    venue: "Around the historic center",
  },
  {
    name: "Prague International Jazz Festival",
    city: "Prague",
    windowStart: "10-20",
    windowEnd: "11-05",
    categories: ["music", "nightlife"],
    priceMinUSD: 25,
    url: "https://www.agharta.cz/festival/",
    venue: "AghaRTA + partner clubs",
  },
  {
    name: "Karlovy Vary Wine harvest (Bohemian regional wine season)",
    city: "Prague",
    windowStart: "09-15",
    windowEnd: "10-15",
    categories: ["food", "culture"],
    priceMinUSD: 0,
    url: "https://www.prague.eu/en/wine-and-cocktail-bars",
    venue: "Wine bars + market pop-ups",
  },
  // Bangkok
  {
    name: "Vegetarian Festival (Tesagan Gin Je)",
    city: "Bangkok",
    windowStart: "09-27",
    windowEnd: "10-06",
    categories: ["food", "culture", "history"],
    priceMinUSD: 0,
    url: "https://www.tourismthailand.org/Articles/vegetarian-festival",
    venue: "Chinatown (Yaowarat) + city-wide",
  },
  {
    name: "Loi Krathong (float lanterns on the river)",
    city: "Bangkok",
    windowStart: "11-04",
    windowEnd: "11-05",
    categories: ["culture", "history", "photography"],
    priceMinUSD: 0,
    url: "https://www.tourismthailand.org/Articles/loy-krathong-festival",
    venue: "Chao Phraya riverfront",
  },
  {
    name: "Bangkok Design Week (autumn edition)",
    city: "Bangkok",
    windowStart: "09-20",
    windowEnd: "09-28",
    categories: ["culture", "shopping", "architecture"],
    priceMinUSD: 0,
    url: "https://www.bangkokdesignweek.com/",
    venue: "Charoenkrung + Thonglor districts",
  },
  // South Italy
  {
    name: "Amalfi Regatta of the Ancient Maritime Republics",
    city: "South Italy",
    windowStart: "09-05",
    windowEnd: "09-15",
    categories: ["culture", "history", "sports"],
    priceMinUSD: 0,
    url: "https://www.amalfitouristoffice.it/",
    venue: "Amalfi coast",
  },
  {
    name: "Pizzafest (Napoli)",
    city: "South Italy",
    windowStart: "09-05",
    windowEnd: "09-12",
    categories: ["food"],
    priceMinUSD: 5,
    url: "https://www.pizzafest.info/",
    venue: "Mostra d'Oltremare, Naples",
  },
  {
    name: "Ravello Chamber Music Festival (late season)",
    city: "South Italy",
    windowStart: "09-10",
    windowEnd: "10-05",
    categories: ["music", "culture"],
    priceMinUSD: 30,
    url: "https://www.ravellofestival.com/",
    venue: "Villa Rufolo, Ravello",
  },
];

function seedToEvent(seed: Seed, year: number): EventItem {
  const startAt = `${year}-${seed.windowStart}T18:00:00`;
  const endAt = `${year}-${seed.windowEnd}T23:59:00`;
  return {
    id: `curated:${seed.city}:${seed.name}`,
    name: seed.name,
    startAt,
    endAt,
    venueName: seed.venue,
    city: seed.city,
    coords: seed.coords,
    categories: seed.categories,
    priceMinUSD: seed.priceMinUSD,
    ticketUrl: seed.url,
    source: "curated",
  };
}

function windowsOverlap(
  a: { start: string; end: string },
  b: { start: string; end: string },
): boolean {
  return a.start <= b.end && b.start <= a.end;
}

export const curatedEventsProvider: EventsProvider = {
  name: "curated",
  async search(q: EventSearchQuery): Promise<ProviderResult<EventItem[]>> {
    const cityLower = q.city.toLowerCase();
    const matches = CURATED.filter((s) => {
      if (
        !cityLower.includes(s.city.toLowerCase()) &&
        !(
          s.city === "South Italy" &&
          /naples|napoli|amalfi|positano|puglia|italy/i.test(cityLower)
        )
      ) {
        return false;
      }
      const year = new Date(q.from).getUTCFullYear();
      const evStart = `${year}-${s.windowStart}`;
      const evEnd = `${year}-${s.windowEnd}`;
      if (
        !windowsOverlap(
          { start: q.from.slice(0, 10), end: q.to.slice(0, 10) },
          { start: evStart, end: evEnd },
        )
      )
        return false;
      if (q.categories && q.categories.length > 0) {
        const wanted = new Set(q.categories.map((c) => c.toLowerCase()));
        if (!s.categories.some((c) => wanted.has(c.toLowerCase()))) return false;
      }
      return true;
    });

    const year = new Date(q.from).getUTCFullYear();
    const events = matches
      .map((s) => seedToEvent(s, year))
      .slice(0, q.limit ?? 20);

    return {
      data: events,
      status: "estimated",
      source: "curated",
      checkedAt: new Date().toISOString(),
    };
  },
};
