/**
 * Provider factories. Each returns the real implementation when the
 * corresponding API key/service is present in env, otherwise the mock
 * (or null if the surface can gracefully degrade).
 *
 * The swap from mock → real happens at env-config time, not at every
 * call site.
 */

import { mockFlightProvider } from "./flights/mock";
import { fastFlightsProvider } from "./flights/fast-flights";
import type {
  EventsProvider,
  FlightProvider,
  HotelProvider,
  ImageProvider,
  PlacesProvider,
  WeatherProvider,
} from "./types";

export function flightProvider(): FlightProvider {
  // If FAST_FLIGHTS_BASE_URL is set, prefer the real scraper-backed
  // service. Falls through to mock on any transport error at call time.
  if (process.env.FAST_FLIGHTS_BASE_URL) {
    return fastFlightsProvider;
  }
  return mockFlightProvider;
}

export function placesProvider(): PlacesProvider | null {
  // Google Places wires up when GOOGLE_MAPS_API_KEY is present and
  // the "Places API (New)" is enabled on the project. Wired in a
  // follow-up iteration; returning null here means callers can render
  // "provider not configured" and keep the page usable.
  return null;
}

export function eventsProvider(): EventsProvider | null {
  return null;
}

export function hotelProvider(): HotelProvider | null {
  return null;
}

export function imageProvider(): ImageProvider | null {
  return null;
}

export function weatherProvider(): WeatherProvider | null {
  return null;
}
