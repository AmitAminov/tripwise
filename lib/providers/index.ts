/**
 * Provider factories. Each returns the real implementation when the
 * corresponding API key is present in env, otherwise the mock.
 *
 * This lets every downstream page call `flightProvider().search(...)`
 * uniformly; the swap from mock → real happens at env-config time,
 * not at every call site.
 */

import { mockFlightProvider } from "./flights/mock";
import type {
  EventsProvider,
  FlightProvider,
  HotelProvider,
  ImageProvider,
  PlacesProvider,
  WeatherProvider,
} from "./types";

export function flightProvider(): FlightProvider {
  // Real Duffel/Amadeus providers slot in here when DUFFEL_API_KEY /
  // AMADEUS_API_KEY are present. Until then, mock keeps the UI honest
  // and demoable.
  return mockFlightProvider;
}

export function placesProvider(): PlacesProvider | null {
  // Google Places wires up when GOOGLE_PLACES_API_KEY is present.
  return null;
}

export function eventsProvider(): EventsProvider | null {
  // Ticketmaster / PredictHQ.
  return null;
}

export function hotelProvider(): HotelProvider | null {
  // LiteAPI / RateHawk. Until then, use the seeded estimates baked
  // into data/destinations.ts.
  return null;
}

export function imageProvider(): ImageProvider | null {
  // Gemini Nano Banana.
  return null;
}

export function weatherProvider(): WeatherProvider | null {
  // Open-Meteo (free, no key). Wire on demand.
  return null;
}
