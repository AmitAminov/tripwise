/**
 * Mocked destination data — the concrete Bangkok / Prague / South Italy
 * test case for the destination-comparison flow.
 *
 * Prices are ESTIMATES for a couple flying from TLV between
 * 15-Sep-2026 and 10-Oct-2026 for one week. Replace with live provider
 * data as APIs come online. Values here are annotated with confidence.
 */

import type { PriceEstimate } from "@/lib/types/trip-intent";

export interface DestinationSeed {
  id: string;
  name: string;
  country: string;
  region: string;
  airport: string;
  timezone: string;
  coords: { lat: number; lng: number };
  vibe: string;
  tagline: string;
  /** Which interest tokens does this destination score well on? */
  interestSignals: string[];
  bestFor: string[];
  climate: {
    seasonNote: string;
    tempMinC: number;
    tempMaxC: number;
    rainDaysExpected: number;
  };
  visa: {
    forIsraeliPassport:
      | "visa_free"
      | "visa_on_arrival"
      | "e_visa"
      | "consular_required"
      | "check";
    note: string;
  };
  safety: {
    level: "very_safe" | "safe" | "moderate" | "caution";
    note: string;
  };
  flightFromTLV: {
    directAvailable: boolean;
    typicalDurationHours: number;
    typicalStops: number;
  };
  gradient: [string, string]; // hero placeholder background until Gemini fills it
}

export interface DestinationCard extends DestinationSeed {
  estimates: PriceEstimate[];
  totalEstimate: {
    min: number;
    expected: number;
    max: number;
    currency: string;
  };
}

const ISO_NOW = new Date().toISOString();

function est(
  component: string,
  min: number,
  expected: number,
  max: number,
  confidence: PriceEstimate["confidence"] = "medium",
): PriceEstimate {
  return {
    component,
    min,
    expected,
    max,
    currency: "USD",
    confidence,
    status: "estimated",
    source: "internal_heuristic_v1",
    checkedAt: ISO_NOW,
  };
}

/**
 * Weekly cost estimates assume 2 travelers, standard comfort,
 * shoulder-season Sep-Oct 2026, from TLV.
 */
const SEEDS: DestinationSeed[] = [
  {
    id: "bangkok",
    name: "Bangkok",
    country: "Thailand",
    region: "Southeast Asia",
    airport: "BKK",
    timezone: "Asia/Bangkok",
    coords: { lat: 13.7563, lng: 100.5018 },
    vibe: "Kinetic. Warm. Endlessly edible.",
    tagline:
      "Street food temples, longtail boats, Buddhist quiet inside city chaos.",
    interestSignals: [
      "food",
      "culture",
      "wellness",
      "nightlife",
      "shopping",
      "history",
      "photography",
    ],
    bestFor: [
      "First long-haul together",
      "Food-obsessed couples",
      "Wellness escape (spas, yoga, massage)",
    ],
    climate: {
      seasonNote:
        "Late rainy season. Warm (28–33°C), afternoon showers, everything greener, fewer crowds.",
      tempMinC: 25,
      tempMaxC: 33,
      rainDaysExpected: 10,
    },
    visa: {
      forIsraeliPassport: "visa_free",
      note: "Israeli passports get 30-day visa-free entry to Thailand. Confirm with embassy near travel date.",
    },
    safety: {
      level: "safe",
      note: "Standard urban vigilance. Traffic + scams the main concerns; violent crime uncommon.",
    },
    flightFromTLV: {
      directAvailable: false,
      typicalDurationHours: 12,
      typicalStops: 1,
    },
    gradient: ["#f0a800", "#c93b1e"],
  },
  {
    id: "prague",
    name: "Prague",
    country: "Czech Republic",
    region: "Central Europe",
    airport: "PRG",
    timezone: "Europe/Prague",
    coords: { lat: 50.0755, lng: 14.4378 },
    vibe: "Storybook. Bookish. Cinematic golden hour.",
    tagline:
      "Autumn light on baroque spires. Cafés, wine harvests, jazz cellars.",
    interestSignals: [
      "architecture",
      "culture",
      "history",
      "food",
      "photography",
      "museums",
      "nightlife",
    ],
    bestFor: [
      "Walkable European city break",
      "Autumn photo trip",
      "Couples who like slow cafés and museums",
    ],
    climate: {
      seasonNote:
        "Peak autumn. Cool (8–18°C), crisp, some rain, red-gold foliage, wine season.",
      tempMinC: 8,
      tempMaxC: 18,
      rainDaysExpected: 8,
    },
    visa: {
      forIsraeliPassport: "visa_free",
      note: "Israeli passports get 90-day Schengen visa-free access. Verify with the ETIAS timeline near travel — ETIAS enforcement may begin during 2026.",
    },
    safety: {
      level: "very_safe",
      note: "One of the safer European capitals. Pickpockets in tourist zones the only real concern.",
    },
    flightFromTLV: {
      directAvailable: true,
      typicalDurationHours: 3.75,
      typicalStops: 0,
    },
    gradient: ["#8fa9c0", "#3a4a5a"],
  },
  {
    id: "south_italy",
    name: "South Italy",
    country: "Italy",
    region: "Southern Europe",
    airport: "NAP",
    timezone: "Europe/Rome",
    coords: { lat: 40.8358, lng: 14.2488 },
    vibe: "Slow. Salty. Sun-bleached.",
    tagline:
      "Amalfi cliffs, Puglia trulli, Naples pizza. Sea still warm; crowds thinning.",
    interestSignals: [
      "food",
      "beaches",
      "culture",
      "history",
      "architecture",
      "photography",
      "nature",
    ],
    bestFor: [
      "Slow-travel couples",
      "Food + sea combo",
      "Perfect shoulder-season weather",
    ],
    climate: {
      seasonNote:
        "Shoulder-season sweet spot. Warm days (20–26°C), sea ~24°C — still swimmable. Rainfall low.",
      tempMinC: 15,
      tempMaxC: 26,
      rainDaysExpected: 4,
    },
    visa: {
      forIsraeliPassport: "visa_free",
      note: "Schengen visa-free for 90 days. Same ETIAS caveat as Prague.",
    },
    safety: {
      level: "safe",
      note: "Naples has pickpocket / petty theft reputation; Amalfi/Puglia calmer. Rent car with care on coastal roads.",
    },
    flightFromTLV: {
      directAvailable: true,
      typicalDurationHours: 3.5,
      typicalStops: 0,
    },
    gradient: ["#e6c9a1", "#5b7a68"],
  },
];

// Per-destination estimates, all for 2 adults / 7 nights / from TLV.
const ESTIMATES: Record<string, PriceEstimate[]> = {
  bangkok: [
    est("Flights (2 pax, r/t)", 900, 1300, 1900, "medium"),
    est("Lodging (7 nights, standard)", 350, 550, 900, "medium"),
    est("Food (14 pax-days)", 210, 350, 560, "high"),
    est("Local transport", 60, 100, 160, "high"),
    est("Activities (temples, cooking, spa)", 150, 250, 450, "medium"),
    est("Events / shows", 0, 80, 200, "low"),
    est("Insurance (est.)", 60, 90, 120, "medium"),
    est("Buffer (10%)", 100, 200, 350, "low"),
  ],
  prague: [
    est("Flights (2 pax, r/t, direct)", 380, 620, 900, "medium"),
    est("Lodging (7 nights, standard)", 490, 770, 1100, "medium"),
    est("Food (14 pax-days)", 350, 560, 850, "high"),
    est("Local transport", 40, 70, 110, "high"),
    est("Activities (museums, jazz)", 120, 200, 380, "medium"),
    est("Events / shows", 0, 120, 300, "low"),
    est("Insurance (est.)", 40, 70, 100, "medium"),
    est("Buffer (10%)", 90, 160, 290, "low"),
  ],
  south_italy: [
    est("Flights (2 pax, r/t, direct)", 340, 560, 800, "medium"),
    est("Lodging (7 nights, standard)", 700, 1100, 1600, "medium"),
    est("Food (14 pax-days)", 490, 770, 1100, "high"),
    est("Local transport (train + car)", 150, 240, 380, "medium"),
    est("Activities (Pompeii, boats, tastings)", 200, 350, 550, "medium"),
    est("Events / shows", 0, 80, 200, "low"),
    est("Insurance (est.)", 40, 70, 100, "medium"),
    est("Buffer (10%)", 120, 220, 350, "low"),
  ],
};

function total(components: PriceEstimate[]) {
  return components.reduce(
    (acc, c) => ({
      min: acc.min + c.min,
      expected: acc.expected + c.expected,
      max: acc.max + c.max,
    }),
    { min: 0, expected: 0, max: 0 },
  );
}

export const DESTINATIONS: DestinationCard[] = SEEDS.map((seed) => {
  const components = ESTIMATES[seed.id] ?? [];
  const t = total(components);
  return {
    ...seed,
    estimates: components,
    totalEstimate: { ...t, currency: "USD" },
  };
});

export function getDestination(id: string): DestinationCard | undefined {
  return DESTINATIONS.find((d) => d.id === id);
}
