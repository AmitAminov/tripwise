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
  gradient: [string, string]; // fallback if no hero PNG exists
  /** True when a pre-generated Gemini hero exists at /destinations/{id}.png */
  hasHero: boolean;
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
    hasHero: true,
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
    hasHero: true,
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
    hasHero: true,
  },
];

/**
 * Compact spec for the 47 "second-tier" seeded destinations. Each entry is
 * expanded into a full `DestinationSeed` by `buildBulkSeeds` below. The idea:
 * pack the fields that actually differ (name, country, coords, flight profile,
 * cost tier, visa, safety, climate, interests) — everything else is derived
 * from a small tier table so we can carry ~50 destinations without the file
 * turning into an unmanageable JSON blob.
 */
type CostTier = "low" | "mid" | "high" | "premium";
type VisaCode = "visa_free" | "visa_on_arrival" | "e_visa" | "consular_required" | "check";
type SafetyLevel = "very_safe" | "safe" | "moderate" | "caution";

interface BulkSpec {
  id: string;
  name: string;
  country: string;
  region: string;
  airport: string;
  timezone: string;
  lat: number;
  lng: number;
  tagline: string;
  interests: string[];
  bestFor: string[];
  climate: { seasonNote: string; tempMinC: number; tempMaxC: number; rainDaysExpected: number };
  visa: VisaCode;
  visaNote?: string;
  safety: SafetyLevel;
  safetyNote?: string;
  flightHours: number;
  direct: boolean;
  tier: CostTier;
  gradient: [string, string];
}

const BULK: BulkSpec[] = [
  // ---------- Western / Northern Europe ----------
  { id: "paris",       name: "Paris",       country: "France",         region: "Western Europe", airport: "CDG", timezone: "Europe/Paris",     lat: 48.8566, lng: 2.3522,   tagline: "Café mornings, Seine walks, museum overload.",           interests: ["food","museums","architecture","culture","history","shopping","photography"], bestFor: ["Classic city break","Museum lovers","Second-time couples going deeper"], climate: { seasonNote: "Autumn: 9–19°C, some rain, low crowds after Sep.", tempMinC: 9,  tempMaxC: 19, rainDaysExpected: 9  }, visa: "visa_free", safety: "safe",       flightHours: 4.5, direct: true,  tier: "high",     gradient: ["#f1c78a","#3a4a5a"] },
  { id: "london",      name: "London",      country: "United Kingdom", region: "Western Europe", airport: "LHR", timezone: "Europe/London",    lat: 51.5074, lng: -0.1278,  tagline: "Markets, museums, pubs, theatre — cost of admission is high.", interests: ["museums","food","culture","history","shopping","architecture","nightlife"],  bestFor: ["Museums (many free)","Foodies","Theatre lovers"],           climate: { seasonNote: "Cool grey autumn: 8–16°C, ~10 rain days.",         tempMinC: 8,  tempMaxC: 16, rainDaysExpected: 10 }, visa: "visa_free", safety: "safe",       flightHours: 5.0, direct: true,  tier: "premium",  gradient: ["#8fa9c0","#3a4a5a"] },
  { id: "rome",        name: "Rome",        country: "Italy",          region: "Southern Europe",airport: "FCO", timezone: "Europe/Rome",      lat: 41.9028, lng: 12.4964,  tagline: "Antiquity layered under trattorias, aperitivo hour a religion.", interests: ["history","food","architecture","culture","photography","museums"],           bestFor: ["First-timers to Italy","History-obsessed","Food + art combo"], climate: { seasonNote: "Warm autumn: 14–24°C, occasional storm.",           tempMinC: 14, tempMaxC: 24, rainDaysExpected: 6  }, visa: "visa_free", safety: "safe",       flightHours: 3.3, direct: true,  tier: "mid",      gradient: ["#e6c9a1","#a04c3a"] },
  { id: "amsterdam",   name: "Amsterdam",   country: "Netherlands",    region: "Western Europe", airport: "AMS", timezone: "Europe/Amsterdam", lat: 52.3676, lng: 4.9041,   tagline: "Canals, bikes, dense museums, Golden Age light.",         interests: ["museums","architecture","food","culture","photography","nightlife"],         bestFor: ["Cyclable city","Rijksmuseum + Van Gogh","Small-scale wandering"], climate: { seasonNote: "Cool + damp: 8–15°C, wind off the North Sea.",     tempMinC: 8,  tempMaxC: 15, rainDaysExpected: 11 }, visa: "visa_free", safety: "very_safe",  flightHours: 4.5, direct: true,  tier: "high",     gradient: ["#f0a800","#3a4a5a"] },
  { id: "barcelona",   name: "Barcelona",   country: "Spain",          region: "Southern Europe",airport: "BCN", timezone: "Europe/Madrid",    lat: 41.3874, lng: 2.1686,   tagline: "Gaudí curves + tapas + still-warm sea.",                  interests: ["architecture","food","beaches","culture","nightlife","shopping","photography"], bestFor: ["City + beach combo","Modernista architecture","Late dinners"], climate: { seasonNote: "Warm shoulder: 17–25°C, sea ~22°C.",                tempMinC: 17, tempMaxC: 25, rainDaysExpected: 6  }, visa: "visa_free", safety: "safe",       flightHours: 4.5, direct: true,  tier: "mid",      gradient: ["#f0a800","#c93b1e"] },
  { id: "vienna",      name: "Vienna",      country: "Austria",        region: "Central Europe", airport: "VIE", timezone: "Europe/Vienna",    lat: 48.2082, lng: 16.3738,  tagline: "Coffeehouse pace, imperial architecture, concert nights.", interests: ["culture","music","architecture","food","history","museums"],                    bestFor: ["Classical music lovers","Slow-city couples","Autumn walks"],  climate: { seasonNote: "Crisp autumn: 6–17°C.",                             tempMinC: 6,  tempMaxC: 17, rainDaysExpected: 7  }, visa: "visa_free", safety: "very_safe",  flightHours: 3.5, direct: true,  tier: "high",     gradient: ["#c9a961","#3a4a5a"] },
  { id: "berlin",      name: "Berlin",      country: "Germany",        region: "Central Europe", airport: "BER", timezone: "Europe/Berlin",    lat: 52.5200, lng: 13.4050,  tagline: "Reinvented history, deep clubs, cheap-for-Europe eating.", interests: ["history","culture","nightlife","food","architecture","museums"],               bestFor: ["Cheap-for-Western-Europe city","Nightlife","20th-century history"], climate: { seasonNote: "Cool autumn: 7–16°C.",                             tempMinC: 7,  tempMaxC: 16, rainDaysExpected: 8  }, visa: "visa_free", safety: "safe",       flightHours: 4.0, direct: true,  tier: "mid",      gradient: ["#8fa9c0","#3a4a5a"] },
  { id: "lisbon",      name: "Lisbon",      country: "Portugal",       region: "Southern Europe",airport: "LIS", timezone: "Europe/Lisbon",    lat: 38.7223, lng: -9.1393,  tagline: "Pastel hills, ocean light, wine + custard tarts.",         interests: ["food","architecture","culture","photography","beaches","history"],             bestFor: ["Value shoulder-season","Coastal day trips","Photo trip"],       climate: { seasonNote: "Perfect shoulder: 15–24°C, mostly sunny.",         tempMinC: 15, tempMaxC: 24, rainDaysExpected: 4  }, visa: "visa_free", safety: "very_safe",  flightHours: 5.5, direct: false, tier: "mid",      gradient: ["#f1c78a","#c93b1e"] },
  { id: "athens",      name: "Athens",      country: "Greece",         region: "Southern Europe",airport: "ATH", timezone: "Europe/Athens",    lat: 37.9838, lng: 23.7275,  tagline: "Ancient stones + a new Athens of food + nightlife.",       interests: ["history","food","culture","architecture","beaches","nightlife"],               bestFor: ["Ancient history + islands hop","Food scene","Warm shoulder"], climate: { seasonNote: "Warm autumn: 17–26°C, low rain.",                  tempMinC: 17, tempMaxC: 26, rainDaysExpected: 4  }, visa: "visa_free", safety: "safe",       flightHours: 2.0, direct: true,  tier: "mid",      gradient: ["#e6c9a1","#5b7a68"] },
  { id: "copenhagen",  name: "Copenhagen",  country: "Denmark",        region: "Northern Europe",airport: "CPH", timezone: "Europe/Copenhagen",lat: 55.6761, lng: 12.5683,  tagline: "Design shops, canal swims, Michelin creativity.",          interests: ["food","architecture","culture","shopping","photography","museums"],           bestFor: ["Design nerds","Food obsessed","Bike-around city"],           climate: { seasonNote: "Cool + variable: 8–15°C.",                          tempMinC: 8,  tempMaxC: 15, rainDaysExpected: 9  }, visa: "visa_free", safety: "very_safe",  flightHours: 4.5, direct: true,  tier: "premium",  gradient: ["#c9dee8","#3a4a5a"] },
  { id: "edinburgh",   name: "Edinburgh",   country: "United Kingdom", region: "Western Europe", airport: "EDI", timezone: "Europe/London",    lat: 55.9533, lng: -3.1883,  tagline: "Cobbled Old Town, whisky, castle-on-a-rock drama.",        interests: ["history","architecture","culture","photography","food","nature"],             bestFor: ["Autumn atmosphere","Whisky + walks","Day trips to Highlands"], climate: { seasonNote: "Bracing: 6–14°C, wind + rain but golden hour is worth it.", tempMinC: 6, tempMaxC: 14, rainDaysExpected: 12 }, visa: "visa_free", safety: "very_safe",  flightHours: 5.5, direct: false, tier: "high",     gradient: ["#8fa9c0","#5b7a68"] },
  { id: "reykjavik",   name: "Reykjavik",   country: "Iceland",        region: "Northern Europe",airport: "KEF", timezone: "Atlantic/Reykjavik",lat: 64.1466, lng: -21.9426, tagline: "Northern lights emerging, geothermal soaks, waterfalls.",  interests: ["nature","photography","hiking","wellness","food"],                             bestFor: ["Northern lights window","Nature couples","Road trip"],       climate: { seasonNote: "Cold + windy: 3–8°C. Aurora season starts Sep.",     tempMinC: 3,  tempMaxC: 8,  rainDaysExpected: 14 }, visa: "visa_free", safety: "very_safe",  flightHours: 7.0, direct: false, tier: "premium",  gradient: ["#c9dee8","#5b7a68"] },
  { id: "zurich",      name: "Zurich",      country: "Switzerland",    region: "Central Europe", airport: "ZRH", timezone: "Europe/Zurich",    lat: 47.3769, lng: 8.5417,   tagline: "Lakeside walks, alpine day trips, everything works.",       interests: ["nature","hiking","food","architecture","wellness","culture"],                 bestFor: ["Alps day trips","Efficient travelers","Fall foliage in the Alps"], climate: { seasonNote: "Crisp: 6–17°C, glorious foliage in the mountains.", tempMinC: 6,  tempMaxC: 17, rainDaysExpected: 8  }, visa: "visa_free", safety: "very_safe",  flightHours: 4.0, direct: true,  tier: "premium",  gradient: ["#c9dee8","#5b7a68"] },
  { id: "budapest",    name: "Budapest",    country: "Hungary",        region: "Central Europe", airport: "BUD", timezone: "Europe/Budapest",  lat: 47.4979, lng: 19.0402,  tagline: "Thermal baths, ruin bars, twin cities on the Danube.",     interests: ["culture","architecture","food","nightlife","wellness","history","photography"],bestFor: ["Value trip","Bathhouses + wine","Autumn photo trip"],         climate: { seasonNote: "Cool autumn: 8–18°C.",                             tempMinC: 8,  tempMaxC: 18, rainDaysExpected: 7  }, visa: "visa_free", safety: "safe",       flightHours: 3.5, direct: true,  tier: "mid",      gradient: ["#c9a961","#a04c3a"] },
  { id: "krakow",      name: "Krakow",      country: "Poland",         region: "Central Europe", airport: "KRK", timezone: "Europe/Warsaw",    lat: 50.0647, lng: 19.9450,  tagline: "Medieval square, Wawel castle, deep-history side trips.",   interests: ["history","architecture","culture","food","museums"],                          bestFor: ["Deep history (Auschwitz + Salt Mines nearby)","Value","Slow city"], climate: { seasonNote: "Crisp: 5–16°C.",                                    tempMinC: 5,  tempMaxC: 16, rainDaysExpected: 8  }, visa: "visa_free", safety: "very_safe",  flightHours: 3.5, direct: false, tier: "low",      gradient: ["#c9a961","#3a4a5a"] },
  { id: "dubrovnik",   name: "Dubrovnik",   country: "Croatia",        region: "Southern Europe",airport: "DBV", timezone: "Europe/Zagreb",    lat: 42.6507, lng: 18.0944,  tagline: "Old town walls over the Adriatic, still-warm sea.",         interests: ["beaches","architecture","history","culture","photography","food"],            bestFor: ["Shoulder-season Adriatic","Walkable old town","Game of Thrones fans"], climate: { seasonNote: "Warm + dry: 17–24°C, sea ~22°C.",                   tempMinC: 17, tempMaxC: 24, rainDaysExpected: 5  }, visa: "visa_free", safety: "safe",       flightHours: 3.0, direct: false, tier: "mid",      gradient: ["#f0a800","#5b7a68"] },
  { id: "istanbul",    name: "Istanbul",    country: "Turkey",         region: "Middle East",    airport: "IST", timezone: "Europe/Istanbul",  lat: 41.0082, lng: 28.9784,  tagline: "Two continents, minarets + bazaars, food obsession.",       interests: ["food","history","architecture","culture","shopping","photography"],           bestFor: ["First-time Middle East","Bazaars + baklava","Bosphorus views"], climate: { seasonNote: "Warm: 15–23°C.",                                    tempMinC: 15, tempMaxC: 23, rainDaysExpected: 6  }, visa: "visa_free", safety: "safe",       flightHours: 2.0, direct: true,  tier: "low",      gradient: ["#c9a961","#c93b1e"] },
  // ---------- North Africa / Middle East ----------
  { id: "marrakech",   name: "Marrakech",   country: "Morocco",        region: "North Africa",   airport: "RAK", timezone: "Africa/Casablanca",lat: 31.6295, lng: -7.9811,  tagline: "Riads, souks, desert side trips, tagines til midnight.",    interests: ["culture","food","architecture","shopping","photography","history"],           bestFor: ["Sensory overload","Desert extension","Riad stays"],           climate: { seasonNote: "Warm days + cool nights: 15–28°C.",                 tempMinC: 15, tempMaxC: 28, rainDaysExpected: 2  }, visa: "visa_free", safety: "safe",       flightHours: 5.5, direct: false, tier: "low",      gradient: ["#c93b1e","#c9a961"] },
  { id: "cairo",       name: "Cairo",       country: "Egypt",          region: "Middle East",    airport: "CAI", timezone: "Africa/Cairo",     lat: 30.0444, lng: 31.2357,  tagline: "Pyramids, Nile felucca, deep antiquity.",                    interests: ["history","culture","photography","architecture","food"],                       bestFor: ["Ancient Egypt","Nile cruise pairing","Short haul from TLV"],  climate: { seasonNote: "Hot dry: 20–33°C.",                                 tempMinC: 20, tempMaxC: 33, rainDaysExpected: 0  }, visa: "e_visa",   safety: "moderate",   flightHours: 1.5, direct: true,  tier: "low",      gradient: ["#c9a961","#5b7a68"] },
  { id: "petra",       name: "Petra (Aqaba/Amman)", country: "Jordan", region: "Middle East",    airport: "AMM", timezone: "Asia/Amman",       lat: 30.3285, lng: 35.4444,  tagline: "Rose-red city, Wadi Rum stars, Dead Sea float.",             interests: ["history","photography","hiking","nature","culture"],                          bestFor: ["Quick-hit archaeology","Overland trip","Land border option"], climate: { seasonNote: "Warm dry: 15–28°C.",                                tempMinC: 15, tempMaxC: 28, rainDaysExpected: 1  }, visa: "visa_on_arrival", safety: "safe",       flightHours: 0.8, direct: true,  tier: "low",      gradient: ["#c93b1e","#c9a961"] },
  { id: "dubai",       name: "Dubai",       country: "UAE",            region: "Middle East",    airport: "DXB", timezone: "Asia/Dubai",       lat: 25.2048, lng: 55.2708,  tagline: "Skyline + desert + malls + brunches.",                       interests: ["shopping","food","nightlife","architecture","beaches","wellness"],            bestFor: ["Layover stopover","Beach + city combo","Family activities"],  climate: { seasonNote: "Still hot: 24–35°C.",                              tempMinC: 24, tempMaxC: 35, rainDaysExpected: 0  }, visa: "visa_on_arrival", safety: "very_safe",  flightHours: 3.0, direct: true,  tier: "high",     gradient: ["#f0a800","#3a4a5a"] },
  // ---------- Asia ----------
  { id: "delhi",       name: "Delhi",       country: "India",          region: "South Asia",     airport: "DEL", timezone: "Asia/Kolkata",     lat: 28.7041, lng: 77.1025,  tagline: "Chaotic + spiritual + Mughal + market-forward.",             interests: ["food","history","culture","architecture","photography","shopping"],           bestFor: ["Golden Triangle start","Deep culture","Spice lovers"],       climate: { seasonNote: "Warm dry (post-monsoon): 22–32°C.",                 tempMinC: 22, tempMaxC: 32, rainDaysExpected: 3  }, visa: "e_visa",   safety: "moderate",   flightHours: 7.0, direct: false, tier: "low",      gradient: ["#c93b1e","#f0a800"] },
  { id: "kathmandu",   name: "Kathmandu",   country: "Nepal",          region: "South Asia",     airport: "KTM", timezone: "Asia/Kathmandu",   lat: 27.7172, lng: 85.3240,  tagline: "Temples, trekking prep, Himalayan flights.",                 interests: ["hiking","culture","photography","nature","history"],                           bestFor: ["Trekking base","Himalaya views","Prayer-flag towns"],         climate: { seasonNote: "Clear peak trekking: 15–25°C.",                    tempMinC: 15, tempMaxC: 25, rainDaysExpected: 2  }, visa: "visa_on_arrival", safety: "safe",       flightHours: 8.5, direct: false, tier: "low",      gradient: ["#c93b1e","#5b7a68"] },
  { id: "bali",        name: "Bali",        country: "Indonesia",      region: "Southeast Asia", airport: "DPS", timezone: "Asia/Makassar",    lat: -8.4095, lng: 115.1889, tagline: "Rice terraces, surf breaks, temple mornings.",               interests: ["beaches","wellness","food","nature","photography","culture"],                 bestFor: ["Beach + wellness","Yoga retreats","Long stay value"],         climate: { seasonNote: "Dry season tail: 24–30°C.",                        tempMinC: 24, tempMaxC: 30, rainDaysExpected: 5  }, visa: "visa_on_arrival", safety: "safe",       flightHours: 15,  direct: false, tier: "low",      gradient: ["#f0a800","#5b7a68"] },
  { id: "singapore",   name: "Singapore",   country: "Singapore",      region: "Southeast Asia", airport: "SIN", timezone: "Asia/Singapore",   lat: 1.3521,  lng: 103.8198, tagline: "Hawker centres, garden cities, everything efficient.",       interests: ["food","architecture","shopping","culture","wellness","family_activities"],   bestFor: ["Foodie stopover","Family-friendly","Layover extension"],     climate: { seasonNote: "Hot + humid: 26–32°C, afternoon showers.",         tempMinC: 26, tempMaxC: 32, rainDaysExpected: 12 }, visa: "visa_free", safety: "very_safe",  flightHours: 11,  direct: false, tier: "high",     gradient: ["#f0a800","#3a4a5a"] },
  { id: "hcmc",        name: "Ho Chi Minh City", country: "Vietnam",   region: "Southeast Asia", airport: "SGN", timezone: "Asia/Ho_Chi_Minh", lat: 10.7769, lng: 106.7009, tagline: "Motorbike density, banh mi + phở, rooftop bars.",           interests: ["food","culture","history","nightlife","shopping","photography"],              bestFor: ["Street food heaven","Vietnam entry","Value"],                climate: { seasonNote: "Hot + wet: 25–32°C, afternoon storms.",           tempMinC: 25, tempMaxC: 32, rainDaysExpected: 15 }, visa: "e_visa",   safety: "safe",       flightHours: 13,  direct: false, tier: "low",      gradient: ["#c9a961","#5b7a68"] },
  { id: "hanoi",       name: "Hanoi",       country: "Vietnam",        region: "Southeast Asia", airport: "HAN", timezone: "Asia/Ho_Chi_Minh", lat: 21.0285, lng: 105.8542, tagline: "Old Quarter chaos, egg coffee, lantern-lit alleys.",         interests: ["food","culture","history","architecture","photography"],                       bestFor: ["Halong Bay pairing","Coffee culture","Slow city"],           climate: { seasonNote: "Pleasant: 22–29°C.",                                tempMinC: 22, tempMaxC: 29, rainDaysExpected: 8  }, visa: "e_visa",   safety: "safe",       flightHours: 13,  direct: false, tier: "low",      gradient: ["#c93b1e","#c9a961"] },
  { id: "tokyo",       name: "Tokyo",       country: "Japan",          region: "East Asia",      airport: "HND", timezone: "Asia/Tokyo",       lat: 35.6762, lng: 139.6503, tagline: "Neon + shrines + convenience-store perfection.",             interests: ["food","culture","shopping","architecture","photography","nightlife"],         bestFor: ["First-timers to Japan","Food obsessed","Modern + traditional"], climate: { seasonNote: "Comfortable: 18–26°C.",                            tempMinC: 18, tempMaxC: 26, rainDaysExpected: 8  }, visa: "visa_free", safety: "very_safe",  flightHours: 13.5,direct: false, tier: "high",     gradient: ["#c93b1e","#8fa9c0"] },
  { id: "kyoto",       name: "Kyoto",       country: "Japan",          region: "East Asia",      airport: "KIX", timezone: "Asia/Tokyo",       lat: 35.0116, lng: 135.7681, tagline: "Temples, tea, autumn foliage peak.",                          interests: ["culture","architecture","history","food","photography","nature"],             bestFor: ["Autumn koyo (late Oct+)","Slow-city Japan","Ryokan stays"],  climate: { seasonNote: "Cool nights, warm days: 15–24°C. Peak koyo late Nov but foliage begins Oct.", tempMinC: 15, tempMaxC: 24, rainDaysExpected: 6 }, visa: "visa_free", safety: "very_safe",  flightHours: 14,  direct: false, tier: "high",     gradient: ["#c93b1e","#e6c9a1"] },
  { id: "seoul",       name: "Seoul",       country: "South Korea",    region: "East Asia",      airport: "ICN", timezone: "Asia/Seoul",       lat: 37.5665, lng: 126.9780, tagline: "K-BBQ midnights, palaces + malls + convenience.",           interests: ["food","shopping","culture","nightlife","architecture"],                        bestFor: ["Trendy city","Beauty + shopping","Late-night eating"],       climate: { seasonNote: "Crisp autumn: 12–22°C.",                            tempMinC: 12, tempMaxC: 22, rainDaysExpected: 5  }, visa: "visa_free", safety: "very_safe",  flightHours: 12,  direct: false, tier: "mid",      gradient: ["#c9a961","#3a4a5a"] },
  { id: "taipei",      name: "Taipei",      country: "Taiwan",         region: "East Asia",      airport: "TPE", timezone: "Asia/Taipei",      lat: 25.0330, lng: 121.5654, tagline: "Night markets, hot springs, indie coffee.",                  interests: ["food","culture","nightlife","nature","wellness","shopping"],                  bestFor: ["Cheap food capital","Bath houses","Hot springs day trips"], climate: { seasonNote: "Warm humid: 22–28°C.",                              tempMinC: 22, tempMaxC: 28, rainDaysExpected: 7  }, visa: "visa_free", safety: "very_safe",  flightHours: 13,  direct: false, tier: "mid",      gradient: ["#f0a800","#5b7a68"] },
  { id: "manila",      name: "Manila",      country: "Philippines",    region: "Southeast Asia", airport: "MNL", timezone: "Asia/Manila",      lat: 14.5995, lng: 120.9842, tagline: "Gateway to island paradise; keep the city short.",           interests: ["beaches","food","culture","nightlife","history"],                              bestFor: ["Island transfer base","Palawan/Cebu extension","Beaches"],   climate: { seasonNote: "Wet tail end: 24–30°C.",                            tempMinC: 24, tempMaxC: 30, rainDaysExpected: 14 }, visa: "visa_on_arrival", safety: "moderate",   flightHours: 14,  direct: false, tier: "low",      gradient: ["#f0a800","#c93b1e"] },
  { id: "hong_kong",   name: "Hong Kong",   country: "Hong Kong SAR",  region: "East Asia",      airport: "HKG", timezone: "Asia/Hong_Kong",   lat: 22.3193, lng: 114.1694, tagline: "Skyline + dim sum + hiking within minutes of downtown.",     interests: ["food","architecture","nature","shopping","hiking","nightlife"],               bestFor: ["Skyline junkies","Dim sum obsessives","Hiking near a metropolis"], climate: { seasonNote: "Comfortable: 22–29°C.",                          tempMinC: 22, tempMaxC: 29, rainDaysExpected: 7  }, visa: "visa_free", safety: "very_safe",  flightHours: 11,  direct: false, tier: "high",     gradient: ["#c93b1e","#3a4a5a"] },
  // ---------- Oceania ----------
  { id: "sydney",      name: "Sydney",      country: "Australia",      region: "Oceania",        airport: "SYD", timezone: "Australia/Sydney", lat: -33.8688, lng: 151.2093, tagline: "Harbour swims + Opera House + coastal walks.",              interests: ["beaches","food","culture","architecture","hiking","nightlife","wellness"],    bestFor: ["Spring in the south","Coastal city","Harbour walks"],       climate: { seasonNote: "Spring: 13–22°C.",                                  tempMinC: 13, tempMaxC: 22, rainDaysExpected: 9  }, visa: "e_visa",   safety: "very_safe",  flightHours: 22,  direct: false, tier: "premium",  gradient: ["#c9dee8","#f1c78a"] },
  { id: "auckland",    name: "Auckland",    country: "New Zealand",    region: "Oceania",        airport: "AKL", timezone: "Pacific/Auckland", lat: -36.8485, lng: 174.7633, tagline: "Volcanic bays, gateway to LOTR landscapes.",                 interests: ["nature","hiking","food","photography","wellness"],                              bestFor: ["Adventure entry","Road trip","Fiords + coast"],             climate: { seasonNote: "Spring: 10–17°C, variable.",                       tempMinC: 10, tempMaxC: 17, rainDaysExpected: 12 }, visa: "e_visa",   safety: "very_safe",  flightHours: 25,  direct: false, tier: "high",     gradient: ["#c9dee8","#5b7a68"] },
  // ---------- Africa (sub-Saharan) ----------
  { id: "cape_town",   name: "Cape Town",   country: "South Africa",   region: "Africa",         airport: "CPT", timezone: "Africa/Johannesburg",lat: -33.9249, lng: 18.4241, tagline: "Table Mountain + wine country + safari extensions.",         interests: ["nature","food","hiking","beaches","photography","wellness"],                  bestFor: ["Wine + safari combo","Adventure","Photo trip"],             climate: { seasonNote: "Spring: 11–20°C.",                                  tempMinC: 11, tempMaxC: 20, rainDaysExpected: 7  }, visa: "consular_required", safety: "moderate", flightHours: 14, direct: false, tier: "mid",      gradient: ["#f0a800","#5b7a68"] },
  { id: "nairobi",     name: "Nairobi",     country: "Kenya",          region: "Africa",         airport: "NBO", timezone: "Africa/Nairobi",   lat: -1.2921, lng: 36.8219,  tagline: "Safari gateway; brief city stop before the Mara.",           interests: ["nature","photography","culture","food"],                                       bestFor: ["Masai Mara base","Safari-forward trip","Wildlife"],         climate: { seasonNote: "Mild: 12–24°C, short rains starting.",              tempMinC: 12, tempMaxC: 24, rainDaysExpected: 7  }, visa: "e_visa",   safety: "moderate",   flightHours: 6.5, direct: false, tier: "mid",      gradient: ["#c93b1e","#5b7a68"] },
  { id: "zanzibar",    name: "Zanzibar",    country: "Tanzania",       region: "Africa",         airport: "ZNZ", timezone: "Africa/Dar_es_Salaam",lat: -6.1659, lng: 39.2026, tagline: "Turquoise water, spice-island alleys, dhow sails.",         interests: ["beaches","culture","food","photography","nature","history"],                  bestFor: ["Beach + culture combo","Safari + beach pairing","Snorkeling"], climate: { seasonNote: "Warm dry: 22–29°C, sea ~27°C.",                    tempMinC: 22, tempMaxC: 29, rainDaysExpected: 2  }, visa: "visa_on_arrival", safety: "safe",       flightHours: 8,   direct: false, tier: "mid",      gradient: ["#f0a800","#c9dee8"] },
  // ---------- North America ----------
  { id: "nyc",         name: "New York",    country: "United States",  region: "North America",  airport: "JFK", timezone: "America/New_York", lat: 40.7128, lng: -74.0060, tagline: "Skyline, dense food, shows, five boroughs of layered life.", interests: ["food","culture","shopping","museums","architecture","nightlife","photography"], bestFor: ["Foodie deep dive","Broadway","First-time NA"],              climate: { seasonNote: "Perfect autumn: 13–21°C.",                          tempMinC: 13, tempMaxC: 21, rainDaysExpected: 7  }, visa: "e_visa",   safety: "safe",       flightHours: 11,  direct: true,  tier: "premium",  gradient: ["#f0a800","#3a4a5a"] },
  { id: "sf",          name: "San Francisco",country: "United States", region: "North America",  airport: "SFO", timezone: "America/Los_Angeles",lat: 37.7749, lng: -122.4194, tagline: "Fog + coastal drive + wine country reach.",                 interests: ["food","architecture","nature","culture","photography","wellness"],           bestFor: ["Wine country side trip","Coastal drive","Tech-adjacent city"], climate: { seasonNote: "Warm autumn: 13–22°C.",                            tempMinC: 13, tempMaxC: 22, rainDaysExpected: 2  }, visa: "e_visa",   safety: "moderate",   flightHours: 14,  direct: false, tier: "premium",  gradient: ["#c9dee8","#c93b1e"] },
  { id: "la",          name: "Los Angeles", country: "United States",  region: "North America",  airport: "LAX", timezone: "America/Los_Angeles",lat: 34.0522, lng: -118.2437, tagline: "Sprawl, beaches, food deserts and food deities.",           interests: ["beaches","food","shopping","culture","nightlife","wellness"],                 bestFor: ["Palm Springs pairing","Beach + city","Foodie trip"],         climate: { seasonNote: "Warm dry: 17–26°C.",                              tempMinC: 17, tempMaxC: 26, rainDaysExpected: 1  }, visa: "e_visa",   safety: "moderate",   flightHours: 14.5,direct: false, tier: "premium",  gradient: ["#f0a800","#c93b1e"] },
  { id: "miami",       name: "Miami",       country: "United States",  region: "North America",  airport: "MIA", timezone: "America/New_York", lat: 25.7617, lng: -80.1918, tagline: "Deco pastels, Latin nights, hot ocean.",                     interests: ["beaches","nightlife","food","culture","architecture","shopping"],             bestFor: ["Beach + nightlife","Latin dance","Winter escape"],           climate: { seasonNote: "Hot humid: 24–30°C, hurricane season tapering.",  tempMinC: 24, tempMaxC: 30, rainDaysExpected: 10 }, visa: "e_visa",   safety: "safe",       flightHours: 13.5,direct: false, tier: "high",     gradient: ["#f0a800","#c9dee8"] },
  { id: "vancouver",   name: "Vancouver",   country: "Canada",         region: "North America",  airport: "YVR", timezone: "America/Vancouver",lat: 49.2827, lng: -123.1207, tagline: "Mountains + sea, temperate rainforest, walkable dense city.",interests: ["nature","food","hiking","architecture","photography","wellness"],            bestFor: ["Nature + city combo","Rockies extension","Salmon-run season"],climate: { seasonNote: "Mild wet: 8–15°C.",                                tempMinC: 8,  tempMaxC: 15, rainDaysExpected: 12 }, visa: "e_visa",   safety: "very_safe",  flightHours: 13.5,direct: false, tier: "high",     gradient: ["#c9dee8","#5b7a68"] },
  { id: "toronto",     name: "Toronto",     country: "Canada",         region: "North America",  airport: "YYZ", timezone: "America/Toronto",  lat: 43.6532, lng: -79.3832, tagline: "Multicultural food, autumn colors, Niagara side trip.",      interests: ["food","culture","architecture","museums","shopping"],                          bestFor: ["Fall colors","Value NA city","Cultural depth"],              climate: { seasonNote: "Cool autumn: 8–17°C.",                             tempMinC: 8,  tempMaxC: 17, rainDaysExpected: 7  }, visa: "e_visa",   safety: "very_safe",  flightHours: 12,  direct: false, tier: "high",     gradient: ["#c9a961","#3a4a5a"] },
  { id: "mexico_city", name: "Mexico City", country: "Mexico",         region: "Latin America",  airport: "MEX", timezone: "America/Mexico_City",lat: 19.4326, lng: -99.1332, tagline: "World-class food + Frida + pyramids day trip.",             interests: ["food","culture","history","architecture","photography","nightlife"],         bestFor: ["Foodie deep dive","Ancient sites","Urban culture"],         climate: { seasonNote: "Mild high-altitude: 12–22°C.",                     tempMinC: 12, tempMaxC: 22, rainDaysExpected: 7  }, visa: "consular_required", safety: "moderate", flightHours: 17, direct: false, tier: "low",      gradient: ["#c93b1e","#c9a961"] },
  // ---------- Latin America ----------
  { id: "buenos_aires",name: "Buenos Aires",country: "Argentina",      region: "Latin America",  airport: "EZE", timezone: "America/Argentina/Buenos_Aires", lat: -34.6037, lng: -58.3816, tagline: "Steak + tango + European bones in the Southern Cone.", interests: ["food","culture","nightlife","architecture","history","photography"],           bestFor: ["Spring in the south","Wine + steak","Tango"],                climate: { seasonNote: "Spring: 12–22°C.",                                  tempMinC: 12, tempMaxC: 22, rainDaysExpected: 7  }, visa: "visa_free", safety: "moderate",   flightHours: 18,  direct: false, tier: "mid",      gradient: ["#8fa9c0","#c93b1e"] },
  { id: "rio",         name: "Rio de Janeiro",country: "Brazil",       region: "Latin America",  airport: "GIG", timezone: "America/Sao_Paulo",lat: -22.9068, lng: -43.1729, tagline: "Beaches under a granite skyline; caipirinha weather returning.", interests: ["beaches","nightlife","food","culture","photography","nature"],           bestFor: ["Beach + city","Spring warmth","Copacabana + Ipanema"],       climate: { seasonNote: "Warming: 20–27°C.",                                 tempMinC: 20, tempMaxC: 27, rainDaysExpected: 7  }, visa: "visa_free", safety: "moderate",   flightHours: 15,  direct: false, tier: "mid",      gradient: ["#f0a800","#5b7a68"] },
  { id: "cusco",       name: "Cusco / Machu Picchu", country: "Peru",  region: "Latin America",  airport: "CUZ", timezone: "America/Lima",     lat: -13.5320, lng: -71.9675, tagline: "Andean altitude, Inca stones, Sacred Valley days.",         interests: ["history","hiking","culture","photography","nature","food"],                  bestFor: ["Inca Trail permit season","Once-in-a-lifetime","Cultural photo trip"], climate: { seasonNote: "Dry season sweet spot: 4–20°C, big diurnal swing.", tempMinC: 4, tempMaxC: 20, rainDaysExpected: 3 }, visa: "visa_free", safety: "safe",       flightHours: 20,  direct: false, tier: "mid",      gradient: ["#c9a961","#5b7a68"] },
  { id: "cartagena",   name: "Cartagena",   country: "Colombia",       region: "Latin America",  airport: "CTG", timezone: "America/Bogota",   lat: 10.3910, lng: -75.4794, tagline: "Colonial walls + Caribbean warmth + salsa nights.",         interests: ["beaches","food","culture","history","nightlife","architecture","photography"], bestFor: ["Caribbean colonial","Salsa","Rum + seafood"],               climate: { seasonNote: "Hot humid: 25–31°C, some storms.",                  tempMinC: 25, tempMaxC: 31, rainDaysExpected: 10 }, visa: "visa_free", safety: "moderate",   flightHours: 18,  direct: false, tier: "low",      gradient: ["#f0a800","#c9dee8"] },
  { id: "havana",      name: "Havana",      country: "Cuba",           region: "Latin America",  airport: "HAV", timezone: "America/Havana",   lat: 23.1136, lng: -82.3666, tagline: "Time-warp streets, rum, live music, cigar smoke.",           interests: ["culture","music","architecture","history","photography","nightlife"],       bestFor: ["Music lovers","Photo trip","Time-warp travel"],             climate: { seasonNote: "Hot wet tail: 24–30°C, hurricane risk.",             tempMinC: 24, tempMaxC: 30, rainDaysExpected: 10 }, visa: "consular_required", safety: "safe",       flightHours: 15,  direct: false, tier: "mid",      gradient: ["#c9a961","#c93b1e"] },
];

/**
 * Regional cost tiers → base weekly cost for 2 pax at "standard" comfort.
 * Numbers are USD before flights. Flights are added separately using a
 * distance/direct model on top.
 */
const TIER_BASE: Record<CostTier, { lodging: number; food: number; activities: number; transport: number; buffer: number }> = {
  low:     { lodging: 500,  food: 300,  activities: 200, transport: 90,  buffer: 150 },
  mid:     { lodging: 850,  food: 560,  activities: 300, transport: 120, buffer: 220 },
  high:    { lodging: 1300, food: 820,  activities: 450, transport: 160, buffer: 350 },
  premium: { lodging: 2000, food: 1200, activities: 700, transport: 220, buffer: 500 },
};

function flightEstimate(hours: number, direct: boolean): { min: number; expected: number; max: number } {
  // Rough model calibrated against the 3 hand-tuned seeds (Bangkok = 12h, ~$1300 expected; Prague = 3.75h, ~$620 expected).
  const base = 120 + hours * 90;
  const surcharge = direct ? 1 : 1.15;
  const expected = Math.round(base * surcharge * 2); // 2 pax r/t
  return {
    min: Math.round(expected * 0.65),
    expected,
    max: Math.round(expected * 1.55),
  };
}

function spread(mid: number): { min: number; expected: number; max: number } {
  return {
    min: Math.round(mid * 0.65),
    expected: mid,
    max: Math.round(mid * 1.5),
  };
}

function buildBulkSeeds(): DestinationCard[] {
  return BULK.map((b) => {
    const seed: DestinationSeed = {
      id: b.id,
      name: b.name,
      country: b.country,
      region: b.region,
      airport: b.airport,
      timezone: b.timezone,
      coords: { lat: b.lat, lng: b.lng },
      vibe: b.tagline,
      tagline: b.tagline,
      interestSignals: b.interests,
      bestFor: b.bestFor,
      climate: b.climate,
      visa: {
        forIsraeliPassport: b.visa,
        note:
          b.visaNote ??
          (b.visa === "visa_free"
            ? "Israeli passports enter visa-free for tourism stays. Confirm rules near travel date."
            : b.visa === "visa_on_arrival"
              ? "Visa on arrival available for Israeli passports; keep passport valid 6+ months."
              : b.visa === "e_visa"
                ? "Apply for an e-visa online before travel."
                : b.visa === "consular_required"
                  ? "Requires an embassy application in advance. Start 2+ months out."
                  : "Verify current visa rules for Israeli passports before booking."),
      },
      safety: {
        level: b.safety,
        note:
          b.safetyNote ??
          (b.safety === "very_safe"
            ? "One of the safer options in the region. Standard urban vigilance only."
            : b.safety === "safe"
              ? "Broadly safe for travelers; pickpocket/scam awareness advised in tourist zones."
              : b.safety === "moderate"
                ? "Elevated caution in specific neighborhoods. Read up before you go and stick to well-reviewed areas."
                : "Meaningful safety considerations; consult current advisories before booking."),
      },
      flightFromTLV: {
        directAvailable: b.direct,
        typicalDurationHours: b.flightHours,
        typicalStops: b.direct ? 0 : 1,
      },
      gradient: b.gradient,
      hasHero: false,
    };
    const base = TIER_BASE[b.tier];
    const fl = flightEstimate(b.flightHours, b.direct);
    const estimates: PriceEstimate[] = [
      { component: `Flights (2 pax, r/t${b.direct ? ", direct" : ""})`, ...fl, currency: "USD", confidence: "medium", status: "estimated", source: "internal_heuristic_v1", checkedAt: ISO_NOW },
      { component: "Lodging (7 nights, standard)", ...spread(base.lodging), currency: "USD", confidence: "medium", status: "estimated", source: "internal_heuristic_v1", checkedAt: ISO_NOW },
      { component: "Food (14 pax-days)",           ...spread(base.food),    currency: "USD", confidence: "medium", status: "estimated", source: "internal_heuristic_v1", checkedAt: ISO_NOW },
      { component: "Local transport",              ...spread(base.transport), currency: "USD", confidence: "medium", status: "estimated", source: "internal_heuristic_v1", checkedAt: ISO_NOW },
      { component: "Activities",                   ...spread(base.activities), currency: "USD", confidence: "medium", status: "estimated", source: "internal_heuristic_v1", checkedAt: ISO_NOW },
      { component: "Insurance (est.)",             min: 40, expected: 80, max: 120, currency: "USD", confidence: "medium", status: "estimated", source: "internal_heuristic_v1", checkedAt: ISO_NOW },
      { component: "Buffer (10%)",                 ...spread(base.buffer),  currency: "USD", confidence: "low",    status: "estimated", source: "internal_heuristic_v1", checkedAt: ISO_NOW },
    ];
    const t = total(estimates);
    return {
      ...seed,
      estimates,
      totalEstimate: { ...t, currency: "USD" },
    };
  });
}

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

const HAND_TUNED: DestinationCard[] = SEEDS.map((seed) => {
  const components = ESTIMATES[seed.id] ?? [];
  const t = total(components);
  return {
    ...seed,
    estimates: components,
    totalEstimate: { ...t, currency: "USD" },
  };
});

/**
 * Public list. Hand-tuned entries first (they own their airport heroes
 * and richer copy); everything else is expanded from the compact BULK spec.
 */
export const DESTINATIONS: DestinationCard[] = [
  ...HAND_TUNED,
  ...buildBulkSeeds(),
];

export function getDestination(id: string): DestinationCard | undefined {
  return DESTINATIONS.find((d) => d.id === id);
}
