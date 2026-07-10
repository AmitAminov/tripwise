/**
 * Provider ports — the external world reached through a stable interface
 * so mock and real implementations are interchangeable and swappable per
 * the spec's provider-abstraction requirement.
 *
 * Every operation returns a `ProviderResult` so callers can render
 * status ("estimated" / "live_checked" / "cached" / "error") uniformly
 * without special-casing.
 */

import type { PriceEstimate } from "@/lib/types/trip-intent";

export type ProviderStatus =
  | "estimated"
  | "live_checked"
  | "cached"
  | "checking"
  | "unavailable"
  | "error";

export interface ProviderResult<T> {
  data: T | null;
  status: ProviderStatus;
  source: string;
  checkedAt: string;
  error?: string;
}

// ---------- Flights ----------

export interface FlightSearchQuery {
  originAirport: string;
  destinationAirport: string;
  departDate: string; // ISO
  returnDate?: string; // ISO
  adults: number;
  children?: number;
  cabinClass?: "economy" | "premium_economy" | "business" | "first";
  directOnly?: boolean;
  maxDurationHours?: number;
}

export interface FlightOffer {
  id: string;
  totalPriceUSD: number;
  currency: string;
  totalDurationMinutes: number;
  layoverCount: number;
  carriers: string[];
  outboundSegments: FlightSegment[];
  inboundSegments: FlightSegment[];
  bookingUrl?: string;
  baggageIncluded?: boolean;
  source: string;
  checkedAt: string;
}

export interface FlightSegment {
  from: string; // airport code
  to: string;
  departAt: string; // ISO datetime
  arriveAt: string; // ISO datetime
  carrier: string;
  flightNumber?: string;
  durationMinutes: number;
}

export interface FlightProvider {
  name: string;
  search(query: FlightSearchQuery): Promise<ProviderResult<FlightOffer[]>>;
}

// ---------- Places (attractions / restaurants) ----------

export interface Place {
  id: string;
  name: string;
  category: string;
  coords: { lat: number; lng: number };
  rating?: number;
  ratingCount?: number;
  priceLevel?: 0 | 1 | 2 | 3 | 4;
  photoUrl?: string;
  address?: string;
  openingHours?: string[];
  websiteUrl?: string;
}

export interface PlaceSearchQuery {
  center: { lat: number; lng: number };
  radiusMeters?: number;
  kind:
    | "attractions"
    | "restaurants"
    | "cafes"
    | "patisseries"
    | "wineries"
    | "bars"
    | "custom";
  keyword?: string;
  limit?: number;
  /**
   * When true, the provider prefers a text search over a nearby-radius
   * search. Use this for regional / country-wide destinations where
   * anything within a 50km circle around one anchor city misses the
   * whole rest of the region (e.g. "South Italy" → Puglia + Calabria).
   * `regionQuery` is the natural-language phrase Google sees.
   */
  regional?: boolean;
  regionQuery?: string;
  /**
   * Post-fetch address filter. When set, results whose
   * `formattedAddress` does NOT contain this string (case-insensitive)
   * are dropped. Required for regional text search — Google's index
   * can return places semantically related to the query but located
   * anywhere in the world (e.g. a Tel Aviv restaurant surfacing on a
   * "top restaurants in South Italy" search because its reviews
   * mention Italian cuisine). Pass the destination's country name.
   */
  countryFilter?: string;
  /**
   * Post-fetch half-space filter around the country's centroid. Used
   * when the destination has a cardinal-direction word ("south italy"
   * → south of Italy's centroid, "eastern japan" → east of Japan's
   * centroid). Places whose coords are on the wrong side of the
   * centroid axis get dropped. Country-wide entries and non-directional
   * destinations do not set this.
   */
  directionFilter?: {
    direction: "north" | "south" | "east" | "west";
    centroid: { lat: number; lng: number };
  };
}

export interface PlacesProvider {
  name: string;
  search(query: PlaceSearchQuery): Promise<ProviderResult<Place[]>>;
  detail(placeId: string): Promise<ProviderResult<Place>>;
}

// ---------- Events ----------

export interface EventItem {
  id: string;
  name: string;
  startAt: string; // ISO datetime
  endAt?: string;
  venueName?: string;
  city: string;
  coords?: { lat: number; lng: number };
  categories: string[];
  priceMinUSD?: number;
  ticketUrl?: string;
  source: string;
}

export interface EventSearchQuery {
  city: string;
  from: string; // ISO date
  to: string; // ISO date
  categories?: string[];
  keyword?: string;
  limit?: number;
}

export interface EventsProvider {
  name: string;
  search(query: EventSearchQuery): Promise<ProviderResult<EventItem[]>>;
}

// ---------- Hotels ----------

export interface HotelEstimate {
  destination: string;
  nights: number;
  perNight: PriceEstimate;
  areas?: HotelArea[];
}

export interface HotelArea {
  name: string;
  vibe: string;
  perNight: PriceEstimate;
  walkableTo?: string[];
}

export interface HotelEstimateQuery {
  destination: string;
  nights: number;
  comfortLevel: "budget" | "standard" | "premium" | "luxury";
  guests: number;
}

export interface HotelProvider {
  name: string;
  estimate(
    query: HotelEstimateQuery,
  ): Promise<ProviderResult<HotelEstimate>>;
}

// ---------- Images ----------

export type ImageAspect = "16:9" | "4:5" | "1:1" | "3:2";

export interface ImageGenerationQuery {
  prompt: string;
  aspect: ImageAspect;
  destinationId?: string;
  purpose: "destination_hero" | "trip_poster" | "attraction_fallback";
}

export interface GeneratedImage {
  url: string;
  aspect: ImageAspect;
  model: string;
  prompt: string;
  cacheKey: string;
  createdAt: string;
}

export interface ImageProvider {
  name: string;
  generate(
    query: ImageGenerationQuery,
  ): Promise<ProviderResult<GeneratedImage>>;
}

// ---------- Weather (small) ----------

export interface WeatherForecast {
  city: string;
  from: string;
  to: string;
  avgTempC: number;
  minTempC: number;
  maxTempC: number;
  rainDays: number;
  summary: string;
}

export interface WeatherProvider {
  name: string;
  forecast(
    lat: number,
    lng: number,
    from: string,
    to: string,
  ): Promise<ProviderResult<WeatherForecast>>;
}
